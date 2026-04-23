# Changelog

All notable changes to `@guardianclaw/voltagent` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-04-23

### Changed

- `@voltagent/core` peer dependency widened to `>=2.0.0`. The 2.x line is the
  active upstream series (AI SDK v6-aligned) and stays backward-compatible with
  the guardrail types this package consumes (`InputGuardrailArgs`,
  `InputGuardrailResult`, `OutputGuardrailArgs`, `OutputGuardrailResult`,
  `VoltAgentTextStreamPart`, `GuardrailContext`).
- `VOLTAGENT_VERSION_RANGE` bumped to `>=2.0.0`.

### Validation

- Validated against `@voltagent/core@2.7.2` — 225/225 tests pass, typecheck
  clean, build clean.
