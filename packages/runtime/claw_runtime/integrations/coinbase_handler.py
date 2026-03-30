"""
Coinbase AgentKit Integration Handler.

This handler provides GuardianClaw protection for Coinbase AgentKit-based agents.
It wraps the guardianclaw Coinbase integration and provides:
- Transaction validation with spending limits
- Address validation with blocklists
- DeFi risk assessment
- x402 payment validation
- Fiduciary guard integration

Configuration:
    {
        "security_profile": "standard",
        "spending_limits": {
            "max_single_transaction": 100,
            "max_daily_total": 500,
            "confirmation_threshold": 50
        },
        "blocked_addresses": [],
        "fiduciary_enabled": true,
        "block_unlimited_approvals": true,
        "validate_before_sign": true
    }
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from claw_runtime.integrations.base_handler import (
    BaseIntegrationHandler,
    IntegrationConfig,
    IntegrationResult,
    ValidationResult,
    Violation,
    ViolationSeverity,
    SeedLevel,
    OnViolation,
)

logger = logging.getLogger("claw_runtime.integrations.coinbase")


class SecurityProfile(str, Enum):
    """Security profile for Coinbase operations."""
    PERMISSIVE = "permissive"
    STANDARD = "standard"
    STRICT = "strict"
    PARANOID = "paranoid"


class TransactionDecision(str, Enum):
    """Decision for a transaction validation."""
    APPROVE = "approve"
    BLOCK = "block"
    REQUIRE_CONFIRMATION = "require_confirmation"
    WARN = "warn"


class RiskLevel(str, Enum):
    """Risk level for transactions and DeFi operations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SpendingLimits:
    """Spending limits configuration."""
    max_single_transaction: float = 100.0
    max_daily_total: float = 500.0
    max_weekly_total: float = 2000.0
    confirmation_threshold: float = 50.0
    max_transactions_per_day: int = 50

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SpendingLimits":
        """Create from dictionary."""
        return cls(
            max_single_transaction=data.get("max_single_transaction", 100.0),
            max_daily_total=data.get("max_daily_total", 500.0),
            max_weekly_total=data.get("max_weekly_total", 2000.0),
            confirmation_threshold=data.get("confirmation_threshold", 50.0),
            max_transactions_per_day=data.get("max_transactions_per_day", 50),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "max_single_transaction": self.max_single_transaction,
            "max_daily_total": self.max_daily_total,
            "max_weekly_total": self.max_weekly_total,
            "confirmation_threshold": self.confirmation_threshold,
            "max_transactions_per_day": self.max_transactions_per_day,
        }


@dataclass
class TransactionValidationResult:
    """Result of transaction validation."""
    decision: TransactionDecision
    risk_level: RiskLevel
    concerns: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    requires_confirmation: bool = False
    blocked_reason: Optional[str] = None

    @property
    def is_approved(self) -> bool:
        """Check if transaction is approved."""
        return self.decision == TransactionDecision.APPROVE

    @property
    def should_proceed(self) -> bool:
        """Check if transaction should proceed."""
        return self.decision in (TransactionDecision.APPROVE, TransactionDecision.WARN)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "decision": self.decision.value,
            "risk_level": self.risk_level.value,
            "is_approved": self.is_approved,
            "should_proceed": self.should_proceed,
            "requires_confirmation": self.requires_confirmation,
            "concerns": self.concerns,
            "recommendations": self.recommendations,
            "blocked_reason": self.blocked_reason,
        }


@dataclass
class DeFiRiskAssessment:
    """Result of DeFi risk assessment."""
    protocol: str
    action_type: str
    risk_level: RiskLevel
    risk_score: float
    risk_factors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

    @property
    def is_high_risk(self) -> bool:
        """Check if this is a high-risk operation."""
        return self.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "protocol": self.protocol,
            "action_type": self.action_type,
            "risk_level": self.risk_level.value,
            "risk_score": self.risk_score,
            "is_high_risk": self.is_high_risk,
            "risk_factors": self.risk_factors,
            "warnings": self.warnings,
            "recommendations": self.recommendations,
        }


class CoinbaseHandler(BaseIntegrationHandler):
    """
    Integration handler for Coinbase AgentKit.

    Uses GuardianClawActionProvider from guardianclaw.integrations.coinbase
    to validate transactions, addresses, and DeFi operations.

    The handler wraps the full Coinbase integration including:
    - AgentKit action provider for AI agents
    - Transaction validation with spending limits
    - Address validation with blocklists
    - DeFi risk assessment
    - x402 payment validation

    Example:
        handler = CoinbaseHandler(IntegrationConfig.from_dict({
            "security_profile": "strict",
            "spending_limits": {"max_single_transaction": 50},
        }))

        # Validate a transaction
        result = handler.validate_transaction(
            action="native_transfer",
            to_address="0x456...",
            amount=25.0,
        )
        if not result.is_approved:
            print(f"Blocked: {result.blocked_reason}")

        # Get action provider for AgentKit
        provider = handler.get_action_provider()
    """

    FRAMEWORK = "coinbase"
    DEFAULT_SEED_LEVEL = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION = OnViolation.BLOCK

    # Security profiles with default spending limits
    SECURITY_PROFILES = {
        SecurityProfile.PERMISSIVE: SpendingLimits(
            max_single_transaction=1000.0,
            max_daily_total=5000.0,
            confirmation_threshold=500.0,
        ),
        SecurityProfile.STANDARD: SpendingLimits(
            max_single_transaction=100.0,
            max_daily_total=500.0,
            confirmation_threshold=50.0,
        ),
        SecurityProfile.STRICT: SpendingLimits(
            max_single_transaction=25.0,
            max_daily_total=100.0,
            confirmation_threshold=10.0,
        ),
        SecurityProfile.PARANOID: SpendingLimits(
            max_single_transaction=10.0,
            max_daily_total=50.0,
            confirmation_threshold=5.0,
        ),
    }

    def __init__(self, config: IntegrationConfig):
        """Initialize Coinbase handler."""
        # Extract Coinbase-specific config
        profile_name = config.framework_config.get("security_profile", "standard")
        self._security_profile = SecurityProfile(profile_name)

        # Get spending limits from config or use profile defaults
        limits_data = config.framework_config.get("spending_limits")
        if limits_data:
            self._spending_limits = SpendingLimits.from_dict(limits_data)
        else:
            self._spending_limits = self.SECURITY_PROFILES[self._security_profile]

        # Other config
        self._blocked_addresses = set(
            addr.lower() for addr in config.framework_config.get("blocked_addresses", [])
        )
        self._fiduciary_enabled = config.framework_config.get("fiduciary_enabled", True)
        self._block_unlimited_approvals = config.framework_config.get(
            "block_unlimited_approvals", True
        )
        self._validate_before_sign = config.framework_config.get("validate_before_sign", True)

        # Tracking for spending limits
        self._daily_spending: Dict[str, float] = {}
        self._transaction_count: Dict[str, int] = {}
        self._validation_history: List[TransactionValidationResult] = []

        # Call parent init (creates validator)
        super().__init__(config)

    def _create_validator(self) -> Any:
        """
        Create the Coinbase GuardianClaw validator.

        Returns the GuardianClawActionProvider or a TransactionValidator for
        synchronous validation in the executor.
        """
        try:
            from guardianclaw.integrations.coinbase import (
                GuardianClawActionProvider,
                claw_action_provider,
                GuardianClawCoinbaseConfig,
                get_default_config,
                TransactionValidator,
            )

            # Get SDK config based on security profile
            sdk_config = get_default_config(self._security_profile.value)

            # Apply our spending limits
            if hasattr(sdk_config, "chain_configs"):
                for chain_config in sdk_config.chain_configs.values():
                    chain_config.spending_limits.max_single_transfer = (
                        self._spending_limits.max_single_transaction
                    )
                    chain_config.spending_limits.daily_limit = (
                        self._spending_limits.max_daily_total
                    )

            # Apply blocked addresses
            sdk_config.blocked_addresses.update(self._blocked_addresses)

            # Apply other settings
            sdk_config.block_unlimited_approvals = self._block_unlimited_approvals

            # Store for later use
            self._sdk_config = sdk_config
            self._coinbase_available = True

            # Create transaction validator for sync validation
            self._transaction_validator = TransactionValidator(config=sdk_config)

            # Create action provider for AgentKit
            self._action_provider = claw_action_provider(
                security_profile=self._security_profile.value,
            )

            return self._transaction_validator

        except ImportError as e:
            logger.warning(f"guardianclaw Coinbase integration not available: {e}")
            self._sdk_config = None
            self._coinbase_available = False
            self._transaction_validator = None
            self._action_provider = None

            # Fallback to base validator
            try:
                from guardianclaw.validation import LayeredValidator, ValidationConfig

                validator_config = ValidationConfig(
                    use_heuristic=True,
                    use_semantic=False,
                )
                return LayeredValidator(config=validator_config)

            except ImportError:
                logger.error("guardianclaw not available")
                return None

    def _execute_internal(
        self,
        state: Dict[str, Any],
        step: Any,
    ) -> IntegrationResult:
        """
        Execute Coinbase-specific logic.

        For Coinbase AgentKit, the main integration point is through
        the action provider. This method handles:
        1. Input validation for transaction intents
        2. Preparing configuration for the action provider

        Args:
            state: Current execution state
            step: Current flow step

        Returns:
            IntegrationResult with execution outcome
        """
        current_input = state.get("current_input", state.get("initial_input", ""))

        # 1. Validate input
        input_result = self.validate_input(current_input)
        if input_result.blocked and self.config.on_violation == OnViolation.BLOCK:
            return IntegrationResult(
                success=False,
                error=f"Input blocked: {[v.type for v in input_result.violations]}",
                validation_input=input_result,
            )

        # 2. Prepare integration info
        integration_info = {
            "security_profile": self._security_profile.value,
            "spending_limits": self._spending_limits.to_dict(),
            "fiduciary_enabled": self._fiduciary_enabled,
            "block_unlimited_approvals": self._block_unlimited_approvals,
            "coinbase_available": self._coinbase_available,
        }

        # 3. Return result
        return IntegrationResult(
            success=True,
            data=integration_info,
            validation_input=input_result,
            metadata={
                "security_profile": self._security_profile.value,
                "blocked_addresses_count": len(self._blocked_addresses),
            },
        )

    def validate_transaction(
        self,
        action: str,
        to_address: str,
        amount: float,
        from_address: Optional[str] = None,
        token_address: Optional[str] = None,
        approval_amount: Optional[float] = None,
        worth: Optional[str] = None,
        chain: str = "base-mainnet",
    ) -> TransactionValidationResult:
        """
        Validate a transaction before execution.

        Performs comprehensive validation including:
        - Spending limits check
        - Address blocklist check
        - Unlimited approval detection
        - CLAW worth validation
        - Daily limit tracking

        Args:
            action: Action type (native_transfer, transfer, approve, etc.)
            to_address: Destination address
            amount: Transaction amount in USD equivalent
            from_address: Source address (optional)
            token_address: Token contract address (optional)
            approval_amount: Approval amount for approve actions (optional)
            worth: Stated worth for the transaction (optional)
            chain: Blockchain network (default: base-mainnet)

        Returns:
            TransactionValidationResult with decision and details
        """
        concerns = []
        recommendations = []
        requires_confirmation = False
        decision = TransactionDecision.APPROVE
        risk_level = RiskLevel.LOW

        # 1. Check if address is blocked
        if to_address.lower() in self._blocked_addresses:
            return TransactionValidationResult(
                decision=TransactionDecision.BLOCK,
                risk_level=RiskLevel.CRITICAL,
                concerns=["Recipient address is on blocklist"],
                blocked_reason="Address blocked",
            )

        # 2. Check spending limits
        if amount > self._spending_limits.max_single_transaction:
            concerns.append(
                f"Amount ${amount} exceeds single transaction limit "
                f"${self._spending_limits.max_single_transaction}"
            )
            decision = TransactionDecision.BLOCK
            risk_level = RiskLevel.HIGH

        # 3. Check daily limits
        wallet = from_address or "default"
        daily_spent = self._daily_spending.get(wallet, 0.0)
        if daily_spent + amount > self._spending_limits.max_daily_total:
            concerns.append(
                f"Transaction would exceed daily limit. "
                f"Spent: ${daily_spent}, Limit: ${self._spending_limits.max_daily_total}"
            )
            decision = TransactionDecision.BLOCK
            risk_level = RiskLevel.HIGH

        # 4. Check confirmation threshold
        if amount >= self._spending_limits.confirmation_threshold:
            requires_confirmation = True
            if decision == TransactionDecision.APPROVE:
                decision = TransactionDecision.REQUIRE_CONFIRMATION
            recommendations.append(
                f"Amount ${amount} requires confirmation (threshold: "
                f"${self._spending_limits.confirmation_threshold})"
            )

        # 5. Check unlimited approvals
        if action == "approve" and self._block_unlimited_approvals:
            if approval_amount is None or approval_amount > 10**18:
                concerns.append("Unlimited token approval detected")
                decision = TransactionDecision.BLOCK
                risk_level = RiskLevel.CRITICAL

        # 6. Validate worth with CLAW if provided
        if worth and self._validator:
            try:
                claw_result = self._validator.validate(worth)
                if hasattr(claw_result, "is_safe") and not claw_result.is_safe:
                    concerns.append("Transaction purpose failed CLAW validation")
                    if decision == TransactionDecision.APPROVE:
                        decision = TransactionDecision.WARN
                        risk_level = RiskLevel.MEDIUM
            except Exception as e:
                logger.debug(f"CLAW validation error: {e}")

        # 7. Use SDK validator if available
        if self._transaction_validator:
            try:
                from guardianclaw.integrations.coinbase.config import ChainType

                chain_type = ChainType(chain)
                sdk_result = self._transaction_validator.validate(
                    action=action,
                    from_address=from_address or "0x" + "0" * 40,
                    to_address=to_address,
                    amount=amount,
                    chain=chain_type,
                    token_address=token_address,
                    approval_amount=approval_amount,
                    worth=worth,
                )

                # Merge SDK concerns
                if hasattr(sdk_result, "concerns"):
                    concerns.extend(sdk_result.concerns)

                # Use SDK decision if stricter
                if hasattr(sdk_result, "decision"):
                    if sdk_result.decision.value == "block" and decision != TransactionDecision.BLOCK:
                        decision = TransactionDecision.BLOCK
                        if hasattr(sdk_result, "blocked_reason"):
                            result = TransactionValidationResult(
                                decision=decision,
                                risk_level=RiskLevel(sdk_result.risk_level.value) if hasattr(sdk_result, "risk_level") else risk_level,
                                concerns=concerns,
                                recommendations=recommendations,
                                requires_confirmation=requires_confirmation,
                                blocked_reason=sdk_result.blocked_reason,
                            )
                            self._validation_history.append(result)
                            return result

            except Exception as e:
                logger.debug(f"SDK validation error: {e}")

        result = TransactionValidationResult(
            decision=decision,
            risk_level=risk_level,
            concerns=concerns,
            recommendations=recommendations,
            requires_confirmation=requires_confirmation,
            blocked_reason=concerns[0] if concerns and decision == TransactionDecision.BLOCK else None,
        )

        self._validation_history.append(result)
        return result

    def validate_address(
        self,
        address: str,
        require_checksum: bool = False,
    ) -> Dict[str, Any]:
        """
        Validate an Ethereum address.

        Args:
            address: Address to validate
            require_checksum: Whether to require valid checksum

        Returns:
            Validation result dictionary
        """
        result = {
            "valid": False,
            "is_blocked": False,
            "is_checksummed": False,
            "checksum_address": None,
            "warnings": [],
        }

        # Check blocklist
        if address.lower() in self._blocked_addresses:
            result["is_blocked"] = True
            result["warnings"].append("Address is on blocklist")
            return result

        # Use SDK validator if available
        if self._coinbase_available:
            try:
                from guardianclaw.integrations.coinbase import validate_address

                sdk_result = validate_address(address, require_checksum=require_checksum)
                result["valid"] = sdk_result.valid
                result["is_checksummed"] = sdk_result.is_checksummed
                result["checksum_address"] = sdk_result.checksum_address
                result["warnings"] = sdk_result.warnings

            except Exception as e:
                logger.debug(f"Address validation error: {e}")
                # Basic validation fallback
                result["valid"] = len(address) == 42 and address.startswith("0x")
        else:
            # Basic validation fallback
            result["valid"] = len(address) == 42 and address.startswith("0x")

        return result

    def assess_defi_risk(
        self,
        protocol: str,
        action: str,
        amount: float,
        collateral_ratio: Optional[float] = None,
        apy: Optional[float] = None,
        token_address: Optional[str] = None,
    ) -> DeFiRiskAssessment:
        """
        Assess risk of a DeFi operation.

        Args:
            protocol: DeFi protocol name (aave, compound, uniswap, etc.)
            action: Action type (supply, borrow, swap, etc.)
            amount: Amount in USD equivalent
            collateral_ratio: Collateral ratio for lending operations
            apy: Annual percentage yield
            token_address: Token contract address

        Returns:
            DeFiRiskAssessment with risk evaluation
        """
        risk_factors = []
        warnings = []
        recommendations = []
        risk_score = 0.0
        risk_level = RiskLevel.LOW

        # Use SDK validator if available
        if self._coinbase_available:
            try:
                from guardianclaw.integrations.coinbase import assess_defi_risk

                sdk_result = assess_defi_risk(
                    protocol=protocol,
                    action=action,
                    amount=amount,
                    collateral_ratio=collateral_ratio,
                    apy=apy,
                    token_address=token_address,
                )

                return DeFiRiskAssessment(
                    protocol=sdk_result.protocol.value if hasattr(sdk_result.protocol, "value") else protocol,
                    action_type=sdk_result.action_type.value if hasattr(sdk_result.action_type, "value") else action,
                    risk_level=RiskLevel(sdk_result.risk_level.value),
                    risk_score=sdk_result.risk_score,
                    risk_factors=sdk_result.risk_factors,
                    warnings=sdk_result.warnings,
                    recommendations=sdk_result.recommendations,
                )

            except Exception as e:
                logger.debug(f"DeFi risk assessment error: {e}")

        # Fallback assessment
        # High amount increases risk
        if amount > 1000:
            risk_factors.append("High transaction amount")
            risk_score += 30

        # Low collateral ratio is risky for borrowing
        if action in ("borrow", "leverage") and collateral_ratio:
            if collateral_ratio < 1.5:
                risk_factors.append("Low collateral ratio")
                warnings.append("Position at risk of liquidation")
                risk_score += 40
                recommendations.append("Increase collateral to reduce liquidation risk")

        # Very high APY is suspicious
        if apy and apy > 100:
            risk_factors.append("Unusually high APY")
            warnings.append("High APY may indicate unsustainable yield or risk")
            risk_score += 25

        # Determine risk level
        if risk_score >= 70:
            risk_level = RiskLevel.CRITICAL
        elif risk_score >= 50:
            risk_level = RiskLevel.HIGH
        elif risk_score >= 25:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        return DeFiRiskAssessment(
            protocol=protocol,
            action_type=action,
            risk_level=risk_level,
            risk_score=risk_score,
            risk_factors=risk_factors,
            warnings=warnings,
            recommendations=recommendations,
        )

    def get_action_provider(self) -> Any:
        """
        Get the GuardianClawActionProvider for use with Coinbase AgentKit.

        The provider can be passed to AgentKit to add security guardrails
        to all agent actions.

        Example:
            provider = handler.get_action_provider()
            agent = AgentKit(action_providers=[provider])

        Returns:
            GuardianClawActionProvider or None if not available
        """
        return self._action_provider

    def get_spending_summary(self, wallet_address: Optional[str] = None) -> Dict[str, Any]:
        """
        Get spending summary for a wallet.

        Args:
            wallet_address: Wallet address (uses default if not provided)

        Returns:
            Summary dictionary with spending stats
        """
        wallet = (wallet_address or "default").lower()

        return {
            "wallet": wallet[:10] + "..." + wallet[-6:] if len(wallet) > 16 else wallet,
            "daily_spent": self._daily_spending.get(wallet, 0.0),
            "daily_limit": self._spending_limits.max_daily_total,
            "daily_remaining": max(
                0,
                self._spending_limits.max_daily_total - self._daily_spending.get(wallet, 0.0),
            ),
            "transaction_count": self._transaction_count.get(wallet, 0),
            "max_single": self._spending_limits.max_single_transaction,
            "confirmation_threshold": self._spending_limits.confirmation_threshold,
        }

    def record_transaction(self, wallet_address: str, amount: float) -> None:
        """
        Record a completed transaction for spending tracking.

        Call this after a transaction is successfully executed.

        Args:
            wallet_address: Wallet address
            amount: Transaction amount in USD
        """
        wallet = wallet_address.lower()
        self._daily_spending[wallet] = self._daily_spending.get(wallet, 0.0) + amount
        self._transaction_count[wallet] = self._transaction_count.get(wallet, 0) + 1

    def block_address(self, address: str, reason: Optional[str] = None) -> bool:
        """
        Add an address to the blocklist.

        Args:
            address: Address to block
            reason: Reason for blocking (optional)

        Returns:
            True if added, False if already blocked
        """
        normalized = address.lower()
        if normalized in self._blocked_addresses:
            return False

        self._blocked_addresses.add(normalized)
        logger.info(f"Address blocked: {address[:10]}... Reason: {reason or 'Manual'}")
        return True

    def unblock_address(self, address: str) -> bool:
        """
        Remove an address from the blocklist.

        Args:
            address: Address to unblock

        Returns:
            True if removed, False if wasn't blocked
        """
        normalized = address.lower()
        if normalized not in self._blocked_addresses:
            return False

        self._blocked_addresses.remove(normalized)
        return True

    def reset_spending(self, wallet_address: Optional[str] = None) -> None:
        """
        Reset spending counters.

        Args:
            wallet_address: Specific wallet to reset, or None for all
        """
        if wallet_address:
            wallet = wallet_address.lower()
            self._daily_spending.pop(wallet, None)
            self._transaction_count.pop(wallet, None)
        else:
            self._daily_spending.clear()
            self._transaction_count.clear()

    def get_validation_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent validation history.

        Args:
            limit: Maximum number of entries to return

        Returns:
            List of validation result dictionaries
        """
        return [r.to_dict() for r in self._validation_history[-limit:]]

    def get_security_profile(self) -> Dict[str, Any]:
        """
        Get current security profile configuration.

        Returns:
            Configuration dictionary
        """
        return {
            "profile": self._security_profile.value,
            "spending_limits": self._spending_limits.to_dict(),
            "blocked_addresses_count": len(self._blocked_addresses),
            "fiduciary_enabled": self._fiduciary_enabled,
            "block_unlimited_approvals": self._block_unlimited_approvals,
            "validate_before_sign": self._validate_before_sign,
            "coinbase_sdk_available": self._coinbase_available,
        }


# Register the handler
def _register():
    """Register Coinbase handler on module import."""
    try:
        from claw_runtime.integrations import register_handler
        register_handler("coinbase", handler_class=CoinbaseHandler)
    except ImportError:
        pass


_register()
