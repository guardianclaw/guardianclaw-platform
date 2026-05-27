"""Audit-event emission for ClawPay.

The x402 middleware can optionally route every validation outcome into a
durable sink so the GuardianClaw dashboard ( /app/clawpay/audit ) can display
it later. Sinks are pluggable so tests use the in-memory variant and
production uses the Supabase variant.

The pipeline is **fail-safe**: any exception raised inside emit() is logged
at WARNING and swallowed. A misbehaving sink must never break payment
validation.

Schema reference: `supabase/migrations/20260521010000_clawpay_core.sql`
(table ``clawpay_audit_events``).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from .types import (
    CLAWGate,
    PaymentDecision,
    PaymentRequirementsModel,
    PaymentRiskLevel,
    PaymentValidationResult,
)

logger = logging.getLogger("guardianclaw.integrations.coinbase.x402.audit_sink")


# ============================================================================
# Audit record shape (matches the clawpay_audit_events row, minus server-side
# defaults like id / created_at / wallet_address from the JWT).
# ============================================================================


def _decision_to_event_kind(decision: PaymentDecision) -> str:
    """Map the internal PaymentDecision enum to the clawpay_event_kind enum."""
    if decision == PaymentDecision.APPROVE:
        return "payment_approved"
    if decision == PaymentDecision.REQUIRE_CONFIRMATION:
        return "payment_confirmation_required"
    if decision == PaymentDecision.BLOCK or decision == PaymentDecision.REJECT:
        return "payment_blocked"
    # Catch-all for future decision values.
    return "payment_failed"


def _serialize_gate_results(
    gates: dict[CLAWGate, Any],
) -> dict[str, dict[str, Any]]:
    """Render gate_results as JSON-friendly objects for the audit row.

    Each gate becomes ``{passed, reason, details}``. Anything non-serializable
    in ``details`` is dropped — the audit log should be safe to JSON-encode
    end-to-end.
    """
    out: dict[str, dict[str, Any]] = {}
    for gate, result in gates.items():
        details = getattr(result, "details", None)
        out[gate.value] = {
            "passed": bool(getattr(result, "passed", False)),
            "reason": getattr(result, "reason", None),
            "details": details if _is_json_safe(details) else None,
        }
    return out


def _is_json_safe(value: Any) -> bool:
    """Cheap check — we only allow primitive containers of primitives."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return True
    if isinstance(value, dict):
        return all(isinstance(k, str) and _is_json_safe(v) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return all(_is_json_safe(v) for v in value)
    return False


@dataclass
class AuditRecord:
    """Wire format that sinks receive. Maps 1:1 to clawpay_audit_events
    columns; sinks may translate to their own storage.

    ``provider`` distinguishes which payment surface produced the event
    ('x402' for Coinbase HTTP 402 micropayments, 'stripe' for the Stripe
    Agent Toolkit). Default is 'x402' to preserve backwards compatibility
    for callers that pre-date Sprint 3.
    """

    wallet_address: str
    agent_id: Optional[str]
    event_kind: str
    decision: str
    risk_level: str
    endpoint: Optional[str]
    network: Optional[str]
    asset: Optional[str]
    pay_to: Optional[str]
    amount_usd: Optional[float]
    gates: dict[str, dict[str, Any]]
    drainer_intel: list[dict[str, Any]]
    reasoning: Optional[str] = None
    tx_signature: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    provider: str = "x402"
    # Sprint 4 — serialized SimulationResult.to_audit_dict() output, or None
    # when no pre-flight simulation was configured.
    simulation: Optional[dict[str, Any]] = None

    def to_supabase_row(self) -> dict[str, Any]:
        return {
            "wallet_address": self.wallet_address,
            "agent_id": self.agent_id,
            "provider": self.provider,
            "event_kind": self.event_kind,
            "decision": self.decision,
            "risk_level": self.risk_level,
            "endpoint": self.endpoint,
            "network": self.network,
            "asset": self.asset,
            "pay_to": self.pay_to,
            "amount_usd": self.amount_usd,
            "gates": self.gates,
            "drainer_intel": self.drainer_intel,
            "simulation": self.simulation,
            "reasoning": self.reasoning,
            "tx_signature": self.tx_signature,
            "metadata": self.metadata,
            "occurred_at": self.occurred_at.isoformat(),
        }


def build_audit_record(
    *,
    wallet_address: str,
    endpoint: str,
    payment_requirements: PaymentRequirementsModel,
    result: PaymentValidationResult,
    agent_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AuditRecord:
    """Map a PaymentValidationResult to the AuditRecord wire format.

    Pulls drainer_intel hits out of the AVOIDANCE gate's details when present
    (the validator stores them there).
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

    return AuditRecord(
        wallet_address=wallet_address,
        agent_id=agent_id,
        event_kind=_decision_to_event_kind(result.decision),
        decision=result.decision.value,
        risk_level=result.risk_level.value if isinstance(result.risk_level, PaymentRiskLevel)
        else str(result.risk_level),
        endpoint=endpoint,
        network=str(payment_requirements.network) if payment_requirements.network else None,
        asset=payment_requirements.asset,
        pay_to=payment_requirements.pay_to,
        amount_usd=payment_requirements.get_amount_float(),
        simulation=simulation,
        gates=_serialize_gate_results(result.gates),
        drainer_intel=drainer_intel,
        reasoning=reasoning,
        metadata=metadata or {},
    )


# ============================================================================
# Sink abstraction
# ============================================================================


class AuditSink(ABC):
    """Pluggable destination for ClawPay audit records.

    Implementations should be safe to call from a sync context and must NEVER
    raise — return cleanly and let the lookup base class log warnings.
    """

    @abstractmethod
    def emit(self, record: AuditRecord) -> None:
        ...


class InMemoryAuditSink(AuditSink):
    """Useful for tests and ephemeral debugging. Stores records in a list."""

    def __init__(self) -> None:
        self.records: list[AuditRecord] = []

    def emit(self, record: AuditRecord) -> None:
        self.records.append(record)


class SupabaseAuditSink(AuditSink):
    """Posts each record into the ``clawpay_audit_events`` table via the
    Supabase PostgREST endpoint.

    Uses a service-role key so RLS is bypassed (the table has no insert
    policy for authenticated tenants — writes flow through trusted services
    only). The handler is fenced by a short timeout; failures are logged and
    swallowed.
    """

    def __init__(
        self,
        *,
        supabase_url: str,
        service_key: str,
        table: str = "clawpay_audit_events",
        timeout_seconds: float = 2.0,
    ) -> None:
        try:
            import httpx  # noqa: F401
        except ImportError as exc:  # pragma: no cover — runtime guard
            raise ImportError(
                "SupabaseAuditSink requires httpx. Install with "
                "`pip install guardianclaw[x402]`."
            ) from exc

        self.supabase_url = supabase_url.rstrip("/")
        self.service_key = service_key
        self.table = table
        self.timeout = timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def emit(self, record: AuditRecord) -> None:
        try:
            import httpx
            httpx.post(
                f"{self.supabase_url}/rest/v1/{self.table}",
                headers=self._headers(),
                json=record.to_supabase_row(),
                timeout=self.timeout,
            ).raise_for_status()
        except Exception as exc:  # pragma: no cover — defensive
            logger.warning("SupabaseAuditSink emit failed: %s", exc)


__all__ = [
    "AuditRecord",
    "AuditSink",
    "InMemoryAuditSink",
    "SupabaseAuditSink",
    "build_audit_record",
]
