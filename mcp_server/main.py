#!/usr/bin/env python3
"""
GitHub PR Manager MCP Server - Main Entry Point

Run this file to start the MCP server:
    python mcp_server/main.py

The server communicates via stdio and can be connected to by MCP clients
such as the MCP Inspector or AI agents.

Environment Variables:
    GITHUB_PERSONAL_ACCESS_TOKEN: Required. Your GitHub personal access token
                                   with 'repo' scope for private repositories.
"""

from mcp_server.server import main

if __name__ == "__main__":
    main()
