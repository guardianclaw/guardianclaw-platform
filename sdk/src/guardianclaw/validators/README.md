# GuardianClaw Validators

This module provides validation for the CLAW (Credibility-Limits-Avoidance-Worth) protocol.

## Recommended Usage

For most use cases, use the high-level `GuardianClaw` API:

```python
from guardianclaw import GuardianClaw

claw = GuardianClaw()
result = claw.validate("content to check")
if not result.is_safe:
    print(f"Blocked: {result.violations}")
```

## Validator Types

### Heuristic (Regex-based)

Fast, local validation using pattern matching. No API keys required.

| Validator | Description |
|-----------|-------------|
| `CLAWValidator` | **Recommended**. Full 4-gate CLAW protocol |
| `TruthGate` | Detects deception, impersonation, false claims |
| `HarmGate` | Detects harmful content (weapons, malware, etc.) |
| `ScopeGate` | Detects boundary violations, prompt injection |
| `PurposeGate` | Detects lack of legitimate purpose |

```python
from guardianclaw.validators import CLAWValidator

validator = CLAWValidator()
result = validator.validate("your text here")
print(result["is_safe"])  # True or False
print(result["gates"])    # Status of each gate
print(result["violations"])  # List of issues found
```

### Semantic (LLM-based)

Deep validation using LLM reasoning. Requires API keys.

| Validator | Description |
|-----------|-------------|
| `SemanticValidator` | Synchronous LLM-based validation |
| `AsyncSemanticValidator` | Async version for concurrent requests |

```python
from guardianclaw.validators import SemanticValidator

validator = SemanticValidator(
    provider="openai",
    api_key="sk-..."
)
result = validator.validate("your text here")
```

## CLAW Protocol

The CLAW protocol consists of four gates that content must pass:

1. **Credibility Gate**: "Does this involve creating false information or deceiving others?"
2. **Avoidance Gate**: "Who or what could be harmed if this succeeds?"
3. **Limits Gate**: "Is this within appropriate boundaries?"
4. **Worth Gate**: "Does this serve legitimate benefit?"

All four gates must pass for content to be considered safe.

## Deprecated Classes

The following classes are deprecated and will be removed in version 3.0.0:

| Class | Replacement |
|-------|-------------|
| `THSValidator` | Use `CLAWValidator` (adds Purpose gate) |
| `JailbreakGate` | Integrated into `TruthGate` and `ScopeGate` |

## Architecture

```
validators/
├── __init__.py     # Public exports
├── gates.py        # Heuristic validators (regex-based)
├── semantic.py     # LLM-based validators
└── README.md       # This file
```
