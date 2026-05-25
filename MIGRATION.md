# Migration Guide

## v2.x → v3.0.0-rc.1

Version 3.0 finalizes the **CLAW Protocol** naming across both the Python SDK
(`guardianclaw`) and the TypeScript core (`@guardianclaw/core`). The four gates
are now canonical: **Credibility**, **Limits**, **Avoidance**, **Worth**.

Jailbreak is no longer modeled as a 5th gate — it is an attack *type* that
surfaces as violations in Credibility (role/roleplay manipulation) or Limits
(instruction override, prompt extraction, filter bypass, system injection).

This is a breaking change. Aliases were **not** kept.

---

## Python SDK (`guardianclaw`)

### Gate class renames

| v2.x | v3.0 |
|------|------|
| `TruthGate` | `CredibilityGate` |
| `HarmGate` | `AvoidanceGate` |
| `ScopeGate` | `LimitsGate` |
| `PurposeGate` | `WorthGate` |

```python
# Before
from guardianclaw.validators import TruthGate, HarmGate, ScopeGate, PurposeGate

# After
from guardianclaw.validators import CredibilityGate, AvoidanceGate, LimitsGate, WorthGate
```

### `CLAWResult` (no more `jailbreak` field)

The result object returned by `validate_text()` and friends no longer exposes a
`jailbreak` key. Check the relevant host gate instead:

```python
# Before
if not result.jailbreak.passed:
    ...

# After
if not result.credibility.passed or not result.limits.passed:
    ...
```

### `TokenTracker` re-exported from `guardianclaw.core`

Previously only accessible via the submodule. Now a first-class export:

```python
# v2.x
from guardianclaw.core.token_tracker import TokenTracker

# v3.0 (both still work; the short form is now preferred)
from guardianclaw.core import TokenTracker
```

---

## TypeScript — `@guardianclaw/core`

### Pattern constant renames

All pattern exports now match the canonical gate they feed. The legacy THSP
names (`HARM_*`, `SCOPE_*`, `PURPOSE_*`) have been removed.

| v2.x | v3.0 | Gate |
|------|------|------|
| `HARM_PATTERNS` | `AVOIDANCE_PATTERNS` | Avoidance |
| `HARM_KEYWORDS` | `AVOIDANCE_KEYWORDS` | Avoidance |
| `ALL_HARM_PATTERNS` | `ALL_AVOIDANCE_PATTERNS` | Avoidance |
| `SCOPE_PATTERNS` | `LIMITS_PATTERNS` | Limits |
| `ALL_SCOPE_PATTERNS` | `ALL_LIMITS_PATTERNS` | Limits |
| `PURPOSE_PATTERNS` | `WORTH_PATTERNS` | Worth |
| `PURPOSE_INDICATORS` | `WORTH_INDICATORS` | Worth |
| `ALL_PURPOSE_PATTERNS` | `ALL_WORTH_PATTERNS` | Worth |

```typescript
// Before
import { HARM_PATTERNS, SCOPE_PATTERNS, ALL_PURPOSE_PATTERNS } from '@guardianclaw/core';

// After
import { AVOIDANCE_PATTERNS, LIMITS_PATTERNS, ALL_WORTH_PATTERNS } from '@guardianclaw/core';
```

`DECEPTION_PATTERNS`, `MISINFORMATION_INDICATORS`, `AUTHORITY_INDICATORS`,
`SYSTEM_ACCESS_INDICATORS`, `SENSITIVE_DATA_PATTERNS`, and all jailbreak
attack-type pattern arrays (`INSTRUCTION_OVERRIDE_PATTERNS`,
`ROLE_MANIPULATION_PATTERNS`, `PROMPT_EXTRACTION_PATTERNS`, etc.) are
unchanged.

### Removed helper

| Removed | Replacement |
|---------|-------------|
| `checkHarm(text)` | `validateCLAW(text)` — use `result.avoidance` |

`checkHarm()` was a thin convenience wrapper around the Avoidance gate. Call
`validateCLAW()` and read `result.avoidance` directly. `checkJailbreak()` is
still available (jailbreak is an attack category, not a gate).

```typescript
// Before
const harmResult = checkHarm(text);
if (!harmResult.passed) { ... }

// After
const result = validateCLAW(text);
if (!result.avoidance.passed) { ... }
```

### `CLAWResult` (no more `jailbreak` field)

The TypeScript `CLAWResult` type no longer has a `jailbreak` property. Same
migration as Python — check Credibility and Limits, or call `checkJailbreak()`
for the cross-gate convenience:

```typescript
// Before
const result = validateCLAW(text);
if (!result.jailbreak.passed) { ... }

// After
const result = validateCLAW(text);
if (!result.credibility.passed || !result.limits.passed) {
  // jailbreak is implied when either host gate fails on role/roleplay
  // or instruction override / prompt extraction / filter bypass / system
  // injection violations.
}
// or keep the convenience wrapper:
if (!checkJailbreak(text).passed) { ... }
```

If your downstream type models still carry a synthetic `jailbreak` gate (e.g.
openclaw's `GateResults` or voltagent's `CLAWGates`), derive it from
`credibility.passed && limits.passed`.

### Sub-entries unchanged

`@guardianclaw/core/patterns` and `@guardianclaw/core/memory-patterns` still
resolve the same way — only the individual export names inside them changed
per the table above.

---

## Migration checklist

- [ ] **Python**: search-replace gate class names
  (`TruthGate`/`HarmGate`/`ScopeGate`/`PurposeGate` → CLAW equivalents)
- [ ] **Python**: remove any reads of `CLAWResult.jailbreak` — substitute with
  Credibility/Limits checks
- [ ] **TypeScript**: search-replace pattern constants
  (`HARM_*`/`SCOPE_*`/`PURPOSE_*` → `AVOIDANCE_*`/`LIMITS_*`/`WORTH_*`)
- [ ] **TypeScript**: replace `checkHarm(text)` with
  `validateCLAW(text).avoidance`
- [ ] **TypeScript**: remove any reads of `CLAWResult.jailbreak`
- [ ] Run typecheck and test suites — no surprises expected beyond the
  renames above
- [ ] Update your own docstrings/comments to match the CLAW naming

---

## Rationale

- **CLAW is the spec.** Having two vocabularies (THSP internally, CLAW
  externally) was a constant source of confusion and mis-reviews during
  Tier-1 audits.
- **Jailbreak-as-gate was a categorical error.** A jailbreak is not a gate —
  it's an attempt to subvert the agent's contract. The actual observable
  signals (role manipulation, instruction override, etc.) already live inside
  Credibility and Limits; duplicating them as a 5th gate inflated violation
  counts and made risk scoring inconsistent.
- **No deprecation cycle.** The v3 RCs are pre-publish. Keeping a 2-tier
  export surface (new + legacy) for a release that nobody has installed yet
  would just postpone the cleanup.

See the top-level `CHANGELOG.md` files in `packages/core/` and `sdk/` for the
full change list, and the auditoria entries under `_internal/auditoria/` for
the justification trail (not public).

---

## v3.0 → v3.1 — L1 keyword detection: role evolution

This is **not** a breaking API change. L1 keyword detection
(`HarmfulRequestDetector` and adjacent perimeter checks) remains in place with
identical public surface. What changes is how we recommend you **use** it.

### Background

In May 2026 we ran a rigorous calibration audit against adversarial-by-design
benchmarks (OR-Bench-Hard + HarmBench, BCa CI 95%, 600 OR-Bench items + 100
HarmBench items, two models). The headline findings, reported here without
softening:

| Operating point (gpt-4o-mini, N=600) | FRR | ASR | p(ΔASR vs baseline) |
|---|---:|---:|---:|
| Baseline (no GuardianClaw) | 17.25% [13.5, 21.0] | 4.00% [2.0, 8.0] | — |
| L1 safety-first only | 32.75% [28.2, 37.5] | 4.00% [2.0, 8.0] | **1.0000** |
| L1 balanced only | 27.00% [22.8, 31.5] | 4.00% [2.0, 8.0] | 1.0000 |
| L1 permissive only | 21.00% [17.0, 25.2] | 4.00% [2.0, 8.0] | 1.0000 |

In plain English: on this benchmark, L1 as a **sole** decision layer increases
the false-refusal rate by 4–15 percentage points without reducing successful
attacks — it is Pareto-dominated by simply not running L1. The AUROC of L1
confidence vs ground truth was **0.43–0.47** on both models tested
(gpt-4o-mini, Llama-3.3-70B) — below random.

The same audit identified that `intent_signal_detector` achieves **70%
precision** when it is the sole detector that hit, versus **19%** for
`harmful_request_detector` — strong evidence that intent signals are the
informative carriers, and keyword matches alone are noise.

This is consistent with the broader 2026 guardrails literature
([Meta LlamaFirewall](https://ai.meta.com/research/publications/llamafirewall-an-open-source-guardrail-system-for-building-secure-ai-agents/),
[NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails), production
reports from Microsoft / Google / GitHub / OpenAI 2025–2026): classifier-based
detection is a **coarse perimeter filter**, not a **structural trust
boundary**.

### What you should do

| You were doing | Recommended now |
|---|---|
| L1 as the sole pre-AI block, blocking on `confidence ≥ 0.5` | L1 as **one** signal of several. Block only on multi-layer concordance (L1+L4) or structural rules (limits, drainer_intel lookup, on-chain simulation) |
| Treating an L1 high-confidence hit as ground truth | Treating an L1 hit as a hint that surfaces in the audit log and may raise risk_level, but does not, by itself, refuse |
| `confidence_threshold=0.5` in production | Either keep L1 as telemetry (always log, never block solo) or raise threshold to `0.85`+ AND require a corroborating signal (L4 ClawObserver agrees, or `drainer_intel` lookup matches) |

The Python SDK keeps L1 enabled by default for backwards compatibility, but the
recommendation in production deployments is to subscribe to L1's output as a
**signal** alongside L2/L3/L4 and structural checks, not as a decision-maker.

### Where L1 still earns its keep

- **Telemetry / audit trail.** L1 fingerprints attack categories cheaply; this
  is useful for dashboards and analyst review even when it doesn't decide
  blocking.
- **High-signal keyword sets.** A small Tier-1 lexicon (e.g., `ransomware`,
  `bomb`, `phishing kit`, `seed phrase`) has high precision in practice — the
  problem was treating all 270 keywords as equally informative, not the idea
  of a keyword filter itself.
- **Multi-layer concordance.** When L1 *and* L4 (ClawObserver) *and* a
  structural rule all flag the same request, that intersection is high
  signal even though each layer alone is weak.

### ClawPay applies this

The first commercial product on top of the framework
([ClawPay](#), Sprint 1 shipping 2026-05) consumes L1 as audit-only signal.
Payment blocking decisions are structural — `spending_limits` math, on-chain
`simulateTransaction`, deterministic `drainer_intel` lookup — with L4 LLM
reasoning available for post-event analysis. The same `AvoidanceGateValidator`
is the integration point: it now accepts a `DrainerLookup` and returns
explainable hits (`source`, `source_ref`, `severity`) instead of a confidence
score.

```python
# v3.1 recommended usage in payment-style flows
from guardianclaw.integrations.coinbase.x402 import (
    CLAWPaymentValidator,
    DrainerLookup,
    InMemoryDrainerSource,
    SupabaseDrainerSource,
)

lookup = DrainerLookup(sources=[
    SupabaseDrainerSource(supabase_url=..., api_key=...),
    InMemoryDrainerSource([...]),  # static fallback
])
validator = CLAWPaymentValidator(drainer_lookup=lookup)
# Blocks now cite a deterministic feed entry, not a classifier score.
```

### Where to read more

- Audit report (public): `_internal/auditoria/benchmarks-v3-20260518/HANDOFF.md`
  (currently internal — will be summarized in a public blog post)
- Drainer-intel schema: `supabase/migrations/20260521000000_drainer_intel.sql`
- ClawPay sprint plan: `~/.claude/plans/async-pondering-dahl.md` (internal)

### Why we are not removing L1

The framework is published, the API is in use internally for testing, and we
take public-surface stability seriously even pre-launch. The honest path is
to publish what we learned, redefine the recommended role, and let L1
continue to exist as the cheap perimeter filter it actually is — not as the
firewall it was originally positioned to be.

---

## v3.1 → v3.2 — Stripe Agent Toolkit + cross-provider audit shape

Sprint 3 of ClawPay (2026-05-21) added a second payment surface to the
framework: the **Stripe Agent Toolkit**. The change is additive and
backwards-compatible — no existing import breaks.

### What's new

| Area | Change |
|------|--------|
| **Python SDK** | New module `guardianclaw.integrations.stripe` with `GuardianClawStripeMiddleware`, `StripePaymentRequest`, `StripeIntentKind`, four CLAW gates, and the orchestrator `StripeCLAWValidator`. Reuses `DrainerLookup` and `AuditSink` from the x402 module. |
| **Audit row** | `AuditRecord` ships a new `provider: str = "x402"` field. Default preserves the prior wire shape for rows already in the wild. New rows from `build_stripe_audit_record` set `provider="stripe"`. |
| **Supabase schema** | Migration `20260521020000_clawpay_provider_field.sql` adds the column with `DEFAULT 'x402'` and a CHECK constraint enumerating supported providers. Legacy rows are correctly backfilled. |
| **API route** | `GET /clawpay/audit-events` accepts `?provider=x402|stripe`. CSV export and dashboard table include the new column. |
| **npm package** | `@guardianclaw/stripe-agent-toolkit` v1.0.0 ships with the same CLAW logic in TypeScript, validated against the Python tests for parity. |

### What you should do

Most callers don't need to change anything — the new code path is opt-in.
If you want to use ClawPay for Stripe-bound agents:

```python
from guardianclaw.integrations.stripe import (
    GuardianClawStripeMiddleware, StripePaymentRequest, StripeIntentKind,
)
```

Reuse your existing `DrainerLookup` and `AuditSink` instances — the Stripe
middleware accepts the same kwargs as the x402 one, so a single
configuration applies to both surfaces.

### Backwards compatibility

- `GuardianClawX402Middleware()` constructor signature unchanged.
- `AuditRecord(...)` without an explicit `provider=` still works (defaults
  to `"x402"`).
- `SupabaseAuditSink.emit()` now writes a `provider` column; the migration
  must run before sinks targeting Sprint-3-era schema.

---

## v3.2 → v3.3 — Pre-flight on-chain simulation

Sprint 4 (2026-05-21) adds an optional pre-flight simulation step that
defeats the modern Solana drainer families (aqua, vanish, TOCTOU-based
kits) that bypass wallet simulation by mutating the transaction between
sign and broadcast. The change is **opt-in and backwards compatible** —
callers that don't configure a `SimulationProvider` see no behavioral
change.

### What's new

| Area | Change |
|------|--------|
| **Python SDK** | New module `guardianclaw.integrations.coinbase.x402.simulation` with `SimulationStatus`, `SimulationResult`, `SimulationProvider` ABC, plus three implementations (`Helius`, `Tenderly`, `InMemory`) and a `SimulationGate` orchestrator. |
| **Middleware** | `GuardianClawX402Middleware(simulation_provider=...)` argument. When set, the gate runs BEFORE the four CLAW gates and pipes the result through `context['simulation_result']`. CredibilityGate consumes `WOULD_FAIL`; AvoidanceGate consumes `SUSPICIOUS_*`. |
| **Audit record** | `AuditRecord.simulation: Optional[dict] = None`. Default `None` preserves the prior wire shape; only present when a `SimulationProvider` was wired. Stripe `build_stripe_audit_record` also extracts it. |
| **Supabase schema** | Migration `20260521030000_clawpay_simulation_field.sql` adds `simulation jsonb` to `clawpay_audit_events` with a functional index on `(simulation ->> 'status')`. |
| **API route** | `GET /clawpay/audit-events` accepts `?simulation_status=ok|would_fail|suspicious_balance_change|...`. The CSV export adds `simulation_status` and `simulation` columns. |
| **Dashboard** | New `SimulationBadge` component and a dedicated section in the audit detail dialog showing ownership reassignments, balance changes, and log excerpts. |

### What you should do

Most callers don't need to change anything. To enable pre-flight
simulation for an existing deployment:

```python
from guardianclaw.integrations.coinbase.x402 import (
    GuardianClawX402Middleware,
    HeliusSimulationProvider,
)
import os

middleware = GuardianClawX402Middleware(
    simulation_provider=HeliusSimulationProvider(
        rpc_url=f"https://mainnet.helius-rpc.com/?api-key={os.environ['HELIUS_API_KEY']}",
    ),
)
```

Then run migration `20260521030000_clawpay_simulation_field.sql` against
your Supabase instance.

### Backwards compatibility

- The middleware constructor signature is purely additive
  (`simulation_provider=None` default).
- `AuditRecord.simulation` defaults to `None`; the field is only written
  to Supabase when present.
- Provider exceptions are caught at the gate boundary —
  `SimulationStatus.ERROR` becomes a risk factor, never a block.
- The migration adds a nullable column with a partial index; no rows are
  rewritten.
- Existing routes / CSV columns are appended-to, not replaced — CSV
  consumers that hard-code column positions should re-check, but
  consumers that read by header name keep working.

---

## v3.3 → v3.4 — Outcome-based billing

Sprint 5 (2026-05-21) ships the outcome-billing pipeline that turns every
blocked payment into a line on a monthly invoice. The change is **purely
additive** — none of the existing SDK or API surface changes; the new
billing surface is entirely opt-in.

### What's new

| Area | Change |
|------|--------|
| **Supabase schema** | Migration `20260521040000_clawpay_billing.sql` adds three tables (`clawpay_billing_accounts`, `clawpay_billing_periods`, `clawpay_billing_usage_records`) plus a `close_clawpay_billing_period(uuid)` SECURITY DEFINER RPC. RLS scopes every read to `jwt_wallet_address()`. |
| **API surface** | New routes under `/clawpay/billing/*`: `account`, `current`, `periods`, `periods/:id`, `periods/close`, and the Stripe-side `periods/:id/invoice` + `webhooks/stripe`. Dashboard auth required for everything except the public webhook (signature-verified). |
| **Stripe bridge** | `apps/api/src/services/clawpay-stripe-billing.ts` talks to Stripe via raw `fetch` (no SDK), with WebCrypto-HMAC signature verification and `Idempotency-Key` per line. Test-only `baseUrl` override so suites never accidentally hit live Stripe. |
| **Dashboard** | New `/app/clawpay/billing` page + `BillingStatusBadge` component. The Overview page surfaces the current-period totals via the new API. |
| **Plan pricing** | Single source of truth in `services/clawpay-billing.ts` (`PLAN_PRICING`). Enterprise contracts override per tenant on the `billing_accounts` row. |

### Backwards compatibility

- All previously published SDK / API surfaces are unchanged.
- The new tables are nullable / lazily populated — tenants without a
  billing account default to a synthetic Free row.
- Stripe credentials are optional environment vars
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`); routes return `503` with
  a clear message when missing instead of throwing.
- `close_clawpay_billing_period` is idempotent — re-running the close
  job is safe.

---

## v3.4 → v3.5 — Closed-beta launch infrastructure

Sprint 6 (2026-05-21) ships the runway that makes a closed beta
operationally viable: invite codes, transactional email, an onboarding
wizard, a public status page, and a structured case-study export.
Everything additive and opt-in.

### What's new

| Area | Change |
|------|--------|
| **Supabase schema** | Migration `20260521050000_clawpay_beta.sql` adds five tables (`clawpay_beta_invites`, `clawpay_beta_invite_redemptions`, `clawpay_email_subscriptions`, `clawpay_email_deliveries`, `clawpay_status_incidents`) plus the SECURITY DEFINER `redeem_clawpay_beta_invite(text, text)` RPC. |
| **API surface** | Public `GET /clawpay/beta/invites/:code` + `GET /clawpay/status` for unauthenticated callers; authenticated `POST /clawpay/beta/invites/:code/redeem`, `GET/PATCH /clawpay/notifications/preferences`, `POST /clawpay/notifications/test`, `GET /clawpay/case-study/export`. |
| **Email pipeline** | `apps/api/src/services/clawpay-email.ts` — `EmailProvider` ABC, Resend implementation, in-memory variant, five hand-rolled templates with subject + HTML + text variants. |
| **Onboarding wizard** | `/app/clawpay/onboarding` — four-step guided setup that hydrates from server state on mount. |
| **Public status** | `/clawpay/status` API + (planned) marketing page that consume `clawpay_status_incidents`. |
| **Case-study export** | Versioned JSON report with deterministic anonymization. |
| **Blog post** | `apps/web/src/lib/blog.ts` ships the closed-beta launch announcement. |

### Backwards compatibility

- All Sprint 1–5 surfaces are unchanged.
- The new tables default to empty / synthetic-default reads — calling
  `GET /clawpay/notifications/preferences` for a wallet without a row
  returns a tier-1 default shape rather than 404.
- The email service falls back to `InMemoryEmailProvider` when
  `RESEND_API_KEY` isn't configured; tests + dev never hit the network.
- The public `/clawpay/status` endpoint returns 200 with a typed
  `warning` even when the incidents store is unreachable, so the
  marketing status page never displays a hard error.
