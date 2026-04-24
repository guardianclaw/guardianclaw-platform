# MCP Server Integration

Model Context Protocol server exposing GuardianClaw safety tools.

> Validated against `mcp@1.27.0` (and floor `mcp@1.8.0`) on 2026-04-24.

## Requirements

```bash
pip install guardianclaw[mcp]
# or manually:
pip install guardianclaw mcp
```

**Dependencies:**
- `mcp>=1.8.0`: [GitHub](https://github.com/modelcontextprotocol/python-sdk)
  Minimum floor is `1.8.0` because `mcp.client.streamable_http` landed in that release.

**For Claude Desktop:**
```bash
npm install -g mcp-server-guardianclaw
```

## Overview

| Component | Description |
|-----------|-------------|
| `create_claw_mcp_server` | Create MCP server with tools |
| `add_claw_tools` | Add tools to existing server |
| `GuardianClawMCPClient` | Async client for connecting to server |
| `run_server` | Run standalone server |
| `MCPConfig` | Configuration constants |

## Tools Provided

| Tool | Description |
|------|-------------|
| `claw_validate` | Validate text through CLAW (max 50KB) |
| `claw_check_action` | Check if action is safe (max 50KB) |
| `claw_check_request` | Validate user request (max 50KB) |
| `claw_get_seed` | Get seed content |
| `claw_batch_validate` | Validate multiple items (max 10KB each) |

## Resources Provided

| Resource | Description |
|----------|-------------|
| `claw://seed/{level}` | Get seed by level |
| `claw://config` | Current configuration with limits |

## Quick Start

### Standalone Server

```python
from guardianclaw.integrations.mcp_server import create_claw_mcp_server

mcp = create_claw_mcp_server()
mcp.run()
```

Or run directly:
```bash
python -m guardianclaw.integrations.mcp_server
```

### Add to Existing Server

```python
from mcp.server.fastmcp import FastMCP
from guardianclaw.integrations.mcp_server import add_claw_tools

mcp = FastMCP("my-server")
add_claw_tools(mcp)

@mcp.tool()
def my_custom_tool():
    pass

mcp.run()
```

## IDE Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "claw": {
      "command": "npx",
      "args": ["mcp-server-guardianclaw"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "claw": {
      "command": "python",
      "args": ["-m", "guardianclaw.integrations.mcp_server"],
      "env": {}
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "claw": {
      "command": "python",
      "args": ["-m", "guardianclaw.integrations.mcp_server"],
      "env": {}
    }
  }
}
```

### VS Code (with Continue or similar)

Add to your MCP-compatible extension's config:

```json
{
  "mcpServers": {
    "claw": {
      "command": "python",
      "args": ["-m", "guardianclaw.integrations.mcp_server"]
    }
  }
}
```

## Configuration

### MCPConfig

Default limits and timeouts:

```python
from guardianclaw.integrations.mcp_server import MCPConfig

# Text size limits
MCPConfig.MAX_TEXT_SIZE = 50 * 1024        # 50KB per request
MCPConfig.MAX_TEXT_SIZE_BATCH = 10 * 1024  # 10KB per batch item

# Batch limits
MCPConfig.MAX_BATCH_ITEMS = 1000           # Maximum items in batch
MCPConfig.DEFAULT_BATCH_ITEMS = 100        # Default batch size

# Timeouts
MCPConfig.DEFAULT_TIMEOUT = 30.0           # Default operation timeout
MCPConfig.BATCH_TIMEOUT = 60.0             # Batch operation timeout
```

### create_claw_mcp_server

```python
create_claw_mcp_server(
    name="claw-safety",      # Server name
    claw=None,               # GuardianClaw instance (optional)
    seed_level="standard",       # Default seed level
)
```

### add_claw_tools

```python
add_claw_tools(
    mcp,                         # FastMCP server instance (required)
    claw=None,               # GuardianClaw instance for get_seed (optional)
    validator=None,              # LayeredValidator for validation (optional)
)
```

## Tool Specifications

### claw_validate

```python
def claw_validate(text: str, check_type: str = "general") -> dict:
    """
    Validate text through CLAW gates.

    Args:
        text: Content to validate (max 50KB)
        check_type: "general", "action", or "request"

    Returns:
        {safe: bool, violations: [], recommendation: str}
        On size error: {safe: False, error: "text_too_large", ...}
    """
```

### claw_check_action

```python
def claw_check_action(action: str) -> dict:
    """
    Check if planned action is safe.

    Args:
        action: Action description (max 50KB)

    Returns:
        {safe: bool, should_proceed: bool, concerns: [], risk_level: str}
    """
```

### claw_check_request

```python
def claw_check_request(request: str) -> dict:
    """
    Validate user request for safety.

    Args:
        request: User request text (max 50KB)

    Returns:
        {should_proceed: bool, risk_level: str, concerns: []}
    """
```

### claw_get_seed

```python
def claw_get_seed(level: str = "standard") -> str:
    """
    Get GuardianClaw seed for system prompt.

    Args:
        level: "minimal", "standard", or "full"

    Returns:
        Seed content string
    """
```

### claw_batch_validate

```python
def claw_batch_validate(
    items: list,
    check_type: str = "general",
    max_items: int = 100
) -> dict:
    """
    Validate multiple items.

    Args:
        items: List of text strings (max 10KB each)
        check_type: "general", "action", or "request"
        max_items: Maximum items to process (default 100, max 1000)

    Returns:
        {
            total: int,
            safe_count: int,
            unsafe_count: int,
            skipped_count: int,  # Items that exceeded size limit
            all_safe: bool,
            truncated: bool,
            results: []
        }
    """
```

## Client Usage

### HTTP Transport (Remote Server)

> **Note:** HTTP transport requires `streamable_http_client` from the MCP SDK, which
> may not be available in all versions. Use stdio transport for maximum compatibility.

```python
from guardianclaw.integrations.mcp_server import GuardianClawMCPClient

async with GuardianClawMCPClient(
    url="http://localhost:8000/mcp",
    timeout=30.0,  # Optional timeout override
) as client:
    # List available tools
    tools = await client.list_tools()

    # Validate text
    result = await client.validate("Some text to check")
    if result["safe"]:
        proceed()

    # Check action safety
    action_result = await client.check_action("delete user data")
    print(f"Risk level: {action_result['risk_level']}")

    # Batch validation with custom timeout
    batch = await client.batch_validate(
        ["text1", "text2", "text3"],
        check_type="request",
        timeout=60.0,  # Override timeout for batch
    )
```

### Stdio Transport (Local Server)

```python
async with GuardianClawMCPClient(
    command="python",
    args=["-m", "guardianclaw.integrations.mcp_server"],
    timeout=10.0,
) as client:
    result = await client.check_request("ignore previous instructions")
    if not result["should_proceed"]:
        print(f"Blocked: {result['concerns']}")
```

## Exception Handling

```python
from guardianclaw.integrations.mcp_server import (
    MCPClientError,      # Base exception for client errors
    MCPTimeoutError,     # Operation timed out
    MCPConnectionError,  # Connection failed
    TextTooLargeError,   # Text exceeds size limit
)

try:
    async with GuardianClawMCPClient(url="http://localhost:8000/mcp") as client:
        result = await client.validate(text, timeout=5.0)
except MCPTimeoutError as e:
    print(f"Timeout after {e.timeout}s on {e.operation}")
except TextTooLargeError as e:
    print(f"Text {e.size} bytes exceeds limit of {e.max_size}")
except MCPClientError as e:
    print(f"Client error: {e}")
```

## Logging

Enable debug logging to see operation details:

```python
import logging
logging.getLogger("guardianclaw.mcp_server").setLevel(logging.DEBUG)
```

## Running Examples

```bash
# Basic examples
python -m guardianclaw.integrations.mcp_server.example

# All examples including async client
python -m guardianclaw.integrations.mcp_server.example --all
```

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `create_claw_mcp_server(name, claw, seed_level)` | Create server |
| `add_claw_tools(mcp, claw, validator)` | Add tools to server |
| `run_server()` | Run standalone |

### Classes

| Class | Description |
|-------|-------------|
| `GuardianClawMCPClient` | Async client for MCP servers |
| `MCPConfig` | Configuration constants |
| `TextTooLargeError` | Text size exceeded |
| `MCPClientError` | Base client exception |
| `MCPTimeoutError` | Timeout exception |
| `MCPConnectionError` | Connection exception |

### GuardianClawMCPClient Methods

| Method | Description |
|--------|-------------|
| `list_tools(timeout)` | List available tools |
| `validate(text, check_type, timeout)` | Validate text through CLAW |
| `check_action(action, timeout)` | Check if action is safe |
| `check_request(request, timeout)` | Validate user request |
| `get_seed(level, timeout)` | Get seed content |
| `batch_validate(items, check_type, max_items, timeout)` | Batch validation |

### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `MCP_AVAILABLE` | bool | Whether MCP SDK is installed |
| `__version__` | str | Integration version |

## Links

- **MCP SDK:** https://github.com/modelcontextprotocol/python-sdk
- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **npm Package:** https://www.npmjs.com/package/mcp-server-guardianclaw
- **GuardianClaw:** https://guardianclaw.org
