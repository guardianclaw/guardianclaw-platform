"""
Solana Agent Kit Integration Handler.

This handler provides GuardianClaw protection for Solana Agent Kit-based agents.
It implements transaction validation and spending limits for Solana operations.

The Solana Agent Kit (github.com/sendaifun/solana-agent-kit) is a TypeScript SDK
for building AI agents that interact with the Solana blockchain. This handler
provides server-side validation that can be used alongside the toolkit.

Configuration:
    {
        "spending_limits": {
            "max_single_transaction": 100,
            "max_daily_total": 500,
            "confirmation_threshold": 50
        },
        "blocked_addresses": [],
        "fiduciary_enabled": true,
        "slippage_tolerance": 1.0,
        "priority_fee_cap": 10000,
        "memory_integrity_check": false
    }

Note: The Solana Agent Kit is TypeScript-based, so this handler provides
validation that can be called from the frontend or via API before executing
Solana transactions.
"""

from __future__ import annotations

import logging
import re
import base58
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

logger = logging.getLogger("claw_runtime.integrations.solana")


class TransactionType(str, Enum):
    """Types of Solana transactions."""
    TRANSFER = "transfer"
    SWAP = "swap"
    STAKE = "stake"
    UNSTAKE = "unstake"
    BRIDGE = "bridge"
    DEPLOY_TOKEN = "deploy_token"
    MINT_NFT = "mint_nft"
    AIRDROP = "airdrop"
    UNKNOWN = "unknown"


class TransactionDecision(str, Enum):
    """Decision for a transaction validation."""
    APPROVE = "approve"
    BLOCK = "block"
    REQUIRE_CONFIRMATION = "require_confirmation"
    WARN = "warn"


class RiskLevel(str, Enum):
    """Risk level for transactions."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SpendingLimits:
    """Spending limits configuration for Solana operations."""
    max_single_transaction: float = 100.0  # USD equivalent
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
    """Result of Solana transaction validation."""
    decision: TransactionDecision
    risk_level: RiskLevel
    transaction_type: TransactionType
    concerns: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    requires_confirmation: bool = False
    blocked_reason: Optional[str] = None
    estimated_fee_lamports: Optional[int] = None

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
            "transaction_type": self.transaction_type.value,
            "is_approved": self.is_approved,
            "should_proceed": self.should_proceed,
            "requires_confirmation": self.requires_confirmation,
            "concerns": self.concerns,
            "recommendations": self.recommendations,
            "blocked_reason": self.blocked_reason,
            "estimated_fee_lamports": self.estimated_fee_lamports,
        }


@dataclass
class SwapValidationResult:
    """Result of swap/trade validation."""
    approved: bool
    risk_level: RiskLevel
    slippage_ok: bool
    token_verified: bool
    concerns: List[str] = field(default_factory=list)
    rug_check_passed: Optional[bool] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "approved": self.approved,
            "risk_level": self.risk_level.value,
            "slippage_ok": self.slippage_ok,
            "token_verified": self.token_verified,
            "concerns": self.concerns,
            "rug_check_passed": self.rug_check_passed,
        }


class SolanaAgentKitHandler(BaseIntegrationHandler):
    """
    Integration handler for Solana Agent Kit.

    Provides validation for Solana blockchain operations including:
    - Transfer validation with spending limits
    - Swap validation with slippage checks
    - Address validation and blocklists
    - Priority fee management
    - Fiduciary guard integration

    Since Solana Agent Kit is TypeScript-based, this handler provides
    server-side validation that can be called before executing transactions.

    Example:
        handler = SolanaAgentKitHandler(IntegrationConfig.from_dict({
            "spending_limits": {"max_single_transaction": 50},
            "slippage_tolerance": 1.5,
        }))

        # Validate a transfer
        result = handler.validate_transaction(
            transaction_type="transfer",
            to_address="9xQeW...",
            amount_sol=1.5,
        )

        # Validate a swap
        swap_result = handler.validate_swap(
            input_mint="So11111...",
            output_mint="EPjFW...",
            amount=1.0,
            slippage=0.5,
        )
    """

    FRAMEWORK = "solana_agent_kit"
    DEFAULT_SEED_LEVEL = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION = OnViolation.BLOCK

    # High-risk transaction types that require extra validation
    HIGH_RISK_OPERATIONS = {
        TransactionType.BRIDGE,
        TransactionType.DEPLOY_TOKEN,
    }

    def __init__(self, config: IntegrationConfig):
        """Initialize Solana Agent Kit handler."""
        # Extract Solana-specific config
        limits_data = config.framework_config.get("spending_limits")
        if limits_data:
            self._spending_limits = SpendingLimits.from_dict(limits_data)
        else:
            self._spending_limits = SpendingLimits()

        self._blocked_addresses = set(
            config.framework_config.get("blocked_addresses", [])
        )
        self._fiduciary_enabled = config.framework_config.get("fiduciary_enabled", True)
        self._slippage_tolerance = config.framework_config.get("slippage_tolerance", 1.0)
        self._priority_fee_cap = config.framework_config.get("priority_fee_cap", 10000)
        self._memory_integrity_check = config.framework_config.get("memory_integrity_check", False)

        # Tracking for spending limits
        self._daily_spending: Dict[str, float] = {}
        self._transaction_count: Dict[str, int] = {}
        self._validation_history: List[TransactionValidationResult] = []

        # Known token mints (for verification)
        self._known_tokens = self._init_known_tokens()

        # Call parent init
        super().__init__(config)

    def _init_known_tokens(self) -> Dict[str, Dict[str, Any]]:
        """Initialize known token list."""
        return {
            # SOL (native)
            "So11111111111111111111111111111111111111112": {
                "symbol": "SOL",
                "name": "Solana",
                "verified": True,
            },
            # USDC
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
                "symbol": "USDC",
                "name": "USD Coin",
                "verified": True,
            },
            # USDT
            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {
                "symbol": "USDT",
                "name": "Tether USD",
                "verified": True,
            },
        }

    def _create_validator(self) -> Any:
        """
        Create the validator for Solana operations.

        Since there's no dedicated guardianclaw Solana integration yet,
        we use the base LayeredValidator for CLAW validation of purposes
        and intents.
        """
        try:
            from guardianclaw.validation import LayeredValidator, ValidationConfig

            validator_config = ValidationConfig(
                use_heuristic=True,
                use_semantic=False,
            )

            self._sdk_available = True
            return LayeredValidator(config=validator_config)

        except ImportError:
            logger.warning("guardianclaw not available")
            self._sdk_available = False
            return None

    def _execute_internal(
        self,
        state: Dict[str, Any],
        step: Any,
    ) -> IntegrationResult:
        """
        Execute Solana-specific logic.

        For Solana Agent Kit, the main integration is through transaction
        validation before execution. This method handles:
        1. Input validation for transaction intents
        2. Preparing validation configuration

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
            "spending_limits": self._spending_limits.to_dict(),
            "slippage_tolerance": self._slippage_tolerance,
            "priority_fee_cap": self._priority_fee_cap,
            "fiduciary_enabled": self._fiduciary_enabled,
            "memory_integrity_check": self._memory_integrity_check,
        }

        # 3. Return result
        return IntegrationResult(
            success=True,
            data=integration_info,
            validation_input=input_result,
            metadata={
                "blocked_addresses_count": len(self._blocked_addresses),
                "known_tokens_count": len(self._known_tokens),
            },
        )

    def validate_address(self, address: str) -> Dict[str, Any]:
        """
        Validate a Solana address.

        Args:
            address: Solana address (base58 encoded public key)

        Returns:
            Validation result dictionary
        """
        result = {
            "valid": False,
            "is_blocked": False,
            "format_ok": False,
            "warnings": [],
        }

        # Check blocklist
        if address in self._blocked_addresses:
            result["is_blocked"] = True
            result["warnings"].append("Address is on blocklist")
            return result

        # Validate base58 format
        try:
            decoded = base58.b58decode(address)
            if len(decoded) == 32:
                result["format_ok"] = True
                result["valid"] = True
            else:
                result["warnings"].append(f"Invalid key length: {len(decoded)} (expected 32)")
        except Exception:
            result["warnings"].append("Invalid base58 encoding")

        return result

    def validate_transaction(
        self,
        transaction_type: str,
        to_address: str,
        amount_sol: Optional[float] = None,
        amount_usd: Optional[float] = None,
        from_address: Optional[str] = None,
        worth: Optional[str] = None,
        priority_fee_lamports: Optional[int] = None,
    ) -> TransactionValidationResult:
        """
        Validate a Solana transaction before execution.

        Performs comprehensive validation including:
        - Spending limits check
        - Address validation and blocklist check
        - Priority fee cap check
        - CLAW worth validation

        Args:
            transaction_type: Type of transaction (transfer, swap, stake, etc.)
            to_address: Destination address
            amount_sol: Amount in SOL (optional)
            amount_usd: Amount in USD equivalent (optional)
            from_address: Source address (optional)
            worth: Stated worth for the transaction (optional)
            priority_fee_lamports: Priority fee in lamports (optional)

        Returns:
            TransactionValidationResult with decision and details
        """
        concerns = []
        recommendations = []
        requires_confirmation = False
        decision = TransactionDecision.APPROVE
        risk_level = RiskLevel.LOW

        # Parse transaction type
        try:
            tx_type = TransactionType(transaction_type.lower())
        except ValueError:
            tx_type = TransactionType.UNKNOWN

        # Convert amount to USD if needed (assume SOL = $100 for now, should use oracle)
        if amount_usd is None and amount_sol is not None:
            amount_usd = amount_sol * 100  # Placeholder conversion

        amount = amount_usd or 0

        # 1. Validate destination address
        addr_result = self.validate_address(to_address)
        if addr_result["is_blocked"]:
            return TransactionValidationResult(
                decision=TransactionDecision.BLOCK,
                risk_level=RiskLevel.CRITICAL,
                transaction_type=tx_type,
                concerns=["Destination address is on blocklist"],
                blocked_reason="Address blocked",
            )

        if not addr_result["valid"]:
            concerns.append(f"Invalid destination address: {addr_result['warnings']}")
            decision = TransactionDecision.BLOCK
            risk_level = RiskLevel.HIGH

        # 2. Check spending limits
        if amount > self._spending_limits.max_single_transaction:
            concerns.append(
                f"Amount ${amount:.2f} exceeds single transaction limit "
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
                f"Spent: ${daily_spent:.2f}, Limit: ${self._spending_limits.max_daily_total}"
            )
            decision = TransactionDecision.BLOCK
            risk_level = RiskLevel.HIGH

        # 4. Check confirmation threshold
        if amount >= self._spending_limits.confirmation_threshold:
            requires_confirmation = True
            if decision == TransactionDecision.APPROVE:
                decision = TransactionDecision.REQUIRE_CONFIRMATION
            recommendations.append(
                f"Amount ${amount:.2f} requires confirmation"
            )

        # 5. Check priority fee cap
        if priority_fee_lamports and priority_fee_lamports > self._priority_fee_cap:
            concerns.append(
                f"Priority fee {priority_fee_lamports} lamports exceeds cap {self._priority_fee_cap}"
            )
            if decision == TransactionDecision.APPROVE:
                decision = TransactionDecision.WARN
                risk_level = RiskLevel.MEDIUM

        # 6. Check high-risk operations
        if tx_type in self.HIGH_RISK_OPERATIONS:
            concerns.append(f"{tx_type.value} is a high-risk operation")
            requires_confirmation = True
            if risk_level == RiskLevel.LOW:
                risk_level = RiskLevel.MEDIUM

        # 7. Validate worth with CLAW if provided
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

        result = TransactionValidationResult(
            decision=decision,
            risk_level=risk_level,
            transaction_type=tx_type,
            concerns=concerns,
            recommendations=recommendations,
            requires_confirmation=requires_confirmation,
            blocked_reason=concerns[0] if concerns and decision == TransactionDecision.BLOCK else None,
        )

        self._validation_history.append(result)
        return result

    def validate_swap(
        self,
        input_mint: str,
        output_mint: str,
        amount: float,
        slippage: float,
        worth: Optional[str] = None,
    ) -> SwapValidationResult:
        """
        Validate a token swap operation.

        Args:
            input_mint: Input token mint address
            output_mint: Output token mint address
            amount: Amount in input token
            slippage: Slippage tolerance percentage
            worth: Stated worth for the swap (optional)

        Returns:
            SwapValidationResult with validation details
        """
        concerns = []
        risk_level = RiskLevel.LOW
        approved = True

        # Check slippage tolerance
        slippage_ok = slippage <= self._slippage_tolerance
        if not slippage_ok:
            concerns.append(
                f"Slippage {slippage}% exceeds tolerance {self._slippage_tolerance}%"
            )
            risk_level = RiskLevel.MEDIUM

        # Check if tokens are verified
        input_verified = input_mint in self._known_tokens
        output_verified = output_mint in self._known_tokens
        token_verified = input_verified and output_verified

        if not input_verified:
            concerns.append("Input token is not verified")
            risk_level = RiskLevel.MEDIUM

        if not output_verified:
            concerns.append("Output token is not verified - potential rug risk")
            risk_level = RiskLevel.HIGH

        # Validate worth with CLAW if provided
        if worth and self._validator:
            try:
                claw_result = self._validator.validate(worth)
                if hasattr(claw_result, "is_safe") and not claw_result.is_safe:
                    concerns.append("Swap worth failed CLAW validation")
                    risk_level = RiskLevel.MEDIUM
            except Exception as e:
                logger.debug(f"CLAW validation error: {e}")

        # Determine approval
        if risk_level == RiskLevel.HIGH or risk_level == RiskLevel.CRITICAL:
            approved = False

        return SwapValidationResult(
            approved=approved,
            risk_level=risk_level,
            slippage_ok=slippage_ok,
            token_verified=token_verified,
            concerns=concerns,
            rug_check_passed=output_verified,  # Simplified rug check
        )

    def add_known_token(
        self,
        mint: str,
        symbol: str,
        name: str,
        verified: bool = True,
    ) -> None:
        """
        Add a token to the known tokens list.

        Args:
            mint: Token mint address
            symbol: Token symbol
            name: Token name
            verified: Whether token is verified
        """
        self._known_tokens[mint] = {
            "symbol": symbol,
            "name": name,
            "verified": verified,
        }

    def get_spending_summary(self, wallet_address: Optional[str] = None) -> Dict[str, Any]:
        """
        Get spending summary for a wallet.

        Args:
            wallet_address: Wallet address (uses default if not provided)

        Returns:
            Summary dictionary with spending stats
        """
        wallet = wallet_address or "default"

        return {
            "wallet": wallet[:8] + "..." + wallet[-4:] if len(wallet) > 12 else wallet,
            "daily_spent": self._daily_spending.get(wallet, 0.0),
            "daily_limit": self._spending_limits.max_daily_total,
            "daily_remaining": max(
                0,
                self._spending_limits.max_daily_total - self._daily_spending.get(wallet, 0.0),
            ),
            "transaction_count": self._transaction_count.get(wallet, 0),
            "max_single": self._spending_limits.max_single_transaction,
            "confirmation_threshold": self._spending_limits.confirmation_threshold,
            "slippage_tolerance": self._slippage_tolerance,
            "priority_fee_cap": self._priority_fee_cap,
        }

    def record_transaction(
        self,
        wallet_address: str,
        amount_usd: float,
    ) -> None:
        """
        Record a completed transaction for spending tracking.

        Call this after a transaction is successfully executed.

        Args:
            wallet_address: Wallet address
            amount_usd: Transaction amount in USD equivalent
        """
        self._daily_spending[wallet_address] = (
            self._daily_spending.get(wallet_address, 0.0) + amount_usd
        )
        self._transaction_count[wallet_address] = (
            self._transaction_count.get(wallet_address, 0) + 1
        )

    def block_address(self, address: str, reason: Optional[str] = None) -> bool:
        """
        Add an address to the blocklist.

        Args:
            address: Address to block
            reason: Reason for blocking (optional)

        Returns:
            True if added, False if already blocked
        """
        if address in self._blocked_addresses:
            return False

        self._blocked_addresses.add(address)
        logger.info(f"Address blocked: {address[:8]}... Reason: {reason or 'Manual'}")
        return True

    def unblock_address(self, address: str) -> bool:
        """
        Remove an address from the blocklist.

        Args:
            address: Address to unblock

        Returns:
            True if removed, False if wasn't blocked
        """
        if address not in self._blocked_addresses:
            return False

        self._blocked_addresses.remove(address)
        return True

    def reset_spending(self, wallet_address: Optional[str] = None) -> None:
        """
        Reset spending counters.

        Args:
            wallet_address: Specific wallet to reset, or None for all
        """
        if wallet_address:
            self._daily_spending.pop(wallet_address, None)
            self._transaction_count.pop(wallet_address, None)
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

    def get_config_summary(self) -> Dict[str, Any]:
        """
        Get current configuration summary.

        Returns:
            Configuration dictionary
        """
        return {
            "spending_limits": self._spending_limits.to_dict(),
            "slippage_tolerance": self._slippage_tolerance,
            "priority_fee_cap": self._priority_fee_cap,
            "fiduciary_enabled": self._fiduciary_enabled,
            "memory_integrity_check": self._memory_integrity_check,
            "blocked_addresses_count": len(self._blocked_addresses),
            "known_tokens_count": len(self._known_tokens),
        }


# Register the handler
def _register():
    """Register Solana Agent Kit handler on module import."""
    try:
        from claw_runtime.integrations import register_handler
        register_handler("solana_agent_kit", handler_class=SolanaAgentKitHandler)
    except ImportError:
        pass


_register()
