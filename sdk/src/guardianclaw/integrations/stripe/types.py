"""Type definitions for the GuardianClaw Stripe integration (ClawPay Sprint 3).

Mirrors the shape of the inputs an agent constructs when calling the Stripe
Agent Toolkit (PaymentIntent.create, Charge.create, Refund.create, etc.).
We deliberately model a single ``StripePaymentRequest`` covering all the
intent kinds rather than one Pydantic class per Stripe object — the CLAW
gates care about the same five fields (kind, amount, currency, customer,
destination) regardless of which Stripe endpoint they end up at.

Why provider-agnostic CLAW types are imported from the validators package
instead of duplicated here: the four gates and the risk-level vocabulary
exist *above* any specific provider. x402 (Sprint 1-2) imports the same
``CLAWGate`` enum.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# Import CLAW types from the canonical source — same instances used by x402.
from guardianclaw.validators.semantic import CLAWGate

# Re-export so callers don't need to know the canonical location.
__all_re_export__ = ("CLAWGate",)


# ============================================================================
# Stripe API key shape detection
# ============================================================================


class StripeApiKeyKind(str, Enum):
    """Detected kind of Stripe API key prefix.

    `rk_*` (restricted) is the only kind Stripe officially recommends for
    agents — full secret keys give the agent permission to do anything the
    account can do.
    """

    RESTRICTED_LIVE = "restricted_live"
    RESTRICTED_TEST = "restricted_test"
    SECRET_LIVE = "secret_live"
    SECRET_TEST = "secret_test"
    PUBLISHABLE = "publishable"
    UNKNOWN = "unknown"

    @classmethod
    def detect(cls, key: str | None) -> "StripeApiKeyKind":
        if not key:
            return cls.UNKNOWN
        if key.startswith("rk_live_"):
            return cls.RESTRICTED_LIVE
        if key.startswith("rk_test_"):
            return cls.RESTRICTED_TEST
        if key.startswith("sk_live_"):
            return cls.SECRET_LIVE
        if key.startswith("sk_test_"):
            return cls.SECRET_TEST
        if key.startswith("pk_"):
            return cls.PUBLISHABLE
        return cls.UNKNOWN

    @property
    def is_restricted(self) -> bool:
        return self in (self.RESTRICTED_LIVE, self.RESTRICTED_TEST)

    @property
    def is_live(self) -> bool:
        return self in (self.RESTRICTED_LIVE, self.SECRET_LIVE)


# ============================================================================
# Stripe intent kinds
# ============================================================================


class StripeIntentKind(str, Enum):
    """Operation the agent is about to perform via the Stripe Agent Toolkit.

    Granularity matches the documented Toolkit surface
    (`docs.stripe.com/agents` covers Payment Intents, Charges, Customers,
    Invoices, Subscriptions, Payment Links, Refunds). The validators care
    about the *category* — payment outflow vs metadata mutation — so we
    cluster by side-effect class rather than by exact API call.
    """

    PAYMENT_INTENT_CREATE = "payment_intent.create"
    PAYMENT_INTENT_CONFIRM = "payment_intent.confirm"
    CHARGE_CREATE = "charge.create"
    REFUND_CREATE = "refund.create"
    PAYMENT_LINK_CREATE = "payment_link.create"
    INVOICE_FINALIZE = "invoice.finalize"
    SUBSCRIPTION_CREATE = "subscription.create"
    TRANSFER_CREATE = "transfer.create"
    CUSTOMER_CREATE = "customer.create"
    UNKNOWN = "unknown"

    @property
    def moves_money(self) -> bool:
        """Whether this intent results in a payment outflow (cap by Limits)."""
        return self in {
            self.PAYMENT_INTENT_CREATE,
            self.PAYMENT_INTENT_CONFIRM,
            self.CHARGE_CREATE,
            self.TRANSFER_CREATE,
        }

    @property
    def is_refund(self) -> bool:
        return self == self.REFUND_CREATE


# ============================================================================
# Currency handling
# ============================================================================
#
# Stripe quotes `amount` in the smallest currency unit. For most currencies
# this is 1/100 of the major unit (cents). A handful of currencies are
# "zero-decimal" — `amount=1000` already means 1,000 yen, not 10.00 yen.
# Source: https://stripe.com/docs/currencies#zero-decimal

ZERO_DECIMAL_CURRENCIES: frozenset[str] = frozenset(
    {
        "bif",
        "clp",
        "djf",
        "gnf",
        "jpy",
        "kmf",
        "krw",
        "mga",
        "pyg",
        "rwf",
        "ugx",
        "vnd",
        "vuv",
        "xaf",
        "xof",
        "xpf",
    }
)


# A coarse FX table used as fallback when the caller does not supply
# ``amount_usd_hint``. Values are approximate and intentionally kept simple —
# real production deployments should pass ``amount_usd_hint`` derived from
# their own FX source. Numbers chosen as a conservative midpoint of public
# rates in May 2026; off by a few percent is acceptable since the Limits
# gate uses USD-equivalents only to apply spending caps, not to settle.
_FALLBACK_USD_RATES: dict[str, float] = {
    "usd": 1.0,
    "eur": 1.08,
    "gbp": 1.27,
    "cad": 0.74,
    "aud": 0.66,
    "chf": 1.10,
    "sek": 0.094,
    "nok": 0.092,
    "dkk": 0.144,
    "jpy": 0.0065,
    "krw": 0.00072,
    "vnd": 0.000040,
    "twd": 0.031,
    "hkd": 0.128,
    "sgd": 0.74,
    "inr": 0.012,
    "brl": 0.20,
    "mxn": 0.058,
}


def normalize_amount_usd(
    amount: int,
    currency: str,
    *,
    amount_usd_hint: Optional[float] = None,
) -> float:
    """Return the USD-equivalent of a Stripe ``amount`` in its smallest unit.

    Resolution order:
        1. If ``amount_usd_hint`` is set by the caller, trust it.
        2. Otherwise convert ``amount`` to its major unit (divide by 100
           unless the currency is zero-decimal), then apply the fallback
           FX table.
        3. Unknown currencies default to a 1:1 rate against USD; callers
           that need precision must pass ``amount_usd_hint``.
    """
    if amount_usd_hint is not None:
        return float(amount_usd_hint)
    currency = currency.lower()
    base = float(amount) if currency in ZERO_DECIMAL_CURRENCIES else float(amount) / 100.0
    rate = _FALLBACK_USD_RATES.get(currency, 1.0)
    return base * rate


# ============================================================================
# Request shape
# ============================================================================


_CUSTOMER_ID_RE = re.compile(r"^cus_[A-Za-z0-9]{6,}$")
_ACCOUNT_ID_RE = re.compile(r"^acct_[A-Za-z0-9]{6,}$")
_INTENT_ID_RE = re.compile(r"^pi_[A-Za-z0-9]{6,}$")
_CHARGE_ID_RE = re.compile(r"^ch_[A-Za-z0-9]{6,}$")
_REFUND_ID_RE = re.compile(r"^re_[A-Za-z0-9]{6,}$")


def is_valid_customer_id(value: str | None) -> bool:
    return bool(value) and _CUSTOMER_ID_RE.match(value or "") is not None


def is_valid_account_id(value: str | None) -> bool:
    return bool(value) and _ACCOUNT_ID_RE.match(value or "") is not None


def is_valid_intent_id(value: str | None) -> bool:
    return bool(value) and _INTENT_ID_RE.match(value or "") is not None


def is_valid_charge_id(value: str | None) -> bool:
    return bool(value) and _CHARGE_ID_RE.match(value or "") is not None


def is_valid_refund_id(value: str | None) -> bool:
    return bool(value) and _REFUND_ID_RE.match(value or "") is not None


class StripePaymentRequest(BaseModel):
    """Wire shape for a Stripe operation the agent is about to perform.

    Required fields cover the union of Payment Intents, Charges, Refunds,
    and Transfers. Optional fields apply to the subset of operations that
    use them — e.g. ``customer`` for Payment Intents, ``destination`` for
    transfers.

    Operations that are NOT money-moving (customer.create, invoice.finalize)
    still go through validation because they can leak PII or be abused for
    business-logic injection, but the Limits gate is a no-op for them.

    Field naming mirrors the Stripe API as faithfully as practical so a
    caller can hand the same dict to both the toolkit and the validator.
    """

    intent_kind: StripeIntentKind = StripeIntentKind.UNKNOWN

    # Amount and currency. Stripe `amount` is an integer in the smallest
    # currency unit. `currency` is ISO-4217 lower-case.
    amount: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)

    # Pre-computed USD equivalent. Optional; when set, the Limits gate skips
    # the fallback FX table and trusts this value.
    amount_usd_hint: Optional[float] = None

    customer: Optional[str] = None
    payment_method: Optional[str] = None
    destination: Optional[str] = None      # acct_* for Connect transfers
    description: Optional[str] = ""

    # Free-form metadata the agent is attaching to the Stripe object.
    # Validators inspect specific allow-listed keys; the rest passes through.
    metadata: Optional[dict[str, Any]] = None

    # When the caller already has an idempotency key, we record it so the
    # audit log can correlate.
    idempotency_key: Optional[str] = None

    # When this is a follow-up to an existing object (refund of a charge,
    # confirm of an intent), the reference id helps the auditor reconstruct
    # the chain.
    reference_id: Optional[str] = None

    # API key the caller plans to use. Treated like sensitive metadata —
    # we never store it, only the detected ``StripeApiKeyKind``.
    api_key: Optional[str] = Field(default=None, repr=False)

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @property
    def normalized_currency(self) -> Optional[str]:
        return self.currency.lower() if self.currency else None

    def usd_amount(self) -> float:
        """USD-equivalent of ``amount``. Returns 0.0 for non-money intents."""
        if self.amount is None or self.amount <= 0 or not self.currency:
            return 0.0
        return normalize_amount_usd(
            self.amount, self.currency, amount_usd_hint=self.amount_usd_hint,
        )

    def detected_key_kind(self) -> StripeApiKeyKind:
        return StripeApiKeyKind.detect(self.api_key)


# ============================================================================
# Audit facts
# ============================================================================
#
# Subset of a StripePaymentRequest that's safe to persist in an audit row.
# We never store secrets or full API keys — only the detected kind.


@dataclass(frozen=True)
class StripeAuditFacts:
    intent_kind: str
    amount_usd: Optional[float]
    currency: Optional[str]
    customer: Optional[str]
    destination: Optional[str]
    description: Optional[str]
    api_key_kind: Optional[str]
    idempotency_key: Optional[str]
    reference_id: Optional[str]

    @classmethod
    def from_request(cls, req: StripePaymentRequest) -> "StripeAuditFacts":
        return cls(
            intent_kind=req.intent_kind.value,
            amount_usd=req.usd_amount() if req.amount is not None else None,
            currency=req.normalized_currency,
            customer=req.customer,
            destination=req.destination,
            description=req.description,
            api_key_kind=req.detected_key_kind().value,
            idempotency_key=req.idempotency_key,
            reference_id=req.reference_id,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "intent_kind": self.intent_kind,
            "amount_usd": self.amount_usd,
            "currency": self.currency,
            "customer": self.customer,
            "destination": self.destination,
            "description": self.description,
            "api_key_kind": self.api_key_kind,
            "idempotency_key": self.idempotency_key,
            "reference_id": self.reference_id,
        }


# ============================================================================
# CLAW result types — reuse the x402 ones to keep audit emit + dashboard
# rendering identical across providers.
# ============================================================================


@dataclass
class CLAWGateResult:
    """Result of a single CLAW gate evaluation (Stripe namespace).

    Has the same shape as ``coinbase.x402.types.CLAWGateResult`` so the
    AuditSink can serialize either uniformly. Kept duplicated locally to
    avoid a forced import path through the x402 module.
    """

    gate: CLAWGate
    passed: bool
    reason: Optional[str] = None
    details: Optional[dict[str, Any]] = None


class PaymentRiskLevel(str, Enum):
    SAFE = "safe"
    CAUTION = "caution"
    HIGH = "high"
    CRITICAL = "critical"
    BLOCKED = "blocked"


class PaymentDecision(str, Enum):
    APPROVE = "approve"
    REQUIRE_CONFIRMATION = "require_confirmation"
    REJECT = "reject"
    BLOCK = "block"


@dataclass
class PaymentValidationResult:
    """Full output of a Stripe payment validation."""

    decision: PaymentDecision
    risk_level: PaymentRiskLevel
    gates: dict[CLAWGate, CLAWGateResult]
    facts: StripeAuditFacts
    issues: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    requires_confirmation: bool = False
    blocked_reason: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def is_approved(self) -> bool:
        return self.decision in (PaymentDecision.APPROVE, PaymentDecision.REQUIRE_CONFIRMATION)

    @property
    def all_gates_passed(self) -> bool:
        return all(gr.passed for gr in self.gates.values())

    def to_dict(self) -> dict[str, Any]:
        return {
            "decision": self.decision.value,
            "risk_level": self.risk_level.value,
            "gates": {
                gate.value: {
                    "passed": result.passed,
                    "reason": result.reason,
                    "details": result.details,
                }
                for gate, result in self.gates.items()
            },
            "facts": self.facts.to_dict(),
            "issues": self.issues,
            "recommendations": self.recommendations,
            "requires_confirmation": self.requires_confirmation,
            "blocked_reason": self.blocked_reason,
            "metadata": self.metadata,
        }


@dataclass
class StripeAuditEntry:
    """Lightweight in-memory audit entry used by the middleware's local log.

    The persistent audit pipeline still flows through ``AuditSink``; this
    dataclass exists for the same get_spending_summary / get_audit_log
    helpers the x402 middleware exposes.
    """

    timestamp: datetime
    wallet_address: str
    intent_kind: str
    amount_usd: Optional[float]
    customer: Optional[str]
    destination: Optional[str]
    decision: PaymentDecision
    risk_level: PaymentRiskLevel
    reference_id: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "wallet_address": self.wallet_address,
            "intent_kind": self.intent_kind,
            "amount_usd": self.amount_usd,
            "customer": self.customer,
            "destination": self.destination,
            "decision": self.decision.value,
            "risk_level": self.risk_level.value,
            "reference_id": self.reference_id,
            "error": self.error,
        }


__all__ = [
    "CLAWGate",
    "CLAWGateResult",
    "PaymentDecision",
    "PaymentRiskLevel",
    "PaymentValidationResult",
    "StripeApiKeyKind",
    "StripeAuditEntry",
    "StripeAuditFacts",
    "StripeIntentKind",
    "StripePaymentRequest",
    "ZERO_DECIMAL_CURRENCIES",
    "normalize_amount_usd",
    "is_valid_customer_id",
    "is_valid_account_id",
    "is_valid_intent_id",
    "is_valid_charge_id",
    "is_valid_refund_id",
]
