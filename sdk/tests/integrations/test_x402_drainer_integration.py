"""Integration tests for AvoidanceGate + DrainerLookup.

These tests verify the wiring between the x402 validators and the drainer_intel
lookup added in Sprint 1 of ClawPay. They use InMemoryDrainerSource (no Supabase
required) so they run as ordinary unit tests in CI.

Run with: pytest tests/integrations/test_x402_drainer_integration.py -v
"""

from __future__ import annotations

import pytest

from guardianclaw.integrations.coinbase.x402.drainer_db import (
    DrainerEntry,
    DrainerKind,
    DrainerLookup,
    InMemoryDrainerSource,
)
from guardianclaw.integrations.coinbase.x402.config import (
    GuardianClawX402Config,
)
from guardianclaw.integrations.coinbase.x402.types import (
    CLAWGate,
    PaymentRequirementsModel,
)
from guardianclaw.integrations.coinbase.x402.validators import (
    AvoidanceGateValidator,
    CLAWPaymentValidator,
)


# ============================================================================
# Helpers
# ============================================================================


def _payment(
    *,
    pay_to: str = "0x1234567890abcdef1234567890abcdef12345678",
    network: str = "base",
    asset: str = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
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
        asset=asset,
        extra=None,
    )


# ============================================================================
# Avoidance + recipient address hit
# ============================================================================


class TestAvoidanceRecipientHit:
    def test_drainer_intel_blocks_known_drainer_address(self):
        bad_addr = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value=bad_addr,
                severity="critical",
                source="scamsniffer",
                source_ref="https://example.com/abc",
                network="base",
            ),
        ])
        validator = AvoidanceGateValidator(drainer_lookup=DrainerLookup(sources=[source]))
        config = GuardianClawX402Config()

        result = validator.validate(
            payment_requirements=_payment(pay_to=bad_addr),
            endpoint="https://api.example.com/paid",
            wallet_address="0xagent",
            config=config,
        )

        assert result.gate == CLAWGate.AVOIDANCE
        assert not result.passed
        assert "drainer_intel" in result.reason.lower() or "matched" in result.reason.lower()
        assert result.details is not None
        hits = result.details.get("drainer_intel") or []
        assert len(hits) == 1
        assert hits[0]["source"] == "scamsniffer"
        assert hits[0]["severity"] == "critical"
        assert hits[0]["scope"] == "recipient"

    def test_clean_recipient_passes(self):
        source = InMemoryDrainerSource([])  # no entries
        validator = AvoidanceGateValidator(drainer_lookup=DrainerLookup(sources=[source]))
        result = validator.validate(
            payment_requirements=_payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        assert result.passed

    def test_no_lookup_still_passes_clean(self):
        """Validator without drainer_lookup still runs static checks only."""
        validator = AvoidanceGateValidator()  # No lookup.
        result = validator.validate(
            payment_requirements=_payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        assert result.passed


# ============================================================================
# Avoidance + endpoint host hit
# ============================================================================


class TestAvoidanceEndpointHit:
    def test_known_phishing_host_blocks(self):
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ENDPOINT,
                value="evil.example.com",
                severity="high",
                source="scamsniffer",
                network=None,
            ),
        ])
        validator = AvoidanceGateValidator(drainer_lookup=DrainerLookup(sources=[source]))
        result = validator.validate(
            payment_requirements=_payment(),
            endpoint="https://evil.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        assert not result.passed
        hits = result.details["drainer_intel"]
        assert hits[0]["scope"] == "endpoint"
        assert hits[0]["value"] == "evil.example.com"

    def test_pattern_match_blocks_at_high_severity(self):
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(
                r"drain-\w+\.example\.com",
                severity="critical",
                source="manual",
            ),
        ])
        validator = AvoidanceGateValidator(drainer_lookup=DrainerLookup(sources=[source]))
        result = validator.validate(
            payment_requirements=_payment(),
            endpoint="https://drain-bot.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        assert not result.passed
        hits = result.details["drainer_intel"]
        assert any(h["scope"] == "endpoint_pattern" for h in hits)

    def test_pattern_match_at_low_severity_only_flags(self):
        """Low/medium-severity pattern hits become risk_factors, not blocks."""
        source = InMemoryDrainerSource([
            DrainerEntry.pattern(
                r"tracking-\w+\.example\.com",
                severity="low",
                source="manual",
            ),
        ])
        validator = AvoidanceGateValidator(drainer_lookup=DrainerLookup(sources=[source]))
        result = validator.validate(
            payment_requirements=_payment(),
            endpoint="https://tracking-abc.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        # Low-severity hit doesn't block.
        assert result.passed
        # But it surfaces as risk_factor for downstream risk_level calc.
        risk_factors = result.details.get("risk_factors", [])
        assert any("drainer pattern" in rf.lower() for rf in risk_factors)


# ============================================================================
# Full validator chain integration
# ============================================================================


class TestCLAWPaymentValidatorIntegration:
    def test_drainer_lookup_propagates_to_avoidance(self):
        bad_addr = "0xcafecafecafecafecafecafecafecafecafecafe"
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value=bad_addr,
                severity="critical",
                source="manual",
            ),
        ])
        validator = CLAWPaymentValidator(drainer_lookup=DrainerLookup(sources=[source]))

        results = validator.validate_payment(
            payment_requirements=_payment(pay_to=bad_addr),
            endpoint="https://api.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        avoidance = results[CLAWGate.AVOIDANCE]
        assert not avoidance.passed
        assert "drainer_intel" in (avoidance.details or {})

    def test_validator_without_lookup_still_works(self):
        validator = CLAWPaymentValidator()  # No drainer_lookup.
        results = validator.validate_payment(
            payment_requirements=_payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="0xagent",
            config=GuardianClawX402Config(),
        )
        # All four gates run; AVOIDANCE passes because no static blocklist hit.
        assert CLAWGate.AVOIDANCE in results
        assert results[CLAWGate.AVOIDANCE].passed
