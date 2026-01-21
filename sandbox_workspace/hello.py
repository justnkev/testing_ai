#!/usr/bin/env python3
"""Demo script created by Antigravity in the Docker sandbox."""

import platform
import os

def main():
    print("=" * 50)
    print("Hello from the Docker Sandbox!")
    print("=" * 50)
    print(f"Python version: {platform.python_version()}")
    print(f"OS: {platform.system()} {platform.release()}")
    print(f"User: {os.getenv('USER', 'unknown')}")
    print(f"Working directory: {os.getcwd()}")
    print()
    print("Files in workspace:")
    for f in os.listdir('.'):
        print(f"  - {f}")

if __name__ == "__main__":
    main()

