# Changelog

All notable changes to `@guardianclaw/core` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0-rc.1] - 2026-04-22

### Changed

- **Pattern exports now use CLAW canonical names.** Legacy THSP names
  (`HARM_*`, `SCOPE_*`, `PURPOSE_*`) are removed:
  - `HARM_PATTERNS` → `AVOIDANCE_PATTERNS`
  - `HARM_KEYWORDS` → `AVOIDANCE_KEYWORDS`
  - `ALL_HARM_PATTERNS` → `ALL_AVOIDANCE_PATTERNS`
  - `SCOPE_PATTERNS` → `LIMITS_PATTERNS`
  - `ALL_SCOPE_PATTERNS` → `ALL_LIMITS_PATTERNS`
  - `PURPOSE_PATTERNS` → `WORTH_PATTERNS`
  - `PURPOSE_INDICATORS` → `WORTH_INDICATORS`
  - `ALL_PURPOSE_PATTERNS` → `ALL_WORTH_PATTERNS`
- Package boundaries documented: jailbreak attack-type patterns
  (`INSTRUCTION_OVERRIDE_*`, `ROLE_MANIPULATION_*`, etc.) are distributed
  across Credibility (identity deception) and Limits (boundary violation),
  not a separate gate.
- Sub-entries (`@guardianclaw/core/patterns` and
  `@guardianclaw/core/memory-patterns`) ship `cjs` + `esm` + `.d.ts` each.

### Removed

- `checkHarm()` helper. Use `validateCLAW(text).avoidance` directly.
- `CLAWResult.jailbreak` field. Derive from `credibility` + `limits` or call
  `checkJailbreak()` explicitly for the cross-gate signal.
- Test files are no longer included in the published tarball (`files` in
  `package.json` excludes `src/**/*.test.ts`).

### Fixed

- `WORTH_PATTERNS.explicit_harmful` regex: the `to (hurt|damage|destroy)`
  verb list had been corrupted during an earlier THSP → CLAW rename
  (`harm` → `avoidance` inside the pattern body), which broke the detection
  semantics. Restored to the intended verb set.

### Notes

- No deprecation cycle — the v3 RCs are pre-publish. See the root
  `MIGRATION.md` for the full rename map and migration checklist.
- `checkJailbreak()`, `ALL_JAILBREAK_PATTERNS`, and `JAILBREAK_INDICATORS`
  are preserved as convenience surfaces for downstream consumers that model
  jailbreak as a cross-gate attack category.

## [Unreleased]

(Reserved for post-rc changes.)
