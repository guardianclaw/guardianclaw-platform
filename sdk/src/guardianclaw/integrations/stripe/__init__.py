"""GuardianClaw Stripe Agent Toolkit safety layer (ClawPay Sprint 3).

Provider-neutral counterpart of `guardianclaw.integrations.coinbase.x402`. The
two share the same four CLAW gates (Credibility / Avoidance / Limits / Worth),
the same DrainerLookup and AuditSink, and the same risk-level vocabulary —
the only thing that changes is the payment shape on the wire.

Where x402 deals with on-chain HTTP 402 payments, this module deals with
Stripe API calls a Stripe Agent Toolkit-powered agent is about to make
(PaymentIntent, Charge, Refund, Invoice, PaymentLink, Subscription).

Usage:

    >>> import os, stripe
    >>> from guardianclaw.integrations.stripe import (
    ...     GuardianClawStripeMiddleware,
    ...     StripePaymentRequest,
    ... )
    >>> middleware = GuardianClawStripeMiddleware()
    >>> request = StripePaymentRequest(
    ...     intent_kind="payment_intent.create",
    ...     amount=4900,
    ...     currency="usd",
    ...     customer="cus_NksY4M0bM4FfXg",
    ...     description="Daily API budget refill",
    ... )
    >>> result = middleware.validate_payment(request, wallet_address="agent-1")
    >>> if result.is_approved:
    ...     stripe.PaymentIntent.create(
    ...         amount=4900, currency="usd", customer="cus_NksY4M0bM4FfXg",
    ...     )

References:
    - Stripe Agent Toolkit: https://docs.stripe.com/agents
    - npm @stripe/agent-toolkit, PyPI stripe-agent-toolkit
"""

from .config import (
    GuardianClawStripeConfig,
    SpendingLimits,
    ConfirmationThresholds,
    ValidationConfig,
    get_default_config,
)
from .middleware import (
    GuardianClawStripeMiddleware,
    PaymentBlockedError,
    PaymentRejectedError,
    PaymentConfirmationRequired,
    create_stripe_middleware,
)
from .types import (
    StripeApiKeyKind,
    StripeIntentKind,
    StripePaymentRequest,
    StripeAuditFacts,
    ZERO_DECIMAL_CURRENCIES,
    normalize_amount_usd,
)
from .validators import (
    StripeCLAWValidator,
    StripeCredibilityGateValidator,
    StripeAvoidanceGateValidator,
    StripeLimitsGateValidator,
    StripeWorthGateValidator,
)

__all__ = [
    # Config
    "GuardianClawStripeConfig",
    "SpendingLimits",
    "ConfirmationThresholds",
    "ValidationConfig",
    "get_default_config",
    # Middleware
    "GuardianClawStripeMiddleware",
    "PaymentBlockedError",
    "PaymentRejectedError",
    "PaymentConfirmationRequired",
    "create_stripe_middleware",
    # Types
    "StripeApiKeyKind",
    "StripeIntentKind",
    "StripePaymentRequest",
    "StripeAuditFacts",
    "ZERO_DECIMAL_CURRENCIES",
    "normalize_amount_usd",
    # Validators
    "StripeCLAWValidator",
    "StripeCredibilityGateValidator",
    "StripeAvoidanceGateValidator",
    "StripeLimitsGateValidator",
    "StripeWorthGateValidator",
]
