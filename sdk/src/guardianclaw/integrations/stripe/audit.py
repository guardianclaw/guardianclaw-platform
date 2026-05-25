"""Audit record construction for the Stripe payment surface.

The cross-provider AuditRecord lives in
``guardianclaw.integrations.coinbase.x402.audit_sink``. This module provides
a small ``build_stripe_audit_record`` helper that maps a
``PaymentValidationResult`` from the Stripe namespace onto that shared shape,
filling in Stripe-specific fields (``description``, ``customer``,
``destination``, currency, intent kind) via the audit metadata blob.
"""

from __future__ import annotations

from typing import Any, Optional

from guardianclaw.integrations.coinbase.x402.audit_sink import (
    AuditRecord,
    _serialize_gate_results,
)

from .types import (
    CLAWGate,
    PaymentDecision,
    PaymentValidationResult,
    StripePaymentRequest,
)


def _decision_to_event_kind(decision: PaymentDecision) -> str:
    """Map the Stripe PaymentDecision enum to the clawpay_event_kind enum.

    Mirrors the mapping used by the x402 audit sink so the dashboard renders
    both providers with the same vocabulary.
    """
    if decision == PaymentDecision.APPROVE:
        return "payment_approved"
    if decision == PaymentDecision.REQUIRE_CONFIRMATION:
        return "payment_confirmation_required"
    if decision in (PaymentDecision.BLOCK, PaymentDecision.REJECT):
        return "payment_blocked"
    return "payment_failed"


def build_stripe_audit_record(
    *,
    wallet_address: str,
    request: StripePaymentRequest,
    result: PaymentValidationResult,
    agent_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AuditRecord:
    """Translate a Stripe PaymentValidationResult into the shared AuditRecord.

    Mapping decisions:
    - ``endpoint`` carries a synthetic ``stripe://<intent_kind>`` URI so the
      dashboard rows have something to render even for non-HTTP intents.
    - ``network`` carries the currency code (e.g. ``usd``) — keeps the column
      consistent semantically (which "rail" the payment is on).
    - ``pay_to`` carries the customer or destination (whichever is set).
    - Stripe-specific facts (intent_kind, currency, idempotency_key,
      api_key_kind) ride in the metadata blob so they survive the trip
      through Supabase without forcing a schema change.

    Drainer hits are pulled from the AVOIDANCE gate's details, same as x402.
    """
    drainer_intel: list[dict[str, Any]] = []
    simulation: Optional[dict[str, Any]] = None
    avoidance = result.gates.get(CLAWGate.AVOIDANCE)
    if avoidance and avoidance.details:
        hits = avoidance.details.get("drainer_intel")
        if isinstance(hits, list):
            drainer_intel = [hit for hit in hits if isinstance(hit, dict)]
        sim_payload = avoidance.details.get("simulation")
        if isinstance(sim_payload, dict):
            simulation = sim_payload

    reasoning_parts: list[str] = []
    if result.blocked_reason:
        reasoning_parts.append(result.blocked_reason)
    elif result.issues:
        reasoning_parts.extend(result.issues)
    reasoning = "; ".join(reasoning_parts) if reasoning_parts else None

    facts = result.facts.to_dict()
    base_metadata: dict[str, Any] = {
        "stripe": {
            "intent_kind": facts["intent_kind"],
            "currency": facts["currency"],
            "api_key_kind": facts["api_key_kind"],
            "idempotency_key": facts["idempotency_key"],
            "reference_id": facts["reference_id"],
            "raw_amount": request.amount,
        }
    }
    if metadata:
        base_metadata.update(metadata)

    return AuditRecord(
        wallet_address=wallet_address,
        agent_id=agent_id,
        provider="stripe",
        event_kind=_decision_to_event_kind(result.decision),
        decision=result.decision.value,
        risk_level=result.risk_level.value,
        endpoint=f"stripe://{request.intent_kind.value}",
        network=request.normalized_currency,
        asset=request.normalized_currency,  # Stripe is fiat-only; "asset" = currency.
        pay_to=request.destination or request.customer,
        amount_usd=request.usd_amount() if request.amount is not None else None,
        gates=_serialize_gate_results(result.gates),
        drainer_intel=drainer_intel,
        simulation=simulation,
        reasoning=reasoning,
        metadata=base_metadata,
    )


__all__ = ["build_stripe_audit_record"]
