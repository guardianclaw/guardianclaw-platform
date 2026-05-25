"""GuardianClaw middleware for Stripe Agent Toolkit operations.

Parallel surface to ``coinbase.x402.middleware.GuardianClawX402Middleware``.
Wraps a Stripe API call (PaymentIntent.create, Charge.create, Refund.create,
Transfer.create) in the four CLAW gates so an agent cannot move money,
issue a refund, or set up a recurring charge without passing every check.

Usage pattern (canonical):

    from guardianclaw.integrations.stripe import (
        GuardianClawStripeMiddleware,
        StripePaymentRequest,
        StripeIntentKind,
    )

    middleware = GuardianClawStripeMiddleware(
        drainer_lookup=lookup,
        audit_sink=sink,
        agent_id="agent-1",
    )

    request = StripePaymentRequest(
        intent_kind=StripeIntentKind.PAYMENT_INTENT_CREATE,
        amount=4900,
        currency="usd",
        customer="cus_NksY4M0bM4FfXg",
        description="Daily API budget refill for support agent",
    )

    result = middleware.validate_payment(request, wallet_address="agent-1")
    if not result.is_approved:
        # Block. Do NOT call stripe.PaymentIntent.create.
        return

    stripe.PaymentIntent.create(
        amount=request.amount, currency=request.currency,
        customer=request.customer,
    )

    middleware.after_payment(
        request=request, success=True, reference_id="pi_...",
    )

The middleware deliberately does not call Stripe itself — that keeps the
boundary explicit and means a single instance can guard any Stripe SDK
version the host project happens to be using.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any, Callable, Optional

from guardianclaw.integrations.coinbase.x402.audit_sink import AuditSink
from guardianclaw.integrations.coinbase.x402.drainer_db import DrainerLookup

from .audit import build_stripe_audit_record
from .config import GuardianClawStripeConfig, get_default_config
from .types import (
    CLAWGate,
    CLAWGateResult,
    PaymentDecision,
    PaymentRiskLevel,
    PaymentValidationResult,
    StripeAuditEntry,
    StripeAuditFacts,
    StripeIntentKind,
    StripePaymentRequest,
)
from .validators import StripeCLAWValidator

logger = logging.getLogger("guardianclaw.integrations.stripe.middleware")


# ============================================================================
# Exceptions
# ============================================================================


class PaymentBlockedError(Exception):
    """Raised by ``before_create_hook`` when the request is BLOCKED."""

    def __init__(self, message: str, *, result: PaymentValidationResult) -> None:
        super().__init__(message)
        self.result = result


class PaymentRejectedError(Exception):
    """Raised by ``before_create_hook`` when the request is REJECTED."""

    def __init__(self, message: str, *, result: PaymentValidationResult) -> None:
        super().__init__(message)
        self.result = result


class PaymentConfirmationRequired(Exception):
    """Raised when REQUIRE_CONFIRMATION fires and no confirmation callback
    is registered (so the host can't decide on the agent's behalf)."""

    def __init__(self, message: str, *, result: PaymentValidationResult) -> None:
        super().__init__(message)
        self.result = result


# ============================================================================
# Middleware
# ============================================================================


_DAILY_RESET_AT_HOUR = 0  # spending day starts at 00:00 UTC


class GuardianClawStripeMiddleware:
    """Decision firewall for Stripe Agent Toolkit operations.

    The middleware is *advisory*: it returns a structured
    ``PaymentValidationResult`` and emits to the audit sink, but it never
    calls Stripe directly. The caller decides what to do with the result.

    For the ``before_create_hook`` / ``after_create_hook`` lifecycle, the
    middleware raises a typed exception on blocking decisions to keep
    integration callsites short.
    """

    def __init__(
        self,
        config: GuardianClawStripeConfig | None = None,
        *,
        drainer_lookup: DrainerLookup | None = None,
        audit_sink: AuditSink | None = None,
        agent_id: str | None = None,
        on_payment_blocked: Callable[[PaymentValidationResult], None] | None = None,
        on_payment_approved: Callable[[PaymentValidationResult], None] | None = None,
        on_confirmation_required: Callable[[PaymentValidationResult], bool] | None = None,
    ) -> None:
        self.config = config or get_default_config("standard")
        self.validator = StripeCLAWValidator(drainer_lookup=drainer_lookup)
        self.audit_sink = audit_sink
        self.agent_id = agent_id

        self._on_blocked = on_payment_blocked
        self._on_approved = on_payment_approved
        self._on_confirmation = on_confirmation_required

        # In-process spending state. The dashboard's persistent
        # ``clawpay_spending_limits`` table is the authoritative cap; this
        # cache exists so a single process can enforce its rolling-window
        # math without a round trip per call.
        self._lock = Lock()
        self._daily_state: dict[str, _DailyWindow] = defaultdict(_DailyWindow)
        self._customer_history: dict[str, set[str]] = defaultdict(set)
        self._destination_history: dict[str, set[str]] = defaultdict(set)
        self._audit_log: list[StripeAuditEntry] = []

    # --------------------------------------------------------------------
    # Public API
    # --------------------------------------------------------------------

    def validate_payment(
        self,
        request: StripePaymentRequest | dict[str, Any],
        wallet_address: str,
    ) -> PaymentValidationResult:
        """Run all four CLAW gates and return the decision."""

        if isinstance(request, dict):
            request = StripePaymentRequest(**request)

        context = self._build_validation_context(wallet_address)

        gate_results = self.validator.validate(
            request=request,
            wallet_address=wallet_address,
            config=self.config,
            context=context,
        )

        risk_level = self.validator.calculate_risk_level(
            gate_results=gate_results, request=request, config=self.config,
        )

        decision = self._determine_decision(
            gate_results=gate_results, risk_level=risk_level, request=request,
        )

        result = self._build_result(
            decision=decision, risk_level=risk_level,
            gate_results=gate_results, request=request,
        )

        self._trigger_callbacks(result)

        if self.config.validation.audit_all_payments:
            self._log_audit(
                wallet_address=wallet_address, request=request, result=result,
            )

        if self.audit_sink is not None:
            try:
                record = build_stripe_audit_record(
                    wallet_address=wallet_address,
                    request=request,
                    result=result,
                    agent_id=self.agent_id,
                )
                self.audit_sink.emit(record)
            except Exception as exc:  # pragma: no cover — fail-safe path
                logger.warning("Stripe audit sink emit failed: %s", exc)

        return result

    def before_create_hook(
        self,
        request: StripePaymentRequest | dict[str, Any],
        wallet_address: str,
    ) -> PaymentValidationResult:
        """Validate before letting the agent call the Stripe SDK.

        Raises ``PaymentBlockedError`` / ``PaymentRejectedError`` on BLOCK /
        REJECT. Returns the result otherwise (the caller still inspects it
        to honour CONFIRMATION).
        """
        result = self.validate_payment(request, wallet_address=wallet_address)

        if result.decision == PaymentDecision.BLOCK:
            raise PaymentBlockedError(
                f"Stripe payment blocked: {result.blocked_reason}", result=result,
            )
        if result.decision == PaymentDecision.REJECT:
            raise PaymentRejectedError(
                f"Stripe payment rejected: {'; '.join(result.issues)}", result=result,
            )
        return result

    def after_create_hook(
        self,
        request: StripePaymentRequest | dict[str, Any],
        wallet_address: str,
        *,
        success: bool,
        reference_id: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        """Record the result of an actual Stripe call.

        Updates spending counters when ``success`` is True so subsequent
        Limits-gate checks see the new running total.
        """
        if isinstance(request, dict):
            request = StripePaymentRequest(**request)

        if success and request.intent_kind.moves_money:
            with self._lock:
                self._daily_state[wallet_address].record_payment(request.usd_amount())
                if request.customer:
                    self._customer_history[wallet_address].add(request.customer)
                if request.destination:
                    self._destination_history[wallet_address].add(request.destination)

        # Local audit ring buffer.
        entry = StripeAuditEntry(
            timestamp=datetime.now(timezone.utc),
            wallet_address=wallet_address,
            intent_kind=request.intent_kind.value,
            amount_usd=request.usd_amount() if request.amount is not None else None,
            customer=request.customer,
            destination=request.destination,
            decision=PaymentDecision.APPROVE if success else PaymentDecision.REJECT,
            risk_level=PaymentRiskLevel.SAFE,
            reference_id=reference_id,
            error=error,
        )
        with self._lock:
            self._audit_log.append(entry)

    def get_spending_summary(self, wallet_address: str) -> dict[str, Any]:
        """Snapshot of the in-process counters for a wallet."""
        with self._lock:
            window = self._daily_state.get(wallet_address)
            limits = self.config.spending_limits
            return {
                "wallet_address": wallet_address,
                "daily_total_usd": window.total_usd if window else 0.0,
                "daily_transactions": window.transaction_count if window else 0,
                "daily_limit_usd": limits.max_daily_total,
                "daily_remaining_usd": max(
                    0.0,
                    limits.max_daily_total - (window.total_usd if window else 0.0),
                ),
                "hourly_transactions": window.hourly_count() if window else 0,
                "hourly_limit": limits.max_transactions_per_hour,
            }

    def get_audit_log(self, limit: int = 100) -> list[StripeAuditEntry]:
        """Return the in-process audit ring buffer (most recent last)."""
        with self._lock:
            return list(self._audit_log[-limit:])

    # --------------------------------------------------------------------
    # Internals
    # --------------------------------------------------------------------

    def _build_validation_context(self, wallet_address: str) -> dict[str, Any]:
        with self._lock:
            window = self._daily_state.get(wallet_address)
            return {
                "daily_total": window.total_usd if window else 0.0,
                "daily_transaction_count": window.transaction_count if window else 0,
                "hourly_transaction_count": window.hourly_count() if window else 0,
                "customer_history": {
                    cid: True for cid in self._customer_history.get(wallet_address, set())
                },
                "destination_history": {
                    did: True for did in self._destination_history.get(wallet_address, set())
                },
            }

    def _determine_decision(
        self,
        *,
        gate_results: dict[CLAWGate, CLAWGateResult],
        risk_level: PaymentRiskLevel,
        request: StripePaymentRequest,
    ) -> PaymentDecision:
        if risk_level == PaymentRiskLevel.BLOCKED:
            return PaymentDecision.BLOCK

        if risk_level in (PaymentRiskLevel.CRITICAL, PaymentRiskLevel.HIGH):
            # Any structural failure = REJECT (the caller can rebuild the
            # request and retry instead of escalating to confirmation).
            return PaymentDecision.REJECT

        if risk_level == PaymentRiskLevel.CAUTION and request.intent_kind.moves_money:
            return PaymentDecision.REQUIRE_CONFIRMATION

        return PaymentDecision.APPROVE

    def _build_result(
        self,
        *,
        decision: PaymentDecision,
        risk_level: PaymentRiskLevel,
        gate_results: dict[CLAWGate, CLAWGateResult],
        request: StripePaymentRequest,
    ) -> PaymentValidationResult:
        issues: list[str] = []
        recommendations: list[str] = []
        for gate_result in gate_results.values():
            if not gate_result.passed and gate_result.reason:
                issues.append(f"[{gate_result.gate.value}] {gate_result.reason}")

        blocked_reason: Optional[str] = None
        if decision == PaymentDecision.BLOCK:
            avoidance = gate_results.get(CLAWGate.AVOIDANCE)
            blocked_reason = avoidance.reason if avoidance else "; ".join(issues)
        if decision in (PaymentDecision.REJECT, PaymentDecision.BLOCK):
            recommendations.append(
                "Inspect the audit log for the specific gate failure before retrying."
            )

        return PaymentValidationResult(
            decision=decision,
            risk_level=risk_level,
            gates=gate_results,
            facts=StripeAuditFacts.from_request(request),
            issues=issues,
            recommendations=recommendations,
            requires_confirmation=decision == PaymentDecision.REQUIRE_CONFIRMATION,
            blocked_reason=blocked_reason,
        )

    def _trigger_callbacks(self, result: PaymentValidationResult) -> None:
        try:
            if result.decision == PaymentDecision.BLOCK and self._on_blocked:
                self._on_blocked(result)
            elif result.decision == PaymentDecision.APPROVE and self._on_approved:
                self._on_approved(result)
            elif (
                result.decision == PaymentDecision.REQUIRE_CONFIRMATION
                and self._on_confirmation
            ):
                confirmed = self._on_confirmation(result)
                if confirmed is False:
                    result.decision = PaymentDecision.REJECT
                    result.requires_confirmation = False
                elif confirmed is True:
                    result.decision = PaymentDecision.APPROVE
                    result.requires_confirmation = False
        except Exception as exc:  # pragma: no cover — fail-safe path
            logger.warning("Stripe middleware callback raised: %s", exc)

    def _log_audit(
        self,
        *,
        wallet_address: str,
        request: StripePaymentRequest,
        result: PaymentValidationResult,
    ) -> None:
        entry = StripeAuditEntry(
            timestamp=datetime.now(timezone.utc),
            wallet_address=wallet_address,
            intent_kind=request.intent_kind.value,
            amount_usd=request.usd_amount() if request.amount is not None else None,
            customer=request.customer,
            destination=request.destination,
            decision=result.decision,
            risk_level=result.risk_level,
            reference_id=request.reference_id,
            error=result.blocked_reason or None,
        )
        with self._lock:
            self._audit_log.append(entry)


# ============================================================================
# Daily-window helper — encapsulates the rolling reset logic so the lock-
# guarded section in the middleware stays small.
# ============================================================================


class _DailyWindow:
    """Tracks total USD + per-day txn count + per-hour txn timestamps."""

    def __init__(self) -> None:
        self.total_usd: float = 0.0
        self.transaction_count: int = 0
        self.period_start: datetime = self._today_start()
        self.hourly_timestamps: list[datetime] = []

    def _today_start(self) -> datetime:
        now = datetime.now(timezone.utc)
        return now.replace(hour=_DAILY_RESET_AT_HOUR, minute=0, second=0, microsecond=0)

    def _roll_if_needed(self) -> None:
        now = datetime.now(timezone.utc)
        if now >= self.period_start + timedelta(days=1):
            self.period_start = self._today_start()
            self.total_usd = 0.0
            self.transaction_count = 0

    def record_payment(self, amount_usd: float) -> None:
        self._roll_if_needed()
        self.total_usd += amount_usd
        self.transaction_count += 1
        now = datetime.now(timezone.utc)
        self.hourly_timestamps.append(now)
        cutoff = now - timedelta(hours=1)
        self.hourly_timestamps = [t for t in self.hourly_timestamps if t >= cutoff]

    def hourly_count(self) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
        return sum(1 for t in self.hourly_timestamps if t >= cutoff)


# ============================================================================
# Factory
# ============================================================================


def create_stripe_middleware(
    profile: str = "standard",
    *,
    drainer_lookup: DrainerLookup | None = None,
    audit_sink: AuditSink | None = None,
    agent_id: str | None = None,
) -> GuardianClawStripeMiddleware:
    """Convenience constructor — instantiates middleware from a preset profile."""
    from .config import get_default_config

    return GuardianClawStripeMiddleware(
        config=get_default_config(profile),  # type: ignore[arg-type]
        drainer_lookup=drainer_lookup,
        audit_sink=audit_sink,
        agent_id=agent_id,
    )


__all__ = [
    "GuardianClawStripeMiddleware",
    "PaymentBlockedError",
    "PaymentConfirmationRequired",
    "PaymentRejectedError",
    "create_stripe_middleware",
]
