"""Configuration for the GuardianClaw Stripe integration.

Mirrors the shape of ``coinbase.x402.config`` so a single SecurityProfile
preset can be applied consistently across providers. Field defaults are
chosen to match the Sprint 2 ClawPay dashboard contract.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# ============================================================================
# Spending and confirmation thresholds
# ============================================================================


@dataclass
class SpendingLimits:
    """USD-equivalent caps applied by the LimitsGate.

    The local in-memory enforcement in the middleware mirrors what the
    `clawpay_spending_limits` table enforces in the dashboard — both use
    USD because Stripe agents commonly transact across multiple currencies.
    """

    max_single_payment: float = 100.0
    max_daily_total: float = 500.0
    max_weekly_total: float = 2_000.0
    max_monthly_total: float = 5_000.0
    max_transactions_per_day: int = 50
    max_transactions_per_hour: int = 10

    def __post_init__(self) -> None:
        if self.max_single_payment <= 0:
            raise ValueError("max_single_payment must be > 0")
        if self.max_transactions_per_hour <= 0:
            raise ValueError("max_transactions_per_hour must be > 0")


@dataclass
class ConfirmationThresholds:
    """Payment-size thresholds that escalate APPROVE → REQUIRE_CONFIRMATION."""

    amount_threshold: float = 10.0
    unknown_customer_threshold: float = 5.0
    new_destination_threshold: float = 5.0
    high_risk_threshold: float = 1.0


@dataclass
class ValidationConfig:
    """Toggles for which checks the middleware runs.

    Operators dial these by SecurityProfile (see ``get_default_config``).
    """

    strict_mode: bool = False

    # Stripe-specific. When True, fail Credibility for keys that aren't `rk_*`.
    require_restricted_api_key: bool = True
    # Whether to block live keys (rk_live_*, sk_live_*) when sandbox-only.
    sandbox_only: bool = False
    # Currency allowlist. Empty => allow all ISO-4217 currencies.
    allowed_currencies: list[str] = field(default_factory=list)

    allow_unknown_customers: bool = True
    allow_unknown_destinations: bool = True
    enable_spending_limits: bool = True
    enable_rate_limiting: bool = True
    audit_all_payments: bool = True


# ============================================================================
# Aggregate config
# ============================================================================


SecurityProfile = Literal["permissive", "standard", "strict", "paranoid"]


@dataclass
class GuardianClawStripeConfig:
    """Top-level Stripe middleware configuration."""

    spending_limits: SpendingLimits = field(default_factory=SpendingLimits)
    confirmation_thresholds: ConfirmationThresholds = field(default_factory=ConfirmationThresholds)
    validation: ValidationConfig = field(default_factory=ValidationConfig)

    blocked_customers: list[str] = field(default_factory=list)
    blocked_destinations: list[str] = field(default_factory=list)
    blocked_description_terms: list[str] = field(
        default_factory=lambda: list(DEFAULT_BLOCKED_DESCRIPTION_TERMS)
    )


# ============================================================================
# Defaults
# ============================================================================


# Description terms that we treat as automatic risk markers. Kept short — the
# AvoidanceGate combines this list with drainer_intel for the real decision.
DEFAULT_BLOCKED_DESCRIPTION_TERMS: frozenset[str] = frozenset(
    {
        "private key",
        "seed phrase",
        "mnemonic",
        "drain wallet",
        "transfer all funds",
        "send all balance",
        "empty account",
    }
)


# Description phrasing that hints at urgency-based social engineering. Used
# by AvoidanceGate to flag risk factors (doesn't block on its own).
SUSPICIOUS_URGENCY_TERMS: frozenset[str] = frozenset(
    {"urgent", "immediately", "right now", "asap", "verify now", "act fast"}
)


def get_default_config(profile: SecurityProfile = "standard") -> GuardianClawStripeConfig:
    """Preset config for each profile.

    Profiles deliberately mirror the x402 ones so an operator can switch
    providers without re-tuning their thresholds.
    """
    if profile == "permissive":
        return GuardianClawStripeConfig(
            spending_limits=SpendingLimits(
                max_single_payment=1_000.0,
                max_daily_total=5_000.0,
                max_weekly_total=25_000.0,
                max_monthly_total=100_000.0,
                max_transactions_per_day=200,
                max_transactions_per_hour=50,
            ),
            validation=ValidationConfig(
                strict_mode=False,
                require_restricted_api_key=False,
                allow_unknown_customers=True,
                allow_unknown_destinations=True,
            ),
        )

    if profile == "strict":
        return GuardianClawStripeConfig(
            spending_limits=SpendingLimits(
                max_single_payment=25.0,
                max_daily_total=100.0,
                max_weekly_total=500.0,
                max_monthly_total=1_000.0,
                max_transactions_per_day=10,
                max_transactions_per_hour=3,
            ),
            confirmation_thresholds=ConfirmationThresholds(
                amount_threshold=2.0,
                unknown_customer_threshold=1.0,
                new_destination_threshold=1.0,
                high_risk_threshold=0.5,
            ),
            validation=ValidationConfig(
                strict_mode=True,
                require_restricted_api_key=True,
                allow_unknown_customers=False,
                allow_unknown_destinations=False,
            ),
        )

    if profile == "paranoid":
        return GuardianClawStripeConfig(
            spending_limits=SpendingLimits(
                max_single_payment=5.0,
                max_daily_total=20.0,
                max_weekly_total=100.0,
                max_monthly_total=200.0,
                max_transactions_per_day=5,
                max_transactions_per_hour=1,
            ),
            confirmation_thresholds=ConfirmationThresholds(
                amount_threshold=0.5,
                unknown_customer_threshold=0.25,
                new_destination_threshold=0.25,
                high_risk_threshold=0.10,
            ),
            validation=ValidationConfig(
                strict_mode=True,
                require_restricted_api_key=True,
                sandbox_only=True,
                allow_unknown_customers=False,
                allow_unknown_destinations=False,
            ),
        )

    # standard
    return GuardianClawStripeConfig()


__all__ = [
    "ConfirmationThresholds",
    "DEFAULT_BLOCKED_DESCRIPTION_TERMS",
    "GuardianClawStripeConfig",
    "SecurityProfile",
    "SpendingLimits",
    "SUSPICIOUS_URGENCY_TERMS",
    "ValidationConfig",
    "get_default_config",
]
