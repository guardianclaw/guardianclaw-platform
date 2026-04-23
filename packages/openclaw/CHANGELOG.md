# Changelog

All notable changes to @guardianclaw/openclaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0-rc.1] - 2026-04-22

Package renamed from `@guardianclaw/moltbot` to `@guardianclaw/openclaw`
to follow the upstream rename (moltbot -> openclaw, same product).
Version jumps to 3.0.0-rc.1 to align with `@guardianclaw/core`.

### Breaking

- **Package name**: `@guardianclaw/moltbot` -> `@guardianclaw/openclaw`.
  Existing consumers must update their imports and `package.json` dependency.
- **peerDependency**: `moltbot >=1.0.0` -> `openclaw >=2026.0.0`.
- **Plugin entry shape**: the package now ships a `definePluginEntry(...)`
  default export from `openclaw/plugin-sdk/core`. The legacy named
  `register(api)` export is kept for back-compat but new code should
  consume the default export.
- **Seed hook**: migrated from `before_agent_start` to `before_prompt_build`.
  Seeds are now injected via `prependSystemContext`, which is
  prompt-cacheable by providers (cheaper per turn).
- **Config type**: `GuardianClawMoltbotConfig` -> `GuardianClawOpenClawConfig`.
- **Constant**: `MOLTBOT_VERSION_RANGE` -> `OPENCLAW_VERSION_RANGE` (now `>=2026.0.0`).
- **Manifest**: `clawdbot.plugin.json` -> `openclaw.plugin.json`.

### Added

- Dev-time typecheck against `openclaw@2026.4.21` (new `devDependency`).

### Compatibility

- Node.js 18+
- OpenClaw 2026.0+
- @guardianclaw/core 3.0+

### Planned for next minor

- `before_install` hook integration (CLAW scan of third-party plugins pre-install).
- Optional migration to `requireApproval` flow on `before_tool_call`
  (human-in-the-loop gate instead of hard block).

---

## [1.0.0] - 2026-01-28

### Added

#### Core Features
- **Protection Levels**: Four levels of protection (off, watch, guard, shield)
- **Hook Integration**: Full OpenClaw hook support (message_received, before_agent_start, message_sending, before_tool_call, agent_end)
- **CLAW Validation**: Credibility, Limits, Avoidance, Worth gate validation via @guardianclaw/core

#### Validators
- **Input Analysis**: Detects prompt injection and jailbreak attempts
- **Output Validation**: Prevents data leaks (API keys, passwords, credentials)
- **Tool Validation**: Blocks dangerous commands and system access

#### Escape Hatches
- **Allow-Once**: Single-use bypass tokens with scope (output/tool/any)
- **Pause Protection**: Time-limited protection pause (10s to 1h)
- **Tool Trust**: Session-level tool trust with wildcard support

#### Logging & Alerts
- **Audit Log**: In-memory audit with TTL, filtering, and persistence hooks
- **Alert Manager**: Webhook delivery with rate limiting and retries
- **Formatters**: Human-readable and webhook-friendly output formats

#### CLI Commands
- `/claw status` - Current protection status
- `/claw level [new]` - View or change protection level
- `/claw log [count]` - View recent audit entries
- `/claw pause <duration>` - Pause protection
- `/claw resume` - Resume protection
- `/claw allow-once [scope]` - Grant one-time bypass
- `/claw trust <tool>` - Trust a tool
- `/claw untrust <tool>` - Revoke tool trust
- `/claw help` - Show available commands

#### Developer Features
- Full TypeScript support with comprehensive type exports
- Pattern registry for extensible detection
- Metrics collection for observability
- Configurable logging with child loggers

### Technical Details
- 724 tests (100% passing)
- 86%+ code coverage
- Zero production dependencies beyond @guardianclaw/core
- ESM and CJS dual module support
- Tree-shakeable exports

### Compatibility
- Node.js 18+
- OpenClaw 0.1.x
- @guardianclaw/core 0.1.x

---

## [Unreleased]

### Planned
- Custom validator plugins
- Persistent escape hatch storage
- Multi-webhook routing by alert type
- Metrics export (Prometheus, OpenTelemetry)
