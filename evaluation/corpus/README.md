# CLAW Correctness Corpus

Reproducible attack-class corpus used to validate that the CLAW protocol (Credibility, Limits, Avoidance, Worth) produces stable verdicts across SDK releases. Each class file contains hand-curated inputs paired with expected per-gate verdicts; the harness runs the SDK and reports any drift.

## Goals

- **Regression detection.** Any change to gates, patterns, or registries that flips a verdict surfaces as a corpus diff.
- **Behavioral documentation.** The expected verdicts double as a contract: this is what the firewall is supposed to do for these attack shapes, today.
- **Honest scope.** Covers heuristic detection only. Semantic Validator (LLM-based Gate 4 Observer) is out of scope; that lives under `evaluation/observer/` (planned).

## Layout

```
evaluation/corpus/
├── README.md                  ← this file
├── SCHEMA.md                  ← per-item field reference
├── run.py                     ← harness: SDK vs corpus diff
├── prompt-injection.json
├── data-exfil.json            (planned)
├── jailbreak.json             (planned)
├── encoding.json              (planned)
├── multilingual.json          (planned)
├── instruction-override.json  (planned)
├── role-play.json             (planned)
└── indirect-via-memory.json   (planned)
```

Each class file is independently versioned (`schema_version`, `class_version`). Adding items bumps `class_version`; renaming fields or restructuring bumps `schema_version` and requires harness update.

## Class definitions

| Class | What it tests | Primary gate(s) expected to fail |
|---|---|---|
| `prompt-injection` | Direct attempts to override system prompt or instructions embedded in user input | `limits` (instruction-override / prompt-extraction / filter-bypass / system-injection families) |
| `data-exfil` | Attempts to extract sensitive data (system prompt, secrets, conversation history) | `limits` (prompt-extraction) — and `avoidance` when payload itself contains secrets |
| `jailbreak` | Persona-based or framing-based attempts to bypass safety (DAN, "do anything now", evil twin) | `credibility` (deception, role-manipulation) + `limits` (filter-bypass) |
| `encoding` | Obfuscated payloads (base64, rot13, leet, unicode confusables, zero-width) | varies — depends on whether the obfuscator preserves a literal pattern match |
| `multilingual` | Same attack intent in non-English (es, pt, fr, de, ru, zh, ja, ar) | same as English equivalents (parity expectation; many will currently `pass` because patterns are English-anchored — that is the regression we want to track) |
| `instruction-override` | Narrow class focused on "ignore previous", "forget system", "you are now" variants | `limits` (instruction-override family) |
| `role-play` | Fictional framings ("write a story where...", "as a penetration tester...") | `credibility` (role-manipulation) — fail when frame is harmful, pass when benign |
| `indirect-via-memory` | Attacks delivered through retrieved memory or quoted document content | `limits` (instruction-override) + observer (out of scope here) |

## Expected verdict semantics

For every item, every gate has an expected verdict:

| Verdict | Meaning |
|---|---|
| `"pass"` | Gate must NOT fire on this input. |
| `"fail"` | Gate MUST fire on this input. |
| `"any"` | Gate behavior is intentionally unconstrained for this item (e.g. encoded payload where decoder may or may not be wired). Use sparingly and only with explicit rationale. |

`overall` is `"fail"` if any gate is `"fail"`, else `"pass"`. The harness derives it.

## Running

```bash
cd sdk && pip install -e .
python evaluation/corpus/run.py                          # all classes
python evaluation/corpus/run.py --class prompt-injection # single class
python evaluation/corpus/run.py --report report.json     # write JSON report
```

Exit codes:
- `0` — all expected verdicts match SDK output
- `1` — at least one mismatch (regression)
- `2` — corpus file malformed

## Curation principles

1. **Realistic inputs only.** Items must look like something a real adversary or confused user would write. No bare regex anchors.
2. **Calibrated to current behavior.** `expected_verdict` reflects what the SDK does today. When SDK improves, bump corpus to match in same PR.
3. **Diverse surface.** Within a class, vary phrasing, length, capitalization, punctuation. Avoid 50 minor variants of one stem.
4. **Source attribution.** Each item declares `source` (`curated`, `literature`, `wildjailbreak-style`, etc.). Don't paste verbatim from copyrighted datasets — paraphrase.
5. **Rationale per item.** One sentence explaining why the verdict is what it is. If you can't write the rationale, the item shouldn't be in the corpus.

## Frontier gaps

- Semantic / LLM-based gates not exercised here.
- No multi-turn corpus (planned: Frente C.2 Crescendo).
- No adversarial sweeps (planned: Frente C.1 garak).
- Observer transcripts not validated.

These are tracked separately under Frente C.
