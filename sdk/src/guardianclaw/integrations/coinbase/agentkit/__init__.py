"""
GuardianClaw AgentKit Integration.

Provides security guardrails for Coinbase AgentKit through:
- GuardianClawActionProvider: ActionProvider with CLAW validation
- Action wrappers for safe execution
- Pydantic schemas for input validation

This is the main integration point for AgentKit users.

Example:
    from coinbase_agentkit import AgentKit
    from guardianclaw.integrations.coinbase.agentkit import (
        GuardianClawActionProvider,
        claw_action_provider,
    )

    # Create provider
    provider = claw_action_provider(security_profile="strict")

    # Add to AgentKit
    agent = AgentKit(
        action_providers=[provider],
    )
"""

from .action_provider import (
    GuardianClawActionProvider,
    claw_action_provider,
)
from .schemas import (
    ValidateTransactionSchema,
    ValidateAddressSchema,
    CheckActionSafetySchema,
    GetSpendingSummarySchema,
    AssessDeFiRiskSchema,
    ConfigureGuardrailsSchema,
)
from .wrappers import (
    safe_action,
    create_safe_action_wrapper,
    GuardianClawActionWrapper,
)

__all__ = [
    # Action Provider
    "GuardianClawActionProvider",
    "claw_action_provider",
    # Schemas
    "ValidateTransactionSchema",
    "ValidateAddressSchema",
    "CheckActionSafetySchema",
    "GetSpendingSummarySchema",
    "AssessDeFiRiskSchema",
    "ConfigureGuardrailsSchema",
    # Wrappers
    "safe_action",
    "create_safe_action_wrapper",
    "GuardianClawActionWrapper",
]
