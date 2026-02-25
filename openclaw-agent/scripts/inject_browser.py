import sys
import re

def inject_browser(content):
    # 1. Inject Browser Service
    browser_service = """
  browser:
    image: ghcr.io/browserless/chromium:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      - "MAX_CONCURRENT_SESSIONS=10"
"""
    # Check if browser service already exists
    if "image: ghcr.io/browserless/chromium" not in content:
        # Append to end of services (simplified approach: append to file, assuming indentation matches 'services' children)
        # Better: Find the indent of the first service and match it.
        # But 'services:' is usually at top level.
        pass 
        
    # We will parse the file structurally to be safe
    lines = content.split('\n')
    new_lines = []
    
    in_gateway = False
    in_gateway_env = False
    gateway_indent = ""
    env_indent = ""
    
    browser_injected = False
    gateway_env_injected = False
    
    # Simple state machine to find places to inject
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # Detect openclaw-gateway service
        if line.strip().startswith('openclaw-gateway:'):
            in_gateway = True
            gateway_indent = line.split('openclaw-gateway:')[0]
            
        # Detect environment block in gateway
        if in_gateway and line.strip().startswith('environment:'):
            in_gateway_env = True
            env_indent = line.split('environment:')[0] + "  " # Assume 2 space indent increase
            
        # Inject env var if we are in gateway env and leaving it (or at end of block)
        # This is tricky without a yaml parser. 
        # Easier strategy: Replace "environment:" with "environment:\n      BROWSER_WS_ENDPOINT: ws://browser:3000"
        
    # Let's try a regex replacement for the gateway environment
    # Look for 'environment:' inside 'openclaw-gateway:' block
    
    # 1. Add BROWSER_WS_ENDPOINT
    if 'BROWSER_WS_ENDPOINT' not in content:
        # Find environment: under openclaw-gateway
        # We need to be careful not to match other services
        pattern = r"(openclaw-gateway:[\s\S]*?environment:)"
        replacement = r"\1\n      BROWSER_WS_ENDPOINT: ws://browser:3000"
        content = re.sub(pattern, replacement, content, count=1)
        
    # 2. Add depends_on
    if 'depends_on:' not in content and 'browser' not in content:
         pattern = r"(openclaw-gateway:[\s\S]*?restart: unless-stopped)"
         replacement = r"\1\n    depends_on:\n      - browser"
         content = re.sub(pattern, replacement, content, count=1)

    # 3. Add Browser Service
    if 'image: ghcr.io/browserless/chromium' not in content:
        # Append to end of services
        # We assume 'services:' is at the top.
        # We'll valid yaml by appending to the end with '  ' indentation
        content += browser_service

    return content

if __name__ == "__main__":
    input_file = sys.argv[1]
    with open(input_file, 'r') as f:
        content = f.read()
    
    new_content = inject_browser(content)
    
    with open(input_file, 'w') as f:
        f.write(new_content)
    
    print("Successfully injected browser configuration.")
