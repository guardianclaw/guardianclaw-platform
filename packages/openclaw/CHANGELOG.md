# Changelog

All notable changes to `@guardianclaw/openclaw` will be documented in this
file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0-rc.1] - 2026-04-22

First public release. Version aligned with `@guardianclaw/core`.

### Features

- Four protection levels: `off`, `watch`, `guard`, `shield`.
- Plugin entry via `definePluginEntry(...)` (compatible with
  `openclaw/plugin-sdk/core`).
- Seed injection via `before_prompt_build` using `prependSystemContext`
  (prompt-cached by providers).
- Hook handlers wired to OpenClaw lifecycle:
  `message_received`, `before_prompt_build`, `message_sending`,
  `before_tool_call`, `agent_end`.
- CLAW validation (Credibility, Limits, Avoidance, Worth) via
  `@guardianclaw/core`.
- Validators: input analysis (prompt injection / jailbreak), output
  validation (data leaks), tool validation (destructive commands).
- Escape hatches: allow-once tokens, time-limited pause, session tool trust.
- Audit log with TTL, filtering, and persistence hooks.
- Alert manager with webhook delivery, rate limiting, and retries.
- CLI commands: `/claw status`, `/claw level`, `/claw log`, `/claw pause`,
  `/claw resume`, `/claw allow-once`, `/claw trust`, `/claw untrust`,
  `/claw help`.

### Planned for next minor

- `before_install` hook: CLAW scan of third-party plugins pre-install.
- Optional `requireApproval` flow on `before_tool_call`
  (human-in-the-loop gate instead of hard block).
