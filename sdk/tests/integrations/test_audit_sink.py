"""Tests for the ClawPay audit sink + middleware wiring.

Verifies:
  - build_audit_record maps PaymentValidationResult into the wire format
  - InMemoryAuditSink stores records as-is
  - middleware.validate_payment emits to the configured sink
  - emit() failures never propagate out of validate_payment
  - SupabaseAuditSink builds the right HTTP request (mocked)
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from guardianclaw.integrations.coinbase.x402 import (
    AuditRecord,
    AuditSink,
    DrainerEntry,
    DrainerKind,
    DrainerLookup,
    GuardianClawX402Config,
    GuardianClawX402Middleware,
    InMemoryAuditSink,
    InMemoryDrainerSource,
    PaymentDecision,
    PaymentRequirementsModel,
    PaymentRiskLevel,
    SupabaseAuditSink,
    build_audit_record,
)
from guardianclaw.integrations.coinbase.x402.audit_sink import (
    _decision_to_event_kind,
    _is_json_safe,
    _serialize_gate_results,
)
from guardianclaw.integrations.coinbase.x402.types import CLAWGate, CLAWGateResult
from guardianclaw.integrations.coinbase.x402.validators import CLAWPaymentValidator


# ============================================================================
# Helpers
# ============================================================================


def _payment(
    *,
    pay_to: str = "0x1234567890abcdef1234567890abcdef12345678",
    network: str = "base",
    amount_atomic: str = "1000000",
) -> PaymentRequirementsModel:
    return PaymentRequirementsModel(
        scheme="exact",
        network=network,
        max_amount_required=amount_atomic,
        resource="https://api.example.com/paid",
        description="paid endpoint",
        mime_type="application/json",
        output_schema=None,
        pay_to=pay_to,
        max_timeout_seconds=60,
        asset="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        extra=None,
    )


# ============================================================================
# build_audit_record
# ============================================================================


class TestBuildAuditRecord:
    def test_maps_approved_decision_to_event_kind(self):
        validator = CLAWPaymentValidator()
        config = GuardianClawX402Config()
        payment = _payment()
        gates = validator.validate_payment(
            payment_requirements=payment,
            endpoint="https://api.example.com/paid",
            wallet_address="0xagent",
            config=config,
        )
        from guardianclaw.integrations.coinbase.x402.middleware import GuardianClawX402Middleware
        mw = GuardianClawX402Middleware()
        result = mw._build_result(
            decision=PaymentDecision.APPROVE,
            risk_level=PaymentRiskLevel.SAFE,
            gate_results=gates,
            payment_requirements=payment,
            endpoint="https://api.example.com/paid",
        )

        record = build_audit_record(
            wallet_address="0xagent",
            endpoint="https://api.example.com/paid",
            payment_requirements=payment,
            result=result,
        )
        assert record.event_kind == "payment_approved"
        assert record.decision == "approve"
        assert record.risk_level == "safe"
        assert record.amount_usd == pytest.approx(1.0)
        assert record.network == "base"
        assert record.pay_to == payment.pay_to
        assert record.endpoint == "https://api.example.com/paid"
        # gates is a dict of CLAWGate.value → {passed, reason, details}
        assert all(isinstance(k, str) for k in record.gates.keys())

    def test_event_kind_mapping_for_each_decision(self):
        assert _decision_to_event_kind(PaymentDecision.APPROVE) == "payment_approved"
        assert _decision_to_event_kind(PaymentDecision.REQUIRE_CONFIRMATION) == "payment_confirmation_required"
        assert _decision_to_event_kind(PaymentDecision.BLOCK) == "payment_blocked"
        assert _decision_to_event_kind(PaymentDecision.REJECT) == "payment_blocked"

    def test_extracts_drainer_intel_from_avoidance_gate(self):
        bad_addr = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value=bad_addr,
                severity="critical",
                source="manual",
            ),
        ])
        mw = GuardianClawX402Middleware(
            drainer_lookup=DrainerLookup(sources=[source]),
        )
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(pay_to=bad_addr),
            wallet_address="0xagent",
        )
        record = build_audit_record(
            wallet_address="0xagent",
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(pay_to=bad_addr),
            result=result,
        )
        assert record.event_kind == "payment_blocked"
        assert len(record.drainer_intel) == 1
        assert record.drainer_intel[0]["source"] == "manual"
        assert record.drainer_intel[0]["severity"] == "critical"

    def test_empty_drainer_intel_when_no_hits(self):
        mw = GuardianClawX402Middleware()
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="0xagent",
        )
        record = build_audit_record(
            wallet_address="0xagent",
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            result=result,
        )
        assert record.drainer_intel == []

    def test_to_supabase_row_serializes_all_fields(self):
        record = AuditRecord(
            wallet_address="0xagent",
            agent_id="agent-1",
            event_kind="payment_approved",
            decision="approve",
            risk_level="safe",
            endpoint="https://api.example.com",
            network="base",
            asset="USDC",
            pay_to="0xrecipient",
            amount_usd=42.5,
            gates={"credibility": {"passed": True, "reason": None, "details": None}},
            drainer_intel=[],
            reasoning="all clear",
        )
        row = record.to_supabase_row()
        assert row["wallet_address"] == "0xagent"
        assert row["agent_id"] == "agent-1"
        assert row["amount_usd"] == 42.5
        assert "occurred_at" in row and isinstance(row["occurred_at"], str)
        assert row["gates"] == {
            "credibility": {"passed": True, "reason": None, "details": None}
        }


# ============================================================================
# _is_json_safe / _serialize_gate_results
# ============================================================================


class TestSerialization:
    def test_is_json_safe_primitives(self):
        assert _is_json_safe(None) is True
        assert _is_json_safe("x") is True
        assert _is_json_safe(1) is True
        assert _is_json_safe(1.5) is True
        assert _is_json_safe(True) is True

    def test_is_json_safe_containers(self):
        assert _is_json_safe([1, 2, 3]) is True
        assert _is_json_safe({"k": [1, "x"]}) is True
        assert _is_json_safe([{"k": "v"}, 1]) is True

    def test_is_json_safe_rejects_complex(self):
        assert _is_json_safe(object()) is False
        assert _is_json_safe({1: 2}) is False  # non-string key
        assert _is_json_safe([object()]) is False

    def test_serialize_gate_results_handles_non_json_details(self):
        gate_results = {
            CLAWGate.CREDIBILITY: CLAWGateResult(
                gate=CLAWGate.CREDIBILITY, passed=True,
                details={"object": object()},  # non-safe
            ),
            CLAWGate.AVOIDANCE: CLAWGateResult(
                gate=CLAWGate.AVOIDANCE, passed=False,
                reason="blocked",
                details={"hits": [{"source": "scamsniffer"}]},
            ),
        }
        out = _serialize_gate_results(gate_results)
        # Non-JSON-safe details gets dropped to None.
        assert out["credibility"]["details"] is None
        # JSON-safe details survives intact.
        assert out["avoidance"]["details"] == {"hits": [{"source": "scamsniffer"}]}


# ============================================================================
# InMemoryAuditSink
# ============================================================================


class TestInMemoryAuditSink:
    def test_stores_records(self):
        sink = InMemoryAuditSink()
        assert sink.records == []
        record = AuditRecord(
            wallet_address="x",
            agent_id=None,
            event_kind="payment_approved",
            decision="approve",
            risk_level="safe",
            endpoint=None,
            network=None,
            asset=None,
            pay_to=None,
            amount_usd=None,
            gates={},
            drainer_intel=[],
        )
        sink.emit(record)
        assert sink.records == [record]


# ============================================================================
# SupabaseAuditSink (with mocked httpx)
# ============================================================================


class TestSupabaseAuditSink:
    def test_emit_posts_to_supabase(self):
        sink = SupabaseAuditSink(
            supabase_url="https://example.supabase.co",
            service_key="svc-key",
        )
        record = AuditRecord(
            wallet_address="0xagent",
            agent_id=None,
            event_kind="payment_blocked",
            decision="block",
            risk_level="blocked",
            endpoint="https://x",
            network="base",
            asset="USDC",
            pay_to="0xdead",
            amount_usd=10.0,
            gates={},
            drainer_intel=[],
        )

        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None

        with patch("httpx.post", return_value=fake_resp) as mock_post:
            sink.emit(record)

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert "rest/v1/clawpay_audit_events" in args[0]
        headers = kwargs["headers"]
        assert headers["apikey"] == "svc-key"
        assert headers["Authorization"] == "Bearer svc-key"
        body = kwargs["json"]
        assert body["wallet_address"] == "0xagent"
        assert body["event_kind"] == "payment_blocked"

    def test_emit_swallows_http_errors(self):
        sink = SupabaseAuditSink(
            supabase_url="https://example.supabase.co",
            service_key="svc-key",
        )
        record = AuditRecord(
            wallet_address="x", agent_id=None, event_kind="payment_blocked",
            decision="block", risk_level="blocked",
            endpoint=None, network=None, asset=None, pay_to=None, amount_usd=None,
            gates={}, drainer_intel=[],
        )
        import httpx
        with patch(
            "httpx.post",
            side_effect=httpx.RequestError("connection refused", request=MagicMock()),
        ):
            # Must NOT raise.
            sink.emit(record)


# ============================================================================
# Middleware wiring
# ============================================================================


class TestMiddlewareAuditWiring:
    def test_middleware_emits_to_sink_on_each_validate(self):
        sink = InMemoryAuditSink()
        mw = GuardianClawX402Middleware(audit_sink=sink, agent_id="agent-7")

        mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="0xagent",
        )
        mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(amount_atomic="500000"),
            wallet_address="0xagent",
        )
        assert len(sink.records) == 2
        for record in sink.records:
            assert record.wallet_address == "0xagent"
            assert record.agent_id == "agent-7"
            assert record.endpoint == "https://api.example.com/paid"

    def test_middleware_swallows_sink_exceptions(self):
        class ExplodingSink(AuditSink):
            def emit(self, record):
                raise RuntimeError("storage offline")

        mw = GuardianClawX402Middleware(audit_sink=ExplodingSink())
        # Must not raise even though the sink does.
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="0xagent",
        )
        # Result is still constructed; payment flow not aborted.
        assert result is not None

    def test_no_sink_means_no_emission(self):
        # Default constructor has no audit_sink. Verify no errors thrown and
        # the validator still works.
        mw = GuardianClawX402Middleware()
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="0xagent",
        )
        assert result is not None

    def test_drainer_hit_propagates_into_audit_record(self):
        bad = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        sink = InMemoryAuditSink()
        mw = GuardianClawX402Middleware(
            drainer_lookup=DrainerLookup(sources=[
                InMemoryDrainerSource([
                    DrainerEntry(
                        kind=DrainerKind.ADDRESS,
                        value=bad,
                        severity="critical",
                        source="manual",
                    ),
                ]),
            ]),
            audit_sink=sink,
        )
        mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(pay_to=bad),
            wallet_address="0xagent",
        )
        assert len(sink.records) == 1
        record = sink.records[0]
        assert record.event_kind == "payment_blocked"
        assert len(record.drainer_intel) == 1
        assert record.drainer_intel[0]["source"] == "manual"
