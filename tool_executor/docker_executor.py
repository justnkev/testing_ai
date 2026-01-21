"""
Docker Tool Executor module.

Manages a persistent Docker container for secure tool execution.
Provides methods for bash command execution and file operations.
"""

import atexit
import logging
from pathlib import Path
from typing import Any, TypedDict

import docker
from docker.models.containers import Container
from docker.errors import DockerException, ImageNotFound, APIError

from .config import Settings
from .security import validate_command, validate_file_path, sanitize_output

logger = logging.getLogger(__name__)


class ExecutionResult(TypedDict):
    """Structured result from tool execution."""
    status: str  # "success" or "error"
    output: str
    exit_code: int | None
    error: str | None


class ContainerSetupInfo(TypedDict):
    """Container verification information."""
    user: str
    is_non_root: bool
    workspace_mounted: bool
    working_directory: str


class DockerToolExecutor:
    """
    Manages a Docker container for secure tool execution.
    
    Features:
    - Runs as non-root user inside container
    - Mounts only the workspace directory
    - Provides bash execution and file operations
    - Automatic cleanup on exit
    
    Usage:
        with DockerToolExecutor(settings) as executor:
            result = executor.execute_bash("echo hello")
    """
    
    def __init__(self, config: Settings):
        """
        Initialize the Docker executor.
        
        Args:
            config: Application settings.
        """
        self.config = config
        self.client: docker.DockerClient | None = None
        self.container: Container | None = None
        self._setup_complete = False
    
    def __enter__(self) -> "DockerToolExecutor":
        """Start the Docker container."""
        self._connect()
        self._create_container()
        self._setup_container_user()
        self._setup_complete = True
        
        # Register cleanup on exit
        atexit.register(self._cleanup)
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Stop and remove the Docker container."""
        self._cleanup()
        atexit.unregister(self._cleanup)
    
    def _connect(self) -> None:
        """Connect to Docker daemon."""
        try:
            self.client = docker.from_env()
            self.client.ping()
            logger.info("Connected to Docker daemon")
        except DockerException as e:
            raise RuntimeError(
                "Failed to connect to Docker. Is Docker Desktop running?"
            ) from e
    
    def _create_container(self) -> None:
        """Create and start the sandbox container."""
        if not self.client:
            raise RuntimeError("Docker client not initialized")
        
        # Ensure image is available
        try:
            self.client.images.get(self.config.docker_image)
            logger.info(f"Using image: {self.config.docker_image}")
        except ImageNotFound:
            logger.info(f"Pulling image: {self.config.docker_image}")
            self.client.images.pull(self.config.docker_image)
        
        # Create container with security settings
        workspace_abs = str(self.config.workspace_path.absolute())
        
        self.container = self.client.containers.run(
            image=self.config.docker_image,
            command="tail -f /dev/null",  # Keep container running
            detach=True,
            remove=False,  # We'll remove manually for cleanup
            working_dir="/workspace",
            volumes={
                workspace_abs: {
                    "bind": "/workspace",
                    "mode": "rw"
                }
            },
            # Security: don't pass API key to container by default
            # It's only needed by the host Python process
            environment={},
            # Resource limits
            mem_limit="512m",
            cpu_period=100000,
            cpu_quota=50000,  # 50% CPU
        )
        
        logger.info(f"Created container: {self.container.short_id}")
    
    def _setup_container_user(self) -> None:
        """Create non-root user inside the container."""
        if not self.container:
            raise RuntimeError("Container not created")
        
        user = self.config.container_user
        uid = self.config.container_uid
        gid = self.config.container_gid
        
        # Create group and user (run as root initially for setup)
        setup_commands = [
            f"groupadd -g {gid} {user} 2>/dev/null || true",
            f"useradd -u {uid} -g {gid} -m {user} 2>/dev/null || true",
            f"chown -R {uid}:{gid} /workspace",
        ]
        
        for cmd in setup_commands:
            result = self.container.exec_run(
                cmd=["sh", "-c", cmd],
                user="root",
            )
            if result.exit_code != 0:
                logger.warning(f"Setup command warning: {cmd} -> {result.output.decode()}")
        
        logger.info(f"Container user setup complete: {user} (uid={uid})")
    
    def verify_container_setup(self) -> ContainerSetupInfo:
        """
        Verify the container security configuration.
        
        Returns:
            ContainerSetupInfo with verification results.
        """
        if not self.container:
            raise RuntimeError("Container not created")
        
        user = self.config.container_user
        
        # Check current user
        user_result = self.container.exec_run(
            cmd=["whoami"],
            user=user,
        )
        current_user = user_result.output.decode().strip()
        
        # Check mount points
        mount_result = self.container.exec_run(
            cmd=["sh", "-c", "mount | grep workspace || echo 'not found'"],
            user=user,
        )
        workspace_mounted = "/workspace" in mount_result.output.decode()
        
        # Check working directory
        pwd_result = self.container.exec_run(
            cmd=["pwd"],
            user=user,
        )
        working_dir = pwd_result.output.decode().strip()
        
        return ContainerSetupInfo(
            user=current_user,
            is_non_root=current_user != "root",
            workspace_mounted=workspace_mounted,
            working_directory=working_dir,
        )
    
    def execute_bash(self, command: str) -> ExecutionResult:
        """
        Execute a bash command inside the container.
        
        Args:
            command: The bash command to execute.
            
        Returns:
            ExecutionResult with status, output, and exit code.
        """
        if not self.container:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error="Container not running",
            )
        
        # Validate command against security blocklist
        validation = validate_command(command)
        if not validation.is_safe:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=validation.error_message,
            )
        
        try:
            result = self.container.exec_run(
                cmd=["bash", "-c", command],
                user=self.config.container_user,
                workdir="/workspace",
                demux=True,  # Separate stdout/stderr
            )
            
            stdout = result.output[0].decode() if result.output[0] else ""
            stderr = result.output[1].decode() if result.output[1] else ""
            
            # Combine output, prioritizing stdout
            combined_output = stdout
            if stderr:
                combined_output += f"\n[stderr]: {stderr}" if stdout else stderr
            
            return ExecutionResult(
                status="success" if result.exit_code == 0 else "error",
                output=sanitize_output(combined_output),
                exit_code=result.exit_code,
                error=stderr if result.exit_code != 0 else None,
            )
            
        except APIError as e:
            logger.error(f"Docker API error: {e}")
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=f"Docker API error: {str(e)}",
            )
    
    def execute_editor(self, args: dict[str, Any]) -> ExecutionResult:
        """
        Execute a file editor operation.
        
        Args:
            args: Dictionary with command, path, and other parameters.
            
        Returns:
            ExecutionResult with operation outcome.
        """
        command = args.get("command")
        path = args.get("path", "")
        
        # Validate path
        validation = validate_file_path(path)
        if not validation.is_safe:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=validation.error_message,
            )
        
        # Normalize path to be relative to workspace
        if path.startswith("/workspace/"):
            path = path[len("/workspace/"):]
        elif path.startswith("/"):
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error="Absolute paths outside /workspace are not allowed",
            )
        
        full_path = f"/workspace/{path}"
        
        if command == "view":
            return self._view_file(full_path, args.get("view_range"))
        elif command == "create":
            return self._create_file(full_path, args.get("file_text", ""))
        elif command == "str_replace":
            return self._str_replace(
                full_path,
                args.get("old_str", ""),
                args.get("new_str", ""),
            )
        else:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=f"Unknown editor command: {command}",
            )
    
    def _view_file(
        self, 
        path: str, 
        view_range: list[int] | None = None
    ) -> ExecutionResult:
        """View file contents, optionally with line range."""
        if view_range and len(view_range) == 2:
            start, end = view_range
            cmd = f"sed -n '{start},{end}p' '{path}'"
        else:
            cmd = f"cat '{path}'"
        
        result = self.execute_bash(cmd)
        
        if result["status"] == "success":
            # Add line numbers for context
            lines = result["output"].split("\n")
            start_line = view_range[0] if view_range else 1
            numbered = "\n".join(
                f"{start_line + i:4d} | {line}" 
                for i, line in enumerate(lines)
            )
            result["output"] = numbered
        
        return result
    
    def _create_file(self, path: str, content: str) -> ExecutionResult:
        """Create a new file with the given content."""
        # Ensure parent directory exists
        dir_path = "/".join(path.split("/")[:-1])
        if dir_path:
            mkdir_result = self.execute_bash(f"mkdir -p '{dir_path}'")
            if mkdir_result["status"] == "error":
                return mkdir_result
        
        # Use heredoc to write content safely
        # Escape single quotes in content
        escaped_content = content.replace("'", "'\"'\"'")
        cmd = f"cat > '{path}' << 'EOFMARKER'\n{content}\nEOFMARKER"
        
        result = self.execute_bash(cmd)
        
        if result["status"] == "success":
            result["output"] = f"Created file: {path}"
        
        return result
    
    def _str_replace(
        self, 
        path: str, 
        old_str: str, 
        new_str: str
    ) -> ExecutionResult:
        """Replace exact text in a file."""
        if not old_str:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error="old_str is required for str_replace",
            )
        
        # First, verify the old_str exists in the file
        check_cmd = f"grep -F '{old_str[:50]}' '{path}' > /dev/null 2>&1 && echo 'found' || echo 'not found'"
        check_result = self.execute_bash(check_cmd)
        
        if "not found" in check_result["output"]:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=f"Could not find the specified text in {path}. Ensure old_str matches exactly.",
            )
        
        # Read the file
        read_result = self.execute_bash(f"cat '{path}'")
        if read_result["status"] == "error":
            return read_result
        
        # Perform replacement in Python (more reliable than sed for complex strings)
        original_content = read_result["output"]
        
        # Remove line number prefixes if present from _view_file
        lines = original_content.split("\n")
        clean_lines = []
        for line in lines:
            if " | " in line[:8]:
                clean_lines.append(line.split(" | ", 1)[1] if " | " in line else line)
            else:
                clean_lines.append(line)
        original_content = "\n".join(clean_lines)
        
        if old_str not in original_content:
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=f"Could not find exact match for old_str in {path}",
            )
        
        new_content = original_content.replace(old_str, new_str, 1)
        
        # Write back
        return self._create_file(path, new_content)
    
    def _cleanup(self) -> None:
        """Stop and remove the container."""
        if self.container:
            try:
                self.container.stop(timeout=5)
                self.container.remove(v=True)  # Remove volumes too
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
