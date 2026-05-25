"""GuardianClaw x402 payment validation integration.

This module provides CLAW safety validation for x402 payment protocol,
enabling AI agents to make safe, validated payments.

x402 is an HTTP-native payment protocol by Coinbase that uses the
HTTP 402 status code for machine-to-machine payments.

Components:
    - GuardianClawX402Middleware: Main validation middleware
    - GuardianClawX402ActionProvider: AgentKit action provider
    - claw_x402_hooks: httpx event hooks
    - CLAWPaymentValidator: CLAW gate validators

Quick Start:
    >>> from guardianclaw.integrations.coinbase.x402 import GuardianClawX402Middleware
    >>>
    >>> middleware = GuardianClawX402Middleware()
    >>> result = middleware.validate_payment(
    ...     endpoint="https://api.example.com/paid",
    ...     payment_requirements=payment_req,
    ...     wallet_address="0x123...",
    ... )
    >>> if result.is_approved:
    ...     print("Payment safe to proceed")

With AgentKit:
    >>> from coinbase_agentkit import AgentKit
    >>> from guardianclaw.integrations.coinbase.x402 import claw_x402_action_provider
    >>>
    >>> agent = AgentKit(
    ...     action_providers=[
    ...         claw_x402_action_provider(security_profile="strict"),
    ...     ]
    ... )

With httpx hooks:
    >>> import httpx
    >>> from eth_account import Account
    >>> from guardianclaw.integrations.coinbase.x402 import claw_x402_hooks
    >>>
    >>> account = Account.from_key("0x...")
    >>> client = httpx.AsyncClient()
    >>> client.event_hooks = claw_x402_hooks(account)

References:
    - x402 Protocol: https://github.com/coinbase/x402
    - x402 Documentation: https://docs.cdp.coinbase.com/x402
"""

# Configuration
from .config import (
    ConfirmationThresholds,
    GuardianClawX402Config,
    SpendingLimits,
    ValidationConfig,
    get_default_config,
)

# Types
from .types import (
    EndpointReputation,
    PaymentAuditEntry,
    PaymentDecision,
    PaymentRequirementsModel,
    PaymentRiskLevel,
    PaymentValidationResult,
    SpendingRecord,
    SupportedNetwork,
    CLAWGate,
    CLAWGateResult,
)

# Validators
from .validators import (
    AvoidanceGateValidator,
    PaymentValidator,
    WorthGateValidator,
    LimitsGateValidator,
    CLAWPaymentValidator,
    CredibilityGateValidator,
)

# Middleware
from .middleware import (
    PaymentBlockedError,
    PaymentConfirmationRequired,
    PaymentRejectedError,
    GuardianClawX402Middleware,
    create_claw_x402_middleware,
)

# Hooks
from .hooks import (
    GuardianClawHttpxHooks,
    GuardianClawRequestsAdapter,
    create_claw_x402_client,
    parse_payment_required_response,
    select_payment_option,
    claw_x402_adapter,
    claw_x402_hooks,
)

# AgentKit Provider
from .agentkit_provider import (
    GuardianClawX402ActionProvider,
    claw_x402_action_provider,
)

# Drainer intel lookup (ClawPay Sprint 1)
from .drainer_db import (
    DrainerEntry,
    DrainerKind,
    DrainerLookup,
    DrainerMatch,
    DrainerSeverity,
    DrainerSource,
    InMemoryDrainerSource,
    SupabaseDrainerSource,
)

# Audit sink (ClawPay Sprint 2 Phase F)
from .audit_sink import (
    AuditRecord,
    AuditSink,
    InMemoryAuditSink,
    SupabaseAuditSink,
    build_audit_record,
)

# Pre-flight simulation (ClawPay Sprint 4)
from .simulation import (
    BalanceChange,
    HeliusSimulationProvider,
    InMemorySimulationProvider,
    OwnershipChange,
    SimulationGate,
    SimulationProvider,
    SimulationResult,
    SimulationStatus,
    TenderlySimulationProvider,
)

__all__ = [
    # Configuration
    "GuardianClawX402Config",
    "SpendingLimits",
    "ConfirmationThresholds",
    "ValidationConfig",
    "get_default_config",
    # Types
    "PaymentRiskLevel",
    "PaymentDecision",
    "CLAWGate",
    "CLAWGateResult",
    "PaymentValidationResult",
    "PaymentAuditEntry",
    "PaymentRequirementsModel",
    "EndpointReputation",
    "SpendingRecord",
    "SupportedNetwork",
    # Validators
    "PaymentValidator",
    "CredibilityGateValidator",
    "AvoidanceGateValidator",
    "LimitsGateValidator",
    "WorthGateValidator",
    "CLAWPaymentValidator",
    # Middleware
    "GuardianClawX402Middleware",
    "create_claw_x402_middleware",
    "PaymentBlockedError",
    "PaymentRejectedError",
    "PaymentConfirmationRequired",
    # Hooks
    "claw_x402_hooks",
    "claw_x402_adapter",
    "create_claw_x402_client",
    "GuardianClawHttpxHooks",
    "GuardianClawRequestsAdapter",
    "parse_payment_required_response",
    "select_payment_option",
    # AgentKit
    "GuardianClawX402ActionProvider",
    "claw_x402_action_provider",
    # Drainer intel
    "DrainerKind",
    "DrainerSeverity",
    "DrainerEntry",
    "DrainerMatch",
    "DrainerSource",
    "InMemoryDrainerSource",
    "SupabaseDrainerSource",
    "DrainerLookup",
    # Audit sink
    "AuditRecord",
    "AuditSink",
    "InMemoryAuditSink",
    "SupabaseAuditSink",
    "build_audit_record",
    # Simulation (Sprint 4)
    "SimulationStatus",
    "SimulationResult",
    "SimulationProvider",
    "SimulationGate",
    "InMemorySimulationProvider",
    "HeliusSimulationProvider",
    "TenderlySimulationProvider",
    "BalanceChange",
    "OwnershipChange",
]
