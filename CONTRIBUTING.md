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

### CI enforcement

The `pattern-sync` job in `.github/workflows/ci.yml` runs
`python scripts/gen_patterns.py --check` and fails the build if the
generated output diverges from what is committed. If that job fails, run
the generator locally and commit the result.

### Scope of v1

- Only plain lowercased string indicators are supported.
- Regex patterns remain hand-maintained on each side until their runtime
  semantics have been audited for parity between Python's `re` and
  JavaScript's `RegExp`.
