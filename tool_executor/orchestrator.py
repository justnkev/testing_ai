"""
Orchestrator module for the Containerized Tool Executor.

Manages the conversation loop between user, Gemini model, and Docker tools.
Handles function calling, rate limiting, and colorized output.
"""

import logging
import time
from typing import Any

from colorama import Fore, Style, init as colorama_init
from google import genai
from google.genai import types
from google.api_core.exceptions import ResourceExhausted

from .config import Settings
from .docker_executor import DockerToolExecutor, ExecutionResult
from .tools import get_all_tools, TOOL_BASH, TOOL_STR_REPLACE_EDITOR, TOOL_VALIDATE_WORK
from .validator import run_validation

from memory_engine import MemoryCompressor, MarkdownMemoryStorage

# Initialize colorama for Windows compatibility
colorama_init()

logger = logging.getLogger(__name__)


class Orchestrator:
    """
    Main orchestrator for the Gemini-powered tool executor.
    
    Manages:
    - Gemini API client and conversation history
    - Tool routing to DockerToolExecutor
    - Rate limit handling with exponential backoff
    - Colorized console output
    """
    
    def __init__(self, executor: DockerToolExecutor, config: Settings):
        """
        Initialize the orchestrator.
        
        Args:
            executor: Docker executor for tool execution.
            config: Application settings.
        """
        self.executor = executor
        self.config = config
        self.client = genai.Client(api_key=config.api_key)
        self.history: list[types.Content] = []
        self.tools = get_all_tools()

        # Memory compression engine
        import pathlib
        memory_path = pathlib.Path(config.workspace_path) / "project_memory.md"
        self.memory = MemoryCompressor(
            client=self.client,
            storage=MarkdownMemoryStorage(memory_path),
            threshold=100_000,
            model_name=config.gemini_model,
        )
        
        # System instruction for the model
        self.system_instruction = """You are an AI assistant with access to a secure Docker sandbox.
You can execute bash commands and edit files within the /workspace directory.

Available tools:
1. **bash**: Execute shell commands. The working directory is /workspace.
2. **str_replace_editor**: View, create, or edit files using precise string replacement.
3. **validate_work**: Run automated quality checks (lint, type-check, tests) on the workspace.

Guidelines:
- Always check file contents before editing to ensure accurate replacements.
- Use relative paths from /workspace (e.g., "src/main.py" not "/workspace/src/main.py").
- For multi-step tasks, execute one command at a time and verify results.
- Some dangerous commands (git push, sudo, rm -rf /) are blocked for security.
- **IMPORTANT**: Before declaring any task complete, you MUST call `validate_work`
  to run automated checks. If any check fails, fix the issues and re-validate.

When solving problems:
1. Understand the task completely
2. Break it into steps
3. Execute each step and verify
4. Call validate_work to run quality checks
5. Fix any issues found
6. Report the outcome clearly
"""
    
    def print_status(self, message: str, status: str = "info") -> None:
        """Print a colorized status message."""
        colors = {
            "info": Fore.CYAN,
            "success": Fore.GREEN,
            "error": Fore.RED,
            "warning": Fore.YELLOW,
            "tool": Fore.MAGENTA,
        }
        color = colors.get(status, Fore.WHITE)
        print(f"{color}{message}{Style.RESET_ALL}")
    
    def print_tool_call(self, name: str, args: dict[str, Any]) -> None:
        """Print a formatted tool call."""
        print(f"\n{Fore.MAGENTA}┌─ Tool Call: {name}{Style.RESET_ALL}")
        for key, value in args.items():
            # Truncate long values
            str_value = str(value)
            if len(str_value) > 100:
                str_value = str_value[:100] + "..."
            print(f"{Fore.MAGENTA}│{Style.RESET_ALL} {key}: {str_value}")
        print(f"{Fore.MAGENTA}└─{Style.RESET_ALL}")
    
    def print_tool_result(self, result: ExecutionResult) -> None:
        """Print a formatted tool result."""
        status_color = Fore.GREEN if result["status"] == "success" else Fore.RED
        print(f"\n{status_color}┌─ Result ({result['status']}){Style.RESET_ALL}")
        
        if result["output"]:
            for line in result["output"].split("\n")[:20]:  # Limit lines
                print(f"{status_color}│{Style.RESET_ALL} {line}")
            if result["output"].count("\n") > 20:
                print(f"{status_color}│{Style.RESET_ALL} ... (output truncated)")
        
        if result["error"]:
            print(f"{Fore.RED}│ Error: {result['error']}{Style.RESET_ALL}")
        
        print(f"{status_color}└─{Style.RESET_ALL}")
    
    def print_assistant_response(self, text: str) -> None:
        """Print the assistant's text response."""
        print(f"\n{Fore.BLUE}Assistant:{Style.RESET_ALL}")
        print(text)
    
    def run(self, user_prompt: str) -> str | None:
        """
        Run a single turn of the conversation.
        
        Args:
            user_prompt: The user's input message.
            
        Returns:
            The assistant's final text response, or None if only tool calls.
        """
        # Add user message to history
        user_content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_prompt)],
        )
        self.history.append(user_content)

        # Compress history if token threshold exceeded
        self.history = self.memory.check_and_compress(self.history)
        
        # Generate response with retry logic
        response = self._generate_with_retry()
        
        if not response:
            return None
        
        # Process response - may involve multiple tool call rounds
        final_text = self._process_response(response)
        
        return final_text
    
    def _generate_with_retry(self) -> types.GenerateContentResponse | None:
        """Generate content with exponential backoff for rate limits."""
        backoff = self.config.base_backoff_seconds
        
        for attempt in range(self.config.max_retries + 1):
            try:
                # Build system prompt with persisted memory prefix
                effective_prompt = self.memory.build_system_prompt(
                    self.system_instruction
                )
                response = self.client.models.generate_content(
                    model=self.config.gemini_model,
                    contents=self.history,
                    config=types.GenerateContentConfig(
                        tools=self.tools,
                        system_instruction=effective_prompt,
                    ),
                )
                return response
                
            except ResourceExhausted as e:
                if attempt < self.config.max_retries:
                    self.print_status(
                        f"Rate limited. Waiting {backoff:.1f}s before retry...",
                        "warning"
                    )
                    time.sleep(backoff)
                    backoff *= 2  # Exponential backoff
                else:
                    self.print_status(
                        f"Rate limit exceeded after {self.config.max_retries} retries",
                        "error"
                    )
                    raise
            
            except Exception as e:
                self.print_status(f"API error: {e}", "error")
                raise
        
        return None
    
    def _process_response(
        self, 
        response: types.GenerateContentResponse
    ) -> str | None:
        """
        Process model response, handling function calls recursively.
        
        Returns:
            Final text response after all tool calls are complete.
        """
        # Check for function calls
        if response.function_calls:
            # Add assistant's response with function calls to history
            self.history.append(response.candidates[0].content)
            
            # Execute each function call
            function_responses: list[types.Part] = []
            
            for call in response.function_calls:
                self.print_tool_call(call.name, dict(call.args))
                
                # Execute the tool
                result = self._execute_tool(call.name, dict(call.args))
                self.print_tool_result(result)
                
                # Create function response part
                function_response = types.Part.from_function_response(
                    name=call.name,
                    response={
                        "status": result["status"],
                        "output": result["output"],
                        "error": result["error"],
                    },
                )
                function_responses.append(function_response)
            
            # Add function responses to history
            tool_response_content = types.Content(
                role="tool",
                parts=function_responses,
            )
            self.history.append(tool_response_content)
            
            # Continue the conversation
            next_response = self._generate_with_retry()
            if next_response:
                return self._process_response(next_response)
            return None
        
        # No function calls - extract text response
        if response.text:
            self.history.append(response.candidates[0].content)
            self.print_assistant_response(response.text)
            return response.text
        
        return None
    
    def _execute_tool(self, name: str, args: dict[str, Any]) -> ExecutionResult:
        """
        Route tool call to appropriate executor method.
        
        Args:
            name: Tool name.
            args: Tool arguments.
            
        Returns:
            ExecutionResult from the tool.
        """
        try:
            if name == TOOL_BASH:
                command = args.get("command", "")
                return self.executor.execute_bash(command)
            
            elif name == TOOL_STR_REPLACE_EDITOR:
                return self.executor.execute_editor(args)
            
            elif name == TOOL_VALIDATE_WORK:
                project_type = args.get("project_type", None)
                report = run_validation(self.executor, project_type=project_type)
                return ExecutionResult(
                    status="success" if report.overall_pass else "error",
                    output=report.to_json(),
                    exit_code=0 if report.overall_pass else 1,
                    error=None if report.overall_pass else report.summary,
                )
            
            else:
                return ExecutionResult(
                    status="error",
                    output="",
                    exit_code=None,
                    error=f"Unknown tool: {name}",
                )
                
        except Exception as e:
            logger.exception(f"Tool execution error: {e}")
            return ExecutionResult(
                status="error",
                output="",
                exit_code=None,
                error=f"Execution error: {str(e)}",
            )
    
    def clear_history(self) -> None:
        """Clear the conversation history."""
        self.history.clear()
        self.print_status("Conversation history cleared", "info")
