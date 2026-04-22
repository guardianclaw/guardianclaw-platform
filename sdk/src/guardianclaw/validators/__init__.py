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
They are exported for advanced customization only.

- CLAWValidator: Heuristic validation with pattern matching
- SemanticValidator: LLM-based semantic analysis
- Individual gates (CredibilityGate, LimitsGate, AvoidanceGate, WorthGate):
  low-level components used internally by CLAWValidator.

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

# Heuristic validators (regex-based)
from guardianclaw.validators.gates import (
    CredibilityGate,
    LimitsGate,
    AvoidanceGate,
    WorthGate,
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
    "CredibilityGate",
    "LimitsGate",
    "AvoidanceGate",
    "WorthGate",
    "CLAWValidator",
]

# Note: BaseGate is intentionally NOT in __all__ (B002)
# It's an abstract base class for internal use only.
# Direct subclassing is not part of the public API.
