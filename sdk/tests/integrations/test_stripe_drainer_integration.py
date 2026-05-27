"""End-to-end drainer-intel integration tests for the Stripe middleware.

Mirrors test_x402_drainer_integration.py — same fail-safe contract, same
drainer-hit shape in the audit record, same severity-driven block/risk policy.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from guardianclaw.integrations.coinbase.x402.drainer_db import (
    DrainerEntry,
    DrainerKind,
    DrainerLookup,
    DrainerSource,
    InMemoryDrainerSource,
)
from guardianclaw.integrations.stripe import (
    GuardianClawStripeMiddleware,
    StripeIntentKind,
    StripePaymentRequest,
)


def _request(
    *,
    intent_kind: StripeIntentKind = StripeIntentKind.PAYMENT_INTENT_CREATE,
    amount: int = 5000,
    currency: str = "usd",
    customer: str | None = "cus_NksY4M0bM4FfXg",
    destination: str | None = None,
    description: str = "Daily API budget refill for the support agent",
) -> StripePaymentRequest:
    return StripePaymentRequest(
        intent_kind=intent_kind,
        amount=amount,
        currency=currency,
        customer=customer,
        destination=destination,
        description=description,
        api_key="rk_test_abc",
    )


# ============================================================================
# Customer hit
# ============================================================================


class TestCustomerDrainerHit:
    def test_known_drainer_customer_blocks(self):
        bad = "cus_NksY4M0bM4FfXg"
        lookup = DrainerLookup(sources=[InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS, value=bad,
                severity="critical", source="scamsniffer",
                source_ref="https://example.com/abc",
            ),
        ])])
        mw = GuardianClawStripeMiddleware(drainer_lookup=lookup)
        result = mw.validate_payment(_request(customer=bad), wallet_address="agent-1")
        assert result.decision.value == "block"
        # The audit record built later includes the same hit; here we only
        # verify the gate path surfaces it in details.
        avoidance = next(g for g in result.gates.values() if g.gate.value == "avoidance")
        hits = (avoidance.details or {}).get("drainer_intel", [])
        assert len(hits) == 1
        assert hits[0]["source"] == "scamsniffer"
        assert hits[0]["scope"] == "customer"


# ============================================================================
# Destination hit
# ============================================================================


class TestDestinationDrainerHit:
    def test_known_drainer_destination_blocks(self):
        bad = "acct_xyzbaddeadbeef"
        lookup = DrainerLookup(sources=[InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS, value=bad,
                severity="high", source="goplus",
            ),
        ])])
        mw = GuardianClawStripeMiddleware(drainer_lookup=lookup)
        result = mw.validate_payment(
            _request(
                intent_kind=StripeIntentKind.TRANSFER_CREATE,
                destination=bad,
                customer=None,
            ),
            wallet_address="agent-1",
        )
        assert result.decision.value == "block"
        avoidance = next(g for g in result.gates.values() if g.gate.value == "avoidance")
        hits = (avoidance.details or {}).get("drainer_intel", [])
        assert any(h["scope"] == "destination" for h in hits)

    def test_low_severity_destination_does_not_block(self):
        bad = "acct_xyzlowsev123"
        lookup = DrainerLookup(sources=[InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS, value=bad,
                severity="low", source="manual",
            ),
        ])])
        mw = GuardianClawStripeMiddleware(drainer_lookup=lookup)
        result = mw.validate_payment(
            _request(
                intent_kind=StripeIntentKind.TRANSFER_CREATE,
                destination=bad,
                customer=None,
            ),
            wallet_address="agent-1",
        )
        # Low severity is not BLOCK. But the hit still surfaces.
        assert result.decision.value != "block"
        avoidance = next(g for g in result.gates.values() if g.gate.value == "avoidance")
        hits = (avoidance.details or {}).get("drainer_intel", [])
        assert len(hits) == 1
        assert hits[0]["severity"] == "low"


# ============================================================================
# Fail-safe — broken sources never block
# ============================================================================


class TestDrainerFailSafe:
    def test_lookup_failure_does_not_panic_block(self):
        broken: DrainerSource = MagicMock()
        broken.lookup.side_effect = RuntimeError("DB down")
        broken.iter_patterns.return_value = []
        lookup = DrainerLookup(sources=[broken])

        mw = GuardianClawStripeMiddleware(drainer_lookup=lookup)
        # Otherwise clean — should not BLOCK because the lookup raised.
        result = mw.validate_payment(_request(), wallet_address="agent-1")
        assert result.decision.value != "block"

    def test_no_lookup_means_only_static_blocklists_apply(self):
        # Without a lookup the gate falls back to config.blocked_customers.
        from guardianclaw.integrations.stripe import GuardianClawStripeConfig
        config = GuardianClawStripeConfig()
        config.blocked_customers = ["cus_NksY4M0bM4FfXg"]
        mw = GuardianClawStripeMiddleware(config=config)
        result = mw.validate_payment(_request(), wallet_address="agent-1")
        assert result.decision.value == "block"


# ============================================================================
# Mixed provider feed
# ============================================================================


class TestMixedProviderFeed:
    def test_same_lookup_protects_both_providers(self):
        """A single DrainerLookup instance backs both x402 and Stripe."""
        from guardianclaw.integrations.coinbase.x402 import (
            GuardianClawX402Middleware,
            PaymentRequirementsModel,
        )

        bad = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        lookup = DrainerLookup(sources=[InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS, value=bad,
                severity="critical", source="manual",
            ),
        ])])

        # Stripe with same hit on the customer id (assume hex shape collides
        # — what matters is that one shared lookup is honoured).
        stripe_mw = GuardianClawStripeMiddleware(drainer_lookup=lookup)
        stripe_result = stripe_mw.validate_payment(
            StripePaymentRequest(
                intent_kind=StripeIntentKind.TRANSFER_CREATE,
                amount=5000, currency="usd",
                destination=bad,
                description="Send to a known-bad destination on purpose",
                api_key="rk_test_x",
            ),
            wallet_address="agent-1",
        )
        assert stripe_result.decision.value == "block"

        # x402 with the same hit on pay_to.
        x402_mw = GuardianClawX402Middleware(drainer_lookup=lookup)
        x402_result = x402_mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=PaymentRequirementsModel(
                scheme="exact",
                network="base",
                max_amount_required="1000000",
                resource="https://api.example.com/paid",
                pay_to=bad,
                max_timeout_seconds=60,
                asset="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            ),
            wallet_address="agent-1",
        )
        assert x402_result.decision.value == "block"
