# GuardianClaw AI Safety - JetBrains Plugin

AI safety guardrails for LLM prompts using the CLAW protocol (Credibility, Limits, Avoidance, Worth).

[![Build Status](https://github.com/guardianclaw/guardianclaw-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/guardianclaw/guardianclaw-platform/actions)
[![JetBrains Plugin](https://img.shields.io/badge/JetBrains-Plugin-blue)](https://plugins.jetbrains.com/plugin/29459-claw-ai-safety)
[![Version](https://img.shields.io/badge/version-0.3.0-green)](CHANGELOG.md)

## Features

### Core Safety Analysis
- **CLAW Protocol**: Four-gate validation system
  - Credibility Gate: Detects deception and misinformation
  - Avoidance Gate: Identifies potential harm
  - Limits Gate: Checks boundary violations
  - Worth Gate: Validates legitimate purpose
- **Real-time Analysis**: Analyze code and prompts for safety issues
- **Semantic Analysis**: Optional LLM-powered deep analysis (OpenAI/Anthropic/Ollama)
- **Seed Insertion**: Insert alignment seeds into your prompts

### Security Scanning (New in v0.3.0)
- **Scan Secrets**: Detect exposed API keys, passwords, tokens (67+ patterns)
- **Sanitize Prompts**: Identify prompt injection attempts
- **Validate Output**: Check LLM outputs for XSS, command injection, leaked secrets
- **SQL Injection Detection**: 8 categories of SQL injection patterns

### Compliance Checking (New in v0.3.0)
- **EU AI Act**: Articles 5, 6, 52 - Prohibited practices, high-risk systems, transparency
- **OWASP LLM Top 10**: LLM01-LLM10 vulnerability detection
- **CSA AI Controls Matrix**: Model security, data governance, supply chain risks

### Metrics Dashboard (New in v0.3.0)
- Track analysis history and trends
- Security scan statistics
- Compliance check metrics
- Persistent storage across sessions

## Installation

### From JetBrains Marketplace

1. Open your JetBrains IDE (IntelliJ IDEA, PyCharm, WebStorm, etc.)
2. Go to **Settings → Plugins → Marketplace**
3. Search for "GuardianClaw AI Safety"
4. Click **Install**

Or visit: https://plugins.jetbrains.com/plugin/29459-claw-ai-safety

### From Disk

1. Download the `.zip` from [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/29459-claw-ai-safety) or build from source
2. Go to **Settings → Plugins → ⚙️ → Install Plugin from Disk**
3. Select the downloaded `.zip` file

> **Note:** The plugin is available on the JetBrains Marketplace. Building from source requires the full repository clone.

## Usage

### Security Scanning

Right-click selected text or use **Tools → GuardianClaw**:

| Action | Description |
|--------|-------------|
| **Scan Secrets** | Detect exposed API keys, passwords, tokens |
| **Sanitize Prompt** | Identify prompt injection attempts |
| **Validate Output** | Check for XSS, command injection, leaked secrets |
| **Scan SQL Injection** | Detect SQL injection patterns |

### Compliance Checking

Right-click selected text or use **Tools → GuardianClaw**:

| Action | Description |
|--------|-------------|
| **Check OWASP LLM Top 10** | Scan for OWASP vulnerabilities |
| **Check EU AI Act** | Verify EU AI Act compliance |
| **Check CSA AICM** | Validate against CSA controls |
| **Full Compliance Check** | Run all compliance frameworks |

### Metrics Dashboard

- **Show Metrics**: View analysis statistics
- **Clear Metrics**: Reset all metrics data

### CLAW Analysis

1. Select text in the editor
2. Press `Ctrl+Shift+Alt+S` or right-click → **GuardianClaw → Analyze Selection**
3. View results in the GuardianClaw tool window

### Insert Seeds

1. Place cursor where you want to insert
2. Use **Tools → GuardianClaw → Insert Standard/Minimal Seed**

## Configuration

Go to **Settings → Tools → GuardianClaw AI Safety**

### Supported Providers

| Provider | API Key Required | Description |
|----------|------------------|-------------|
| **OpenAI** | Yes | GPT-4o, GPT-4o-mini |
| **Anthropic** | Yes | Claude 3 Haiku, Sonnet, Opus |
| **Ollama** | No | Local models (llama3.2, mistral, qwen2.5) |
| **OpenAI-compatible** | Yes | Groq, Together AI, or any OpenAI-compatible API |

### Ollama (Local, Free)

Run models locally with no API key:

1. [Install Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Start the server: `ollama serve`
4. In Settings, set:
   - Provider: `ollama`
   - Endpoint: `http://localhost:11434`
   - Model: `llama3.2`

### OpenAI-Compatible Endpoints

Use any OpenAI-compatible API (Groq, Together AI):

| Provider | Endpoint | Example Model |
|----------|----------|---------------|
| Groq | `https://api.groq.com` | `llama-3.3-70b-versatile` |
| Together AI | `https://api.together.xyz` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |

### API Keys

API keys are stored securely using the IDE's built-in credential storage (PasswordSafe).

- Without an API key: Heuristic analysis (pattern-based, limited)
- With an API key or Ollama: Semantic analysis (LLM-powered, recommended)

> **Note:** Accuracy varies by content type and complexity. Semantic analysis provides more comprehensive coverage.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Analyze Selection | `Ctrl+Shift+Alt+S` |
| Analyze File | `Ctrl+Shift+Alt+F` |

## Building from Source

### Prerequisites

- JDK 17+
- Gradle 8.13+

### Build

```bash
# Clone the repository
git clone https://github.com/guardianclaw/guardianclaw-platform.git
cd guardianclaw/packages/jetbrains

# Build the plugin
./gradlew buildPlugin

# The plugin ZIP will be in build/distributions/
```

### Run Tests

```bash
./gradlew test
```

### Run in Development Mode

```bash
./gradlew runIde
```

### Verify Plugin

```bash
./gradlew verifyPlugin
```

### Publish

```bash
# Set your token
export PUBLISH_TOKEN="your-jetbrains-marketplace-token"

# Publish to marketplace
./gradlew publishPlugin
```

## Supported IDEs

- IntelliJ IDEA (Community & Ultimate)
- PyCharm (Community & Professional)
- WebStorm
- PhpStorm
- Rider
- CLion
- GoLand
- RubyMine
- DataGrip
- Android Studio

**Minimum Version**: 2024.1+

## Project Structure

```
src/
├── main/kotlin/dev/guardianclaw/jetbrains/
│   ├── actions/          # Plugin actions
│   ├── compliance/       # Compliance patterns (EU AI Act, CSA)
│   ├── services/         # Core services
│   ├── settings/         # Plugin settings
│   ├── toolWindow/       # Tool window UI
│   ├── ui/               # UI components
│   └── util/             # Utilities (patterns, logging, i18n)
└── test/kotlin/          # Unit tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT License - see [LICENSE](LICENSE)

## Links

- [Documentation](https://guardianclaw.org/docs)
- [GitHub](https://github.com/guardianclaw/guardianclaw-platform)
- [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/29459-claw-ai-safety)
