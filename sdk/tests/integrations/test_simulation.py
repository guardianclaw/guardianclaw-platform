"""Comprehensive tests for the ClawPay pre-flight simulation layer.

Covers:
  - SimulationStatus severity properties
  - SimulationResult.to_audit_dict() shape + log truncation
  - InMemorySimulationProvider behavior
  - HeliusSimulationProvider with mocked httpx (happy, failed, ownership reassign,
    network mismatch, malformed payload)
  - TenderlySimulationProvider with mocked httpx (happy, reverted, balance
    discrepancy, unsupported chain)
  - SimulationGate fail-safe wrapping
  - CredibilityGate honors WOULD_FAIL via context
  - AvoidanceGate blocks on SUSPICIOUS_*, downgrades UNSUPPORTED/ERROR to risk_factor
  - CLAWPaymentValidator runs simulation pre-flight and injects context
  - Middleware end-to-end: blocked decision + audit record carries simulation
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from guardianclaw.integrations.coinbase.x402 import (
    AuditSink,
    BalanceChange,
    GuardianClawX402Config,
    GuardianClawX402Middleware,
    HeliusSimulationProvider,
    InMemoryAuditSink,
    InMemorySimulationProvider,
    OwnershipChange,
    PaymentRequirementsModel,
    SimulationGate,
    SimulationResult,
    SimulationStatus,
    TenderlySimulationProvider,
)
from guardianclaw.integrations.coinbase.x402.validators import (
    AvoidanceGateValidator,
    CLAWPaymentValidator,
    CredibilityGateValidator,
    CLAWGate,
)


def _payment(
    *,
    network: str = "base",
    pay_to: str = "0x1234567890abcdef1234567890abcdef12345678",
    amount_atomic: str = "1000000",
    extra: dict | None = None,
) -> PaymentRequirementsModel:
    return PaymentRequirementsModel(
        scheme="exact",
        network=network,
        max_amount_required=amount_atomic,
        resource="https://api.example.com/paid",
        pay_to=pay_to,
        max_timeout_seconds=60,
        asset="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        extra=extra,
    )


# ============================================================================
# SimulationStatus
# ============================================================================


class TestSimulationStatus:
    def test_is_block_worthy(self):
        assert SimulationStatus.SUSPICIOUS_BALANCE_CHANGE.is_block_worthy
        assert SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE.is_block_worthy
        assert not SimulationStatus.WOULD_FAIL.is_block_worthy
        assert not SimulationStatus.OK.is_block_worthy
        assert not SimulationStatus.ERROR.is_block_worthy

    def test_is_reject_worthy(self):
        assert SimulationStatus.WOULD_FAIL.is_reject_worthy
        assert not SimulationStatus.OK.is_reject_worthy
        assert not SimulationStatus.SUSPICIOUS_BALANCE_CHANGE.is_reject_worthy


# ============================================================================
# SimulationResult
# ============================================================================


class TestSimulationResult:
    def test_unsupported_factory(self):
        r = SimulationResult.unsupported("test", "no api key")
        assert r.status == SimulationStatus.UNSUPPORTED
        assert r.provider == "test"
        assert r.message == "no api key"

    def test_error_factory_captures_exception(self):
        try:
            raise RuntimeError("boom")
        except RuntimeError as exc:
            r = SimulationResult.error("test", "rpc died", exc)
        assert r.status == SimulationStatus.ERROR
        assert r.raw_error == "boom"

    def test_to_audit_dict_truncates_logs(self):
        long_logs = [f"log line {i}" for i in range(50)]
        r = SimulationResult(
            status=SimulationStatus.OK,
            provider="test",
            logs_excerpt=long_logs,
        )
        audit = r.to_audit_dict()
        assert len(audit["logs_excerpt"]) == 20

    def test_to_audit_dict_truncates_balance_changes(self):
        many = [
            BalanceChange(address=f"addr{i}", delta_usd=1.0)
            for i in range(50)
        ]
        r = SimulationResult(
            status=SimulationStatus.OK,
            provider="test",
            balance_changes=many,
        )
        audit = r.to_audit_dict()
        assert len(audit["balance_changes"]) == 20

    def test_to_audit_dict_renders_ownership_changes(self):
        oc = OwnershipChange(account="acct", old_owner="sys", new_owner="attacker")
        r = SimulationResult(
            status=SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE,
            provider="test",
            ownership_changes=[oc],
        )
        audit = r.to_audit_dict()
        assert audit["ownership_changes"][0]["new_owner"] == "attacker"


# ============================================================================
# InMemorySimulationProvider
# ============================================================================


class TestInMemorySimulationProvider:
    def test_default_returns_ok(self):
        p = InMemorySimulationProvider()
        result = p.simulate(_payment(), "https://x", "wallet")
        assert result.status == SimulationStatus.OK

    def test_custom_default(self):
        p = InMemorySimulationProvider(
            default=SimulationResult(status=SimulationStatus.WOULD_FAIL, provider="test"),
        )
        result = p.simulate(_payment(), "https://x", "wallet")
        assert result.status == SimulationStatus.WOULD_FAIL

    def test_responder_callable(self):
        def responder(req, ep, wallet):
            return SimulationResult(
                status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
                provider="test",
                message=f"saw wallet {wallet}",
            )
        p = InMemorySimulationProvider(responder=responder)
        result = p.simulate(_payment(), "https://x", "walletXYZ")
        assert result.status == SimulationStatus.SUSPICIOUS_BALANCE_CHANGE
        assert "walletXYZ" in result.message

    def test_responder_exception_converted_to_error(self):
        def boom(req, ep, wallet):
            raise RuntimeError("bug")
        p = InMemorySimulationProvider(responder=boom)
        result = p.simulate(_payment(), "https://x", "wallet")
        assert result.status == SimulationStatus.ERROR


# ============================================================================
# HeliusSimulationProvider (mocked httpx)
# ============================================================================


class TestHeliusSimulationProvider:
    def _provider(self) -> HeliusSimulationProvider:
        return HeliusSimulationProvider(
            rpc_url="https://mainnet.helius-rpc.com/?api-key=xxx",
        )

    def test_unsupported_for_evm_network(self):
        result = self._provider().simulate(
            _payment(network="base"), "https://x", "wallet",
        )
        assert result.status == SimulationStatus.UNSUPPORTED

    def test_unsupported_when_no_signed_tx(self):
        # Solana network but no signed_tx in extra → can't simulate.
        result = self._provider().simulate(
            _payment(network="solana-mainnet"),
            "https://x",
            "wallet",
        )
        assert result.status == SimulationStatus.UNSUPPORTED

    def test_happy_simulation(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})

        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "result": {
                "value": {
                    "err": None,
                    "logs": ["Program log: OK"],
                    "accounts": [
                        {"owner": "11111111111111111111111111111111", "lamports": "1000000000"},
                    ],
                }
            }
        }
        with patch("httpx.post", return_value=fake_resp) as mock_post:
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.OK
        # Outbound JSON-RPC payload includes the watched wallet.
        body = mock_post.call_args.kwargs["json"]
        assert body["method"] == "simulateTransaction"
        assert body["params"][0] == "base64encoded"
        assert body["params"][1]["accounts"]["addresses"][0] == "wallet"

    def test_would_fail_on_simulation_err(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "result": {
                "value": {
                    "err": {"InsufficientFundsForFee": {}},
                    "logs": [],
                    "accounts": [],
                }
            }
        }
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.WOULD_FAIL
        assert result.raw_error is not None

    def test_ownership_reassignment_detected_in_accounts(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "result": {
                "value": {
                    "err": None,
                    "logs": [],
                    "accounts": [
                        # Owner is no longer System Program after execution.
                        {"owner": "AttackerProgram11111111111111111111111111", "lamports": "0"},
                    ],
                }
            }
        }
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE
        assert len(result.ownership_changes) >= 1

    def test_ownership_reassignment_detected_in_logs(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "result": {
                "value": {
                    "err": None,
                    "logs": [
                        "Program log: Assign instruction: account=wallet new_owner=Atk1",
                    ],
                    "accounts": [
                        {"owner": "11111111111111111111111111111111", "lamports": "0"},
                    ],
                }
            }
        }
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE

    def test_rpc_error_yields_error_status(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})

        import httpx
        with patch(
            "httpx.post",
            side_effect=httpx.RequestError("connection refused", request=MagicMock()),
        ):
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.ERROR

    def test_jsonrpc_error_envelope(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"error": {"code": -32600, "message": "Invalid Request"}}
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.ERROR

    def test_malformed_response_yields_error(self):
        provider = self._provider()
        payment = _payment(network="solana-mainnet", extra={"signed_tx": "base64encoded"})
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.side_effect = ValueError("not json")
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(payment, "https://x", "wallet")
        assert result.status == SimulationStatus.ERROR


# ============================================================================
# TenderlySimulationProvider (mocked httpx)
# ============================================================================


class TestTenderlySimulationProvider:
    def _provider(self) -> TenderlySimulationProvider:
        return TenderlySimulationProvider(
            account_slug="acct",
            project_slug="proj",
            access_key="key",
            balance_tolerance=1.05,
        )

    def test_unsupported_for_solana(self):
        result = self._provider().simulate(
            _payment(network="solana-mainnet"), "https://x", "wallet",
        )
        assert result.status == SimulationStatus.UNSUPPORTED

    def test_unsupported_for_unknown_chain(self):
        result = self._provider().simulate(
            _payment(network="weird-network"), "https://x", "wallet",
        )
        assert result.status == SimulationStatus.UNSUPPORTED

    def test_happy_simulation_under_tolerance(self):
        provider = self._provider()
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "transaction": {
                "status": True,
                "transaction_info": {
                    "asset_changes": [
                        {
                            "from": "0x" + "a" * 40,
                            "to": "0x" + "b" * 40,
                            "amount": "1000000",
                            "dollar_value": "1.00",
                            "token_info": {"symbol": "USDC"},
                        },
                    ],
                    "balance_changes": [],
                },
            },
        }
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(
                _payment(amount_atomic="1000000"), "https://x", "0x" + "a" * 40,
            )
        assert result.status == SimulationStatus.OK
        assert len(result.balance_changes) >= 1

    def test_balance_discrepancy_blocks(self):
        provider = self._provider()
        # Advertised: $1 outflow. Simulation: $10 outflow → 10x tolerance.
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "transaction": {
                "status": True,
                "transaction_info": {
                    "asset_changes": [
                        {
                            "from": "0x" + "a" * 40,
                            "to": "0x" + "c" * 40,
                            "amount": "10000000",
                            "dollar_value": "10.00",
                            "token_info": {"symbol": "USDC"},
                        },
                    ],
                    "balance_changes": [],
                },
            },
        }
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(
                _payment(amount_atomic="1000000"), "https://x", "0x" + "a" * 40,
            )
        assert result.status == SimulationStatus.SUSPICIOUS_BALANCE_CHANGE
        assert "exceeds advertised payment" in result.message

    def test_reverted_yields_would_fail(self):
        provider = self._provider()
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {
            "transaction": {
                "status": False,
                "transaction_info": {"error_message": "execution reverted: ERC20: insufficient"},
            },
        }
        with patch("httpx.post", return_value=fake_resp):
            result = provider.simulate(_payment(), "https://x", "0x" + "a" * 40)
        assert result.status == SimulationStatus.WOULD_FAIL
        assert "insufficient" in (result.raw_error or "")

    def test_network_failure_yields_error(self):
        provider = self._provider()
        import httpx
        with patch(
            "httpx.post",
            side_effect=httpx.RequestError("timeout", request=MagicMock()),
        ):
            result = provider.simulate(_payment(), "https://x", "0x" + "a" * 40)
        assert result.status == SimulationStatus.ERROR

    def test_request_body_carries_chain_id(self):
        provider = self._provider()
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"transaction": {"status": True, "transaction_info": {}}}
        with patch("httpx.post", return_value=fake_resp) as mock_post:
            provider.simulate(
                _payment(network="base", extra={"input": "0xabcd", "value": "0x1"}),
                "https://x",
                "0x" + "a" * 40,
            )
        body = mock_post.call_args.kwargs["json"]
        assert body["network_id"] == "8453"
        assert body["input"] == "0xabcd"


# ============================================================================
# SimulationGate
# ============================================================================


class TestSimulationGate:
    def test_run_passes_through_provider(self):
        gate = SimulationGate(InMemorySimulationProvider())
        result = gate.run(_payment(), "https://x", "wallet")
        assert result.status == SimulationStatus.OK

    def test_provider_raises_returns_error_result(self):
        bad = MagicMock()
        bad.name = "bad"
        bad.simulate.side_effect = RuntimeError("boom")
        gate = SimulationGate(bad)
        result = gate.run(_payment(), "https://x", "wallet")
        assert result.status == SimulationStatus.ERROR


# ============================================================================
# CredibilityGate + AvoidanceGate consume simulation_result
# ============================================================================


class TestCredibilityGateSimulation:
    def test_would_fail_appends_to_issues(self):
        gate = CredibilityGateValidator()
        ctx = {
            "simulation_result": SimulationResult(
                status=SimulationStatus.WOULD_FAIL,
                provider="helius",
                message="InsufficientFundsForFee",
            ),
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is False
        assert "InsufficientFundsForFee" in (result.reason or "")

    def test_ok_simulation_does_not_block_credibility(self):
        gate = CredibilityGateValidator()
        ctx = {
            "simulation_result": SimulationResult(status=SimulationStatus.OK, provider="helius"),
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is True


class TestAvoidanceGateSimulation:
    def test_suspicious_balance_blocks(self):
        gate = AvoidanceGateValidator()
        ctx = {
            "simulation_result": SimulationResult(
                status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
                provider="tenderly",
                message="Simulated outflow $100 exceeds advertised $1",
            ),
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is False
        assert "$100" in (result.reason or "")
        assert "simulation" in (result.details or {})

    def test_suspicious_ownership_blocks(self):
        gate = AvoidanceGateValidator()
        ctx = {
            "simulation_result": SimulationResult(
                status=SimulationStatus.SUSPICIOUS_OWNERSHIP_CHANGE,
                provider="helius",
                message="Ownership reassigned",
            ),
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is False

    def test_unsupported_becomes_risk_factor_not_block(self):
        gate = AvoidanceGateValidator()
        ctx = {
            "simulation_result": SimulationResult(
                status=SimulationStatus.UNSUPPORTED,
                provider="helius",
                message="no signed_tx",
            ),
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is True
        risk_factors = (result.details or {}).get("risk_factors", [])
        assert any("unsupported" in rf.lower() for rf in risk_factors)

    def test_error_becomes_risk_factor_not_block(self):
        gate = AvoidanceGateValidator()
        ctx = {
            "simulation_result": SimulationResult(
                status=SimulationStatus.ERROR,
                provider="helius",
                message="rpc down",
            ),
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is True

    def test_simulation_result_as_dict_also_works(self):
        # Middleware sometimes passes a SimulationResult; sometimes the
        # context already carries the serialized to_audit_dict() output.
        # Both must produce the same Avoidance outcome.
        gate = AvoidanceGateValidator()
        ctx = {
            "simulation_result": {
                "status": "suspicious_balance_change",
                "provider": "tenderly",
                "message": "outflow > advertised",
            },
        }
        result = gate.validate(
            _payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
            context=ctx,
        )
        assert result.passed is False
        assert "outflow > advertised" in (result.reason or "")


# ============================================================================
# CLAWPaymentValidator runs simulation pre-flight
# ============================================================================


class TestValidatorPreflight:
    def test_simulation_gate_runs_before_other_gates(self):
        sim = InMemorySimulationProvider(default=SimulationResult(
            status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
            provider="test",
            message="bait and switch",
        ))
        validator = CLAWPaymentValidator(simulation_gate=SimulationGate(sim))
        results = validator.validate_payment(
            payment_requirements=_payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
        )
        # Avoidance got the simulation signal and rejected.
        assert results[CLAWGate.AVOIDANCE].passed is False

    def test_no_simulation_gate_keeps_old_behavior(self):
        validator = CLAWPaymentValidator()  # no simulation
        results = validator.validate_payment(
            payment_requirements=_payment(),
            endpoint="https://api.example.com/paid",
            wallet_address="wallet",
            config=GuardianClawX402Config(),
        )
        # Avoidance still runs and passes — no simulation injection.
        assert results[CLAWGate.AVOIDANCE].passed is True


# ============================================================================
# Middleware end-to-end
# ============================================================================


class TestMiddlewareSimulation:
    def test_middleware_blocks_on_suspicious_balance(self):
        sim = InMemorySimulationProvider(default=SimulationResult(
            status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
            provider="test",
            message="outflow $100 > advertised $1",
        ))
        mw = GuardianClawX402Middleware(simulation_provider=sim)
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        assert result.decision.value == "block"
        assert result.blocked_reason and "outflow" in result.blocked_reason

    def test_middleware_escalates_would_fail_to_confirmation(self):
        # WOULD_FAIL produces a Credibility issue → HIGH risk. The x402
        # middleware's `_determine_decision` maps HIGH (without an explicit
        # confirmation callback) to REQUIRE_CONFIRMATION when the amount is
        # below the threshold, which is what we want: the agent should
        # rebuild the request, not retry blindly.
        sim = InMemorySimulationProvider(default=SimulationResult(
            status=SimulationStatus.WOULD_FAIL,
            provider="test",
            message="InsufficientFundsForFee",
        ))
        mw = GuardianClawX402Middleware(simulation_provider=sim)
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        assert result.decision.value == "require_confirmation"
        # The credibility issue carrying the simulation message is in the
        # collected issues list.
        assert any("InsufficientFundsForFee" in issue for issue in result.issues)

    def test_middleware_passes_when_simulation_ok(self):
        sim = InMemorySimulationProvider()  # default OK
        mw = GuardianClawX402Middleware(simulation_provider=sim)
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        # No issues from any gate.
        assert result.decision.value in ("approve", "require_confirmation")

    def test_middleware_no_provider_is_identical_to_before_sprint_4(self):
        # Backwards compat: omitting simulation_provider keeps the prior
        # behavior — no Avoidance simulation block, no audit-record
        # simulation field.
        mw = GuardianClawX402Middleware()
        sink = InMemoryAuditSink()
        mw.audit_sink = sink
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        assert result.decision.value != "block"
        assert len(sink.records) == 1
        assert sink.records[0].simulation is None

    def test_audit_record_carries_simulation_payload(self):
        sim = InMemorySimulationProvider(default=SimulationResult(
            status=SimulationStatus.OK,
            provider="helius-mock",
            balance_changes=[BalanceChange(address="wallet", delta_usd=-1.0, asset="USDC")],
        ))
        sink = InMemoryAuditSink()
        mw = GuardianClawX402Middleware(simulation_provider=sim, audit_sink=sink)
        mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        assert len(sink.records) == 1
        sim_field = sink.records[0].simulation
        assert sim_field is not None
        assert sim_field["status"] == "ok"
        assert sim_field["provider"] == "helius-mock"
        assert len(sim_field["balance_changes"]) == 1

    def test_audit_record_supabase_row_includes_simulation(self):
        sim = InMemorySimulationProvider(default=SimulationResult(
            status=SimulationStatus.SUSPICIOUS_BALANCE_CHANGE,
            provider="tenderly-mock",
        ))
        sink = InMemoryAuditSink()
        mw = GuardianClawX402Middleware(simulation_provider=sim, audit_sink=sink)
        mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        row = sink.records[0].to_supabase_row()
        assert "simulation" in row
        assert row["simulation"]["status"] == "suspicious_balance_change"

    def test_middleware_fails_safe_when_provider_raises(self):
        bad = MagicMock()
        bad.name = "bad"
        bad.simulate.side_effect = RuntimeError("rpc panic")
        mw = GuardianClawX402Middleware(simulation_provider=bad)
        # Should not raise; should not block on a clean payment.
        result = mw.validate_payment(
            endpoint="https://api.example.com/paid",
            payment_requirements=_payment(),
            wallet_address="wallet",
        )
        assert result.decision.value != "block"
