"""
MCP Server for Docker Sandbox Execution

Provides bash and str_replace_editor tools that execute inside a secure
Docker container. Inspired by Anthropic's computer-use skills.
"""

import asyncio
import atexit
import json
import logging
import os
import re
import signal
import sys
from pathlib import Path
from typing import Any

import docker
import mcp.server.stdio
import mcp.types as types
from docker.models.containers import Container
from docker.errors import DockerException, ImageNotFound, APIError
from mcp.server.lowlevel import Server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create MCP server instance
mcp_server = Server("docker-sandbox")

# =============================================================================
# Security Configuration
# =============================================================================

BLOCKED_COMMAND_PATTERNS: list[tuple[str, str]] = [
    (r"git\s+push", "git push commands are not allowed"),
    (r"git\s+remote\s+add", "adding git remotes is not allowed"),
    (r"git\s+remote\s+set-url", "modifying git remotes is not allowed"),
    (r"rm\s+-rf\s+/(?!\s|$)", "recursive deletion of root paths is not allowed"),
    (r"rm\s+-rf\s+~", "recursive deletion of home directory is not allowed"),
    (r"rm\s+-rf\s+\.\.", "recursive deletion of parent directories is not allowed"),
    (r"rm\s+-rf\s+\.git", "deletion of .git directory is not allowed"),
    (r"\bsudo\b", "sudo commands are not allowed"),
    (r"\bsu\s+-", "switching users is not allowed"),
    (r"docker\s+run", "running nested containers is not allowed"),
    (r"nsenter", "namespace entering is not allowed"),
]

_COMPILED_PATTERNS = [
    (re.compile(pattern, re.IGNORECASE), message)
    for pattern, message in BLOCKED_COMMAND_PATTERNS
]


def validate_command(command: str) -> tuple[bool, str | None]:
    """Validate a bash command against the security blocklist."""
    if not command or not command.strip():
        return False, "Empty command"
    
    for pattern, message in _COMPILED_PATTERNS:
        if pattern.search(command):
            return False, f"Blocked: {message}"
    
    return True, None


def validate_file_path(path: str) -> tuple[bool, str | None]:
    """Validate a file path to prevent directory traversal."""
    if not path:
        return False, "Empty path"
    
    normalized = path.replace("\\", "/")
    
    if ".." in normalized:
        return False, "Path traversal (..) is not allowed"
    
    if normalized.startswith("/") and not normalized.startswith("/workspace"):
        return False, "Absolute paths must be within /workspace"
    
    return True, None


# =============================================================================
# Docker Container Management
# =============================================================================

class DockerSandbox:
    """Manages a persistent Docker container for command execution."""
    
    def __init__(self):
        self.client: docker.DockerClient | None = None
        self.container: Container | None = None
        self.workspace_path = Path(os.environ.get(
            "SANDBOX_WORKSPACE", 
            "./sandbox_workspace"
        )).resolve()
        self.docker_image = os.environ.get("SANDBOX_IMAGE", "python:3.11-slim")
        self.container_user = "appuser"
        self.container_uid = 1000
        self.container_gid = 1000
    
    def ensure_running(self) -> None:
        """Ensure the Docker container is running."""
        if self.container is not None:
            try:
                self.container.reload()
                if self.container.status == "running":
                    return
            except Exception:
                self.container = None
        
        self._start_container()
    
    def _start_container(self) -> None:
        """Start a new Docker container."""
        try:
            self.client = docker.from_env()
            self.client.ping()
        except DockerException as e:
            raise RuntimeError(
                "Failed to connect to Docker. Is Docker Desktop running?"
            ) from e
        
        # Ensure workspace exists
        self.workspace_path.mkdir(parents=True, exist_ok=True)
        
        # Ensure image is available
        try:
            self.client.images.get(self.docker_image)
        except ImageNotFound:
            logger.info(f"Pulling image: {self.docker_image}")
            self.client.images.pull(self.docker_image)
        
        # Create container
        self.container = self.client.containers.run(
            image=self.docker_image,
            command="tail -f /dev/null",
            detach=True,
            remove=False,
            working_dir="/workspace",
            volumes={
                str(self.workspace_path): {
                    "bind": "/workspace",
                    "mode": "rw"
                }
            },
            environment={},
            mem_limit="512m",
            cpu_period=100000,
            cpu_quota=50000,
        )
        
        logger.info(f"Created container: {self.container.short_id}")
        
        # Setup non-root user
        self._setup_user()
    
    def _setup_user(self) -> None:
        """Create non-root user inside the container."""
        if not self.container:
            return
        
        setup_commands = [
            f"groupadd -g {self.container_gid} {self.container_user} 2>/dev/null || true",
            f"useradd -u {self.container_uid} -g {self.container_gid} -m {self.container_user} 2>/dev/null || true",
            f"chown -R {self.container_uid}:{self.container_gid} /workspace",
        ]
        
        for cmd in setup_commands:
            self.container.exec_run(cmd=["sh", "-c", cmd], user="root")
        
        logger.info(f"Container user setup complete: {self.container_user}")
    
    def execute_bash(self, command: str) -> dict[str, Any]:
        """Execute a bash command in the container."""
        self.ensure_running()
        
        is_safe, error = validate_command(command)
        if not is_safe:
            return {
                "status": "error",
                "output": "",
                "exit_code": None,
                "error": error,
            }
        
        try:
            result = self.container.exec_run(
                cmd=["bash", "-c", command],
                user=self.container_user,
                workdir="/workspace",
                demux=True,
            )
            
            stdout = result.output[0].decode() if result.output[0] else ""
            stderr = result.output[1].decode() if result.output[1] else ""
            
            combined = stdout
            if stderr:
                combined += f"\n[stderr]: {stderr}" if stdout else stderr
            
            # Truncate very long output
            if len(combined) > 10000:
                combined = combined[:10000] + "\n... [truncated]"
            
            return {
                "status": "success" if result.exit_code == 0 else "error",
                "output": combined,
                "exit_code": result.exit_code,
                "error": stderr if result.exit_code != 0 else None,
            }
            
        except APIError as e:
            return {
                "status": "error",
                "output": "",
                "exit_code": None,
                "error": f"Docker API error: {str(e)}",
            }
    
    def view_file(self, path: str, view_range: list[int] | None = None) -> dict[str, Any]:
        """Read file contents."""
        is_safe, error = validate_file_path(path)
        if not is_safe:
            return {"status": "error", "output": "", "error": error}
        
        full_path = f"/workspace/{path}" if not path.startswith("/workspace") else path
        
        if view_range and len(view_range) == 2:
            cmd = f"sed -n '{view_range[0]},{view_range[1]}p' '{full_path}'"
        else:
            cmd = f"cat '{full_path}'"
        
        result = self.execute_bash(cmd)
        
        if result["status"] == "success":
            lines = result["output"].split("\n")
            start = view_range[0] if view_range else 1
            numbered = "\n".join(f"{start + i:4d} | {line}" for i, line in enumerate(lines))
            result["output"] = numbered
        
        return result
    
    def create_file(self, path: str, content: str) -> dict[str, Any]:
        """Create a new file with content."""
        is_safe, error = validate_file_path(path)
        if not is_safe:
            return {"status": "error", "output": "", "error": error}
        
        full_path = f"/workspace/{path}" if not path.startswith("/workspace") else path
        
        # Create parent directories
        dir_path = "/".join(full_path.split("/")[:-1])
        if dir_path:
            self.execute_bash(f"mkdir -p '{dir_path}'")
        
        # Write file using heredoc
        cmd = f"cat > '{full_path}' << 'EOFMARKER'\n{content}\nEOFMARKER"
        result = self.execute_bash(cmd)
        
        if result["status"] == "success":
            result["output"] = f"Created file: {path}"
        
        return result
    
    def str_replace(self, path: str, old_str: str, new_str: str) -> dict[str, Any]:
        """Replace text in a file."""
        is_safe, error = validate_file_path(path)
        if not is_safe:
            return {"status": "error", "output": "", "error": error}
        
        if not old_str:
            return {"status": "error", "output": "", "error": "old_str is required"}
        
        full_path = f"/workspace/{path}" if not path.startswith("/workspace") else path
        
        # Read file
        read_result = self.execute_bash(f"cat '{full_path}'")
        if read_result["status"] == "error":
            return read_result
        
        content = read_result["output"]
        
        if old_str not in content:
            return {
                "status": "error",
                "output": "",
                "error": f"Could not find exact match for old_str in {path}",
            }
        
        new_content = content.replace(old_str, new_str, 1)
        return self.create_file(path, new_content)
    
    def cleanup(self) -> None:
        """Stop and remove the container."""
        if self.container:
            try:
                self.container.stop(timeout=5)
                self.container.remove(v=True)
                logger.info(f"Removed container: {self.container.short_id}")
            except Exception as e:
                logger.warning(f"Cleanup error: {e}")
            finally:
                self.container = None
        
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
            finally:
                self.client = None


# Global sandbox instance
_sandbox: DockerSandbox | None = None


def get_sandbox() -> DockerSandbox:
    """Get or create the Docker sandbox."""
    global _sandbox
    if _sandbox is None:
        _sandbox = DockerSandbox()
        atexit.register(_sandbox.cleanup)
    return _sandbox


def format_response(data: dict[str, Any]) -> list[types.TextContent]:
    """Format response as JSON for LLM parsing."""
    return [
        types.TextContent(
            type="text",
            text=json.dumps(data, indent=2, default=str)
        )
    ]


# =============================================================================
# MCP Tool Definitions
# =============================================================================

@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """Return the list of available sandbox tools."""
    return [
        types.Tool(
            name="sandbox_bash",
            description=(
                "Execute a bash command inside a secure Docker sandbox. "
                "Use this for running scripts, installing packages (within the sandbox), "
                "file operations, and system commands. Working directory is /workspace. "
                "Some dangerous commands (git push, sudo, rm -rf /) are blocked. "
                "The sandbox persists between calls so variables and files are retained."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": (
                            "The bash command to execute. Runs in /workspace directory. "
                            "Chain commands with && or ;. Example: 'python script.py'"
                        )
                    }
                },
                "required": ["command"]
            }
        ),
        types.Tool(
            name="sandbox_file_editor",
            description=(
                "View, create, or edit files in the Docker sandbox using precise string replacement. "
                "All paths are relative to /workspace. "
                "Commands: 'view' reads a file, 'create' writes a new file, "
                "'str_replace' replaces exact text in an existing file."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "enum": ["view", "create", "str_replace"],
                        "description": "The operation: 'view', 'create', or 'str_replace'"
                    },
                    "path": {
                        "type": "string",
                        "description": "Relative path within /workspace (e.g., 'src/main.py')"
                    },
                    "file_text": {
                        "type": "string",
                        "description": "Content for 'create' command"
                    },
                    "old_str": {
                        "type": "string",
                        "description": "Exact text to find for 'str_replace'"
                    },
                    "new_str": {
                        "type": "string",
                        "description": "Replacement text for 'str_replace'"
                    },
                    "view_range": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "Optional [start, end] line range for 'view'"
                    }
                },
                "required": ["command", "path"]
            }
        ),
        types.Tool(
            name="sandbox_status",
            description=(
                "Check the status of the Docker sandbox container. "
                "Returns information about the running user, workspace mount, "
                "and working directory. Use this to verify the sandbox is working."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        ),
    ]


@mcp_server.call_tool()
async def handle_tool_call(
    name: str,
    arguments: dict[str, Any]
) -> list[types.TextContent]:
    """Route tool calls to sandbox methods."""
    logger.info(f"Tool called: {name} with args: {arguments}")
    
    try:
        sandbox = get_sandbox()
        
        if name == "sandbox_bash":
            result = sandbox.execute_bash(arguments.get("command", ""))
        
        elif name == "sandbox_file_editor":
            cmd = arguments.get("command")
            path = arguments.get("path", "")
            
            if cmd == "view":
                result = sandbox.view_file(path, arguments.get("view_range"))
            elif cmd == "create":
                result = sandbox.create_file(path, arguments.get("file_text", ""))
            elif cmd == "str_replace":
                result = sandbox.str_replace(
                    path,
                    arguments.get("old_str", ""),
                    arguments.get("new_str", ""),
                )
            else:
                result = {"status": "error", "error": f"Unknown command: {cmd}"}
        
        elif name == "sandbox_status":
            sandbox.ensure_running()
            
            user_result = sandbox.container.exec_run("whoami", user=sandbox.container_user)
            mount_result = sandbox.container.exec_run(
                ["sh", "-c", "mount | grep workspace || echo 'not found'"],
                user=sandbox.container_user
            )
            pwd_result = sandbox.container.exec_run("pwd", user=sandbox.container_user)
            
            current_user = user_result.output.decode().strip()
            
            result = {
                "status": "success",
                "container_id": sandbox.container.short_id,
                "user": current_user,
                "is_non_root": current_user != "root",
                "workspace_mounted": "/workspace" in mount_result.output.decode(),
                "working_directory": pwd_result.output.decode().strip(),
                "workspace_path": str(sandbox.workspace_path),
            }
        
        else:
            result = {"status": "error", "error": f"Unknown tool: {name}"}
        
        return format_response(result)
    
    except Exception as e:
        logger.exception(f"Error in tool {name}")
        return format_response({
            "status": "error",
            "error": f"Execution error: {str(e)}"
        })


# =============================================================================
# Server Entry Point
# =============================================================================

async def run_server():
    """Start the MCP server using stdio transport."""
    logger.info("Starting Docker Sandbox MCP server...")
    
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await mcp_server.run(
            read_stream,
            write_stream,
            mcp_server.create_initialization_options()
        )


def main():
    """Entry point."""
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
