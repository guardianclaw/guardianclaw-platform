# Changelog

All notable changes to the GuardianClaw Platform.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-package changelogs live under `packages/*/CHANGELOG.md` and `sdk/CHANGELOG.md`.

## [Unreleased]

### Security

- Frente B.1 (audit F-01 / P0.1): user-bucket routes migrated from `service_role`
  to JWT-claims RLS. Final route count: 14/14. 8 migrations, 61 policies live in
  production. Two ownership-predicate paths (`DELETE /user/data` and
  `memories`/`character` mutation surfaces) remain on the older shape and are
  queued for B.2 (transactional writes via SECURITY DEFINER RPC).

### Documentation

- Frente F: full pre-launch documentation audit. Root `LICENSE` added, 30 files
  with stale `guardian-claw` org references corrected, MDX docs aligned with
  CLAW canonical gate names (Credibility / Limits / Avoidance / Worth), broken
  references to absent specification documents removed.

## [3.0.0-rc.1] — 2026-04-22

First release candidate of the v3 platform across npm and PyPI. The CLAW
protocol naming is now canonical across both runtimes; THSP legacy aliases were
removed without a deprecation cycle (see `MIGRATION.md`).

### Added

- `@guardianclaw/core` 3.0.0-rc.1 published on npm (tags `latest` + `next`).
- `guardianclaw` 3.0.0rc1 published on PyPI.
- `@guardianclaw/voltagent` 0.3.0 (peer-widened to `@voltagent/core` 2.x and
  Vercel AI SDK v6).
- `@guardianclaw/elizaos-plugin` 2.0.0-rc.1 (aligned to `@elizaos/core@2.0.0-alpha.223`).
- `@guardianclaw/openclaw` 3.0.0-rc.1 (renamed from `@guardianclaw/moltbot`).
- `@guardianclaw/solana-agent-kit` 1.0.3 (devDep `^2.0.10`).
- Pattern registry (`patterns/*.json`) with sync markers across the Python SDK
  and the TypeScript core, enforced by the `pattern-sync` CI job.
- Pre-publish dry-run pipeline (`npm pack` + `python -m build`).

### Changed

- `THSP` → `CLAW` rename across both runtimes (`HARM_*` → `AVOIDANCE_*`,
  `SCOPE_*` → `LIMITS_*`, `PURPOSE_*` → `WORTH_*`). Gate classes renamed to
  `CredibilityGate` / `LimitsGate` / `AvoidanceGate` / `WorthGate`.
- Jailbreak unified into the 4-gate model: it now surfaces as Credibility
  (role/roleplay) or Limits (instruction override, prompt extraction, filter
  bypass, system injection) violations rather than a synthetic 5th gate.
- Python `__version__` is read via `importlib.metadata` instead of being
  duplicated in source.
- `tsup` sub-entries split (`patterns`, `memory-patterns`).

### Removed

- `CLAWResult.jailbreak` field (Python and TypeScript).
- `checkHarm()` helper (TypeScript) — use `validateCLAW(text).avoidance`.

## [3.0.0-beta] — 2026-01-06

### Added

- N8N-style visual flow builder (React Flow), node palette across Input /
  Process / GuardianClaw / Tools / Output / Flow / Memory / Utility families.
- Builder routes: `/builder` (list), `/builder/new` (3-step wizard),
  `/builder/[id]/{flow,claw,test,deploy,analytics}`.
- Demo mode with pre-configured agent and 5-node flow.
- Switch / Radio Group / Tooltip components (Radix UI).

### Changed

- Migrated to Next.js 15 App Router; static-export config for Cloudflare Pages.
- Migrated from `react-flow-renderer` to `@xyflow/react`.

### Fixed

- Next.js 15 async-params type changes.
- Server / Client component separation for static export.
- Hydration mismatch on dynamic dates.
- Zustand persist + SSR compatibility.

## [2.x.x]

See legacy documentation for previous versions.
