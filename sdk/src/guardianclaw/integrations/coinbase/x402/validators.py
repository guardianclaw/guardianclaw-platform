"""CLAW validators for x402 payment validation.

This module implements the four CLAW gates (Credibility, Limits, Avoidance, Worth)
specifically adapted for x402 payment validation.

Each gate evaluates a different aspect of payment safety:
    - CREDIBILITY: Is the payment request legitimate and well-formed?
    - AVOIDANCE: Could this payment cause harm (malicious recipient, etc.)?
    - LIMITS: Is this payment within acceptable limits?
    - WORTH: Does this payment serve a legitimate purpose?
"""

from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from typing import Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger("guardianclaw.integrations.coinbase.x402.validators")


def _simulation_status_from_context(
    context: dict[str, Any] | None,
) -> Optional[SimulationStatus]:
    """Extract the SimulationStatus from a validator context, if present.

    Tolerates both raw ``SimulationStatus`` values and the serialized
    ``{status: '...'}`` dict shape (so the middleware can stuff the
    audit-ready ``to_audit_dict()`` output in there without losing the
    enum on the way out).
    """
    if not context:
        return None
    raw = context.get("simulation_result")
    if isinstance(raw, SimulationResult):
        return raw.status
    if isinstance(raw, dict):
        status_value = raw.get("status")
        if isinstance(status_value, SimulationStatus):
            return status_value
        if isinstance(status_value, str):
            try:
                return SimulationStatus(status_value)
            except ValueError:
                return None
    return None

from .config import (
    KNOWN_USDC_CONTRACTS,
    KNOWN_USDT_CONTRACTS,
    SUSPICIOUS_URL_PATTERNS,
    GuardianClawX402Config,
)
from .drainer_db import DrainerKind, DrainerLookup, DrainerMatch
from .simulation import SimulationGate, SimulationResult, SimulationStatus
from .types import (
    PaymentRequirementsModel,
    PaymentRiskLevel,
    SpendingRecord,
    SupportedNetwork,
    CLAWGate,
    CLAWGateResult,
)


class PaymentValidator(ABC):
    """Abstract base class for payment validators."""

    @property
    @abstractmethod
    def gate(self) -> CLAWGate:
        """Return the CLAW gate this validator implements."""
        ...

    @abstractmethod
    def validate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
        config: GuardianClawX402Config,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        """Validate a payment against this gate.

        Args:
            payment_requirements: The x402 payment requirements
            endpoint: The endpoint URL requesting payment
            wallet_address: The wallet address making the payment
            config: GuardianClaw x402 configuration
            context: Additional context (spending records, history, etc.)

        Returns:
            CLAWGateResult with pass/fail and reasoning
        """
        ...


class CredibilityGateValidator(PaymentValidator):
    """CREDIBILITY gate: Validates payment request legitimacy and correctness.

    Checks:
        - Payment requirements are well-formed
        - Endpoint URL is valid and uses HTTPS
        - Network is supported
        - Asset contract is verified
        - Amount is valid (non-negative, parseable)
    """

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.CREDIBILITY

    def validate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
        config: GuardianClawX402Config,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        """Validate truthfulness of payment request."""
        issues: list[str] = []

        # Check endpoint URL validity
        try:
            parsed = urlparse(endpoint)
            if not parsed.scheme or not parsed.netloc:
                issues.append("Invalid endpoint URL format")
            elif config.validation.require_https and parsed.scheme != "https":
                issues.append(f"Endpoint uses {parsed.scheme} instead of HTTPS")
        except (ValueError, AttributeError) as e:
            logger.debug(f"Failed to parse endpoint URL: {e}")
            issues.append("Failed to parse endpoint URL")

        # Check network is supported
        try:
            network = SupportedNetwork(payment_requirements.network)
            if network not in config.allowed_networks:
                issues.append(f"Network {network.value} is not in allowed networks")
        except ValueError:
            issues.append(f"Unknown network: {payment_requirements.network}")

        # Verify asset contract address
        if config.validation.verify_contract_addresses:
            asset_addr = payment_requirements.asset.lower()
            network_str = payment_requirements.network

            try:
                network = SupportedNetwork(network_str)
                known_usdc = KNOWN_USDC_CONTRACTS.get(network, "").lower()
                known_usdt = KNOWN_USDT_CONTRACTS.get(network, "").lower()

                if asset_addr and asset_addr not in [known_usdc, known_usdt, ""]:
                    # Unknown asset contract - flag but don't fail
                    issues.append(f"Unverified asset contract: {asset_addr[:10]}...")
            except ValueError:
                pass  # Already flagged above

        # Validate amount
        try:
            amount = payment_requirements.get_amount_float()
            if amount < 0:
                issues.append("Payment amount is negative")
            elif amount == 0:
                issues.append("Payment amount is zero")
        except (ValueError, TypeError, AttributeError) as e:
            logger.debug(f"Failed to parse payment amount: {e}")
            issues.append("Failed to parse payment amount")

        # Check pay_to address format
        pay_to = payment_requirements.pay_to
        if not pay_to:
            issues.append("Missing payment recipient address")
        elif not self._is_valid_address(pay_to):
            issues.append("Invalid recipient address format")

        # Pre-flight simulation signal — when the SimulationGate reports the
        # transaction would revert onchain, surface it here. WOULD_FAIL is a
        # Credibility issue (the request is structurally wrong / out of
        # date), not an Avoidance issue (something malicious is happening).
        sim_status = _simulation_status_from_context(context)
        if sim_status == SimulationStatus.WOULD_FAIL:
            sim_payload = (context or {}).get("simulation_result")
            sim_msg: Optional[str] = None
            if isinstance(sim_payload, SimulationResult):
                sim_msg = sim_payload.message
            elif isinstance(sim_payload, dict):
                maybe_msg = sim_payload.get("message")
                if isinstance(maybe_msg, str):
                    sim_msg = maybe_msg
            issues.append(
                f"Simulation: {sim_msg or 'Pre-flight simulation reports the transaction would fail onchain'}"
            )

        passed = len(issues) == 0
        reason = None if passed else "; ".join(issues)

        return CLAWGateResult(
            gate=CLAWGate.CREDIBILITY,
            passed=passed,
            reason=reason,
            details={"issues": issues} if issues else None,
        )

    def _is_valid_address(self, address: str) -> bool:
        """Check if address is a valid Ethereum address format."""
        if not address:
            return False
        # Basic Ethereum address validation
        return bool(re.match(r"^0x[a-fA-F0-9]{40}$", address))


class AvoidanceGateValidator(PaymentValidator):
    """AVOIDANCE gate: Validates payment won't cause harm.

    Checks:
        - Recipient is not on blocklist (static config + drainer_intel feed)
        - Endpoint is not malicious (static config + drainer_intel feed)
        - No suspicious patterns in URL (static config + drainer_intel patterns)
        - Contract is not flagged as malicious

    The drainer_intel layer (Sprint 1, ClawPay) adds a deterministic feed-backed
    lookup that complements the static config blocklists. The lookup is fail-safe:
    if it errors or returns None, validation falls through to the static rules.
    Auditing intentionally records the matched intel entry (source, source_ref,
    severity) so a blocked payment can be explained without re-running a model.
    """

    def __init__(self, drainer_lookup: Optional[DrainerLookup] = None) -> None:
        """Initialize.

        Args:
            drainer_lookup: Optional drainer-intel lookup. When provided,
                AvoidanceGate consults it for recipient address, endpoint host,
                and pattern matches. When None, only static config rules apply.
        """
        self.drainer_lookup = drainer_lookup

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.AVOIDANCE

    def validate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
        config: GuardianClawX402Config,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        """Validate payment won't cause harm."""
        issues: list[str] = []
        risk_factors: list[str] = []
        drainer_hits: list[dict[str, Any]] = []

        # Check recipient against blocklist
        pay_to = payment_requirements.pay_to
        if pay_to is None:
            issues.append("Missing recipient address")
            return CLAWGateResult(
                gate=CLAWGate.AVOIDANCE,
                passed=False,
                reason="Missing recipient address",
                details={"issues": issues},
            )
        pay_to = pay_to.lower()
        blocked_addresses = [addr.lower() for addr in config.blocked_addresses]

        if pay_to in blocked_addresses:
            issues.append(f"Recipient address is blocked: {pay_to[:10]}...")

        # Check endpoint against blocklist
        for blocked in config.blocked_endpoints:
            if blocked.lower() in endpoint.lower():
                issues.append(f"Endpoint matches blocklist pattern: {blocked}")

        # Check for suspicious URL patterns
        for pattern in SUSPICIOUS_URL_PATTERNS:
            if re.search(pattern, endpoint, re.IGNORECASE):
                risk_factors.append(f"URL matches suspicious pattern")
                break

        # Check if endpoint uses IP address directly
        try:
            parsed = urlparse(endpoint)
            netloc = parsed.netloc.split(":")[0]  # Remove port
            if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", netloc):
                risk_factors.append("Endpoint uses direct IP address instead of domain")
        except (ValueError, AttributeError) as e:
            logger.debug(f"Failed to check IP address in endpoint: {e}")
            parsed = None

        # If context includes known malicious data, check it
        if context:
            known_scams = context.get("known_scam_addresses", [])
            if pay_to in [addr.lower() for addr in known_scams]:
                issues.append("Recipient identified as known scam address")

        # Drainer-intel layer (ClawPay Sprint 1).
        # Failure modes here are explicitly absorbed: any unexpected exception
        # from the lookup is logged downstream by DrainerLookup itself and
        # treated as a miss. We never escalate a lookup error into a block.
        if self.drainer_lookup is not None:
            network = payment_requirements.network
            try:
                # 1) Recipient address against drainer_intel.
                addr_match = self.drainer_lookup.consult(
                    DrainerKind.ADDRESS, pay_to, network=network,
                )
                if addr_match is not None:
                    self._record_drainer_hit(addr_match, issues, drainer_hits,
                                             scope="recipient")

                # 2) Endpoint hostname (case-insensitive) against drainer_intel.
                if parsed is not None and parsed.netloc:
                    host = parsed.netloc.split(":")[0].lower()
                    host_match = self.drainer_lookup.consult(
                        DrainerKind.ENDPOINT, host, network=network,
                    )
                    if host_match is not None:
                        self._record_drainer_hit(host_match, issues, drainer_hits,
                                                 scope="endpoint")

                # 3) Endpoint pattern scan (e.g. wildcard phishing families).
                pattern_match = self.drainer_lookup.match_endpoint_patterns(
                    endpoint, network=network,
                )
                if pattern_match is not None:
                    # Patterns are downgraded to risk_factors at low/medium
                    # severity to allow operator review; high/critical block.
                    if pattern_match.severity in ("high", "critical"):
                        self._record_drainer_hit(pattern_match, issues,
                                                 drainer_hits, scope="endpoint_pattern")
                    else:
                        risk_factors.append(
                            f"Endpoint matches drainer pattern "
                            f"(severity={pattern_match.severity}, "
                            f"source={pattern_match.source})"
                        )
                        drainer_hits.append(pattern_match.to_audit_dict() | {
                            "scope": "endpoint_pattern",
                        })
            except Exception as exc:  # pragma: no cover — fail-safe
                logger.warning("Drainer lookup raised unexpectedly: %s", exc)

        # Pre-flight simulation signal (ClawPay Sprint 4). Suspicious
        # outcomes (balance discrepancy, ownership reassignment) escalate
        # to a block; UNSUPPORTED / ERROR surface only as risk_factors so
        # a misbehaving simulator never panic-blocks legitimate traffic.
        sim_status = _simulation_status_from_context(context)
        sim_payload: dict[str, Any] | None = None
        if sim_status is not None:
            raw_sim = (context or {}).get("simulation_result")
            if isinstance(raw_sim, SimulationResult):
                sim_payload = raw_sim.to_audit_dict()
            elif isinstance(raw_sim, dict):
                sim_payload = raw_sim

            if sim_status.is_block_worthy:
                sim_msg = (
                    (sim_payload or {}).get("message")
                    or f"Pre-flight simulation status: {sim_status.value}"
                )
                issues.append(f"Simulation: {sim_msg}")
            elif sim_status in (SimulationStatus.UNSUPPORTED, SimulationStatus.ERROR):
                risk_factors.append(
                    f"Pre-flight simulation could not complete "
                    f"(status={sim_status.value}, provider="
                    f"{(sim_payload or {}).get('provider', 'unknown')})"
                )

        passed = len(issues) == 0
        reason = None if passed else "; ".join(issues)

        details: dict[str, Any] = {}
        if issues:
            details["issues"] = issues
        if risk_factors:
            details["risk_factors"] = risk_factors
        if drainer_hits:
            details["drainer_intel"] = drainer_hits
        if sim_payload is not None:
            details["simulation"] = sim_payload

        return CLAWGateResult(
            gate=CLAWGate.AVOIDANCE,
            passed=passed,
            reason=reason,
            details=details or None,
        )

    def _record_drainer_hit(
        self,
        match: "DrainerMatch",
        issues: list[str],
        drainer_hits: list[dict[str, Any]],
        *,
        scope: str,
    ) -> None:
        """Append a drainer-intel hit to issues + audit list."""
        issues.append(
            f"{scope.replace('_', ' ').capitalize()} matched drainer_intel "
            f"(severity={match.severity}, source={match.source})"
        )
        drainer_hits.append(match.to_audit_dict() | {"scope": scope})


class LimitsGateValidator(PaymentValidator):
    """LIMITS gate: Validates payment is within acceptable limits.

    Checks:
        - Amount within single payment limit
        - Amount within daily/weekly/monthly limits
        - Transaction count within rate limits
        - Not exceeding spending velocity limits
    """

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.LIMITS

    def validate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
        config: GuardianClawX402Config,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        """Validate payment is within limits limits."""
        issues: list[str] = []
        warnings: list[str] = []

        if not config.validation.enable_spending_limits:
            return CLAWGateResult(
                gate=CLAWGate.LIMITS,
                passed=True,
                reason=None,
                details={"note": "Spending limits disabled"},
            )

        amount = payment_requirements.get_amount_float()
        limits = config.spending_limits

        # Check single payment limit
        if amount > limits.max_single_payment:
            issues.append(
                f"Amount ${amount:.2f} exceeds single payment limit ${limits.max_single_payment:.2f}"
            )

        # Check spending records from context
        if context and config.validation.enable_spending_limits:
            daily_record: SpendingRecord | None = context.get("daily_spending")
            hourly_count: int = context.get("hourly_transaction_count", 0)

            if daily_record:
                # Check daily total
                projected_daily = daily_record.total_spent + amount
                if projected_daily > limits.max_daily_total:
                    issues.append(
                        f"Payment would exceed daily limit: "
                        f"${projected_daily:.2f} > ${limits.max_daily_total:.2f}"
                    )

                # Check daily transaction count
                if daily_record.transaction_count >= limits.max_transactions_per_day:
                    issues.append(
                        f"Daily transaction limit reached: {daily_record.transaction_count}"
                    )
                elif daily_record.transaction_count >= limits.max_transactions_per_day * 0.8:
                    warnings.append("Approaching daily transaction limit")

            # Check hourly rate limit
            if config.validation.enable_rate_limiting:
                if hourly_count >= limits.max_transactions_per_hour:
                    issues.append(
                        f"Hourly rate limit exceeded: {hourly_count} transactions"
                    )
                elif hourly_count >= limits.max_transactions_per_hour * 0.8:
                    warnings.append("Approaching hourly rate limit")

        passed = len(issues) == 0
        reason = None if passed else "; ".join(issues)

        return CLAWGateResult(
            gate=CLAWGate.LIMITS,
            passed=passed,
            reason=reason,
            details={
                "amount": amount,
                "issues": issues,
                "warnings": warnings,
                "limits": {
                    "max_single": limits.max_single_payment,
                    "max_daily": limits.max_daily_total,
                },
            },
        )


class WorthGateValidator(PaymentValidator):
    """WORTH gate: Validates payment serves legitimate purpose.

    Checks:
        - Endpoint has been seen before (trust)
        - Recipient has received payments before (familiarity)
        - Payment description makes sense
        - Resource being purchased is appropriate
    """

    @property
    def gate(self) -> CLAWGate:
        return CLAWGate.WORTH

    def validate(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
        config: GuardianClawX402Config,
        context: dict[str, Any] | None = None,
    ) -> CLAWGateResult:
        """Validate payment serves legitimate purpose."""
        concerns: list[str] = []
        flags: list[str] = []

        # Check if endpoint is known/trusted
        is_known_endpoint = False
        if context:
            endpoint_history = context.get("endpoint_history", {})
            is_known_endpoint = endpoint in endpoint_history
            if not is_known_endpoint and not config.validation.allow_unknown_endpoints:
                concerns.append("Payment to unknown/unverified endpoint")

            # Check if recipient is familiar
            recipient_history = context.get("recipient_history", {})
            pay_to_raw = payment_requirements.pay_to
            if pay_to_raw is None:
                concerns.append("Missing recipient address")
                pay_to = ""
            else:
                pay_to = pay_to_raw.lower()
            is_known_recipient = pay_to in recipient_history if pay_to else False

            if not is_known_recipient and not config.validation.allow_unknown_recipients:
                concerns.append("Payment to unknown recipient address")
            elif not is_known_recipient:
                flags.append("First payment to this recipient")

        # Check payment description for red flags
        description_raw = payment_requirements.description
        description = description_raw.lower() if description_raw else ""
        suspicious_terms = [
            "urgent", "immediate", "secret", "private key",
            "password", "seed phrase", "recovery",
        ]
        for term in suspicious_terms:
            if term in description:
                concerns.append(f"Suspicious term in description: '{term}'")

        # Check resource makes sense
        resource = payment_requirements.resource
        if not resource:
            flags.append("No resource specified for payment")

        # In strict mode, any flags become concerns
        if config.validation.strict_mode:
            concerns.extend(flags)
            flags = []

        passed = len(concerns) == 0
        reason = None if passed else "; ".join(concerns)

        return CLAWGateResult(
            gate=CLAWGate.WORTH,
            passed=passed,
            reason=reason,
            details={
                "concerns": concerns,
                "flags": flags,
                "is_known_endpoint": is_known_endpoint if context else None,
            },
        )


class CLAWPaymentValidator:
    """Main validator orchestrating all CLAW gates for payment validation.

    This class combines all four gates and provides the main validation
    entry point for the x402 middleware.

    Example:
        >>> validator = CLAWPaymentValidator()
        >>> result = validator.validate_payment(
        ...     payment_requirements=payment_req,
        ...     endpoint="https://api.example.com/data",
        ...     wallet_address="0x123...",
        ...     config=config,
        ... )
        >>> if result.all_gates_passed:
        ...     print("Payment approved")
    """

    def __init__(
        self,
        drainer_lookup: Optional[DrainerLookup] = None,
        *,
        simulation_gate: Optional[SimulationGate] = None,
    ) -> None:
        """Initialize with all CLAW gate validators.

        Args:
            drainer_lookup: Optional deterministic drainer-intel lookup
                (ClawPay Sprint 1). Passed to AvoidanceGateValidator so payment
                blocking can cite a specific feed entry. When None, only static
                config rules apply.
            simulation_gate: Optional pre-flight simulation orchestrator
                (ClawPay Sprint 4). When provided, it runs BEFORE the four
                CLAW gates and the resulting ``SimulationResult`` is injected
                into the ``context`` under the ``simulation_result`` key.
                CredibilityGate treats WOULD_FAIL as a request-shape issue;
                AvoidanceGate treats SUSPICIOUS_* as a hard block. When None,
                no simulation is attempted.
        """
        self.simulation_gate = simulation_gate
        self._validators: list[PaymentValidator] = [
            CredibilityGateValidator(),
            AvoidanceGateValidator(drainer_lookup=drainer_lookup),
            LimitsGateValidator(),
            WorthGateValidator(),
        ]

    def validate_payment(
        self,
        payment_requirements: PaymentRequirementsModel,
        endpoint: str,
        wallet_address: str,
        config: GuardianClawX402Config,
        context: dict[str, Any] | None = None,
    ) -> dict[CLAWGate, CLAWGateResult]:
        """Run all CLAW gates on a payment request.

        When a ``SimulationGate`` is configured, it runs first and its result
        is merged into ``context['simulation_result']`` so the four gates can
        consume it. The simulation never blocks on its own — its outcome
        only manifests through the Credibility or Avoidance gates.

        Args:
            payment_requirements: The x402 payment requirements
            endpoint: The endpoint URL requesting payment
            wallet_address: The wallet address making the payment
            config: GuardianClaw x402 configuration
            context: Additional context (spending records, history, etc.)

        Returns:
            Dictionary mapping each gate to its result
        """
        # Pre-flight simulation (Sprint 4). Always fail-safe — the gate
        # already wraps the provider call in a try/except.
        if self.simulation_gate is not None:
            sim_result = self.simulation_gate.run(
                payment_requirements=payment_requirements,
                endpoint=endpoint,
                wallet_address=wallet_address,
            )
            # Mutate (or create) the caller's context dict so all four gates
            # see the same object. We pass the raw SimulationResult so
            # downstream code can read either the enum or the dict form.
            if context is None:
                context = {}
            context["simulation_result"] = sim_result

        results: dict[CLAWGate, CLAWGateResult] = {}

        for validator in self._validators:
            try:
                result = validator.validate(
                    payment_requirements=payment_requirements,
                    endpoint=endpoint,
                    wallet_address=wallet_address,
                    config=config,
                    context=context,
                )
                results[validator.gate] = result
            except Exception as e:
                # If a validator fails, mark that gate as failed
                results[validator.gate] = CLAWGateResult(
                    gate=validator.gate,
                    passed=False,
                    reason=f"Validator error: {e!s}",
                )

        return results

    def calculate_risk_level(
        self,
        gate_results: dict[CLAWGate, CLAWGateResult],
        payment_requirements: PaymentRequirementsModel,
        config: GuardianClawX402Config,
    ) -> PaymentRiskLevel:
        """Calculate overall risk level from gate results.

        Risk levels:
            - BLOCKED: Any critical failure (AVOIDANCE gate failed)
            - CRITICAL: Multiple gates failed
            - HIGH: One gate failed (not AVOIDANCE)
            - CAUTION: All gates passed but with warnings
            - SAFE: All gates passed cleanly

        Args:
            gate_results: Results from all CLAW gates
            payment_requirements: The payment requirements
            config: GuardianClaw x402 configuration

        Returns:
            Calculated PaymentRiskLevel
        """
        failed_gates = [gate for gate, result in gate_results.items() if not result.passed]

        # AVOIDANCE gate failure is always BLOCKED
        if CLAWGate.AVOIDANCE in failed_gates:
            return PaymentRiskLevel.BLOCKED

        # Multiple failures is CRITICAL
        if len(failed_gates) >= 2:
            return PaymentRiskLevel.CRITICAL

        # Single failure is HIGH
        if len(failed_gates) == 1:
            return PaymentRiskLevel.HIGH

        # Check for warnings/flags even when passed
        has_warnings = any(
            result.details and (
                result.details.get("warnings") or
                result.details.get("flags") or
                result.details.get("risk_factors")
            )
            for result in gate_results.values()
        )

        # Check amount against confirmation threshold
        amount = payment_requirements.get_amount_float()
        if amount > config.confirmation_thresholds.amount_threshold:
            return PaymentRiskLevel.CAUTION

        if has_warnings:
            return PaymentRiskLevel.CAUTION

        return PaymentRiskLevel.SAFE
