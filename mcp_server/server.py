"""
MCP Server for GitHub PR Management

Registers tools for PR diff retrieval, code review submission,
CI status checking, and PR merging via the Model Context Protocol.
"""

import asyncio
import json
import logging
from typing import Any

import mcp.server.stdio
import mcp.types as types
from mcp.server.lowlevel import Server

from .github_client import (
    AuthenticationError,
    GitHubClient,
    GitHubClientError,
    RateLimitError,
)
from .vercel_client import VercelClient, VercelClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create MCP server instance
mcp_server = Server("github-pr-manager")

# Global GitHub client (initialized lazily)
# Global GitHub client (initialized lazily)
_github_client: GitHubClient | None = None
_vercel_client: VercelClient | None = None


def get_github_client() -> GitHubClient:
    """Get or initialize the GitHub client singleton."""
    global _github_client
    if _github_client is None:
        _github_client = GitHubClient()
    return _github_client


def get_vercel_client() -> VercelClient:
    """Get or initialize the Vercel client singleton."""
    global _vercel_client
    if _vercel_client is None:
        _vercel_client = VercelClient()
    return _vercel_client


def format_response(data: dict[str, Any]) -> list[types.TextContent]:
    """Format response data as structured JSON for LLM parsing."""
    return [
        types.TextContent(
            type="text",
            text=json.dumps(data, indent=2, default=str)
        )
    ]


@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    """
    Return the list of available PR management tools.
    
    Each tool has a detailed description that helps LLMs understand
    when and how to use them.
    """
    return [
        types.Tool(
            name="get_pr_diff",
            description=(
                "Fetches the raw diff of a GitHub Pull Request for code analysis. "
                "Use this to review what changes a PR introduces before approving or "
                "requesting changes. Returns the diff text along with statistics "
                "(files changed, lines added/deleted)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_name": {
                        "type": "string",
                        "description": "Full repository name in 'owner/repo' format (e.g., 'facebook/react')"
                    },
                    "pr_number": {
                        "type": "integer",
                        "description": "Pull Request number"
                    }
                },
                "required": ["repo_name", "pr_number"]
            }
        ),
        types.Tool(
            name="submit_pr_review",
            description=(
                "Submits a formal code review on a GitHub Pull Request. "
                "Can APPROVE the PR, REQUEST_CHANGES with feedback, or leave a COMMENT. "
                "Optionally include inline comments on specific files and lines. "
                "Use after analyzing a PR diff to provide structured feedback."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_name": {
                        "type": "string",
                        "description": "Full repository name in 'owner/repo' format"
                    },
                    "pr_number": {
                        "type": "integer",
                        "description": "Pull Request number"
                    },
                    "event": {
                        "type": "string",
                        "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT"],
                        "description": "Review action: APPROVE, REQUEST_CHANGES, or COMMENT"
                    },
                    "body": {
                        "type": "string",
                        "description": "Main review comment text explaining your overall feedback"
                    },
                    "comments": {
                        "type": "array",
                        "description": "Optional inline comments on specific code locations",
                        "items": {
                            "type": "object",
                            "properties": {
                                "path": {
                                    "type": "string",
                                    "description": "File path relative to repo root"
                                },
                                "line": {
                                    "type": "integer",
                                    "description": "Line number in the file"
                                },
                                "body": {
                                    "type": "string",
                                    "description": "Comment text for this specific line"
                                }
                            },
                            "required": ["path", "line", "body"]
                        }
                    }
                },
                "required": ["repo_name", "pr_number", "event", "body"]
            }
        ),
        types.Tool(
            name="get_ci_status",
            description=(
                "Checks the GitHub Actions / Check Runs CI/CD status for a branch. "
                "Use this to verify if tests have passed before merging a PR. "
                "Returns overall status (success, failure, pending) and details of "
                "each check run. If checks are pending, includes a suggested retry interval."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_name": {
                        "type": "string",
                        "description": "Full repository name in 'owner/repo' format"
                    },
                    "branch_name": {
                        "type": "string",
                        "description": "Branch name to check CI status for (e.g., 'feature/new-login')"
                    }
                },
                "required": ["repo_name", "branch_name"]
            }
        ),
        types.Tool(
            name="merge_pr",
            description=(
                "Merges a Pull Request if all criteria are met. "
                "Checks for merge conflicts and PR state before attempting merge. "
                "Supports three merge methods: 'merge' (merge commit), 'squash' "
                "(squash and merge), or 'rebase' (rebase and merge). "
                "Use after confirming CI passes and code review is approved."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "repo_name": {
                        "type": "string",
                        "description": "Full repository name in 'owner/repo' format"
                    },
                    "pr_number": {
                        "type": "integer",
                        "description": "Pull Request number"
                    },
                    "merge_method": {
                        "type": "string",
                        "enum": ["merge", "squash", "rebase"],
                        "default": "merge",
                        "description": "How to merge: 'merge', 'squash', or 'rebase'"
                    }
                },
                "required": ["repo_name", "pr_number"]
            }
        ),
        types.Tool(
            name="get_vercel_build_logs",
            description=(
                "Fetches the build logs for a specific Vercel deployment. "
                "Use this to debug failed deployments or check build progress. "
                "Returns the last 150 lines of relevant build events (stdout/stderr)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "deployment_id": {
                        "type": "string",
                        "description": "The deployment ID (e.g., dpl_...) or URL"
                    },
                    "team_id": {
                        "type": "string",
                        "description": "Optional Team ID if the project belongs to a team"
                    }
                },
                "required": ["deployment_id"]
            }
        ),
        types.Tool(
            name="list_vercel_deployments",
            description="List recent Vercel deployments for a project.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id_or_name": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                    "team_id": {"type": "string"}
                },
                "required": ["project_id_or_name"]
            }
        ),
        types.Tool(
            name="get_vercel_deployment_details",
            description="Get metadata for a specific Vercel deployment.",
            inputSchema={
                "type": "object",
                "properties": {
                    "deployment_id": {"type": "string"},
                    "team_id": {"type": "string"}
                },
                "required": ["deployment_id"]
            }
        ),
        types.Tool(
            name="set_vercel_env_var",
            description="Set or update a Vercel environment variable.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "key": {"type": "string"},
                    "value": {"type": "string"},
                    "target": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["production", "preview", "development"]}
                    },
                    "team_id": {"type": "string"}
                },
                "required": ["project_id", "key", "value", "target"]
            }
        )
    ]


@mcp_server.call_tool()
async def handle_tool_call(
    name: str, 
    arguments: dict[str, Any]
) -> list[types.TextContent]:
    """
    Route tool calls to appropriate GitHub client methods.
    
    All responses are returned as structured JSON for easy LLM parsing.
    Handles authentication errors, rate limiting, and API failures gracefully.
    """
    logger.info(f"Tool called: {name} with arguments: {arguments}")
    
    try:
        client = get_github_client()
        
        if name == "get_pr_diff":
            result = client.get_pr_diff(
                repo_name=arguments["repo_name"],
                pr_number=arguments["pr_number"]
            )
        
        elif name == "submit_pr_review":
            result = client.submit_pr_review(
                repo_name=arguments["repo_name"],
                pr_number=arguments["pr_number"],
                event=arguments["event"],
                body=arguments["body"],
                comments=arguments.get("comments")
            )
        
        elif name == "get_ci_status":
            result = client.get_ci_status(
                repo_name=arguments["repo_name"],
                branch_name=arguments["branch_name"]
            )
        
        elif name == "merge_pr":
            result = client.merge_pr(
                repo_name=arguments["repo_name"],
                pr_number=arguments["pr_number"],
                merge_method=arguments.get("merge_method", "merge")
            )
        
        elif name == "get_vercel_build_logs":
            client = get_vercel_client()
            logs = await client.get_build_logs(
                deployment_id=arguments["deployment_id"],
                team_id=arguments.get("team_id")
            )
            result = {"logs": logs}
        
        elif name == "list_vercel_deployments":
            client = get_vercel_client()
            deployments = await client.list_deployments(
                project_id_or_name=arguments["project_id_or_name"],
                limit=arguments.get("limit", 5),
                team_id=arguments.get("team_id")
            )
            result = {"deployments": deployments}

        elif name == "get_vercel_deployment_details":
            client = get_vercel_client()
            details = await client.get_deployment_details(
                deployment_id=arguments["deployment_id"],
                team_id=arguments.get("team_id")
            )
            result = {"details": details}

        elif name == "set_vercel_env_var":
            client = get_vercel_client()
            env_var = await client.set_env_var(
                project_id=arguments["project_id"],
                key=arguments["key"],
                value=arguments["value"],
                target=arguments["target"],
                team_id=arguments.get("team_id")
            )
            result = {"env_var": env_var}
        
        else:
            result = {
                "status": "error",
                "message": f"Unknown tool: {name}"
            }
        
        return format_response(result)
    
    except AuthenticationError as e:
        logger.error(f"Authentication error: {e}")
        return format_response({
            "status": "error",
            "error_type": "authentication",
            "message": str(e)
        })
    
    except RateLimitError as e:
        logger.warning(f"Rate limit error: {e}")
        return format_response({
            "status": "error",
            "error_type": "rate_limit",
            "message": str(e),
            "reset_time": e.reset_time.isoformat()
        })
    
    except GitHubClientError as e:
        logger.error(f"GitHub client error: {e}")
        return format_response({
            "status": "error",
            "error_type": "github_client",
            "message": str(e)
        })
    
    except Exception as e:
        logger.exception(f"Unexpected error in tool {name}")
        return format_response({
            "status": "error",
            "error_type": "unexpected",
            "message": f"Unexpected error: {str(e)}"
        })


async def run_server():
    """Start the MCP server using stdio transport."""
    logger.info("Starting GitHub PR Manager MCP server...")
    
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await mcp_server.run(
            read_stream,
            write_stream,
            mcp_server.create_initialization_options()
        )


def main():
    """Entry point for the MCP server."""
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
