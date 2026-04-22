# Release Policy

GuardianClaw follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH) across all published packages.

## Published Artifacts

| Artifact | Registry | Path |
|---|---|---|
| `@guardianclaw/core` | npm | `packages/core/` |
| `guardianclaw` | PyPI | `sdk/` |
| Monorepo root | (not published) | `package.json` |

Other workspace packages (`apps/*`, non-core `packages/*`) are **not published**. Their versions track internal development and do not follow the public release cadence below.

## Version Alignment

**Major versions of published artifacts MUST be aligned.** When `@guardianclaw/core` bumps to `X.0.0`, `guardianclaw` (Python SDK) must bump to the equivalent `Xrc1` → `X.0.0`, and vice versa. The monorepo root `package.json` tracks the upcoming target major (pre-release allowed).

**Minor and patch versions MAY drift independently** within a major. Python and TypeScript parity is best-effort for bug fixes and new features.

**Rationale:** consumers using both packages (common for projects that have a Python agent backend with a TS browser/node integration layer) should be able to install matching majors without hunting compat tables.

## Pre-Release Channels

| Channel | Pattern (npm) | Pattern (PyPI) | Purpose |
|---|---|---|---|
| Release Candidate | `X.Y.Z-rc.N` | `X.Y.ZrcN` | Feature-complete; stabilization before stable |
| Beta | `X.Y.Z-beta.N` | `X.Y.ZbN` | Feature-incomplete; early feedback |
| Alpha | `X.Y.Z-alpha.N` | `X.Y.ZaN` | Internal validation |

Stable releases drop the pre-release suffix: `3.0.0`.

## Changelog Discipline

- `sdk/CHANGELOG.md` (Python) and `packages/core/CHANGELOG.md` (TS) follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- Every version bump commit touches the corresponding CHANGELOG in the same commit or immediately preceding one.
- Stable releases are tagged (annotated) in git: `v3.0.0`, `v3.0.0-rc.1`, etc. The annotated tag message summarizes the release.

## Version Source of Truth

| Artifact | Source of truth | Runtime read |
|---|---|---|
| TS | `packages/core/package.json` field `version` | `VERSION` export in `src/index.ts` (kept in sync by hand or by build tooling) |
| Python | `sdk/pyproject.toml` field `version` | `guardianclaw.__version__` read via `importlib.metadata.version("guardianclaw")` |

**Python `__version__` must not be declared in source code.** Duplicating between `pyproject.toml` and `__init__.py` leads to drift. Always use `importlib.metadata` and let packaging own the string.

## Release Checklist

For each stable release of a published artifact:

1. All suites green (pytest + vitest) — no skipped-by-default tests in critical paths.
2. Coverage thresholds met (currently 80% for Python — see `sdk/pyproject.toml`).
3. CHANGELOG entry under new version heading with sections: `Added`, `Changed`, `Removed`, `Fixed`, `Security` as applicable.
4. Version bumped in source of truth (see table above).
5. Dry-run publish validated: `npm pack` / `python -m build` tarballs inspected, smoke imports in virgin env.
6. Annotated tag pushed: `git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z`.
7. Registry publish: `npm publish` / `python -m twine upload dist/*`.
8. GitHub Release created, referencing the CHANGELOG entry.

## Breaking Changes

Breaking changes require a MAJOR bump and MUST be accompanied by:

- A `MIGRATION.md` entry at repo root covering the before/after diff with concrete examples.
- An explicit "BREAKING CHANGE:" footer in the commit message body.
- Updated READMEs for each affected artifact.
