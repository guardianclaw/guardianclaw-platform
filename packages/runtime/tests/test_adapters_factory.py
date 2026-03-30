"""
Tests for create_claw_adapter factory function.

These tests verify:
- Factory creates correct adapter type
- Configuration is passed through correctly
- Default configuration handling
"""

import pytest
from unittest.mock import patch, MagicMock


class TestCreateGuardianClawAdapter:
    """Tests for the create_claw_adapter factory function."""

    @patch("claw_runtime.adapters.GuardianClawAdapter")
    def test_create_with_auto_version(self, mock_adapter_class):
        """Test creating adapter with auto version detection."""
        from claw_runtime.adapters import create_claw_adapter

        mock_adapter = MagicMock()
        mock_adapter_class.return_value = mock_adapter

        adapter = create_claw_adapter(version="auto")

        assert mock_adapter_class.called
        assert adapter is mock_adapter

    @patch("claw_runtime.adapters.GuardianClawAdapter")
    def test_create_with_config(self, mock_adapter_class):
        """Test creating adapter with custom configuration."""
        from claw_runtime.adapters import create_claw_adapter

        mock_adapter = MagicMock()
        mock_adapter_class.return_value = mock_adapter

        config = {
            "protection_level": "maximum",
            "gate3_enabled": True,
        }

        adapter = create_claw_adapter(config=config)

        # Verify config was passed to adapter
        call_args = mock_adapter_class.call_args
        assert call_args[0][0] == config

    @patch("claw_runtime.adapters.GuardianClawAdapter")
    def test_create_with_none_config(self, mock_adapter_class):
        """Test creating adapter with None config uses empty dict."""
        from claw_runtime.adapters import create_claw_adapter

        mock_adapter = MagicMock()
        mock_adapter_class.return_value = mock_adapter

        adapter = create_claw_adapter(config=None)

        # Verify empty config was passed
        call_args = mock_adapter_class.call_args
        assert call_args[0][0] == {}

    @patch("claw_runtime.adapters.GuardianClawAdapter")
    def test_create_v3_version(self, mock_adapter_class):
        """Test creating adapter with explicit v3 version."""
        from claw_runtime.adapters import create_claw_adapter

        mock_adapter = MagicMock()
        mock_adapter_class.return_value = mock_adapter

        adapter = create_claw_adapter(version="v3")

        assert mock_adapter_class.called

    @patch("claw_runtime.adapters.GuardianClawAdapter")
    def test_create_v2_version(self, mock_adapter_class):
        """Test creating adapter with v2 version (uses same adapter)."""
        from claw_runtime.adapters import create_claw_adapter

        mock_adapter = MagicMock()
        mock_adapter_class.return_value = mock_adapter

        # v2 should still work (uses same ClawValidator under the hood)
        adapter = create_claw_adapter(version="v2")

        assert mock_adapter_class.called


class TestAdapterExports:
    """Tests for module exports."""

    def test_exports_create_claw_adapter(self):
        """Test that create_claw_adapter is exported."""
        from claw_runtime.adapters import create_claw_adapter

        assert callable(create_claw_adapter)

    def test_exports_claw_adapter_class(self):
        """Test that GuardianClawAdapter class is exported."""
        from claw_runtime.adapters import GuardianClawAdapter

        assert GuardianClawAdapter is not None
