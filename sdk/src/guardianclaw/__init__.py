"""
GuardianClaw AI - Practical AI Alignment for Developers

A comprehensive AI safety toolkit providing:
- Alignment seeds (system prompts that improve AI safety)
- Response validation (CLAW gates: Credibility, Limits, Avoidance, Worth)
- Memory integrity checking (defense against memory injection)
- Fiduciary AI principles (duty of loyalty and care)
- Database query validation (defense against data exfiltration)
- Regulatory compliance (EU AI Act, OWASP LLM Top 10)
- Provider integrations (OpenAI, Anthropic)
- Framework integrations (Virtuals, Garak, OpenGuardrails, OpenAI Agents, Google ADK)

Quick Start:
    from guardianclaw import GuardianClaw

    # Create a claw instance
    claw = GuardianClaw()

    # Get an alignment seed
    seed = claw.get_seed("standard")

    # Validate content
    is_safe, violations = claw.validate("Some content to check")

    # Or use the chat wrapper directly
    response = claw.chat("Hello, how can you help me?")

Layered Validation (advanced):
    from guardianclaw.validation import LayeredValidator

    # Heuristic only (no API required)
    validator = LayeredValidator()
    result = validator.validate("content to check")

    # With semantic validation
    validator = LayeredValidator(
        semantic_api_key="sk-...",
        use_semantic=True,
    )
    result = validator.validate("content")
    if not result.is_safe:
        print(f"Blocked: {result.violations}")

Memory Integrity (for AI agents):
    from guardianclaw.memory import MemoryIntegrityChecker

    checker = MemoryIntegrityChecker(secret_key="your-secret")
    signed = checker.sign_entry(MemoryEntry(content="User data"))
    result = checker.verify_entry(signed)

Fiduciary AI (ensure AI acts in user's best interest):
    from guardianclaw.fiduciary import FiduciaryValidator, UserContext

    validator = FiduciaryValidator()
    result = validator.validate_action(
        action="Recommend high-risk investment",
        user_context=UserContext(risk_tolerance="low")
    )
    if not result.compliant:
        print(f"Fiduciary violation: {result.violations}")

Database Guard (protect against data exfiltration):
    from guardianclaw.database import DatabaseGuard

    guard = DatabaseGuard(
        max_rows_per_query=1000,
        require_where_clause=True,
    )
    result = guard.validate("SELECT name FROM users WHERE id = 1")
    if result.blocked:
        print(f"Query blocked: {result.reason}")

EU AI Act Compliance:
    from guardianclaw.compliance import EUAIActComplianceChecker

    checker = EUAIActComplianceChecker(api_key="...")
    result = checker.check_compliance(
        content="Based on your social behavior...",
        context="financial",
        system_type="high_risk"
    )
    if not result.compliant:
        print(f"Violations: {result.article_5_violations}")

Framework Integrations:
    from guardianclaw.integrations.virtuals import GuardianClawSafetyWorker
    from guardianclaw.integrations.openguardrails import OpenGuardrailsValidator
    from guardianclaw.integrations.openai_agents import create_claw_agent

Documentation: https://guardianclaw.org/docs
GitHub: https://github.com/guardian-claw/guardianclaw
"""

from importlib.metadata import version as _pkg_version, PackageNotFoundError as _PackageNotFoundError

# Core - always available
from guardianclaw.core import GuardianClaw, SeedLevel
from guardianclaw.core.interfaces import Validator, AsyncValidator
from guardianclaw.core.exceptions import (
    GuardianClawError,
    ValidationError,
    ConfigurationError,
    IntegrationError,
)

# v3.0 architecture - unified 3-gate validation
from guardianclaw.core import (
    ClawValidator,
    ClawConfig,
    ClawObserver,
    GuardianClawResult,
    ObservationResult,
)

# Validation - recommended API for advanced usage
from guardianclaw.validation import (
    LayeredValidator,
    AsyncLayeredValidator,
    ValidationResult,
    ValidationConfig,
    ValidationLayer,
)
from guardianclaw.validation.types import RiskLevel as ValidationRiskLevel

# Memory Integrity
from guardianclaw.memory import (
    MemoryIntegrityChecker,
    MemoryEntry,
    SignedMemoryEntry,
    MemoryTamperingDetected,
    # Content validation (v2.0)
    MemoryContentValidator,
    MemoryContentUnsafe,
    ContentValidationResult,
    is_memory_safe,
)

# Fiduciary AI
from guardianclaw.fiduciary import (
    FiduciaryValidator,
    FiduciaryGuard,
    FiduciaryResult,
    UserContext,
    validate_fiduciary,
    is_fiduciary_compliant,
)

# Compliance
from guardianclaw.compliance import (
    EUAIActComplianceChecker,
    ComplianceResult,
    RiskLevel,
    SystemType,
    check_eu_ai_act_compliance,
)

# Database Guard
from guardianclaw.database import (
    DatabaseGuard,
    QueryBlocked,
    QueryValidationResult,
    validate_query,
    is_safe_query,
)

try:
    __version__ = _pkg_version("guardianclaw")
except _PackageNotFoundError:
    # Fallback for development installs where the package is imported
    # before `pip install -e .` has registered its metadata.
    __version__ = "0.0.0+unknown"

def get_seed(level: str = "standard") -> str:
    """Convenience function to get an alignment seed.

    Args:
        level: Seed level - 'minimal', 'standard', or 'full'

    Returns:
        The seed content as a string.

    Example:
        >>> from guardianclaw import get_seed
        >>> seed = get_seed("standard")
        >>> print(len(seed))
        4521
    """
    claw = GuardianClaw()
    return claw.get_seed(level)


__all__ = [
    # Core
    "GuardianClaw",
    "SeedLevel",
    "get_seed",
    # Core Interfaces (for type hints and DI)
    "Validator",
    "AsyncValidator",
    # Core Exceptions
    "GuardianClawError",
    "ValidationError",
    "ConfigurationError",
    "IntegrationError",
    # v3.0 architecture - unified 3-gate validation
    "ClawValidator",
    "ClawConfig",
    "ClawObserver",
    "GuardianClawResult",
    "ObservationResult",
    # Validation (recommended for advanced usage)
    "LayeredValidator",
    "AsyncLayeredValidator",
    "ValidationResult",
    "ValidationConfig",
    "ValidationLayer",
    "ValidationRiskLevel",
    # Memory Integrity
    "MemoryIntegrityChecker",
    "MemoryEntry",
    "SignedMemoryEntry",
    "MemoryTamperingDetected",
    # Memory Content Validation (v2.0)
    "MemoryContentValidator",
    "MemoryContentUnsafe",
    "ContentValidationResult",
    "is_memory_safe",
    # Fiduciary AI
    "FiduciaryValidator",
    "FiduciaryGuard",
    "FiduciaryResult",
    "UserContext",
    "validate_fiduciary",
    "is_fiduciary_compliant",
    # Compliance
    "EUAIActComplianceChecker",
    "ComplianceResult",
    "RiskLevel",
    "SystemType",
    "check_eu_ai_act_compliance",
    # Database Guard
    "DatabaseGuard",
    "QueryBlocked",
    "QueryValidationResult",
    "validate_query",
    "is_safe_query",
]
