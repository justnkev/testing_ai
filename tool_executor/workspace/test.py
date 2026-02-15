# Test file for the Containerized Tool Executor
# This file can be used to verify the agent can read, modify, and run files.

def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}!"


def main():
    print(greet("World"))


if __name__ == "__main__":
    main()
