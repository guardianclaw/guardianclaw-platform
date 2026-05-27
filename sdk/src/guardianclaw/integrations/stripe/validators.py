"""CLAW gate validators for the GuardianClaw Stripe integration.

Same four gates as ``coinbase.x402.validators`` — Credibility, Avoidance,
Limits, Worth — adapted for the shape of a Stripe API call. The validators
share the ``DrainerLookup`` instance with x402 so a single intel feed
protects both providers.
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from typing import Any, Optional

# Shared cross-provider primitives — reuse the x402 implementation rather than
# duplicate it so a single drainer feed protects every payment surface.
from guardianclaw.integrations.coinbase.x402.drainer_db import (
    DrainerKind,
    DrainerLookup,
    DrainerMatch,
)

from .config import (
    GuardianClawStripeConfig,
    SUSPICIOUS_URGENCY_TERMS,
)
from .types import (
    CLAWGate,
    CLAWGateResult,
    PaymentDecision,
    PaymentRiskLevel,
    StripeApiKeyKind,
    StripeIntentKind,
    StripePaymentRequest,
    is_valid_account_id,
    is_valid_customer_id,
)

logger = logging.getLogger("guardianclaw.integrations.stripe.validators")


# ISO-4217 alpha-3 currency code (case-insensitive caller; validator normalizes).
_ISO_4217_RE = re.compile(r"^[a-z]{3}$")


# ============================================================================
# Abstract base
# ============================================================================


class StripePaymentValidator(ABC):
    """Abstract base for the four CLAW gates."""

    @property
    @abstractmethod
    def gate(self) -> CLAWGate:
        ...

    @abstractmethod
    def validate(
        self,
        request: StripePaymentRequest,
        wallet_address: str,
        config: GuardianClawStripeConfig,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        ...


# ============================================================================
# CREDIBILITY — is the call well-formed?
# ============================================================================


class StripeCredibilityGateValidator(StripePaymentValidator):
    """Checks that match Credibility semantics in the Stripe namespace:

    - API key (when provided) is restricted (``rk_*``), not full secret.
    - Currency is ISO-4217 lowercase.
    - Amount has the expected polarity for the operation.
    - Customer / destination IDs are well-formed.
    - Idempotency key (when provided) looks plausible.
    """

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.CREDIBILITY

    def validate(
        self,
        request: StripePaymentRequest,
        wallet_address: str,
        config: GuardianClawStripeConfig,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        issues: list[str] = []

        # API key shape — Stripe officially recommends `rk_*` for agents.
        kind = request.detected_key_kind()
        if request.api_key:
            if config.validation.require_restricted_api_key and not kind.is_restricted:
                issues.append(
                    f"API key kind '{kind.value}' is not a restricted key (rk_*); "
                    "agents should use restricted keys with scoped permissions."
                )
            if config.validation.sandbox_only and kind.is_live:
                issues.append("API key targets live mode but sandbox_only is enforced.")

        # Currency.
        if request.intent_kind.moves_money:
            currency = request.normalized_currency
            if not currency:
                issues.append("Missing currency for a money-moving Stripe call.")
            elif not _ISO_4217_RE.match(currency):
                issues.append(f"Currency '{currency}' is not a valid ISO-4217 code.")
            elif (
                config.validation.allowed_currencies
                and currency not in {c.lower() for c in config.validation.allowed_currencies}
            ):
                issues.append(
                    f"Currency '{currency}' is not in the allowed list "
                    f"({', '.join(config.validation.allowed_currencies)})."
                )

        # Amount.
        if request.intent_kind.moves_money:
            if request.amount is None:
                issues.append("Missing amount for a money-moving Stripe call.")
            elif request.amount <= 0:
                issues.append("Amount must be positive for a money-moving call.")

        # Customer ID shape (when present).
        if request.customer is not None and not is_valid_customer_id(request.customer):
            issues.append(f"Customer ID '{request.customer}' is malformed (expected cus_*).")

        # Destination account ID shape (when present).
        if request.destination is not None and not is_valid_account_id(request.destination):
            issues.append(
                f"Destination '{request.destination}' is malformed (expected acct_*)."
            )

        # Idempotency key plausibility — must be non-empty and within Stripe's
        # 255-char limit (https://stripe.com/docs/api/idempotent_requests).
        if request.idempotency_key is not None:
            if not request.idempotency_key or len(request.idempotency_key) > 255:
                issues.append("Idempotency key must be 1–255 characters.")

        passed = len(issues) == 0
        return CLAWGateResult(
            gate=CLAWGate.CREDIBILITY,
            passed=passed,
            reason=None if passed else "; ".join(issues),
            details={"issues": issues, "api_key_kind": kind.value} if issues else None,
        )


# ============================================================================
# AVOIDANCE — could this cause harm?
# ============================================================================


class StripeAvoidanceGateValidator(StripePaymentValidator):
    """Combines static blocklists, drainer_intel lookup, and description scans.

    Decision policy:
    - Static blocklists + drainer hits at severity ∈ {critical, high}: BLOCK.
    - Drainer hits at lower severities: surface as risk factors, do not block.
    - Suspicious description terms (urgency markers): risk factor only.
    """

    def __init__(self, drainer_lookup: Optional[DrainerLookup] = None) -> None:
        self.drainer_lookup = drainer_lookup

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.AVOIDANCE

    def validate(
        self,
        request: StripePaymentRequest,
        wallet_address: str,
        config: GuardianClawStripeConfig,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        issues: list[str] = []
        risk_factors: list[str] = []
        drainer_hits: list[dict[str, Any]] = []

        # Static blocklists.
        if request.customer and request.customer in set(config.blocked_customers):
            issues.append(f"Customer '{request.customer}' is on the blocklist.")
        if request.destination and request.destination in set(config.blocked_destinations):
            issues.append(f"Destination '{request.destination}' is on the blocklist.")

        # Description-term blocklist.
        description = (request.description or "").lower()
        for term in config.blocked_description_terms:
            if term.lower() in description:
                issues.append(f"Description contains blocked term: '{term}'.")

        # Urgency markers — high noise, downgrade to risk_factor.
        for term in SUSPICIOUS_URGENCY_TERMS:
            if term in description:
                risk_factors.append(f"Description uses urgency phrasing: '{term}'.")
                break

        # Drainer-intel lookup. Fail-safe: any exception is logged and
        # treated as a miss — a misbehaving feed must not panic-block.
        if self.drainer_lookup is not None:
            try:
                if request.customer:
                    match = self.drainer_lookup.consult(
                        DrainerKind.ADDRESS, request.customer,
                    )
                    if match is not None:
                        self._record_drainer_hit(
                            match, issues, drainer_hits, scope="customer"
                        )

                if request.destination:
                    match = self.drainer_lookup.consult(
                        DrainerKind.ADDRESS, request.destination,
                    )
                    if match is not None:
                        self._record_drainer_hit(
                            match, issues, drainer_hits, scope="destination"
                        )
            except Exception as exc:  # pragma: no cover — fail-safe
                logger.warning("Stripe drainer lookup raised unexpectedly: %s", exc)

        passed = len(issues) == 0
        details: dict[str, Any] = {}
        if issues:
            details["issues"] = issues
        if risk_factors:
            details["risk_factors"] = risk_factors
        if drainer_hits:
            details["drainer_intel"] = drainer_hits

        return CLAWGateResult(
            gate=CLAWGate.AVOIDANCE,
            passed=passed,
            reason=None if passed else "; ".join(issues),
            details=details or None,
        )

    def _record_drainer_hit(
        self,
        match: DrainerMatch,
        issues: list[str],
        drainer_hits: list[dict[str, Any]],
        *,
        scope: str,
    ) -> None:
        """Promote a drainer hit at severity ≥ high to a hard block;
        lower severities surface only as risk factors."""
        if match.severity in {"high", "critical"}:
            issues.append(
                f"{scope.capitalize()} matched drainer_intel "
                f"(severity={match.severity}, source={match.source})"
            )
        drainer_hits.append(match.to_audit_dict() | {"scope": scope})


# ============================================================================
# LIMITS — is this within spending caps?
# ============================================================================


class StripeLimitsGateValidator(StripePaymentValidator):
    """Enforces single-payment and rolling-window USD caps + rate limits.

    Uses the same context shape as ``x402.LimitsGateValidator`` — the
    middleware supplies ``daily_spending`` and ``hourly_transaction_count``
    from its in-process state.
    """

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.LIMITS

    def validate(
        self,
        request: StripePaymentRequest,
        wallet_address: str,
        config: GuardianClawStripeConfig,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        issues: list[str] = []
        warnings: list[str] = []

        if not config.validation.enable_spending_limits:
            return CLAWGateResult(
                gate=CLAWGate.LIMITS,
                passed=True,
                details={"note": "Spending limits disabled."},
            )

        if not request.intent_kind.moves_money:
            # Non-payment intents don't move money — Limits is a no-op.
            return CLAWGateResult(gate=CLAWGate.LIMITS, passed=True)

        amount_usd = request.usd_amount()
        limits = config.spending_limits

        if amount_usd > limits.max_single_payment:
            issues.append(
                f"Amount ${amount_usd:.2f} exceeds single payment limit "
                f"${limits.max_single_payment:.2f}."
            )

        if context and config.validation.enable_spending_limits:
            daily_total: float = float(context.get("daily_total", 0.0))
            daily_txn_count: int = int(context.get("daily_transaction_count", 0))
            hourly_count: int = int(context.get("hourly_transaction_count", 0))

            projected_daily = daily_total + amount_usd
            if projected_daily > limits.max_daily_total:
                issues.append(
                    f"Payment would exceed daily limit: "
                    f"${projected_daily:.2f} > ${limits.max_daily_total:.2f}."
                )

            if daily_txn_count >= limits.max_transactions_per_day:
                issues.append(
                    f"Daily transaction limit reached: {daily_txn_count}."
                )
            elif daily_txn_count >= int(limits.max_transactions_per_day * 0.8):
                warnings.append("Approaching daily transaction limit.")

            if config.validation.enable_rate_limiting:
                if hourly_count >= limits.max_transactions_per_hour:
                    issues.append(
                        f"Hourly rate limit exceeded: {hourly_count} transactions."
                    )
                elif hourly_count >= int(limits.max_transactions_per_hour * 0.8):
                    warnings.append("Approaching hourly rate limit.")

        passed = len(issues) == 0
        return CLAWGateResult(
            gate=CLAWGate.LIMITS,
            passed=passed,
            reason=None if passed else "; ".join(issues),
            details={
                "amount_usd": amount_usd,
                "issues": issues,
                "warnings": warnings,
                "limits": {
                    "max_single": limits.max_single_payment,
                    "max_daily": limits.max_daily_total,
                },
            },
        )


# ============================================================================
# WORTH — does the call serve a legitimate purpose?
# ============================================================================


class StripeWorthGateValidator(StripePaymentValidator):
    """Worth requires the agent to declare *why* it's making the call.

    For money-moving intents we require ``description`` ≥ 20 characters with
    at least 3 words. Non-payment intents pass unless ``strict_mode`` is on.
    """

    MIN_DESCRIPTION_LENGTH = 20
    MIN_DESCRIPTION_WORDS = 3

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.WORTH

    def validate(
        self,
        request: StripePaymentRequest,
        wallet_address: str,
        config: GuardianClawStripeConfig,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        concerns: list[str] = []
        flags: list[str] = []

        # Customer familiarity.
        is_known_customer = False
        is_known_destination = False
        if context:
            customer_history = context.get("customer_history", {})
            if request.customer and request.customer in customer_history:
                is_known_customer = True
            if not is_known_customer and request.customer:
                flags.append("First payment to this customer.")
                if not config.validation.allow_unknown_customers:
                    concerns.append("Payment to unknown customer.")

            destination_history = context.get("destination_history", {})
            if request.destination and request.destination in destination_history:
                is_known_destination = True
            if not is_known_destination and request.destination:
                flags.append("First payment to this destination account.")
                if not config.validation.allow_unknown_destinations:
                    concerns.append("Payment to unknown destination.")

        # Purpose / description.
        description = (request.description or "").strip()
        if request.intent_kind.moves_money:
            if len(description) < self.MIN_DESCRIPTION_LENGTH:
                concerns.append(
                    f"Description is too short ({len(description)} chars; "
                    f"need ≥ {self.MIN_DESCRIPTION_LENGTH}) to justify a "
                    "money-moving call."
                )
            else:
                word_count = len([w for w in description.split() if w])
                if word_count < self.MIN_DESCRIPTION_WORDS:
                    concerns.append(
                        f"Description has too few words ({word_count}; need ≥ "
                        f"{self.MIN_DESCRIPTION_WORDS}); state the purpose explicitly."
                    )

        if config.validation.strict_mode:
            # In strict mode any flag becomes a concern.
            concerns.extend(flags)
            flags = []

        passed = len(concerns) == 0
        return CLAWGateResult(
            gate=CLAWGate.WORTH,
            passed=passed,
            reason=None if passed else "; ".join(concerns),
            details={
                "concerns": concerns,
                "flags": flags,
                "is_known_customer": is_known_customer if context else None,
                "is_known_destination": is_known_destination if context else None,
            },
        )


# ============================================================================
# Orchestrator
# ============================================================================


class StripeCLAWValidator:
    """Runs all four CLAW gates on a single Stripe payment request.

    Mirror of ``CLAWPaymentValidator`` from the x402 module.
    """

    def __init__(self, drainer_lookup: Optional[DrainerLookup] = None) -> None:
        self._validators: list[StripePaymentValidator] = [
            StripeCredibilityGateValidator(),
            StripeAvoidanceGateValidator(drainer_lookup=drainer_lookup),
            StripeLimitsGateValidator(),
            StripeWorthGateValidator(),
        ]

    def validate(
        self,
        request: StripePaymentRequest,
        wallet_address: str,
        config: GuardianClawStripeConfig,
        context: dict[str, Any] | None = None,
    ) -> dict[CLAWGate, CLAWGateResult]:
        results: dict[CLAWGate, CLAWGateResult] = {}
        for validator in self._validators:
            try:
                results[validator.gate] = validator.validate(
                    request=request,
                    wallet_address=wallet_address,
                    config=config,
                    context=context,
                )
            except Exception as exc:
                # A misbehaving gate must not be silently safe — record as
                # failed and let the middleware downgrade the decision.
                logger.exception("Stripe validator %s raised", validator.gate.value)
                results[validator.gate] = CLAWGateResult(
                    gate=validator.gate,
                    passed=False,
                    reason=f"Validator error: {exc!s}",
                )
        return results

    def calculate_risk_level(
        self,
        gate_results: dict[CLAWGate, CLAWGateResult],
        request: StripePaymentRequest,
        config: GuardianClawStripeConfig,
    ) -> PaymentRiskLevel:
        failed_gates = [gate for gate, result in gate_results.items() if not result.passed]

        # AVOIDANCE failure is always BLOCKED — the gate is reserved for
        # "this should not happen".
        if CLAWGate.AVOIDANCE in failed_gates:
            return PaymentRiskLevel.BLOCKED

        if len(failed_gates) >= 2:
            return PaymentRiskLevel.CRITICAL
        if len(failed_gates) == 1:
            return PaymentRiskLevel.HIGH

        # All passed. Look for warnings / flags that should escalate to CAUTION.
        has_warnings = any(
            result.details
            and (
                result.details.get("warnings")
                or result.details.get("flags")
                or result.details.get("risk_factors")
            )
            for result in gate_results.values()
        )
        if request.intent_kind.moves_money:
            amount_usd = request.usd_amount()
            if amount_usd > config.confirmation_thresholds.amount_threshold:
                return PaymentRiskLevel.CAUTION
        if has_warnings:
            return PaymentRiskLevel.CAUTION
        return PaymentRiskLevel.SAFE


__all__ = [
    "StripeAvoidanceGateValidator",
    "StripeCLAWValidator",
    "StripeCredibilityGateValidator",
    "StripeLimitsGateValidator",
    "StripePaymentValidator",
    "StripeWorthGateValidator",
]
