"""
Comprehensive test suite for the GuardianClaw Stripe integration (Sprint 3).

Mirrors the layout of test_x402.py:
  - Type detection (StripeApiKeyKind, StripeIntentKind)
  - Amount normalization (USD-equivalent, zero-decimal currencies)
  - Pydantic request model + property helpers
  - StripeAuditFacts
  - Config presets (permissive / standard / strict / paranoid)
  - The four CLAW gates (positive + negative + edge cases)
  - Risk-level computation
  - Middleware orchestration (happy path, BLOCK escalation, REJECT,
    REQUIRE_CONFIRMATION, spending-counter rollover, hook raises)
  - Factory helpers

Run with: pytest tests/integrations/test_stripe.py -v
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from guardianclaw.integrations.stripe import (
    ConfirmationThresholds,
    GuardianClawStripeConfig,
    GuardianClawStripeMiddleware,
    PaymentBlockedError,
    PaymentRejectedError,
    SpendingLimits,
    StripeApiKeyKind,
    StripeAuditFacts,
    StripeCLAWValidator,
    StripeAvoidanceGateValidator,
    StripeCredibilityGateValidator,
    StripeIntentKind,
    StripeLimitsGateValidator,
    StripePaymentRequest,
    StripeWorthGateValidator,
    ValidationConfig,
    ZERO_DECIMAL_CURRENCIES,
    create_stripe_middleware,
    get_default_config,
    normalize_amount_usd,
)
from guardianclaw.integrations.stripe.types import (
    CLAWGate,
    CLAWGateResult,
    PaymentDecision,
    PaymentRiskLevel,
    is_valid_account_id,
    is_valid_charge_id,
    is_valid_customer_id,
    is_valid_intent_id,
    is_valid_refund_id,
)


# ============================================================================
# Fixtures
# ============================================================================


def _request(
    *,
    intent_kind: StripeIntentKind = StripeIntentKind.PAYMENT_INTENT_CREATE,
    amount: int | None = 5000,        # $50.00 USD
    currency: str | None = "usd",
    customer: str | None = "cus_NksY4M0bM4FfXg",
    destination: str | None = None,
    description: str = "Daily API budget refill for the support agent",
    api_key: str | None = "rk_test_abcdef0123",
    metadata: dict | None = None,
    idempotency_key: str | None = None,
    reference_id: str | None = None,
    amount_usd_hint: float | None = None,
) -> StripePaymentRequest:
    return StripePaymentRequest(
        intent_kind=intent_kind,
        amount=amount,
        currency=currency,
        customer=customer,
        destination=destination,
        description=description,
        api_key=api_key,
        metadata=metadata,
        idempotency_key=idempotency_key,
        reference_id=reference_id,
        amount_usd_hint=amount_usd_hint,
    )


# ============================================================================
# StripeApiKeyKind
# ============================================================================


class TestStripeApiKeyKind:
    def test_detects_restricted_live(self):
        assert StripeApiKeyKind.detect("rk_live_abc") == StripeApiKeyKind.RESTRICTED_LIVE

    def test_detects_restricted_test(self):
        assert StripeApiKeyKind.detect("rk_test_abc") == StripeApiKeyKind.RESTRICTED_TEST

    def test_detects_secret_live(self):
        assert StripeApiKeyKind.detect("sk_live_abc") == StripeApiKeyKind.SECRET_LIVE

    def test_detects_secret_test(self):
        assert StripeApiKeyKind.detect("sk_test_abc") == StripeApiKeyKind.SECRET_TEST

    def test_detects_publishable(self):
        assert StripeApiKeyKind.detect("pk_live_abc") == StripeApiKeyKind.PUBLISHABLE
        assert StripeApiKeyKind.detect("pk_test_abc") == StripeApiKeyKind.PUBLISHABLE

    def test_unknown_for_none_and_empty(self):
        assert StripeApiKeyKind.detect(None) == StripeApiKeyKind.UNKNOWN
        assert StripeApiKeyKind.detect("") == StripeApiKeyKind.UNKNOWN

    def test_unknown_for_garbage(self):
        assert StripeApiKeyKind.detect("not_a_key") == StripeApiKeyKind.UNKNOWN

    def test_is_restricted_property(self):
        assert StripeApiKeyKind.RESTRICTED_LIVE.is_restricted is True
        assert StripeApiKeyKind.RESTRICTED_TEST.is_restricted is True
        assert StripeApiKeyKind.SECRET_LIVE.is_restricted is False
        assert StripeApiKeyKind.PUBLISHABLE.is_restricted is False

    def test_is_live_property(self):
        assert StripeApiKeyKind.RESTRICTED_LIVE.is_live is True
        assert StripeApiKeyKind.SECRET_LIVE.is_live is True
        assert StripeApiKeyKind.RESTRICTED_TEST.is_live is False
        assert StripeApiKeyKind.SECRET_TEST.is_live is False


# ============================================================================
# StripeIntentKind
# ============================================================================


class TestStripeIntentKind:
    def test_moves_money_for_payment_kinds(self):
        for kind in (
            StripeIntentKind.PAYMENT_INTENT_CREATE,
            StripeIntentKind.PAYMENT_INTENT_CONFIRM,
            StripeIntentKind.CHARGE_CREATE,
            StripeIntentKind.TRANSFER_CREATE,
        ):
            assert kind.moves_money is True, f"{kind} should move money"

    def test_does_not_move_money_for_non_payment_kinds(self):
        for kind in (
            StripeIntentKind.REFUND_CREATE,
            StripeIntentKind.PAYMENT_LINK_CREATE,
            StripeIntentKind.INVOICE_FINALIZE,
            StripeIntentKind.SUBSCRIPTION_CREATE,
            StripeIntentKind.CUSTOMER_CREATE,
            StripeIntentKind.UNKNOWN,
        ):
            assert kind.moves_money is False, f"{kind} should not move money"

    def test_is_refund(self):
        assert StripeIntentKind.REFUND_CREATE.is_refund is True
        assert StripeIntentKind.PAYMENT_INTENT_CREATE.is_refund is False


# ============================================================================
# normalize_amount_usd
# ============================================================================


class TestNormalizeAmountUsd:
    def test_usd_amount_cents_to_dollars(self):
        assert normalize_amount_usd(4900, "usd") == 49.0

    def test_zero_decimal_currency_stays_in_major_unit(self):
        # 1000 JPY = 1000 yen, not 10 yen.
        out = normalize_amount_usd(1000, "jpy")
        # Convert with fallback rate ~0.0065
        assert 5.0 < out < 8.0, f"expected ~6.5 USD, got {out}"

    def test_hint_overrides_currency_table(self):
        out = normalize_amount_usd(5000, "eur", amount_usd_hint=42.0)
        assert out == 42.0

    def test_unknown_currency_falls_back_to_1to1(self):
        # Unknown currency code → fallback rate 1.0 over the major unit.
        # 1000 / 100 = 10.0
        assert normalize_amount_usd(1000, "xyz") == 10.0

    def test_unknown_zero_decimal_combo(self):
        # 'xyz' isn't zero-decimal, so should divide by 100.
        assert normalize_amount_usd(100, "xyz") == 1.0

    def test_currency_case_insensitive(self):
        assert normalize_amount_usd(4900, "USD") == normalize_amount_usd(4900, "usd")

    def test_eur_converts_via_table(self):
        # 4900 cents = 49 EUR, table rate 1.08 → ~52.92 USD
        out = normalize_amount_usd(4900, "eur")
        assert 52 < out < 54

    def test_zero_decimal_set_contains_jpy(self):
        assert "jpy" in ZERO_DECIMAL_CURRENCIES
        assert "usd" not in ZERO_DECIMAL_CURRENCIES


# ============================================================================
# ID validators
# ============================================================================


class TestIdValidators:
    def test_customer_id_valid(self):
        assert is_valid_customer_id("cus_NksY4M0bM4FfXg") is True

    def test_customer_id_too_short(self):
        assert is_valid_customer_id("cus_abc") is False

    def test_customer_id_no_prefix(self):
        assert is_valid_customer_id("NksY4M0bM4FfXg") is False

    def test_customer_id_none(self):
        assert is_valid_customer_id(None) is False

    def test_account_id_valid(self):
        assert is_valid_account_id("acct_1HpzbS2eZvKYlo2C") is True

    def test_account_id_wrong_prefix(self):
        assert is_valid_account_id("cus_abc123456") is False

    def test_intent_id_valid(self):
        assert is_valid_intent_id("pi_3OXYZabcdef") is True

    def test_charge_id_valid(self):
        assert is_valid_charge_id("ch_3OXYZabcdef") is True

    def test_refund_id_valid(self):
        assert is_valid_refund_id("re_3OXYZabcdef") is True


# ============================================================================
# StripePaymentRequest
# ============================================================================


class TestStripePaymentRequest:
    def test_default_intent_kind_is_unknown(self):
        req = StripePaymentRequest()
        assert req.intent_kind == StripeIntentKind.UNKNOWN

    def test_usd_amount_for_money_moving_request(self):
        req = _request()
        assert req.usd_amount() == 50.0

    def test_usd_amount_zero_when_amount_missing(self):
        req = StripePaymentRequest(intent_kind=StripeIntentKind.CUSTOMER_CREATE)
        assert req.usd_amount() == 0.0

    def test_usd_amount_with_hint(self):
        req = _request(amount=10000, currency="eur", amount_usd_hint=120.0)
        assert req.usd_amount() == 120.0

    def test_normalized_currency_lowercase(self):
        req = _request(currency="USD")
        assert req.normalized_currency == "usd"

    def test_normalized_currency_none(self):
        req = StripePaymentRequest()
        assert req.normalized_currency is None

    def test_detected_key_kind(self):
        assert _request(api_key="rk_live_xxx").detected_key_kind() == StripeApiKeyKind.RESTRICTED_LIVE
        assert _request(api_key=None).detected_key_kind() == StripeApiKeyKind.UNKNOWN

    def test_request_accepts_zero_amount_for_non_payment_intents(self):
        # Stripe customer.create has no amount.
        req = StripePaymentRequest(
            intent_kind=StripeIntentKind.CUSTOMER_CREATE,
            amount=0,
        )
        assert req.usd_amount() == 0.0


# ============================================================================
# StripeAuditFacts
# ============================================================================


class TestStripeAuditFacts:
    def test_from_request_captures_all_fields(self):
        req = _request(
            destination="acct_xyz123456",
            idempotency_key="idem-abc",
            reference_id="pi_existing123",
        )
        facts = StripeAuditFacts.from_request(req)
        assert facts.intent_kind == StripeIntentKind.PAYMENT_INTENT_CREATE.value
        assert facts.amount_usd == 50.0
        assert facts.currency == "usd"
        assert facts.customer == "cus_NksY4M0bM4FfXg"
        assert facts.destination == "acct_xyz123456"
        assert facts.api_key_kind == StripeApiKeyKind.RESTRICTED_TEST.value
        assert facts.idempotency_key == "idem-abc"
        assert facts.reference_id == "pi_existing123"

    def test_to_dict_round_trip(self):
        facts = StripeAuditFacts.from_request(_request())
        d = facts.to_dict()
        assert d["intent_kind"] == "payment_intent.create"
        assert d["amount_usd"] == 50.0
        assert d["api_key_kind"] == "restricted_test"


# ============================================================================
# Config presets
# ============================================================================


class TestConfigPresets:
    def test_standard_is_default(self):
        config = get_default_config("standard")
        assert isinstance(config, GuardianClawStripeConfig)
        assert config.spending_limits.max_single_payment == 100.0

    def test_permissive_relaxes_limits_and_keys(self):
        config = get_default_config("permissive")
        assert config.spending_limits.max_single_payment == 1_000.0
        assert config.validation.require_restricted_api_key is False

    def test_strict_tightens_limits(self):
        config = get_default_config("strict")
        assert config.spending_limits.max_single_payment == 25.0
        assert config.validation.strict_mode is True
        assert config.validation.require_restricted_api_key is True

    def test_paranoid_blocks_live_keys(self):
        config = get_default_config("paranoid")
        assert config.validation.sandbox_only is True
        assert config.spending_limits.max_single_payment == 5.0

    def test_spending_limits_post_init_rejects_invalid(self):
        with pytest.raises(ValueError):
            SpendingLimits(max_single_payment=0)
        with pytest.raises(ValueError):
            SpendingLimits(max_transactions_per_hour=0)


# ============================================================================
# CredibilityGate
# ============================================================================


class TestCredibilityGate:
    def _gate(self) -> StripeCredibilityGateValidator:
        return StripeCredibilityGateValidator()

    def test_clean_restricted_key_passes(self):
        result = self._gate().validate(
            _request(), wallet_address="agent-1", config=get_default_config("standard"),
        )
        assert result.passed is True
        assert result.gate == CLAWGate.CREDIBILITY

    def test_full_secret_key_blocks_by_default(self):
        result = self._gate().validate(
            _request(api_key="sk_live_xxxx"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False
        assert "restricted" in (result.reason or "").lower()

    def test_full_secret_key_passes_when_relaxed(self):
        result = self._gate().validate(
            _request(api_key="sk_live_xxxx"),
            wallet_address="agent-1",
            config=get_default_config("permissive"),
        )
        assert result.passed is True

    def test_live_key_blocks_in_sandbox_only_mode(self):
        result = self._gate().validate(
            _request(api_key="rk_live_xxx"),
            wallet_address="agent-1",
            config=get_default_config("paranoid"),
        )
        assert result.passed is False
        assert "sandbox" in (result.reason or "").lower()

    def test_missing_currency_blocks_money_moving_intent(self):
        result = self._gate().validate(
            _request(currency=None),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False

    def test_invalid_iso_currency_blocks(self):
        # Numbers aren't ISO-4217 letters. Use the model_construct escape
        # hatch to bypass Pydantic's max_length so the gate is what catches
        # the malformed code (otherwise Pydantic short-circuits the test).
        req = StripePaymentRequest.model_construct(
            intent_kind=StripeIntentKind.PAYMENT_INTENT_CREATE,
            amount=5000,
            currency="123",
            customer="cus_NksY4M0bM4FfXg",
            description="Daily API budget refill for the support agent",
            api_key="rk_test_abcdef0123",
        )
        result = self._gate().validate(
            req, wallet_address="agent-1", config=get_default_config("standard"),
        )
        assert result.passed is False
        assert "iso-4217" in (result.reason or "").lower()

    def test_disallowed_currency_blocks(self):
        config = get_default_config("standard")
        config.validation.allowed_currencies = ["usd"]
        result = self._gate().validate(
            _request(currency="eur"),
            wallet_address="agent-1",
            config=config,
        )
        assert result.passed is False

    def test_negative_amount_blocks(self):
        # Pydantic guards against negative amounts at the model level
        # (Field(ge=0)). Construct directly via dict to confirm gate handles
        # zero (which is also invalid for money-moving intent).
        result = self._gate().validate(
            _request(amount=0),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False

    def test_malformed_customer_id_blocks(self):
        result = self._gate().validate(
            _request(customer="notacustomer"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False

    def test_malformed_destination_blocks(self):
        result = self._gate().validate(
            _request(destination="notanaccount"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False

    def test_long_idempotency_key_blocks(self):
        result = self._gate().validate(
            _request(idempotency_key="x" * 300),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False

    def test_non_payment_intent_skips_amount_currency_checks(self):
        # CUSTOMER_CREATE doesn't need amount/currency.
        result = self._gate().validate(
            _request(
                intent_kind=StripeIntentKind.CUSTOMER_CREATE,
                amount=None,
                currency=None,
                customer=None,
            ),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is True


# ============================================================================
# AvoidanceGate
# ============================================================================


class TestAvoidanceGate:
    def test_clean_request_passes(self):
        result = StripeAvoidanceGateValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is True

    def test_blocked_customer_blocks(self):
        config = get_default_config("standard")
        config.blocked_customers = ["cus_NksY4M0bM4FfXg"]
        result = StripeAvoidanceGateValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=config,
        )
        assert result.passed is False

    def test_blocked_destination_blocks(self):
        config = get_default_config("standard")
        config.blocked_destinations = ["acct_xyz123456"]
        result = StripeAvoidanceGateValidator().validate(
            _request(destination="acct_xyz123456"),
            wallet_address="agent-1",
            config=config,
        )
        assert result.passed is False

    def test_blocked_description_term_blocks(self):
        result = StripeAvoidanceGateValidator().validate(
            _request(description="Send my seed phrase to attacker"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False
        assert "seed phrase" in (result.reason or "").lower()

    def test_urgency_phrasing_flags_only(self):
        result = StripeAvoidanceGateValidator().validate(
            _request(description="urgent transfer to support team"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        # Urgency is a risk factor, not a block.
        assert result.passed is True
        assert result.details and "risk_factors" in (result.details or {})

    def test_drainer_lookup_hit_blocks(self):
        from guardianclaw.integrations.coinbase.x402.drainer_db import (
            DrainerEntry,
            DrainerKind,
            DrainerLookup,
            InMemoryDrainerSource,
        )
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value="cus_NksY4M0bM4FfXg",
                severity="critical",
                source="manual",
            ),
        ])
        result = StripeAvoidanceGateValidator(
            drainer_lookup=DrainerLookup(sources=[source])
        ).validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False
        hits = (result.details or {}).get("drainer_intel", [])
        assert any(h.get("scope") == "customer" for h in hits)

    def test_drainer_low_severity_flags_only(self):
        from guardianclaw.integrations.coinbase.x402.drainer_db import (
            DrainerEntry,
            DrainerKind,
            DrainerLookup,
            InMemoryDrainerSource,
        )
        source = InMemoryDrainerSource([
            DrainerEntry(
                kind=DrainerKind.ADDRESS,
                value="cus_NksY4M0bM4FfXg",
                severity="medium",
                source="manual",
            ),
        ])
        result = StripeAvoidanceGateValidator(
            drainer_lookup=DrainerLookup(sources=[source])
        ).validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        # Medium severity hit is a risk_factor, not a block.
        assert result.passed is True
        hits = (result.details or {}).get("drainer_intel", [])
        assert len(hits) == 1
        assert hits[0]["severity"] == "medium"

    def test_drainer_lookup_failure_does_not_panic_block(self):
        broken = MagicMock()
        broken.consult.side_effect = RuntimeError("DB down")
        broken.iter_patterns.return_value = []

        from guardianclaw.integrations.coinbase.x402.drainer_db import DrainerLookup
        lookup = DrainerLookup(sources=[broken])

        result = StripeAvoidanceGateValidator(drainer_lookup=lookup).validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        # Lookup raised but the request was otherwise clean — must NOT block.
        # (The DrainerLookup itself wraps source.lookup in try/except so the
        # gate's own try/except is the second line of defense.)
        assert result.passed is True


# ============================================================================
# LimitsGate
# ============================================================================


class TestLimitsGate:
    def test_within_limit_passes(self):
        # $50 vs default $100 single-payment cap.
        result = StripeLimitsGateValidator().validate(
            _request(amount=5000),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is True

    def test_above_single_payment_limit_blocks(self):
        result = StripeLimitsGateValidator().validate(
            _request(amount=20_000),  # $200 > $100 cap
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False
        assert "single payment limit" in (result.reason or "").lower()

    def test_daily_total_exceeded_blocks(self):
        result = StripeLimitsGateValidator().validate(
            _request(amount=5000),
            wallet_address="agent-1",
            config=get_default_config("standard"),
            context={"daily_total": 480.0, "daily_transaction_count": 5, "hourly_transaction_count": 1},
        )
        # 480 + 50 = 530 > 500 daily cap.
        assert result.passed is False

    def test_daily_transaction_count_exceeded_blocks(self):
        config = get_default_config("standard")
        result = StripeLimitsGateValidator().validate(
            _request(amount=1000),
            wallet_address="agent-1",
            config=config,
            context={"daily_total": 0.0, "daily_transaction_count": config.spending_limits.max_transactions_per_day, "hourly_transaction_count": 0},
        )
        assert result.passed is False
        assert "transaction limit reached" in (result.reason or "").lower()

    def test_hourly_rate_limit_blocks(self):
        config = get_default_config("standard")
        result = StripeLimitsGateValidator().validate(
            _request(amount=1000),
            wallet_address="agent-1",
            config=config,
            context={"daily_total": 0.0, "daily_transaction_count": 0, "hourly_transaction_count": config.spending_limits.max_transactions_per_hour},
        )
        assert result.passed is False

    def test_non_payment_intent_is_no_op(self):
        result = StripeLimitsGateValidator().validate(
            _request(intent_kind=StripeIntentKind.CUSTOMER_CREATE, amount=None, currency=None),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is True

    def test_limits_disabled_short_circuits(self):
        config = get_default_config("standard")
        config.validation.enable_spending_limits = False
        result = StripeLimitsGateValidator().validate(
            _request(amount=999_999),
            wallet_address="agent-1",
            config=config,
        )
        assert result.passed is True

    def test_eu_currency_normalized_to_usd_for_cap(self):
        # 12,000 cents EUR ≈ $130 — exceeds standard $100 cap.
        result = StripeLimitsGateValidator().validate(
            _request(amount=12_000, currency="eur", amount_usd_hint=None),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False


# ============================================================================
# WorthGate
# ============================================================================


class TestWorthGate:
    def test_clean_description_passes(self):
        result = StripeWorthGateValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is True

    def test_short_description_blocks_for_money_moving(self):
        result = StripeWorthGateValidator().validate(
            _request(description="pay"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False
        assert "too short" in (result.reason or "").lower()

    def test_too_few_words_blocks(self):
        # 20+ chars but only one word.
        result = StripeWorthGateValidator().validate(
            _request(description="aaaaaaaaaaaaaaaaaaaaaaaa"),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is False
        assert "few words" in (result.reason or "").lower()

    def test_non_payment_intent_does_not_require_description(self):
        result = StripeWorthGateValidator().validate(
            _request(
                intent_kind=StripeIntentKind.CUSTOMER_CREATE,
                amount=None,
                currency=None,
                description="",
            ),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert result.passed is True

    def test_unknown_customer_flags_only_by_default(self):
        result = StripeWorthGateValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
            context={"customer_history": {}, "destination_history": {}},
        )
        assert result.passed is True
        flags = (result.details or {}).get("flags", [])
        assert any("First payment to this customer" in f for f in flags)

    def test_unknown_customer_blocks_in_strict_mode(self):
        result = StripeWorthGateValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("strict"),
            context={"customer_history": {}, "destination_history": {}},
        )
        assert result.passed is False

    def test_known_customer_passes(self):
        result = StripeWorthGateValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
            context={
                "customer_history": {"cus_NksY4M0bM4FfXg": True},
                "destination_history": {},
            },
        )
        flags = (result.details or {}).get("flags", [])
        assert all("First payment" not in f for f in flags)
        assert result.passed is True


# ============================================================================
# StripeCLAWValidator (orchestrator)
# ============================================================================


class TestStripeCLAWValidator:
    def test_runs_all_four_gates(self):
        results = StripeCLAWValidator().validate(
            _request(),
            wallet_address="agent-1",
            config=get_default_config("standard"),
        )
        assert set(results.keys()) == {
            CLAWGate.CREDIBILITY, CLAWGate.AVOIDANCE, CLAWGate.LIMITS, CLAWGate.WORTH,
        }

    def test_avoidance_failure_yields_blocked_risk(self):
        config = get_default_config("standard")
        config.blocked_customers = ["cus_NksY4M0bM4FfXg"]
        results = StripeCLAWValidator().validate(
            _request(), wallet_address="agent-1", config=config,
        )
        risk = StripeCLAWValidator().calculate_risk_level(
            gate_results=results,
            request=_request(),
            config=config,
        )
        assert risk == PaymentRiskLevel.BLOCKED

    def test_two_failures_critical(self):
        # Bad currency (credibility) + above single limit (limits).
        config = get_default_config("standard")
        results = StripeCLAWValidator().validate(
            _request(amount=20_000, currency="ZZZ" if "ZZZ" else None),  # invalid currency
            wallet_address="agent-1",
            config=config,
        )
        # Manually mark a second failure to simulate two failures cleanly.
        results[CLAWGate.WORTH] = CLAWGateResult(
            gate=CLAWGate.WORTH, passed=False, reason="forced for test",
        )
        risk = StripeCLAWValidator().calculate_risk_level(
            gate_results=results,
            request=_request(),
            config=config,
        )
        assert risk == PaymentRiskLevel.CRITICAL

    def test_one_failure_high(self):
        results = {
            CLAWGate.CREDIBILITY: CLAWGateResult(gate=CLAWGate.CREDIBILITY, passed=True),
            CLAWGate.AVOIDANCE: CLAWGateResult(gate=CLAWGate.AVOIDANCE, passed=True),
            CLAWGate.LIMITS: CLAWGateResult(gate=CLAWGate.LIMITS, passed=False, reason="x"),
            CLAWGate.WORTH: CLAWGateResult(gate=CLAWGate.WORTH, passed=True),
        }
        risk = StripeCLAWValidator().calculate_risk_level(
            gate_results=results, request=_request(), config=get_default_config("standard"),
        )
        assert risk == PaymentRiskLevel.HIGH

    def test_clean_under_threshold_safe(self):
        results = {g: CLAWGateResult(gate=g, passed=True) for g in CLAWGate}
        # Amount $1 → below default $10 confirmation threshold.
        risk = StripeCLAWValidator().calculate_risk_level(
            gate_results=results,
            request=_request(amount=100),  # $1
            config=get_default_config("standard"),
        )
        assert risk == PaymentRiskLevel.SAFE

    def test_clean_above_threshold_caution(self):
        results = {g: CLAWGateResult(gate=g, passed=True) for g in CLAWGate}
        risk = StripeCLAWValidator().calculate_risk_level(
            gate_results=results,
            request=_request(amount=5000),  # $50 > $10 threshold
            config=get_default_config("standard"),
        )
        assert risk == PaymentRiskLevel.CAUTION

    def test_warnings_escalate_to_caution(self):
        results = {g: CLAWGateResult(gate=g, passed=True) for g in CLAWGate}
        results[CLAWGate.LIMITS] = CLAWGateResult(
            gate=CLAWGate.LIMITS, passed=True,
            details={"warnings": ["Approaching daily limit"]},
        )
        risk = StripeCLAWValidator().calculate_risk_level(
            gate_results=results,
            request=_request(amount=100),  # below threshold
            config=get_default_config("standard"),
        )
        assert risk == PaymentRiskLevel.CAUTION

    def test_validator_swallows_gate_exception(self):
        class BrokenGate(StripeCredibilityGateValidator):
            def validate(self, request, wallet_address, config, context=None):
                raise RuntimeError("kaboom")

        v = StripeCLAWValidator()
        v._validators[0] = BrokenGate()
        results = v.validate(
            _request(), wallet_address="agent-1", config=get_default_config("standard"),
        )
        cred = results[CLAWGate.CREDIBILITY]
        assert cred.passed is False
        assert "Validator error" in (cred.reason or "")


# ============================================================================
# Middleware orchestration
# ============================================================================


class TestMiddlewareOrchestration:
    def test_clean_small_payment_approves(self):
        middleware = GuardianClawStripeMiddleware()
        # Prime the customer history so the "first payment" flag doesn't
        # escalate to CAUTION. Keep amount below the $10 threshold.
        middleware.after_create_hook(
            _request(amount=100, description="Initial known-customer seed call"),
            wallet_address="agent-1",
            success=True,
        )
        result = middleware.validate_payment(
            _request(amount=500, description="Tiny follow-up payment for unit checking"),
            wallet_address="agent-1",
        )
        assert result.decision == PaymentDecision.APPROVE
        assert result.is_approved is True

    def test_caution_escalates_to_confirmation(self):
        middleware = GuardianClawStripeMiddleware()
        result = middleware.validate_payment(_request(), wallet_address="agent-1")
        assert result.decision == PaymentDecision.REQUIRE_CONFIRMATION
        assert result.requires_confirmation is True
        assert result.is_approved is True  # confirmation is still "approved-ish"

    def test_blocked_customer_yields_block_decision(self):
        config = get_default_config("standard")
        config.blocked_customers = ["cus_NksY4M0bM4FfXg"]
        middleware = GuardianClawStripeMiddleware(config=config)
        result = middleware.validate_payment(_request(), wallet_address="agent-1")
        assert result.decision == PaymentDecision.BLOCK
        assert result.is_approved is False
        assert result.blocked_reason is not None

    def test_reject_when_one_non_avoidance_gate_fails(self):
        # Above single payment limit → LIMITS fails, AVOIDANCE doesn't.
        middleware = GuardianClawStripeMiddleware()
        result = middleware.validate_payment(_request(amount=50_000), wallet_address="agent-1")
        assert result.decision == PaymentDecision.REJECT

    def test_before_create_raises_on_block(self):
        config = get_default_config("standard")
        config.blocked_customers = ["cus_NksY4M0bM4FfXg"]
        middleware = GuardianClawStripeMiddleware(config=config)
        with pytest.raises(PaymentBlockedError) as exc:
            middleware.before_create_hook(_request(), wallet_address="agent-1")
        assert exc.value.result.decision == PaymentDecision.BLOCK

    def test_before_create_raises_on_reject(self):
        middleware = GuardianClawStripeMiddleware()
        with pytest.raises(PaymentRejectedError) as exc:
            middleware.before_create_hook(_request(amount=50_000), wallet_address="agent-1")
        assert exc.value.result.decision == PaymentDecision.REJECT

    def test_before_create_returns_on_confirmation(self):
        middleware = GuardianClawStripeMiddleware()
        result = middleware.before_create_hook(_request(), wallet_address="agent-1")
        assert result.decision == PaymentDecision.REQUIRE_CONFIRMATION

    def test_after_create_records_spending(self):
        middleware = GuardianClawStripeMiddleware()
        middleware.after_create_hook(
            _request(amount=5000), wallet_address="agent-1",
            success=True, reference_id="pi_abc",
        )
        summary = middleware.get_spending_summary("agent-1")
        assert summary["daily_total_usd"] == pytest.approx(50.0)
        assert summary["daily_transactions"] == 1

    def test_after_create_failure_does_not_record_spending(self):
        middleware = GuardianClawStripeMiddleware()
        middleware.after_create_hook(
            _request(amount=5000), wallet_address="agent-1",
            success=False, error="card declined",
        )
        summary = middleware.get_spending_summary("agent-1")
        assert summary["daily_total_usd"] == 0.0

    def test_spending_remembers_customer(self):
        middleware = GuardianClawStripeMiddleware()
        middleware.after_create_hook(
            _request(amount=5000, customer="cus_AAAAAAAAAA"),
            wallet_address="agent-1",
            success=True,
        )
        result = middleware.validate_payment(
            _request(amount=500, description="Tiny known-customer follow-up payment", customer="cus_AAAAAAAAAA"),
            wallet_address="agent-1",
        )
        worth = result.gates[CLAWGate.WORTH]
        # Customer is now known → no "first payment" flag should appear.
        flags = (worth.details or {}).get("flags", [])
        assert not any("First payment" in f for f in flags)

    def test_dict_request_accepted(self):
        middleware = GuardianClawStripeMiddleware()
        result = middleware.validate_payment(
            {
                "intent_kind": StripeIntentKind.CHARGE_CREATE.value,
                "amount": 500,
                "currency": "usd",
                "customer": "cus_NksY4M0bM4FfXg",
                "description": "Tiny but well-described payment for test purposes",
                "api_key": "rk_test_abc",
            },
            wallet_address="agent-1",
        )
        assert result.is_approved is True

    def test_audit_log_populated(self):
        middleware = GuardianClawStripeMiddleware()
        middleware.validate_payment(_request(), wallet_address="agent-1")
        log = middleware.get_audit_log()
        assert len(log) == 1
        assert log[0].wallet_address == "agent-1"

    def test_confirmation_callback_can_approve(self):
        approvals = []
        middleware = GuardianClawStripeMiddleware(
            on_confirmation_required=lambda r: approvals.append(r) or True,
        )
        result = middleware.validate_payment(_request(), wallet_address="agent-1")
        assert result.decision == PaymentDecision.APPROVE
        assert len(approvals) == 1

    def test_confirmation_callback_can_reject(self):
        middleware = GuardianClawStripeMiddleware(
            on_confirmation_required=lambda r: False,
        )
        result = middleware.validate_payment(_request(), wallet_address="agent-1")
        assert result.decision == PaymentDecision.REJECT

    def test_create_stripe_middleware_factory(self):
        m = create_stripe_middleware("strict")
        assert m.config.validation.strict_mode is True


# ============================================================================
# Spending window roll-over
# ============================================================================


class TestSpendingWindow:
    def test_hourly_count_after_record(self):
        middleware = GuardianClawStripeMiddleware()
        for _ in range(3):
            middleware.after_create_hook(
                _request(amount=100), wallet_address="agent-1", success=True,
            )
        summary = middleware.get_spending_summary("agent-1")
        assert summary["hourly_transactions"] == 3

    def test_daily_total_remaining(self):
        middleware = GuardianClawStripeMiddleware()
        middleware.after_create_hook(
            _request(amount=5000), wallet_address="agent-1", success=True,
        )
        summary = middleware.get_spending_summary("agent-1")
        # Default daily cap is $500. Remaining = $450.
        assert summary["daily_remaining_usd"] == pytest.approx(450.0)


# ============================================================================
# Risk level edge cases for non-money intents
# ============================================================================


class TestNonMoneyIntents:
    def test_customer_create_is_safe(self):
        middleware = GuardianClawStripeMiddleware()
        result = middleware.validate_payment(
            _request(
                intent_kind=StripeIntentKind.CUSTOMER_CREATE,
                amount=None,
                currency=None,
                customer=None,
            ),
            wallet_address="agent-1",
        )
        assert result.risk_level == PaymentRiskLevel.SAFE
        assert result.decision == PaymentDecision.APPROVE

    def test_refund_create_is_not_money_moving(self):
        middleware = GuardianClawStripeMiddleware()
        result = middleware.validate_payment(
            _request(
                intent_kind=StripeIntentKind.REFUND_CREATE,
                amount=5000,
                currency="usd",
                customer=None,
                description="Refund for the failed API call from earlier today",
            ),
            wallet_address="agent-1",
        )
        # Refund doesn't trip the Limits gate (not money-moving FROM the wallet).
        assert result.decision == PaymentDecision.APPROVE
