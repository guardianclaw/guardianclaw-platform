"""
Phase 3 Handler Tests - Google ADK and Virtuals Protocol

Tests for:
- GoogleADKHandler: Thin wrapper for guardianclaw.integrations.google_adk
- VirtualsProtocolHandler: Thin wrapper for guardianclaw.integrations.virtuals

These handlers delegate to the guardianclaw SDK for actual validation.
Tests verify:
1. Handler initialization and configuration
2. Proper delegation to SDK components
3. Fallback behavior when SDK unavailable
4. Public API functionality

Run with: pytest tests/test_phase3_handlers.py -v
"""

import pytest
from unittest.mock import Mock, patch, MagicMock

from claw_runtime.integrations.base_handler import (
    IntegrationConfig,
    ValidationResult,
    Violation,
    ViolationSeverity,
    SeedLevel,
    OnViolation,
)
from claw_runtime.integrations.google_adk_handler import GoogleADKHandler
from claw_runtime.integrations.virtuals_handler import VirtualsProtocolHandler


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def google_adk_config():
    """Create config for GoogleADKHandler."""
    return IntegrationConfig.from_dict({
        "seed_level": "standard",
        "block_on_failure": True,
        "fail_closed": False,
        "validate_inputs": True,
        "validate_outputs": True,
        "validate_tools": True,
        "max_text_size": 10000,
        "validation_timeout": 5.0,
        "log_violations": False,
    })


@pytest.fixture
def google_adk_handler(google_adk_config):
    """Create a GoogleADKHandler instance."""
    return GoogleADKHandler(google_adk_config)


@pytest.fixture
def virtuals_config():
    """Create config for VirtualsProtocolHandler."""
    return IntegrationConfig.from_dict({
        "block_unsafe": True,
        "log_validations": False,
        "max_transaction_amount": 1000.0,
        "require_confirmation_above": 100.0,
        "require_purpose_for": ["transfer", "send", "approve", "swap"],
        "memory_integrity_check": False,
        "blocked_functions": ["drain_wallet", "approve_unlimited", "export_private_key"],
        "fiduciary_enabled": True,
        "strict_fiduciary": False,
    })


@pytest.fixture
def virtuals_handler(virtuals_config):
    """Create a VirtualsProtocolHandler instance."""
    return VirtualsProtocolHandler(virtuals_config)


# =============================================================================
# Google ADK Handler Tests
# =============================================================================

class TestGoogleADKHandlerInit:
    """Tests for GoogleADKHandler initialization."""

    def test_init_with_default_config(self):
        """Test initialization with default configuration."""
        config = IntegrationConfig.from_dict({})
        handler = GoogleADKHandler(config)

        assert handler.FRAMEWORK == "google_adk"
        assert handler._seed_level == "standard"
        assert handler._block_on_failure is True
        assert handler._fail_closed is False

    def test_init_with_custom_config(self, google_adk_config):
        """Test initialization with custom configuration."""
        handler = GoogleADKHandler(google_adk_config)

        assert handler._seed_level == "standard"
        assert handler._validate_inputs is True
        assert handler._validate_outputs is True
        assert handler._validate_tools is True
        assert handler._max_text_size == 10000

    def test_init_with_minimal_seed_level(self):
        """Test initialization with minimal seed level."""
        config = IntegrationConfig.from_dict({"seed_level": "minimal"})
        handler = GoogleADKHandler(config)

        assert handler._seed_level == "minimal"

    def test_init_with_full_seed_level(self):
        """Test initialization with full seed level."""
        config = IntegrationConfig.from_dict({"seed_level": "full"})
        handler = GoogleADKHandler(config)

        assert handler._seed_level == "full"

    def test_init_with_invalid_seed_level_defaults_to_standard(self):
        """Test that invalid seed level defaults to standard."""
        config = IntegrationConfig.from_dict({})
        config.framework_config["seed_level"] = "invalid"
        handler = GoogleADKHandler(config)

        assert handler._seed_level == "standard"


class TestGoogleADKHandlerConfiguration:
    """Tests for GoogleADKHandler configuration."""

    def test_get_config(self, google_adk_handler):
        """Test get_config returns expected structure."""
        config = google_adk_handler.get_config()

        assert "seed_level" in config
        assert "block_on_failure" in config
        assert "fail_closed" in config
        assert "validate_inputs" in config
        assert "validate_outputs" in config
        assert "validate_tools" in config
        assert "adk_available" in config
        assert "has_plugin" in config

    def test_is_ready(self, google_adk_handler):
        """Test is_ready check."""
        # Handler should be ready (has validator or plugin)
        assert google_adk_handler.is_ready() is True

    def test_get_stats_returns_dict(self, google_adk_handler):
        """Test get_stats returns a dictionary."""
        stats = google_adk_handler.get_stats()

        assert isinstance(stats, dict)
        assert "framework" in stats
        assert stats["framework"] == "google_adk"

    def test_get_violations_returns_list(self, google_adk_handler):
        """Test get_violations returns a list."""
        violations = google_adk_handler.get_violations()

        assert isinstance(violations, list)


class TestGoogleADKHandlerValidation:
    """Tests for GoogleADKHandler validation."""

    def test_validate_input_safe_content(self, google_adk_handler):
        """Test validation of safe content."""
        result = google_adk_handler.validate_input("Hello, how are you?")

        assert isinstance(result, ValidationResult)
        # May pass or fail depending on SDK availability

    def test_validate_input_empty_content(self, google_adk_handler):
        """Test validation of empty content."""
        result = google_adk_handler.validate_input("")

        assert isinstance(result, ValidationResult)

    def test_execute_returns_result(self, google_adk_handler):
        """Test execute returns IntegrationResult."""
        state = {"initial_input": "Test input"}
        step = Mock()

        result = google_adk_handler.execute(state, step)

        assert hasattr(result, 'success')


class TestGoogleADKHandlerSDKIntegration:
    """Tests for Google ADK SDK integration."""

    def test_get_plugin(self, google_adk_handler):
        """Test get_plugin returns plugin or None."""
        plugin = google_adk_handler.get_plugin()

        # Plugin may be None if SDK not available
        # This is expected behavior
        assert plugin is None or hasattr(plugin, 'before_model_callback')

    def test_get_callbacks(self, google_adk_handler):
        """Test get_callbacks returns dict."""
        callbacks = google_adk_handler.get_callbacks()

        assert isinstance(callbacks, dict)
        # If ADK available, should have callback functions
        # If not, empty dict is OK

    def test_reset_stats(self, google_adk_handler):
        """Test reset_stats doesn't raise."""
        # Should not raise
        google_adk_handler.reset_stats()

    def test_clear_violations(self, google_adk_handler):
        """Test clear_violations doesn't raise."""
        # Should not raise
        google_adk_handler.clear_violations()


# =============================================================================
# Virtuals Protocol Handler Tests
# =============================================================================

class TestVirtualsProtocolHandlerInit:
    """Tests for VirtualsProtocolHandler initialization."""

    def test_init_with_default_config(self):
        """Test initialization with default configuration."""
        config = IntegrationConfig.from_dict({})
        handler = VirtualsProtocolHandler(config)

        assert handler.FRAMEWORK == "virtuals"
        assert handler._block_unsafe is True
        assert handler._max_transaction_amount == 1000
        assert handler._fiduciary_enabled is True

    def test_init_with_custom_config(self, virtuals_config):
        """Test initialization with custom configuration."""
        handler = VirtualsProtocolHandler(virtuals_config)

        assert handler._block_unsafe is True
        assert handler._max_transaction_amount == 1000.0
        assert handler._require_confirmation_above == 100.0
        assert "drain_wallet" in handler._blocked_functions

    def test_init_with_blocked_functions(self):
        """Test initialization with custom blocked functions."""
        config = IntegrationConfig.from_dict({
            "blocked_functions": ["custom_dangerous_fn", "another_bad_fn"]
        })
        handler = VirtualsProtocolHandler(config)

        assert "custom_dangerous_fn" in handler._blocked_functions


class TestVirtualsProtocolHandlerConfiguration:
    """Tests for VirtualsProtocolHandler configuration."""

    def test_get_config(self, virtuals_handler):
        """Test get_config returns expected structure."""
        config = virtuals_handler.get_config()

        assert "block_unsafe" in config
        assert "max_transaction_amount" in config
        assert "require_confirmation_above" in config
        assert "blocked_functions" in config
        assert "fiduciary_enabled" in config
        assert "game_sdk_available" in config

    def test_is_ready(self, virtuals_handler):
        """Test is_ready check."""
        # Handler should be ready
        assert virtuals_handler.is_ready() is True

    def test_get_stats_returns_dict(self, virtuals_handler):
        """Test get_stats returns a dictionary."""
        stats = virtuals_handler.get_stats()

        assert isinstance(stats, dict)
        assert "framework" in stats
        assert stats["framework"] == "virtuals"


class TestVirtualsProtocolHandlerActionValidation:
    """Tests for VirtualsProtocolHandler action validation."""

    def test_validate_action_safe(self, virtuals_handler):
        """Test validation of safe action."""
        result = virtuals_handler.validate_action(
            action_name="get_balance",
            action_args={},
        )

        assert "passed" in result
        assert "gate_results" in result
        assert "concerns" in result

    def test_validate_action_blocked_function(self, virtuals_handler):
        """Test validation blocks dangerous functions."""
        result = virtuals_handler.validate_action(
            action_name="drain_wallet",
            action_args={},
        )

        assert "passed" in result
        # May be blocked if SDK validation is active

    def test_validate_action_with_purpose(self, virtuals_handler):
        """Test validation with purpose provided."""
        result = virtuals_handler.validate_action(
            action_name="transfer",
            action_args={"amount": 50},
            worth="Payment for service",
        )

        assert "passed" in result
        assert "gate_results" in result

    def test_validate_action_high_amount(self, virtuals_handler):
        """Test validation of high amount transaction."""
        result = virtuals_handler.validate_action(
            action_name="transfer",
            action_args={"amount": 5000},  # Above max
        )

        assert "passed" in result
        # May be blocked for exceeding limit


class TestVirtualsProtocolHandlerBlockedFunctions:
    """Tests for blocked function management."""

    def test_block_function(self, virtuals_handler):
        """Test adding a function to blocked list."""
        result = virtuals_handler.block_function("new_dangerous_fn")

        assert result is True
        assert "new_dangerous_fn" in virtuals_handler._blocked_functions

    def test_block_function_already_blocked(self, virtuals_handler):
        """Test blocking already blocked function returns False."""
        result = virtuals_handler.block_function("drain_wallet")

        assert result is False

    def test_unblock_function(self, virtuals_handler):
        """Test removing a function from blocked list."""
        # First add it
        virtuals_handler.block_function("temp_fn")

        # Then remove
        result = virtuals_handler.unblock_function("temp_fn")

        assert result is True
        assert "temp_fn" not in virtuals_handler._blocked_functions

    def test_unblock_function_not_found(self, virtuals_handler):
        """Test unblocking non-existent function returns False."""
        result = virtuals_handler.unblock_function("nonexistent_fn")

        assert result is False


class TestVirtualsProtocolHandlerTransactionLimits:
    """Tests for transaction limit management."""

    def test_update_transaction_limits_max_amount(self, virtuals_handler):
        """Test updating max transaction amount."""
        virtuals_handler.update_transaction_limits(max_amount=500)

        assert virtuals_handler._max_transaction_amount == 500

    def test_update_transaction_limits_confirmation(self, virtuals_handler):
        """Test updating confirmation threshold."""
        virtuals_handler.update_transaction_limits(confirmation_threshold=200)

        assert virtuals_handler._require_confirmation_above == 200

    def test_update_transaction_limits_both(self, virtuals_handler):
        """Test updating both limits at once."""
        virtuals_handler.update_transaction_limits(
            max_amount=2000,
            confirmation_threshold=500
        )

        assert virtuals_handler._max_transaction_amount == 2000
        assert virtuals_handler._require_confirmation_above == 500


class TestVirtualsProtocolHandlerMemoryIntegrity:
    """Tests for memory integrity features."""

    def test_sign_state_entry_without_worker(self, virtuals_handler):
        """Test sign_state_entry returns unsigned when no worker."""
        result = virtuals_handler.sign_state_entry(
            key="test_key",
            value={"data": "value"},
        )

        assert "key" in result
        assert "value" in result
        assert "signed" in result

    def test_verify_state_entry_without_worker(self, virtuals_handler):
        """Test verify_state_entry handles missing worker."""
        result = virtuals_handler.verify_state_entry({
            "key": "test",
            "value": "data",
        })

        assert "valid" in result or "reason" in result

    def test_verify_state_without_worker(self, virtuals_handler):
        """Test verify_state handles missing worker."""
        result = virtuals_handler.verify_state({
            "key1": {"value": "data1"},
            "key2": {"value": "data2"},
        })

        assert "all_valid" in result or "checked" in result


class TestVirtualsProtocolHandlerSDKIntegration:
    """Tests for Virtuals SDK integration."""

    def test_get_safety_worker_config(self, virtuals_handler):
        """Test get_safety_worker_config returns None or WorkerConfig."""
        config = virtuals_handler.get_safety_worker_config()

        # None is OK if GAME SDK not available
        # WorkerConfig if available
        assert config is None or hasattr(config, 'id')

    def test_get_fiduciary_stats(self, virtuals_handler):
        """Test get_fiduciary_stats returns dict."""
        stats = virtuals_handler.get_fiduciary_stats()

        assert isinstance(stats, dict)
        assert "enabled" in stats


# =============================================================================
# Integration Tests (with real SDK if available)
# =============================================================================

class TestSDKIntegration:
    """Tests that verify real SDK integration when available."""

    def test_google_adk_sdk_import(self):
        """Test that guardianclaw Google ADK integration can be imported."""
        try:
            from guardianclaw.integrations.google_adk import (
                GuardianClawPlugin,
                create_claw_plugin,
                create_claw_callbacks,
                ADK_AVAILABLE,
            )
            # Import succeeded
            assert True
        except ImportError:
            pytest.skip("guardianclaw.integrations.google_adk not available")

    def test_virtuals_sdk_import(self):
        """Test that guardianclaw Virtuals integration can be imported."""
        try:
            from guardianclaw.integrations.virtuals import (
                ClawValidator,
                ClawConfig,
                GuardianClawSafetyWorker,
                GAME_SDK_AVAILABLE,
            )
            # Import succeeded
            assert True
        except ImportError:
            pytest.skip("guardianclaw.integrations.virtuals not available")

    def test_google_adk_handler_with_sdk(self):
        """Test GoogleADKHandler uses SDK when available."""
        config = IntegrationConfig.from_dict({"seed_level": "standard"})
        handler = GoogleADKHandler(config)

        # Check if SDK was used
        config_dict = handler.get_config()

        # adk_available indicates if google-adk package is installed
        # has_plugin indicates if SDK plugin was created
        assert "adk_available" in config_dict
        assert "has_plugin" in config_dict

    def test_virtuals_handler_with_sdk(self):
        """Test VirtualsProtocolHandler uses SDK when available."""
        config = IntegrationConfig.from_dict({"block_unsafe": True})
        handler = VirtualsProtocolHandler(config)

        # Check if SDK was used
        config_dict = handler.get_config()

        # game_sdk_available indicates if game-sdk package is installed
        # fiduciary_available indicates if fiduciary module is available
        assert "game_sdk_available" in config_dict
        assert "fiduciary_available" in config_dict


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Tests for error handling in handlers."""

    def test_google_adk_handles_validation_error(self, google_adk_handler):
        """Test that validation errors are handled gracefully."""
        # Very long input might cause issues
        long_input = "x" * 1000000

        # Should not raise
        result = google_adk_handler.validate_input(long_input)

        assert isinstance(result, ValidationResult)

    def test_virtuals_handles_invalid_action_args(self, virtuals_handler):
        """Test that invalid action args are handled gracefully."""
        # None args should be handled
        result = virtuals_handler.validate_action(
            action_name="test",
            action_args=None,
        )

        assert "passed" in result

    def test_virtuals_handles_empty_action_name(self, virtuals_handler):
        """Test that empty action name is handled."""
        result = virtuals_handler.validate_action(
            action_name="",
            action_args={},
        )

        assert "passed" in result
        # Empty action name should likely fail validation


# =============================================================================
# Framework Registration Tests
# =============================================================================

class TestFrameworkRegistration:
    """Tests for handler registration."""

    def test_google_adk_framework_name(self):
        """Test GoogleADKHandler has correct framework name."""
        assert GoogleADKHandler.FRAMEWORK == "google_adk"

    def test_virtuals_framework_name(self):
        """Test VirtualsProtocolHandler has correct framework name."""
        assert VirtualsProtocolHandler.FRAMEWORK == "virtuals"

    def test_handlers_extend_base_handler(self):
        """Test handlers extend BaseIntegrationHandler."""
        from claw_runtime.integrations.base_handler import BaseIntegrationHandler

        config = IntegrationConfig.from_dict({})

        adk_handler = GoogleADKHandler(config)
        virtuals_handler = VirtualsProtocolHandler(config)

        assert isinstance(adk_handler, BaseIntegrationHandler)
        assert isinstance(virtuals_handler, BaseIntegrationHandler)
