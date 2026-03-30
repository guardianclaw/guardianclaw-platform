# GuardianClaw Runtime

Serverless Python runtime for GuardianClaw Platform agent execution.

## Overview

This package provides the execution runtime for agents built with the GuardianClaw Platform visual builder. It executes agent flows with integrated GuardianClaw protection for input/output validation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       claw RUNTIME                           │
│                                                                  │
│  ┌────────────┐    ┌────────────┐    ┌────────────────────────┐ │
│  │ FlowParser │───►│  Executor  │───►│  Modal.com Function    │ │
│  └────────────┘    └────────────┘    └────────────────────────┘ │
│        │                 │                      │               │
│        │                 │                      │               │
│        ▼                 ▼                      ▼               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   GuardianClawAdapter (ADR-004)                 │ │
│  │  ─────────────────────────────────────────────────────────  │
│  │  validate_input(text) → Gate 1 (Heuristic)                  │
│  │  validate_output(output, input) → Gates 2 + 3               │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│                    ClawValidator (SDK v3.0)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install dependencies
pip install -e .

# For Modal.com deployment
pip install modal
modal setup
```

## Usage

### Local Execution

```python
from claw_runtime import AgentExecutor

# Define flow from visual builder
flow = {
    "nodes": [...],
    "edges": [...]
}

# Create executor
executor = AgentExecutor(
    flow=flow,
    llm_config={
        "provider": "openai",
        "model": "gpt-4o-mini",
        "temperature": 0.7,
    },
    claw_config={
        "protection_level": "standard",  # minimal, standard, maximum
    },
)

# Execute
result = executor.run("Hello, how can you help?")

if result["blocked"]:
    print(f"Blocked by {result['gate']}: {result['reason']}")
else:
    print(f"Response: {result['response']}")
```

### Modal.com Deployment

```bash
# Deploy to Modal.com
modal deploy -m claw_runtime.main

# Run health check (SDK)
modal run claw_runtime.main::health_check

# Test locally (SDK)
modal run claw_runtime.main
```

#### Windows: Encoding Issues

If deploying from a Windows path with special characters (accents, non-ASCII), Modal CLI may fail with:

```
'charmap' codec can't encode character '\u2713'
```

**Workaround:** Copy to a path without special characters before deploy:

```bash
# Copy to temp directory
cp -r packages/runtime /c/temp/claw-runtime

# Deploy from clean path
cd /c/temp/claw-runtime
modal deploy -m claw_runtime.main
```

This is a Modal CLI limitation on Windows with non-UTF8 console encoding.

### Web Endpoints (HTTP)

After deployment, these HTTP endpoints are available:

| Endpoint | Method | URL |
|----------|--------|-----|
| Health | GET | `https://guardian-claw--claw-runtime-health-web.modal.run` |
| Execute Agent | POST | `https://guardian-claw--claw-runtime-execute-agent-web.modal.run` |
| Validate Input | POST | `https://guardian-claw--claw-runtime-validate-input-web.modal.run` |
| Validate Output | POST | `https://guardian-claw--claw-runtime-validate-output-web.modal.run` |

#### Test Web Endpoints

```bash
# Install test dependencies
pip install httpx

# Run test script
python scripts/test_web_endpoints.py

# With LLM API key (to test execute endpoint)
python scripts/test_web_endpoints.py sk-your-openai-key
```

#### Example: cURL

```bash
# Health check
curl https://guardian-claw--claw-runtime-health-web.modal.run

# Validate input
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, how can you help?", "claw_config": {"protection_level": "standard"}}' \
  https://guardian-claw--claw-runtime-validate-input-web.modal.run

# Execute agent
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "flow": {"nodes": [...], "edges": [...]},
    "input_text": "What is 2 + 2?",
    "llm_config": {"provider": "openai", "model": "gpt-4o-mini"},
    "claw_config": {"protection_level": "standard"},
    "llm_api_key": "sk-..."
  }' \
  https://guardian-claw--claw-runtime-execute-agent-web.modal.run
```

### API Integration

```typescript
// From Cloudflare Worker
const result = await callModalRuntime({
    flow: agent.flow,
    input_text: userMessage,
    llm_config: agent.config,
    claw_config: agent.claw_config,
});
```

## Configuration

### LLM Config

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| provider | string | "openai" | LLM provider (openai, anthropic, openrouter) |
| model | string | "gpt-4o-mini" | Model identifier |
| temperature | float | 0.7 | Sampling temperature |
| max_tokens | int | 2048 | Maximum response tokens |
| system_prompt | string | - | Custom system prompt |

### GuardianClaw Config

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| protection_level | string | "standard" | Preset: minimal, standard, maximum |
| gate1_enabled | bool | true | Enable input validation |
| gate2_enabled | bool | true | Enable output validation |
| gate3_enabled | bool | false | Enable LLM observer |
| fail_closed | bool | false | Block on errors |

### Protection Levels

- **minimal**: Fast, heuristic-only validation
- **standard**: Heuristic + embedding validation
- **maximum**: All gates including LLM observer (Gate 3)

## Modal.com Secrets

Configure these secrets in the Modal dashboard:

```
llm-keys:
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...
  OPENROUTER_API_KEY=sk-or-...
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy claw_runtime

# Linting
ruff check claw_runtime
```

## ADR-004 Compliance

This runtime implements the SDK Abstraction Layer (ADR-004) for transparent SDK version migration:

- `GuardianClawAdapter`: Unified interface to GuardianClaw SDK
- Configuration mapping from runtime config to ClawConfig
- Result normalization to standard ValidationResultDict
- Statistics aggregation across validations

## Supported Integrations

| Category | Frameworks | Status |
|----------|-----------|--------|
| AI Frameworks | OpenAI Agents SDK, Anthropic SDK, Google ADK | Supported |
| Crypto | Coinbase AgentKit, Solana Agent Kit | Supported |
| Secondary | Google ADK, Virtuals Protocol (GAME) | Supported |
| Robotics | ROS2, NVIDIA Isaac Lab | Not Supported |

### Note on Robotics

Robotics integrations (ROS2, Isaac Lab) are **not supported** and will not be implemented.
CLAW validation is designed for text-based AI interactions, not real-time motion control.

For robotics applications:
- Use CLAW at the planning/command level only
- Implement certified safety systems (ISO 13849, IEC 62443) for motion control
- Do not rely on software-only guardrails for physical safety

## License

MIT License - GuardianClaw Team
