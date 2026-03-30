"""
Response validators implementing CLAW (Credibility-Limits-Avoidance-Worth) protocol.

RECOMMENDED: Use GuardianClaw or LayeredValidator
==============================================

For most use cases, use the high-level APIs:

    from guardianclaw import GuardianClaw

    claw = GuardianClaw()
    is_safe, violations = claw.validate("content")

For advanced usage with full control:

    from guardianclaw.validation import LayeredValidator

    validator = LayeredValidator()
    result = validator.validate("content")
    if not result.is_safe:
        print(f"Blocked: {result.violations}")

Internal Implementation (not recommended for direct use)
=========================================================

The validators in this module are internal implementation details.
They are exported for backwards compatibility but will be deprecated.

- CLAWValidator: Heuristic validation with pattern matching
- SemanticValidator: LLM-based semantic analysis
- Individual gates (TruthGate, HarmGate, etc.): Low-level components

These are used internally by LayeredValidator and should not be
instantiated directly in application code.
"""

# Semantic validators (LLM-based, recommended)
from guardianclaw.validators.semantic import (
    SemanticValidator,
    AsyncSemanticValidator,
    CLAWResult,
    CLAWGate,
    RiskLevel,
    create_validator,
    validate_content,
)

# Heuristic validators (regex-based, legacy)
from guardianclaw.validators.gates import (
    TruthGate,
    HarmGate,
    ScopeGate,
    PurposeGate,
    JailbreakGate,
    THSValidator,
    CLAWValidator,
)

__all__ = [
    # Semantic (recommended)
    "SemanticValidator",
    "AsyncSemanticValidator",
    "CLAWResult",
    "CLAWGate",
    "RiskLevel",
    "create_validator",
    "validate_content",
    # Heuristic (regex-based)
    "TruthGate",
    "HarmGate",
    "ScopeGate",
    "PurposeGate",
    "CLAWValidator",
    # DEPRECATED - kept for backwards compatibility (M003/M004)
    # These emit DeprecationWarning when instantiated.
    # Use CLAWValidator instead.
    "JailbreakGate",  # Deprecated: integrated into TruthGate/ScopeGate
    "THSValidator",   # Deprecated: use CLAWValidator (4 gates)
]

# Note: BaseGate is intentionally NOT in __all__ (B002)
# It's an abstract base class for internal use only.
# Direct subclassing is not part of the public API.
