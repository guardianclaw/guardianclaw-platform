# Changelog

All notable changes to `@guardianclaw/elizaos-plugin` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-rc.1] - 2026-04-24

### Changed

- `@elizaos/core` peer dependency pinned to `2.0.0-alpha.223` (exact). Upstream
  is still pre-stable; shape drift between alphas is common, so the exact pin
  prevents silent incompatibility.
- Aligned the local duck-typed mirror (`src/types.ts`) with upstream 2.x:
  - `UUID` is now a plain `string` (was branded in 1.x).
  - `Memory.entityId` / `Memory.roomId` relaxed to optional — upstream makes
    them optional and we no longer require them.
  - `HandlerCallback` second parameter renamed `files?: unknown[]` →
    `actionName?: string` to match upstream.
  - `ActionResult.response?` renamed to `text?`, and `error?` widened to
    `string | Error`.
  - `Content` gained `source?`, `url?`, `inReplyTo?` optional fields.
  - `Plugin.init` return type is now `Promise<void> | void`.
- All `ActionResult`s emitted by our actions/evaluators now return `text` (was
  `response`). Action-chaining runtimes read `text`, so the previous
  `response` key was silently dropped.

### Fixed

- Two pre-existing test assertions in `memory-integrity.test.ts` corrected:
  version constant check updated to `'2.0'`, and the version-mismatch test now
  sets an out-of-range version (`'3.0'`) so it actually fails verification.

### Validation

- Validated against `@elizaos/core@2.0.0-alpha.223` — 135/135 tests pass,
  typecheck clean, build clean.

### Notes

- Not adopting upstream `parameters?` for Actions (LLM-driven extraction) in
  this release — deferred to a future minor.
- Not wiring `dispose?` / `applyConfig?` lifecycle hooks yet.
- Diff notes kept in `_internal/projects/elizaos-api-diff.md` (local only).
