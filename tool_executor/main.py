#!/usr/bin/env python3
"""
Containerized Tool Executor - Main Entry Point

A Gemini-powered AI agent that executes bash commands and file operations
inside a secure Docker sandbox.

Usage:
    python -m tool_executor.main
    
Or:
    cd tool_executor
    python main.py
"""

import logging
import sys

from colorama import Fore, Style, init as colorama_init

from .config import Settings
from .docker_executor import DockerToolExecutor
from .orchestrator import Orchestrator

# Initialize colorama
colorama_init()


def print_banner() -> None:
    """Print the startup banner."""
    banner = f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════════╗
║         Containerized Tool Executor Engine                   ║
║         Powered by Gemini + Docker Sandbox                   ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
"""
    print(banner)


def print_verification(info: dict) -> None:
    """Print container verification results."""
    print(f"\n{Fore.YELLOW}Container Security Verification:{Style.RESET_ALL}")
    
    # User check
    user_status = f"{Fore.GREEN}✓{Style.RESET_ALL}" if info["is_non_root"] else f"{Fore.RED}✗{Style.RESET_ALL}"
    print(f"  {user_status} Running as: {info['user']} {'(non-root)' if info['is_non_root'] else '(ROOT - WARNING!)'}")
    
    # Workspace mount check
    mount_status = f"{Fore.GREEN}✓{Style.RESET_ALL}" if info["workspace_mounted"] else f"{Fore.RED}✗{Style.RESET_ALL}"
    print(f"  {mount_status} Workspace mounted: {info['workspace_mounted']}")
    
    # Working directory
    print(f"  {Fore.GREEN}✓{Style.RESET_ALL} Working directory: {info['working_directory']}")
    
    print()


def print_help() -> None:
    """Print help information."""
    help_text = f"""
{Fore.YELLOW}Commands:{Style.RESET_ALL}
  Type your prompt to interact with the AI agent.
  
  Special commands:
    {Fore.CYAN}exit{Style.RESET_ALL}, {Fore.CYAN}quit{Style.RESET_ALL}  - Exit the program
    {Fore.CYAN}clear{Style.RESET_ALL}         - Clear conversation history
    {Fore.CYAN}help{Style.RESET_ALL}          - Show this help message

{Fore.YELLOW}Examples:{Style.RESET_ALL}
  > Create a Python file that prints "Hello World" and run it
  > List all files in the workspace
  > Read the contents of test.py and add error handling
"""
    print(help_text)


def main() -> int:
    """Main entry point."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    
    print_banner()
    
    # Load configuration
    try:
        config = Settings()
        print(f"{Fore.GREEN}✓{Style.RESET_ALL} Configuration loaded")
        print(f"  Model: {config.gemini_model}")
        print(f"  Workspace: {config.workspace_path}")
        print(f"  Docker Image: {config.docker_image}")
    except Exception as e:
        print(f"{Fore.RED}✗ Configuration error: {e}{Style.RESET_ALL}")
        print(f"\n{Fore.YELLOW}Hint: Create a .env file with GOOGLE_API_KEY=your-key{Style.RESET_ALL}")
        return 1
    
    # Start Docker container
    print(f"\n{Fore.CYAN}Starting Docker sandbox...{Style.RESET_ALL}")
    
    try:
        with DockerToolExecutor(config) as executor:
            # Verify container setup
            verification = executor.verify_container_setup()
            print_verification(verification)
            
            if not verification["is_non_root"]:
                print(f"{Fore.RED}WARNING: Container is running as root!{Style.RESET_ALL}")
            
            # Create orchestrator
            orchestrator = Orchestrator(executor, config)
            
            print_help()
            print(f"{Fore.GREEN}Ready! Type your prompt below.{Style.RESET_ALL}\n")
            
            # Main interaction loop
            while True:
                try:
                    # Get user input
                    prompt = input(f"{Fore.WHITE}You: {Style.RESET_ALL}").strip()
                    
                    if not prompt:
                        continue
                    
                    # Handle special commands
                    if prompt.lower() in ("exit", "quit"):
                        print(f"\n{Fore.CYAN}Goodbye!{Style.RESET_ALL}")
                        break
                    
                    if prompt.lower() == "clear":
                        orchestrator.clear_history()
                        continue
                    
                    if prompt.lower() == "help":
                        print_help()
                        continue
                    
                    # Run the orchestrator
                    orchestrator.run(prompt)
                    print()  # Extra newline for readability
                    
                except KeyboardInterrupt:
                    print(f"\n\n{Fore.CYAN}Interrupted. Cleaning up...{Style.RESET_ALL}")
                    break
                    
    except RuntimeError as e:
        print(f"\n{Fore.RED}✗ Docker error: {e}{Style.RESET_ALL}")
        print(f"\n{Fore.YELLOW}Hint: Make sure Docker Desktop is running.{Style.RESET_ALL}")
        return 1
    
    except Exception as e:
        print(f"\n{Fore.RED}✗ Unexpected error: {e}{Style.RESET_ALL}")
        logging.exception("Unexpected error")
        return 1
    
    print(f"{Fore.GREEN}Container cleaned up successfully.{Style.RESET_ALL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
