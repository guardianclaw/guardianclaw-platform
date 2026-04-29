# Contributing

Thanks for taking the time to contribute. This document covers the few
conventions that are not self-evident from the codebase.

## Pattern registry (`patterns/`)

A small set of validator inputs is duplicated between the Python SDK
(`sdk/src/guardianclaw/validators/gates.py`) and the TypeScript core
(`packages/core/src/patterns.ts`). To keep the two sides from drifting, the
canonical source is in `patterns/*.json`, and both code files have
`pattern-sync:start <name>` / `pattern-sync:end <name>` markers around the
blocks that are regenerated from those JSON files.

### Editing a synchronised list

1. Edit the JSON file under `patterns/`. **Do not** edit the code block
   between the sync markers directly.
2. Run the generator:

   ```bash
   python scripts/gen_patterns.py
   ```

3. Review `git diff` — the only expected changes are inside the blocks
   bounded by the sync markers.
4. Commit the JSON change and the regenerated source files together.

### Adding a new synchronised list

1. Create `patterns/<name>.json` conforming to `patterns/schema.json`.
2. In both target files, wrap the list body with the marker pair:

   ```ts
   // pattern-sync:start <name>
   // pattern-sync:end <name>
   ```

   ```python
   # pattern-sync:start <name>
   # pattern-sync:end <name>
   ```

3. Run `python scripts/gen_patterns.py`.
4. Verify the existing test suites still pass on both sides.

### Regex families

Schema v2 supports a second `kind`: `regex`. Files live under
`patterns/regex/*.json` and declare a single `flags` string (a subset of
`imsux` that maps cleanly between Python and JavaScript). Each item is a
regex source string emitted as a Python r-string and as a JavaScript
regex literal — the two engines see the same source.

Only patterns whose runtime semantics match Python's `re` and JavaScript's
`RegExp` belong here. Each regex family must ship with a fixture under
`evaluation/parity/fixtures/<family>.json` containing `should_match` and
`should_not_match` inputs. The parity check at
`scripts/check_pattern_parity.py` runs both engines against the fixture
and fails CI if they disagree on any input or if either engine disagrees
with the fixture's expected verdict.

When adding a regex family:

1. Create `patterns/regex/<family>.json` (schema v2, `kind: regex`).
2. Create `evaluation/parity/fixtures/<family>.json` with at least a
   handful of `should_match` and `should_not_match` strings.
3. Add the marker pair (`# pattern-sync:start <family>` / `end`) inside
   the corresponding constant array in `gates.py` and `patterns.ts`.
4. Run `python scripts/gen_patterns.py`.
5. Run `python scripts/check_pattern_parity.py` and confirm it passes.
6. Run the existing test suites (pytest, vitest) and confirm no
   regressions.

### CI enforcement

The `pattern-sync` job in `.github/workflows/ci.yml` runs:

* `python scripts/gen_patterns.py --check` — fails the build if the
  generated output diverges from what is committed.
* `python scripts/check_pattern_parity.py` — fails the build if Python's
  `re` and JavaScript's `RegExp` produce different verdicts for any
  fixture input, or if either engine disagrees with the fixture's
  expected verdict.

If either step fails, run the matching script locally, address the diff
or the divergence, and commit the result.

### Scope

`indicators` (plain lowercased substrings) and `regex` (regex source
strings, parity-validated) are both supported as of schema v2. Regex
families currently in the registry are limited to the six aligned
jailbreak families (`instruction-override`, `prompt-extraction`,
`filter-bypass`, `role-manipulation`, `roleplay-manipulation`,
`system-injection`). The remaining regex families in `gates.py` and
`patterns.ts` have semantic divergences between Python and TypeScript
that are out of scope for the registry until Frente C.3 (parity audit)
reconciles them.
