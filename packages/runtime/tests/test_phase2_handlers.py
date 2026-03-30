"""
Phase 2 Handlers Unit Tests

Tests for Coinbase AgentKit and Solana Agent Kit integration handlers.
These tests verify:
- Handler initialization with configuration
- Transaction validation with spending limits
- Address validation and blocklists
- DeFi risk assessment
- Swap validation with slippage checks
- Security profiles
"""

import pytest
from unittest.mock import MagicMock, patch
from claw_runtime.integrations.base_handler import (
    IntegrationConfig,
    ValidationResult,
    Violation,
    ViolationSeverity,
    SeedLevel,
    OnViolation,
)


# ============================================================================
# Coinbase Handler Tests
# ============================================================================

class TestCoinbaseHandler:
    """Tests for Coinbase AgentKit handler."""

    @pytest.fixture
    def default_config(self):
        """Create default integration config for testing."""
        return IntegrationConfig.from_dict({
            "seed_level": "standard",
            "on_violation": "block",
            "security_profile": "standard",
            "spending_limits": {
                "max_single_transaction": 100,
                "max_daily_total": 500,
                "confirmation_threshold": 50,
            },
            "blocked_addresses": ["0xBadAddress000000000000000000000000000bad1"],
            "fiduciary_enabled": True,
            "block_unlimited_approvals": True,
        })

    @pytest.fixture
    def strict_config(self):
        """Create strict security config for testing."""
        return IntegrationConfig.from_dict({
            "seed_level": "full",
            "on_violation": "block",
            "security_profile": "strict",
            "spending_limits": {
                "max_single_transaction": 25,
                "max_daily_total": 100,
                "confirmation_threshold": 10,
            },
        })

    def test_handler_initialization(self, default_config):
        """Test handler initializes with correct configuration."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)

        assert handler.FRAMEWORK == "coinbase"
        assert handler._spending_limits.max_single_transaction == 100
        assert handler._spending_limits.max_daily_total == 500
        assert handler._fiduciary_enabled is True
        assert handler._block_unlimited_approvals is True

    def test_security_profile_strict(self, strict_config):
        """Test strict security profile applies correct limits."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            SecurityProfile,
        )

        handler = CoinbaseHandler(strict_config)

        assert handler._security_profile == SecurityProfile.STRICT
        assert handler._spending_limits.max_single_transaction == 25
        assert handler._spending_limits.max_daily_total == 100

    def test_validate_transaction_approved(self, default_config):
        """Test transaction within limits is approved."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            TransactionDecision,
        )

        handler = CoinbaseHandler(default_config)
        # Use valid 42-character Ethereum address
        result = handler.validate_transaction(
            action="native_transfer",
            to_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab32",
            amount=25.0,
        )

        assert result.is_approved
        assert result.decision == TransactionDecision.APPROVE

    def test_validate_transaction_exceeds_limit(self, default_config):
        """Test transaction exceeding single limit is blocked."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            TransactionDecision,
        )

        handler = CoinbaseHandler(default_config)
        result = handler.validate_transaction(
            action="native_transfer",
            to_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab32",
            amount=150.0,  # Exceeds 100 limit
        )

        assert not result.is_approved
        assert result.decision == TransactionDecision.BLOCK
        assert "exceeds single transaction limit" in result.blocked_reason

    def test_validate_transaction_requires_confirmation(self, default_config):
        """Test transaction above threshold requires confirmation."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            TransactionDecision,
        )

        handler = CoinbaseHandler(default_config)
        result = handler.validate_transaction(
            action="native_transfer",
            to_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab32",
            amount=75.0,  # Above 50 threshold but within 100 limit
        )

        assert result.requires_confirmation
        assert result.decision == TransactionDecision.REQUIRE_CONFIRMATION

    def test_validate_transaction_blocked_address(self, default_config):
        """Test transaction to blocked address is blocked."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            TransactionDecision,
            RiskLevel,
        )

        handler = CoinbaseHandler(default_config)
        result = handler.validate_transaction(
            action="native_transfer",
            to_address="0xBadAddress000000000000000000000000000bad1",  # Blocked address
            amount=10.0,
        )

        assert not result.is_approved
        assert result.decision == TransactionDecision.BLOCK
        assert result.risk_level == RiskLevel.CRITICAL
        assert "blocked" in result.blocked_reason.lower()

    def test_validate_transaction_daily_limit(self, default_config):
        """Test spending tracking works correctly."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
        )

        handler = CoinbaseHandler(default_config)
        wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab32"

        # Record spending
        handler.record_transaction(wallet, 100.0)
        handler.record_transaction(wallet, 200.0)

        # Check spending is tracked
        summary = handler.get_spending_summary(wallet)
        assert summary["daily_spent"] == 300.0
        assert summary["transaction_count"] == 2
        assert summary["daily_remaining"] == 200.0  # 500 - 300

    def test_validate_unlimited_approval_blocked(self, default_config):
        """Test unlimited token approvals are blocked."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            TransactionDecision,
            RiskLevel,
        )

        handler = CoinbaseHandler(default_config)
        result = handler.validate_transaction(
            action="approve",
            to_address="0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab32",
            amount=0,
            approval_amount=10**20,  # Effectively unlimited
        )

        assert not result.is_approved
        assert result.decision == TransactionDecision.BLOCK
        assert result.risk_level == RiskLevel.CRITICAL
        assert "unlimited" in result.concerns[0].lower()

    def test_validate_address_valid(self, default_config):
        """Test valid address passes validation."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)
        result = handler.validate_address("0x742d35Cc6634C0532925a3b844Bc9e7595f0Ab32")

        assert result["valid"]
        assert not result["is_blocked"]

    def test_validate_address_blocked(self, default_config):
        """Test blocked address fails validation."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)
        result = handler.validate_address("0xBadAddress000000000000000000000000000bad1")

        assert result["is_blocked"]
        assert "blocklist" in result["warnings"][0].lower()

    def test_assess_defi_risk_basic(self, default_config):
        """Test DeFi risk assessment returns valid result."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            RiskLevel,
        )

        handler = CoinbaseHandler(default_config)
        result = handler.assess_defi_risk(
            protocol="aave",
            action="supply",
            amount=50.0,
        )

        # Verify result structure
        assert result.protocol == "aave"
        assert result.action_type == "supply"
        assert result.risk_level in (RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL)
        assert isinstance(result.risk_score, float)
        assert isinstance(result.to_dict(), dict)

    def test_assess_defi_risk_high_collateral(self, default_config):
        """Test high-risk DeFi operation with low collateral."""
        from claw_runtime.integrations.coinbase_handler import (
            CoinbaseHandler,
            RiskLevel,
        )

        handler = CoinbaseHandler(default_config)
        result = handler.assess_defi_risk(
            protocol="aave",
            action="borrow",
            amount=1000.0,
            collateral_ratio=1.2,  # Very low, risky
        )

        assert result.is_high_risk
        assert "collateral" in str(result.risk_factors).lower()

    def test_spending_summary(self, default_config):
        """Test getting spending summary."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)
        handler.record_transaction("0xwallet", 100.0)
        handler.record_transaction("0xwallet", 50.0)

        summary = handler.get_spending_summary("0xwallet")

        assert summary["daily_spent"] == 150.0
        assert summary["daily_remaining"] == 350.0
        assert summary["transaction_count"] == 2

    def test_block_unblock_address(self, default_config):
        """Test blocking and unblocking addresses."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)

        # Block new address
        assert handler.block_address("0xnewbad", reason="Suspicious activity")

        # Verify it's blocked
        result = handler.validate_address("0xnewbad")
        assert result["is_blocked"]

        # Unblock
        assert handler.unblock_address("0xnewbad")

        # Verify it's no longer blocked
        result = handler.validate_address("0xnewbad")
        assert not result["is_blocked"]

    def test_reset_spending(self, default_config):
        """Test resetting spending counters."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)
        handler.record_transaction("0xwallet", 100.0)

        summary_before = handler.get_spending_summary("0xwallet")
        assert summary_before["daily_spent"] == 100.0

        handler.reset_spending("0xwallet")

        summary_after = handler.get_spending_summary("0xwallet")
        assert summary_after["daily_spent"] == 0.0

    def test_security_profile_config(self, default_config):
        """Test getting security profile configuration."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        handler = CoinbaseHandler(default_config)
        profile = handler.get_security_profile()

        assert profile["profile"] == "standard"
        assert profile["fiduciary_enabled"] is True
        assert profile["block_unlimited_approvals"] is True


# ============================================================================
# Solana Agent Kit Handler Tests
# ============================================================================

class TestSolanaAgentKitHandler:
    """Tests for Solana Agent Kit handler."""

    @pytest.fixture
    def default_config(self):
        """Create default integration config for testing."""
        return IntegrationConfig.from_dict({
            "seed_level": "standard",
            "on_violation": "block",
            "spending_limits": {
                "max_single_transaction": 100,
                "max_daily_total": 500,
                "confirmation_threshold": 50,
            },
            "slippage_tolerance": 1.0,
            "priority_fee_cap": 10000,
            "fiduciary_enabled": True,
        })

    @pytest.fixture
    def strict_config(self):
        """Create strict config with lower limits."""
        return IntegrationConfig.from_dict({
            "spending_limits": {
                "max_single_transaction": 25,
                "max_daily_total": 100,
                "confirmation_threshold": 10,
            },
            "slippage_tolerance": 0.5,
            "priority_fee_cap": 5000,
            "blocked_addresses": ["9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"],
        })

    def test_handler_initialization(self, default_config):
        """Test handler initializes with correct configuration."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)

        assert handler.FRAMEWORK == "solana_agent_kit"
        assert handler._spending_limits.max_single_transaction == 100
        assert handler._slippage_tolerance == 1.0
        assert handler._priority_fee_cap == 10000

    def test_validate_address_valid(self, default_config):
        """Test valid Solana address passes validation."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)
        # Valid base58 encoded 32-byte key
        result = handler.validate_address("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")

        assert result["valid"]
        assert result["format_ok"]
        assert not result["is_blocked"]

    def test_validate_address_invalid_format(self, default_config):
        """Test invalid Solana address fails validation."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_address("invalid_address_format")

        assert not result["valid"]
        assert not result["format_ok"]

    def test_validate_address_blocked(self, strict_config):
        """Test blocked address fails validation."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(strict_config)
        result = handler.validate_address("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin")

        assert result["is_blocked"]
        assert "blocklist" in result["warnings"][0].lower()

    def test_validate_transaction_approved(self, default_config):
        """Test transaction within limits is approved."""
        from claw_runtime.integrations.solana_handler import (
            SolanaAgentKitHandler,
            TransactionDecision,
        )

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_transaction(
            transaction_type="transfer",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=25.0,
        )

        assert result.is_approved
        assert result.decision == TransactionDecision.APPROVE

    def test_validate_transaction_exceeds_limit(self, default_config):
        """Test transaction exceeding limit is blocked."""
        from claw_runtime.integrations.solana_handler import (
            SolanaAgentKitHandler,
            TransactionDecision,
        )

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_transaction(
            transaction_type="transfer",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=150.0,  # Exceeds 100 limit
        )

        assert not result.is_approved
        assert result.decision == TransactionDecision.BLOCK
        assert "exceeds single transaction limit" in result.blocked_reason

    def test_validate_transaction_requires_confirmation(self, default_config):
        """Test high-value transaction requires confirmation."""
        from claw_runtime.integrations.solana_handler import (
            SolanaAgentKitHandler,
            TransactionDecision,
        )

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_transaction(
            transaction_type="transfer",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=75.0,  # Above 50 threshold
        )

        assert result.requires_confirmation
        assert result.decision == TransactionDecision.REQUIRE_CONFIRMATION

    def test_validate_transaction_priority_fee_warning(self, default_config):
        """Test high priority fee generates warning."""
        from claw_runtime.integrations.solana_handler import (
            SolanaAgentKitHandler,
            TransactionDecision,
            RiskLevel,
        )

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_transaction(
            transaction_type="transfer",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=25.0,
            priority_fee_lamports=20000,  # Exceeds 10000 cap
        )

        # Should warn but not block (under amount limit)
        assert result.decision == TransactionDecision.WARN
        assert result.risk_level == RiskLevel.MEDIUM
        assert "priority fee" in result.concerns[0].lower()

    def test_validate_transaction_high_risk_operation(self, default_config):
        """Test high-risk operations require extra confirmation."""
        from claw_runtime.integrations.solana_handler import (
            SolanaAgentKitHandler,
            TransactionType,
        )

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_transaction(
            transaction_type="bridge",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=25.0,
        )

        assert result.requires_confirmation
        assert result.transaction_type == TransactionType.BRIDGE
        assert "high-risk" in str(result.concerns).lower()

    def test_validate_swap_approved(self, default_config):
        """Test swap within slippage tolerance is approved."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_swap(
            input_mint="So11111111111111111111111111111111111111112",  # SOL
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
            amount=1.0,
            slippage=0.5,  # Within 1.0% tolerance
        )

        assert result.approved
        assert result.slippage_ok
        assert result.token_verified

    def test_validate_swap_high_slippage(self, default_config):
        """Test swap with high slippage is flagged."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_swap(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            amount=1.0,
            slippage=2.0,  # Exceeds 1.0% tolerance
        )

        assert not result.slippage_ok
        assert "slippage" in result.concerns[0].lower()

    def test_validate_swap_unverified_token(self, default_config):
        """Test swap with unverified token is flagged."""
        from claw_runtime.integrations.solana_handler import (
            SolanaAgentKitHandler,
            RiskLevel,
        )

        handler = SolanaAgentKitHandler(default_config)
        result = handler.validate_swap(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="UnverifiedMint123456789012345678901234567890",  # Unknown token
            amount=1.0,
            slippage=0.5,
        )

        assert not result.token_verified
        assert result.risk_level == RiskLevel.HIGH
        assert "not verified" in str(result.concerns).lower()

    def test_add_known_token(self, default_config):
        """Test adding a known token."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)

        # Add custom token
        handler.add_known_token(
            mint="CustomTokenMint123456789012345678901234567",
            symbol="CUST",
            name="Custom Token",
            verified=True,
        )

        # Validate swap with custom token
        result = handler.validate_swap(
            input_mint="So11111111111111111111111111111111111111112",
            output_mint="CustomTokenMint123456789012345678901234567",
            amount=1.0,
            slippage=0.5,
        )

        assert result.token_verified

    def test_spending_summary(self, default_config):
        """Test getting spending summary."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)
        handler.record_transaction("wallet1", 100.0)
        handler.record_transaction("wallet1", 50.0)

        summary = handler.get_spending_summary("wallet1")

        assert summary["daily_spent"] == 150.0
        assert summary["daily_remaining"] == 350.0
        assert summary["transaction_count"] == 2
        assert summary["slippage_tolerance"] == 1.0
        assert summary["priority_fee_cap"] == 10000

    def test_block_unblock_address(self, default_config):
        """Test blocking and unblocking addresses."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)

        # Block new address
        assert handler.block_address(
            "BadActorAddress12345678901234567890123456789",
            reason="Scam wallet",
        )

        # Verify it's blocked
        result = handler.validate_address("BadActorAddress12345678901234567890123456789")
        assert result["is_blocked"]

        # Unblock
        assert handler.unblock_address("BadActorAddress12345678901234567890123456789")

        # Verify it's no longer blocked
        result = handler.validate_address("BadActorAddress12345678901234567890123456789")
        assert not result["is_blocked"]

    def test_validation_history(self, default_config):
        """Test validation history tracking."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)

        # Perform some validations
        handler.validate_transaction(
            transaction_type="transfer",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=25.0,
        )
        handler.validate_transaction(
            transaction_type="swap",
            to_address="7UX2i7SucgLMQcfZ75s3VXmZZY4YRUyJN9X1RgfMoDUi",
            amount_usd=50.0,
        )

        history = handler.get_validation_history(limit=5)

        assert len(history) == 2
        assert history[0]["decision"] == "approve"

    def test_config_summary(self, default_config):
        """Test getting configuration summary."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        handler = SolanaAgentKitHandler(default_config)
        config = handler.get_config_summary()

        assert config["slippage_tolerance"] == 1.0
        assert config["priority_fee_cap"] == 10000
        assert config["fiduciary_enabled"] is True
        assert config["spending_limits"]["max_single_transaction"] == 100


# ============================================================================
# Integration Tests
# ============================================================================

class TestPhase2Integration:
    """Integration tests for Phase 2 handlers."""

    def test_both_handlers_available(self):
        """Test both handlers can be imported."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        assert CoinbaseHandler is not None
        assert SolanaAgentKitHandler is not None

    def test_handlers_registered(self):
        """Test handlers are registered in the factory."""
        from claw_runtime.integrations import get_integration_handler

        coinbase_handler = get_integration_handler("coinbase", {})
        solana_handler = get_integration_handler("solana_agent_kit", {})

        assert coinbase_handler is not None
        assert solana_handler is not None

    def test_coinbase_execute(self):
        """Test Coinbase handler execute method."""
        from claw_runtime.integrations.coinbase_handler import CoinbaseHandler

        config = IntegrationConfig.from_dict({"security_profile": "standard"})
        handler = CoinbaseHandler(config)

        state = {"initial_input": "Transfer 50 USDC to wallet", "current_input": "Transfer 50 USDC to wallet"}
        result = handler.execute(state, None)

        assert result.success

    def test_solana_execute(self):
        """Test Solana handler execute method."""
        from claw_runtime.integrations.solana_handler import SolanaAgentKitHandler

        config = IntegrationConfig.from_dict({"slippage_tolerance": 1.0})
        handler = SolanaAgentKitHandler(config)

        state = {"initial_input": "Swap 1 SOL for USDC", "current_input": "Swap 1 SOL for USDC"}
        result = handler.execute(state, None)

        assert result.success
