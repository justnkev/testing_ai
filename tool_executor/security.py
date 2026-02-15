"""
Security module for command validation and blocklist enforcement.

Prevents execution of dangerous commands that could:
- Push to remote git repositories
- Delete sensitive directories
- Escape the sandbox
"""

import re
from typing import NamedTuple


class ValidationResult(NamedTuple):
    """Result of command validation."""
    is_safe: bool
    error_message: str | None = None


# Blocked command patterns with descriptions
BLOCKED_PATTERNS: list[tuple[str, str]] = [
    # Git remote operations
    (r"git\s+push", "git push commands are not allowed"),
    (r"git\s+remote\s+add", "adding git remotes is not allowed"),
    (r"git\s+remote\s+set-url", "modifying git remotes is not allowed"),
    
    # Dangerous deletions
    (r"rm\s+-rf\s+/(?!\s|$)", "recursive deletion of root paths is not allowed"),
    (r"rm\s+-rf\s+~", "recursive deletion of home directory is not allowed"),
    (r"rm\s+-rf\s+\.\.", "recursive deletion of parent directories is not allowed"),
    (r"rm\s+-rf\s+\.git", "deletion of .git directory is not allowed"),
    
    # Privilege escalation
    (r"\bsudo\b", "sudo commands are not allowed"),
    (r"\bsu\s+-", "switching users is not allowed"),
    (r"\bchmod\s+[0-7]*777", "setting 777 permissions is not allowed"),
    
    # Network exfiltration
    (r"\bcurl\b.*\|\s*bash", "piping curl to bash is not allowed"),
    (r"\bwget\b.*\|\s*bash", "piping wget to bash is not allowed"),
    
    # Container escape attempts
    (r"/proc/\d+/root", "accessing process roots is not allowed"),
    (r"docker\s+run", "running nested containers is not allowed"),
    (r"nsenter", "namespace entering is not allowed"),
]

# Compiled patterns for performance
_COMPILED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(pattern, re.IGNORECASE), message)
    for pattern, message in BLOCKED_PATTERNS
]


def validate_command(command: str) -> ValidationResult:
    """
    Validate a bash command against the security blocklist.
    
    Args:
        command: The bash command to validate.
        
    Returns:
        ValidationResult with is_safe=True if command is allowed,
        or is_safe=False with an error_message if blocked.
    """
    if not command or not command.strip():
        return ValidationResult(is_safe=False, error_message="Empty command")
    
    for pattern, message in _COMPILED_PATTERNS:
        if pattern.search(command):
            return ValidationResult(
                is_safe=False,
                error_message=f"Blocked: {message}"
            )
    
    return ValidationResult(is_safe=True)


def validate_file_path(path: str, workspace_root: str = "/workspace") -> ValidationResult:
    """
    Validate a file path to prevent directory traversal attacks.
    
    Args:
        path: The file path to validate.
        workspace_root: The allowed root directory.
        
    Returns:
        ValidationResult indicating if the path is safe.
    """
    if not path:
        return ValidationResult(is_safe=False, error_message="Empty path")
    
    # Normalize the path
    normalized = path.replace("\\", "/")
    
    # Check for obvious traversal attempts
    if ".." in normalized:
        return ValidationResult(
            is_safe=False,
            error_message="Path traversal (..) is not allowed"
        )
    
    # Check for absolute paths outside workspace
    if normalized.startswith("/") and not normalized.startswith(workspace_root):
        return ValidationResult(
            is_safe=False,
            error_message=f"Absolute paths must be within {workspace_root}"
        )
    
    # Check for sensitive files
    sensitive_patterns = [
        r"\.env",
        r"\.git/",
        r"id_rsa",
        r"\.ssh/",
        r"\.aws/",
        r"credentials",
    ]
    
    for pattern in sensitive_patterns:
        if re.search(pattern, normalized, re.IGNORECASE):
            return ValidationResult(
                is_safe=False,
                error_message=f"Access to sensitive files matching '{pattern}' is not allowed"
            )
    
    return ValidationResult(is_safe=True)


def sanitize_output(output: str, max_length: int = 10000) -> str:
    """
    Sanitize command output for safe display.
    
    Args:
        output: Raw command output.
        max_length: Maximum output length before truncation.
        
    Returns:
        Sanitized output string.
    """
    if len(output) > max_length:
        return output[:max_length] + f"\n... [truncated, {len(output) - max_length} more bytes]"
    return output
