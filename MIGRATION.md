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
