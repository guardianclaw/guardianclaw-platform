"""Tests for the Stripe audit pipeline:

- build_stripe_audit_record maps PaymentValidationResult onto AuditRecord
- AuditRecord.provider is 'stripe' for these calls (vs 'x402' for the other path)
- Middleware emits to the configured AuditSink on every validate_payment
- Sink exceptions never propagate out of validate_payment
- SupabaseAuditSink renders the provider field into its row
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from guardianclaw.integrations.coinbase.x402 import (
    AuditRecord,
    AuditSink,
    InMemoryAuditSink,
    SupabaseAuditSink,
)
from guardianclaw.integrations.stripe import (
    GuardianClawStripeMiddleware,
    StripeIntentKind,
    StripePaymentRequest,
)
from guardianclaw.integrations.stripe.audit import build_stripe_audit_record


# ============================================================================
# Helpers
# ============================================================================


def _request(
    *,
    intent_kind: StripeIntentKind = StripeIntentKind.PAYMENT_INTENT_CREATE,
    amount: int | None = 5000,
    currency: str | None = "usd",
    customer: str | None = "cus_NksY4M0bM4FfXg",
    destination: str | None = None,
    description: str = "Daily API budget refill for the support agent",
    api_key: str | None = "rk_test_abcdef",
    idempotency_key: str | None = None,
    reference_id: str | None = None,
) -> StripePaymentRequest:
    return StripePaymentRequest(
        intent_kind=intent_kind,
        amount=amount,
        currency=currency,
        customer=customer,
        destination=destination,
        description=description,
        api_key=api_key,
        idempotency_key=idempotency_key,
        reference_id=reference_id,
    )


# ============================================================================
# build_stripe_audit_record
# ============================================================================


class TestBuildStripeAuditRecord:
    def test_records_provider_stripe(self):
        mw = GuardianClawStripeMiddleware()
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.provider == "stripe"

    def test_synthetic_endpoint_uses_intent_kind(self):
        mw = GuardianClawStripeMiddleware()
        req = _request(intent_kind=StripeIntentKind.CHARGE_CREATE)
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.endpoint == "stripe://charge.create"

    def test_network_carries_currency(self):
        mw = GuardianClawStripeMiddleware()
        req = _request(currency="eur", amount=4900)
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.network == "eur"
        assert record.asset == "eur"

    def test_pay_to_is_destination_when_set(self):
        mw = GuardianClawStripeMiddleware()
        req = _request(destination="acct_xyz123456")
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.pay_to == "acct_xyz123456"

    def test_pay_to_falls_back_to_customer(self):
        mw = GuardianClawStripeMiddleware()
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.pay_to == "cus_NksY4M0bM4FfXg"

    def test_metadata_blob_contains_stripe_facts(self):
        mw = GuardianClawStripeMiddleware()
        req = _request(idempotency_key="idem-abc", reference_id="pi_ref")
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result, agent_id="agent-7",
        )
        stripe_meta = record.metadata.get("stripe", {})
        assert stripe_meta["intent_kind"] == "payment_intent.create"
        assert stripe_meta["currency"] == "usd"
        assert stripe_meta["idempotency_key"] == "idem-abc"
        assert stripe_meta["reference_id"] == "pi_ref"
        assert stripe_meta["api_key_kind"] == "restricted_test"
        assert stripe_meta["raw_amount"] == 5000
        assert record.agent_id == "agent-7"

    def test_metadata_supports_extra_caller_metadata(self):
        mw = GuardianClawStripeMiddleware()
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
            metadata={"caller_session": "sess-42"},
        )
        assert record.metadata["caller_session"] == "sess-42"
        # The provider-specific blob is preserved.
        assert record.metadata["stripe"]["intent_kind"] == "payment_intent.create"

    def test_drainer_hits_propagate(self):
        from guardianclaw.integrations.coinbase.x402 import (
            DrainerEntry,
            DrainerKind,
            DrainerLookup,
            InMemoryDrainerSource,
        )
        bad_customer = "cus_NksY4M0bM4FfXg"
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value=bad_customer,
                severity="critical",
                source="manual",
                source_ref="https://example.com/abc",
            ),
        ])
        mw = GuardianClawStripeMiddleware(
            drainer_lookup=DrainerLookup(sources=[source])
        )
        req = _request(customer=bad_customer)
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.event_kind == "payment_blocked"
        assert len(record.drainer_intel) == 1
        assert record.drainer_intel[0]["source"] == "manual"
        assert record.drainer_intel[0]["scope"] == "customer"

    def test_to_supabase_row_includes_provider_field(self):
        mw = GuardianClawStripeMiddleware()
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        row = record.to_supabase_row()
        assert row["provider"] == "stripe"
        assert row["endpoint"].startswith("stripe://")

    def test_event_kind_mapping_for_block(self):
        # Force a BLOCK via blocked_customers.
        from guardianclaw.integrations.stripe import GuardianClawStripeConfig
        config = GuardianClawStripeConfig()
        config.blocked_customers = ["cus_NksY4M0bM4FfXg"]
        mw = GuardianClawStripeMiddleware(config=config)
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.event_kind == "payment_blocked"
        assert record.decision == "block"

    def test_event_kind_mapping_for_confirmation(self):
        # Default request is $50 → CAUTION → REQUIRE_CONFIRMATION.
        mw = GuardianClawStripeMiddleware()
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )
        assert record.event_kind == "payment_confirmation_required"


# ============================================================================
# Middleware → AuditSink wiring
# ============================================================================


class TestMiddlewareSinkWiring:
    def test_middleware_emits_to_sink(self):
        sink = InMemoryAuditSink()
        mw = GuardianClawStripeMiddleware(audit_sink=sink, agent_id="agent-7")
        mw.validate_payment(_request(), wallet_address="agent-1")
        mw.validate_payment(_request(amount=200), wallet_address="agent-1")
        assert len(sink.records) == 2
        for record in sink.records:
            assert record.provider == "stripe"
            assert record.agent_id == "agent-7"

    def test_middleware_swallows_sink_exceptions(self):
        class ExplodingSink(AuditSink):
            def emit(self, record):
                raise RuntimeError("storage offline")

        mw = GuardianClawStripeMiddleware(audit_sink=ExplodingSink())
        # Must not raise.
        result = mw.validate_payment(_request(), wallet_address="agent-1")
        assert result is not None

    def test_no_sink_no_emission(self):
        # Default constructor — no sink — still validates cleanly.
        mw = GuardianClawStripeMiddleware()
        result = mw.validate_payment(_request(), wallet_address="agent-1")
        assert result is not None


# ============================================================================
# SupabaseAuditSink picks up provider
# ============================================================================


class TestSupabaseSinkProvider:
    def test_emit_posts_provider_column(self):
        sink = SupabaseAuditSink(
            supabase_url="https://example.supabase.co",
            service_key="svc-key",
        )
        mw = GuardianClawStripeMiddleware()
        req = _request()
        result = mw.validate_payment(req, wallet_address="agent-1")
        record = build_stripe_audit_record(
            wallet_address="agent-1", request=req, result=result,
        )

        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None

        with patch("httpx.post", return_value=fake_resp) as mock_post:
            sink.emit(record)

        body = mock_post.call_args.kwargs["json"]
        assert body["provider"] == "stripe"
        assert body["endpoint"].startswith("stripe://")

    def test_x402_records_still_carry_provider_x402_by_default(self):
        """Backwards-compat check: AuditRecord built directly (without
        provider override) defaults to 'x402'."""
        record = AuditRecord(
            wallet_address="x",
            agent_id=None,
            event_kind="payment_approved",
            decision="approve",
            risk_level="safe",
            endpoint="https://api.example.com",
            network="base",
            asset="USDC",
            pay_to="0xrecipient",
            amount_usd=10.0,
            gates={},
            drainer_intel=[],
        )
        assert record.provider == "x402"
        assert record.to_supabase_row()["provider"] == "x402"
