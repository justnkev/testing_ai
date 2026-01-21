"""
Tool definitions for Gemini function calling.

Defines FunctionDeclaration objects for:
- bash: Execute shell commands in Docker sandbox
- str_replace_editor: View, create, and edit files
"""

from google.genai import types


def get_bash_tool() -> types.FunctionDeclaration:
    """
    Create the bash tool declaration.
    
    This tool executes bash commands inside the secure Docker sandbox.
    Commands are validated against a security blocklist before execution.
    """
    return types.FunctionDeclaration(
        name="bash",
        description=(
            "Execute a bash command inside the secure Docker sandbox. "
            "Use this for running scripts, installing packages (within the sandbox), "
            "and performing system operations. The working directory is /workspace. "
            "Some dangerous commands (git push, rm -rf /, sudo, etc.) are blocked."
        ),
        parameters_json_schema={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": (
                        "The bash command to execute. Will run in /workspace directory. "
                        "For multi-line scripts, use && or ; to chain commands."
                    )
                }
            },
            "required": ["command"]
        }
    )


def get_str_replace_editor_tool() -> types.FunctionDeclaration:
    """
    Create the str_replace_editor tool declaration.
    
    This tool provides file viewing, creation, and precise string replacement
    functionality inspired by Anthropic's text_editor tool.
    """
    return types.FunctionDeclaration(
        name="str_replace_editor",
        description=(
            "View, create, or edit files using precise string replacement. "
            "All file paths are relative to /workspace. "
            "Commands: 'view' to read a file, 'create' to make a new file, "
            "'str_replace' to replace exact text in a file."
        ),
        parameters_json_schema={
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "enum": ["view", "create", "str_replace"],
                    "description": (
                        "The operation to perform: "
                        "'view' reads file contents, "
                        "'create' writes a new file, "
                        "'str_replace' replaces text in existing file."
                    )
                },
                "path": {
                    "type": "string",
                    "description": (
                        "Relative path to the file within /workspace. "
                        "Example: 'src/main.py' or 'test.txt'"
                    )
                },
                "file_text": {
                    "type": "string",
                    "description": (
                        "Full file content for 'create' command. "
                        "Ignored for other commands."
                    )
                },
                "old_str": {
                    "type": "string",
                    "description": (
                        "Exact text to find and replace for 'str_replace' command. "
                        "Must match exactly, including whitespace and indentation."
                    )
                },
                "new_str": {
                    "type": "string",
                    "description": (
                        "Replacement text for 'str_replace' command. "
                        "Can be empty to delete the old_str."
                    )
                },
                "view_range": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": (
                        "Optional [start_line, end_line] range for 'view' command. "
                        "If omitted, views entire file."
                    )
                }
            },
            "required": ["command", "path"]
        }
    )


def get_all_tools() -> list[types.Tool]:
    """
    Get all available tools wrapped in a Tool object.
    
    Returns:
        List containing a single Tool with all function declarations.
    """
    return [
        types.Tool(
            function_declarations=[
                get_bash_tool(),
                get_str_replace_editor_tool(),
            ]
        )
    ]


# Tool name constants for routing
TOOL_BASH = "bash"
TOOL_STR_REPLACE_EDITOR = "str_replace_editor"
