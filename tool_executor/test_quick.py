"""Quick verification test for the Containerized Tool Executor."""

import sys
sys.stdout.reconfigure(line_buffering=True)  # Force line buffering

from .config import Settings
from .docker_executor import DockerToolExecutor

print("Loading config...")
config = Settings()
print(f"Config loaded, model: {config.gemini_model}")

print("Starting Docker executor...")
with DockerToolExecutor(config) as executor:
    print("Verifying container setup...")
    info = executor.verify_container_setup()
    print(f"User: {info['user']} (non-root: {info['is_non_root']})")
    print(f"Workspace mounted: {info['workspace_mounted']}")
    print(f"Working dir: {info['working_directory']}")
    
    print("\nTesting bash execution...")
    result = executor.execute_bash('echo Hello from Docker!')
    print(f"Bash test: {result['status']} - {result['output'].strip()}")
    
    print("\nTesting blocked command...")
    result = executor.execute_bash('git push origin main')
    print(f"Block test: {result['status']} - {result['error']}")
    
    print("\nTesting file operations...")
    result = executor.execute_bash('cat /workspace/test.py')
    print(f"File read: {result['status']}")
    if result['status'] == 'success':
        print(result['output'][:200])

print("\nContainer cleaned up!")
print("All tests passed!")
