"""
Entry point for running GuardianClaw MCP Server as a module.

Usage:
    python -m guardianclaw.integrations.mcp_server
"""

from guardianclaw.integrations.mcp_server import run_server

if __name__ == "__main__":
    run_server()
