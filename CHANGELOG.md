# Changelog

All notable changes to the GuardianClaw Platform.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Per-package changelogs live under `packages/*/CHANGELOG.md` and `sdk/CHANGELOG.md`.

## [Unreleased]

### Security

- Frente B.1 (audit F-01 / P0.1): user-bucket routes migrated from `service_role`
  to JWT-claims RLS. Final route count: 14/14. 8 migrations, 61 policies live in
  production.
- Frente B.2 (audit F-06 / P1.3): `DELETE /user/data` and the `memories` /
  `character` mutation surfaces moved behind `purge_user_data` SECURITY DEFINER
  RPC; ownership predicate enforced inside the function rather than at the
  handler.
- Frente B.3: Cloudflare deploy token reduced to a min-scope account-scoped
  token (Workers Scripts:Edit + KV:Edit + Workers Tail:Read + Account
  Settings:Read). Wider `GuardianClaw Full Deploy` token revoked. OIDC
  federation prepared but blocked upstream on `wrangler-action#402`.
- Frente B.4: `/payments/{status,verify,history}` and `/social-deliveries`
  GET/approve migrated from service-role to `getUserClient` + JWT-claims RLS.
  Cross-tenant `tx_signature` uniqueness check moved into the new
  `record_payment` SECURITY DEFINER RPC; `approve_social_delivery` promoted
  to SECURITY DEFINER with `jwt_wallet_address` verification.
- Frente J: `/payments/verify` now honours `Idempotency-Key` header backed by
  KV with a UNIQUE INDEX safety net on `subscriptions(wallet_address,
  idempotency_key)`. Replays return the original verdict via
  `X-Idempotent-Replay: true`; in-flight collisions return 409 with
  `Retry-After: 5`.
- `SECURITY.md` rewritten from a clean source after PowerShell encoding
  corruption introduced mid-word breaks during a Trees-API rebase. G-01
  (auth web/admin unification) and G-05 (B.1 + B.2 + B.4 closure) marked
  Resolved. G-07 (CF token rotation) added.

### Added

- Frente C.3: Python ↔ TypeScript pattern parity audit. Schema v2 of the
  pattern registry (`patterns/regex/`) grew from 6 to 39 families covering
  deception, avoidance subcategories (cyber, malware, hypothetical,
  harassment, exfiltration, fraud, injection, physical, system), limits
  subcategories (medical, legal, financial, system_access,
  delegated_authority), worth subcategories (destruction,
  purposeless_qualifier, validation_bypass, four embodied variants),
  impersonation, false_claims, self_preservation, and seven sensitive-data
  categories. Generator (`scripts/gen_patterns.py`) now drives 4 targets
  (`patterns.ts`, `validator.ts`, `gates.py`, `sensitive_data.py`); parity
  CI gate (`scripts/check_pattern_parity.py`) enforces identical Python and
  JavaScript verdicts across all 39 families.
- Frente C.4: reproducible attack-class corpus under `evaluation/corpus/`.
  Eight classes — `prompt-injection`, `data-exfil`, `jailbreak`, `encoding`,
  `multilingual` (9 languages), `instruction-override`, `role-play`,
  `indirect-via-memory` — each with at least 50 hand-curated items, an
  `expected_verdict` per gate, and a one-sentence rationale per item. Total
  416 items, all calibrated to current SDK output. Harness
  (`evaluation/corpus/run.py`) loads classes, runs `CLAWValidator`, exits
  non-zero on any verdict drift; gated as the `Corpus Validation` CI job
  so future SDK regressions surface immediately.
- Frente D: pattern registry 7.x — 9 string-indicator families migrated
  to `patterns/*.json` with sync markers. Schema v2 supports regex families
  with `flags` (subset of `imsux`).
- TypeScript path mappings in 4 downstream tsconfigs (`apps/browser`,
  `packages/voltagent`, `packages/elizaos`, `packages/openclaw`) so
  `@guardianclaw/core` resolves to source during standalone typecheck;
  zero remaining residual TS errors across the monorepo CI scope.

### Changed

- Frente G: deploy pipeline gated on DNS check
  (`dig +short NS guardianclaw.org` must contain Cloudflare nameservers
  before any production worker subdomain change).
- Token rotation runbook (`_internal/projects/CHECKLIST_ROTACAO_SECRETS.md`)
  now drilled in CF token rotation: previous wide token revoked, min-scope
  token issued via Account API, GitHub secret synced, deploy verified
  green before revocation.

### Documentation

- Frente F: full pre-launch documentation audit. Root `LICENSE` added, 30
  files with stale `guardian-claw` org references corrected, MDX docs
  aligned with CLAW canonical gate names (Credibility / Limits / Avoidance
  / Worth), broken references to absent specification documents removed.

### Fixed

- `apps/api/src/middleware/admin-audit.test.ts` flaky timing assertion
  relaxed (`duration_ms >= 10` → `>= 0`); CI runners occasionally registered
  9 ms.
- `evaluation/parity/fixtures/*.json` allowlisted in `.gitleaks.toml`;
  synthetic fixtures with `sk-…` / `AKIA…` / `ghp_…` prefixes no longer
  trip full-history gitleaks scans.

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
