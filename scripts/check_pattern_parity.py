"""Verify that every regex family in patterns/regex/*.json behaves identically
under Python's re module and JavaScript's RegExp engine.

For each regex family JSON file in patterns/regex/:

  1. Read the family + flags + items.
  2. Read the matching fixture from evaluation/parity/fixtures/<family>.json
     which lists 'should_match' inputs (any pattern in the family must
     match) and 'should_not_match' inputs (no pattern in the family may
     match).
  3. Run the Python verdict (any-pattern-matches) for each input.
  4. Hand the same family + inputs to the Node companion at
     scripts/check_pattern_parity.mjs and read its JSON verdicts.
  5. Compare. The two engines must agree on every input. Any divergence
     is a parity violation.

Two failure modes:

  * Verdict mismatch between engines — same input, different yes/no.
    These are the parity bugs we exist to catch.
  * Verdict mismatches the fixture's expected — both engines agree but
    the family is broken in the same way on both sides. The fixture is
    treated as authoritative; the family's content needs to change or
    the fixture does.

CLI:

    python scripts/check_pattern_parity.py            # run check, exit 1 on
                                                       # any mismatch
    python scripts/check_pattern_parity.py --report   # print full per-input
                                                       # verdicts even on pass
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGEX_DIR = ROOT / "patterns" / "regex"
FIXTURE_DIR = ROOT / "evaluation" / "parity" / "fixtures"
NODE_RUNNER = ROOT / "scripts" / "check_pattern_parity.mjs"

PY_FLAG_MAP = {
    "i": re.IGNORECASE,
    "m": re.MULTILINE,
    "s": re.DOTALL,
    "u": re.UNICODE,
    "x": re.VERBOSE,
}


def load_family(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("kind") != "regex":
        raise SystemExit(f"{path}: not a regex family")
    return data


def py_verdicts(family: dict, inputs: list[str]) -> list[bool]:
    py_flags = 0
    for ch in family.get("flags", ""):
        py_flags |= PY_FLAG_MAP.get(ch, 0)
    compiled = [re.compile(p, py_flags) for p in family["items"]]
    return [any(p.search(s) for p in compiled) for s in inputs]


def js_verdicts(family_name: str, inputs: list[str]) -> list[bool]:
    payload = json.dumps({"family": family_name, "inputs": inputs})
    result = subprocess.run(
        ["node", str(NODE_RUNNER)],
        input=payload,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise SystemExit(
            f"node runner failed for {family_name!r}: {result.stderr.strip()}"
        )
    return json.loads(result.stdout)["verdicts"]


def check_family(family_path: Path, report: bool) -> int:
    family = load_family(family_path)
    name = family["name"]
    fixture_path = FIXTURE_DIR / f"{name}.json"
    if not fixture_path.exists():
        sys.stderr.write(
            f"missing fixture for {name!r}: expected {fixture_path}\n"
        )
        return 1
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    pos = list(fixture.get("should_match", []))
    neg = list(fixture.get("should_not_match", []))
    inputs = pos + neg
    expected = [True] * len(pos) + [False] * len(neg)

    py = py_verdicts(family, inputs)
    js = js_verdicts(name, inputs)

    failures: list[str] = []
    for s, e, p, j in zip(inputs, expected, py, js):
        marker = "ok" if (p == j == e) else "FAIL"
        if report:
            print(f"  {marker} py={p} js={j} expected={e}  {s!r}")
        if p != j:
            failures.append(
                f"engine divergence on {s!r}: py={p} js={j}"
            )
        elif p != e:
            failures.append(
                f"both engines disagree with fixture on {s!r}: "
                f"got={p} expected={e}"
            )

    if failures:
        sys.stderr.write(f"\nFamily {name}: {len(failures)} failure(s)\n")
        for f in failures:
            sys.stderr.write(f"  - {f}\n")
        return 1
    if report:
        print(f"  {name}: {len(inputs)} inputs, all engines agree, all match fixture")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()

    if not NODE_RUNNER.exists():
        raise SystemExit(f"node runner missing at {NODE_RUNNER}")

    rc = 0
    for path in sorted(REGEX_DIR.glob("*.json")):
        if args.report:
            print(f"\n[{path.stem}]")
        rc |= check_family(path, args.report)
    if rc == 0 and not args.report:
        sys.stdout.write("pattern-parity: all families passed\n")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
