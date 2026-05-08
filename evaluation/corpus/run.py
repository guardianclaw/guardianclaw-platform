"""Run the SDK against the corpus and report verdict mismatches.

Each class file under evaluation/corpus/ pairs attack inputs with expected
per-gate verdicts. This harness loads them, runs CLAWValidator, and exits
non-zero if any verdict diverges from expectation. Use --report to dump a
JSON report; without --verbose only mismatches are printed.

Usage:
    python evaluation/corpus/run.py
    python evaluation/corpus/run.py --class prompt-injection
    python evaluation/corpus/run.py --report report.json
    python evaluation/corpus/run.py --verbose
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

CORPUS_DIR = Path(__file__).resolve().parent
SUPPORTED_SCHEMA_VERSION = 1
GATES = ("credibility", "limits", "avoidance", "worth")
VERDICTS = ("pass", "fail", "any")


@dataclass
class Mismatch:
    class_name: str
    item_id: str
    input_excerpt: str
    expected: dict[str, str]
    actual: dict[str, str]
    violations: list[str]
    diff: list[str]


@dataclass
class Report:
    classes_run: list[str] = field(default_factory=list)
    total_items: int = 0
    matches: int = 0
    mismatches: list[Mismatch] = field(default_factory=list)
    malformed: list[str] = field(default_factory=list)


def _excerpt(text: str, limit: int = 80) -> str:
    text = text.replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def load_class(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    schema = data.get("schema_version")
    if schema != SUPPORTED_SCHEMA_VERSION:
        raise ValueError(
            f"{path.name}: schema_version={schema!r} not supported "
            f"(expected {SUPPORTED_SCHEMA_VERSION})"
        )
    if data.get("class") != path.stem:
        raise ValueError(
            f"{path.name}: class={data.get('class')!r} does not match filename"
        )
    items = data.get("items")
    if not isinstance(items, list):
        raise ValueError(f"{path.name}: items must be a list")
    seen_ids: set[str] = set()
    for item in items:
        for key in ("id", "input", "language", "source", "expected_verdict", "rationale"):
            if key not in item:
                raise ValueError(
                    f"{path.name}: item missing required field {key!r}: {item!r}"
                )
        if item["id"] in seen_ids:
            raise ValueError(f"{path.name}: duplicate item id {item['id']!r}")
        seen_ids.add(item["id"])
        for gate in GATES:
            verdict = item["expected_verdict"].get(gate)
            if verdict not in VERDICTS:
                raise ValueError(
                    f"{path.name}:{item['id']}: gate {gate!r} verdict "
                    f"{verdict!r} not in {VERDICTS}"
                )
    return data


def diff_verdict(expected: dict[str, str], actual: dict[str, str]) -> list[str]:
    diffs: list[str] = []
    for gate in GATES:
        want = expected[gate]
        got = actual[gate]
        if want == "any":
            continue
        if want != got:
            diffs.append(f"{gate}: expected {want}, got {got}")
    return diffs


def run(class_filter: str | None) -> tuple[Report, int]:
    try:
        from guardianclaw.validators.gates import CLAWValidator
    except ImportError as exc:
        sys.stderr.write(
            "guardianclaw SDK not importable. Install it first:\n"
            "    cd sdk && pip install -e .\n"
            f"Underlying error: {exc}\n"
        )
        return Report(), 2

    validator = CLAWValidator()
    report = Report()

    paths = sorted(CORPUS_DIR.glob("*.json"))
    if not paths:
        sys.stderr.write(f"no corpus files found in {CORPUS_DIR}\n")
        return report, 2

    for path in paths:
        if class_filter and path.stem != class_filter:
            continue
        try:
            data = load_class(path)
        except (ValueError, json.JSONDecodeError) as exc:
            report.malformed.append(f"{path.name}: {exc}")
            continue
        report.classes_run.append(path.stem)
        for item in data["items"]:
            report.total_items += 1
            result = validator.validate(item["input"])
            actual = {gate: result["gates"][gate] for gate in GATES}
            diff = diff_verdict(item["expected_verdict"], actual)
            if diff:
                report.mismatches.append(
                    Mismatch(
                        class_name=path.stem,
                        item_id=item["id"],
                        input_excerpt=_excerpt(item["input"]),
                        expected={gate: item["expected_verdict"][gate] for gate in GATES},
                        actual=actual,
                        violations=list(result.get("violations", [])),
                        diff=diff,
                    )
                )
            else:
                report.matches += 1

    if report.malformed:
        return report, 2
    return report, 0 if not report.mismatches else 1


def write_report(report: Report, path: Path) -> None:
    payload = {
        "classes_run": report.classes_run,
        "total_items": report.total_items,
        "matches": report.matches,
        "mismatch_count": len(report.mismatches),
        "mismatches": [
            {
                "class": m.class_name,
                "id": m.item_id,
                "input_excerpt": m.input_excerpt,
                "expected": m.expected,
                "actual": m.actual,
                "violations": m.violations,
                "diff": m.diff,
            }
            for m in report.mismatches
        ],
        "malformed": report.malformed,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def print_report(report: Report, verbose: bool) -> None:
    sys.stdout.write(
        f"corpus: {report.total_items} items across "
        f"{len(report.classes_run)} class(es); "
        f"{report.matches} match, {len(report.mismatches)} mismatch\n"
    )
    if report.malformed:
        sys.stderr.write("\nmalformed corpus files:\n")
        for line in report.malformed:
            sys.stderr.write(f"  - {line}\n")
    if report.mismatches:
        sys.stderr.write("\nmismatches:\n")
        for m in report.mismatches:
            sys.stderr.write(
                f"  [{m.class_name}/{m.item_id}] {m.input_excerpt}\n"
            )
            for d in m.diff:
                sys.stderr.write(f"      {d}\n")
            if verbose and m.violations:
                sys.stderr.write(f"      violations: {m.violations}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--class", dest="class_filter", default=None)
    parser.add_argument("--report", type=Path, default=None)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    report, code = run(args.class_filter)
    print_report(report, args.verbose)
    if args.report is not None:
        write_report(report, args.report)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
