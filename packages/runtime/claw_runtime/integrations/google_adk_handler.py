"""
Google ADK Integration Handler.

This handler provides GuardianClaw protection for Google Agent Development Kit agents.
It wraps the guardianclaw.integrations.google_adk module and provides:
- Plugin-based validation for Runner instances
- Callback-based validation for individual agents
- Configurable validation behavior

The handler is a thin wrapper that delegates to the SDK for actual validation.
All CLAW validation logic is in the guardianclaw SDK.

Configuration:
    {
        "seed_level": "standard",
        "block_on_failure": true,
        "fail_closed": false,
        "validate_inputs": true,
        "validate_outputs": true,
        "validate_tools": true,
        "max_text_size": 100000,
        "validation_timeout": 5.0,
        "blocked_message": "Request blocked by safety validation.",
        "log_violations": true
    }
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Callable

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

logger = logging.getLogger("claw_runtime.integrations.google_adk")


class GoogleADKHandler(BaseIntegrationHandler):
    """
    Integration handler for Google Agent Development Kit.

    This handler wraps guardianclaw.integrations.google_adk to provide
    GuardianClaw protection for Google ADK agents.

    The handler delegates all validation logic to the SDK. It provides:
    - Plugin for Runner instances (applies to all agents)
    - Callbacks for individual LlmAgent instances

    Example:
        handler = GoogleADKHandler(IntegrationConfig.from_dict({
            "seed_level": "standard",
            "block_on_failure": True,
        }))

        # Get plugin for Runner (recommended for multi-agent systems)
        plugin = handler.get_plugin()
        runner = Runner(
            app_name="my_app",
            agent=agent,
            plugins=[plugin],
            session_service=session_service,
        )

        # Or get callbacks for individual agent
        callbacks = handler.get_callbacks()
        agent = LlmAgent(name="Agent", model="gemini-2.0-flash", **callbacks)
    """

    FRAMEWORK = "google_adk"
    DEFAULT_SEED_LEVEL = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION = OnViolation.BLOCK

    # Valid seed levels
    VALID_SEED_LEVELS = ("minimal", "standard", "full")

    def __init__(self, config: IntegrationConfig):
        """Initialize Google ADK handler."""
        # Extract Google ADK-specific config from framework_config
        fc = config.framework_config

        self._seed_level = fc.get("seed_level", "standard")
        self._block_on_failure = fc.get("block_on_failure", True)
        self._fail_closed = fc.get("fail_closed", False)
        self._validate_inputs = fc.get("validate_inputs", True)
        self._validate_outputs = fc.get("validate_outputs", True)
        self._validate_tools = fc.get("validate_tools", True)
        self._max_text_size = fc.get("max_text_size", 100000)
        self._validation_timeout = fc.get("validation_timeout", 5.0)
        self._blocked_message = fc.get(
            "blocked_message", "Request blocked by safety validation."
        )
        self._log_violations = fc.get("log_violations", True)

        # Validate seed level
        if self._seed_level not in self.VALID_SEED_LEVELS:
            logger.warning(
                f"Invalid seed_level '{self._seed_level}', using 'standard'"
            )
            self._seed_level = "standard"

        # SDK components (initialized in _create_validator)
        self._plugin = None
        self._adk_available = False

        # Call parent init (creates validator)
        super().__init__(config)

    def _create_validator(self) -> Any:
        """
        Create the Google ADK GuardianClaw validator.

        Imports from guardianclaw.integrations.google_adk and creates
        a GuardianClawPlugin configured with our settings.
        """
        try:
            from guardianclaw.integrations.google_adk import (
                GuardianClawPlugin,
                create_claw_plugin,
                ADK_AVAILABLE,
            )

            self._adk_available = ADK_AVAILABLE

            # Create plugin with our configuration
            self._plugin = create_claw_plugin(
                seed_level=self._seed_level,
                block_on_failure=self._block_on_failure,
                fail_closed=self._fail_closed,
                validate_inputs=self._validate_inputs,
                validate_outputs=self._validate_outputs,
                validate_tools=self._validate_tools,
                max_text_size=self._max_text_size,
                validation_timeout=self._validation_timeout,
                log_violations=self._log_violations,
                blocked_message=self._blocked_message,
            )

            logger.info(
                f"Google ADK handler initialized: "
                f"seed_level={self._seed_level}, "
                f"adk_available={self._adk_available}"
            )

            # Return the plugin as the validator (used for validation methods)
            return self._plugin

        except ImportError as e:
            logger.warning(f"guardianclaw Google ADK integration not available: {e}")
            self._adk_available = False
            self._plugin = None

            # Fallback to LayeredValidator
            try:
                from guardianclaw.validation import LayeredValidator, ValidationConfig

                validator_config = ValidationConfig(
                    use_heuristic=True,
                    use_semantic=False,
                    max_text_size=self._max_text_size,
                    validation_timeout=self._validation_timeout,
                    fail_closed=self._fail_closed,
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
        Execute Google ADK-specific logic.

        For Google ADK, the main integration is through plugins/callbacks.
        This method validates input and returns configuration info.
        """
        current_input = state.get("current_input", state.get("initial_input", ""))

        # Validate input if enabled
        if self._validate_inputs:
            input_result = self.validate_input(current_input)
            if input_result.blocked and self.config.on_violation == OnViolation.BLOCK:
                return IntegrationResult(
                    success=False,
                    error=f"Input blocked: {[v.type for v in input_result.violations]}",
                    validation_input=input_result,
                )
        else:
            input_result = ValidationResult.passed(decided_by="input_validation_disabled")

        # Return integration configuration
        return IntegrationResult(
            success=True,
            data={
                "seed_level": self._seed_level,
                "block_on_failure": self._block_on_failure,
                "fail_closed": self._fail_closed,
                "validate_inputs": self._validate_inputs,
                "validate_outputs": self._validate_outputs,
                "validate_tools": self._validate_tools,
                "adk_available": self._adk_available,
            },
            validation_input=input_result,
            metadata={
                "seed_level": self._seed_level,
                "adk_available": self._adk_available,
            },
        )

    def _validate_input_internal(self, text: str) -> ValidationResult:
        """
        Validate input using the SDK plugin.

        Delegates to the GuardianClawPlugin or LayeredValidator.
        """
        if not self._validator:
            return ValidationResult.passed(decided_by="no_validator")

        # If we have the full plugin, use its validation
        if self._plugin and hasattr(self._plugin, 'validate'):
            try:
                sdk_result = self._plugin.validate(text)
                return self._convert_sdk_result(sdk_result, "input")
            except Exception as e:
                logger.debug(f"Plugin validation failed: {e}")

        # Fallback to inherited validation (uses LayeredValidator)
        if hasattr(self._validator, 'validate'):
            try:
                sdk_result = self._validator.validate(text)
                return self._convert_validation_result(sdk_result, "input")
            except Exception as e:
                logger.debug(f"Validator failed: {e}")

        return ValidationResult.passed(decided_by="no_validation_method")

    def _convert_validation_result(
        self,
        sdk_result: Any,
        stage: str,
    ) -> ValidationResult:
        """
        Convert SDK ValidationResult to our ValidationResult.

        Handles the guardianclaw.validation.ValidationResult format.
        """
        # Handle ValidationResult from guardianclaw.validation
        if hasattr(sdk_result, 'is_safe'):
            if sdk_result.is_safe:
                return ValidationResult.passed(decided_by="sdk")

            violations = []
            for v in getattr(sdk_result, 'violations', []) or []:
                violations.append(Violation(
                    type=f"{stage}:violation",
                    message=str(v),
                    severity=ViolationSeverity.HIGH,
                ))

            return ValidationResult.failed(violations, decided_by="sdk")

        # Use parent's conversion for other formats
        return self._convert_sdk_result(sdk_result, stage)

    def get_plugin(self) -> Any:
        """
        Get the GuardianClawPlugin for use with Google ADK Runner.

        The plugin applies safety validation to all agents in the Runner.

        Example:
            plugin = handler.get_plugin()
            runner = Runner(
                app_name="my_app",
                agent=agent,
                plugins=[plugin],
                session_service=session_service,
            )

        Returns:
            GuardianClawPlugin or None if not available
        """
        return self._plugin

    def get_callbacks(self) -> Dict[str, Callable]:
        """
        Get callback functions for individual agent validation.

        Returns callbacks that can be unpacked into LlmAgent constructor.

        Example:
            callbacks = handler.get_callbacks()
            agent = LlmAgent(
                name="Agent",
                model="gemini-2.0-flash",
                **callbacks,
            )

        Returns:
            Dictionary with callback functions, or empty dict if unavailable
        """
        if not self._adk_available:
            logger.warning("ADK not available, returning empty callbacks")
            return {}

        try:
            from guardianclaw.integrations.google_adk import create_claw_callbacks

            # Only pass parameters that the SDK function accepts
            return create_claw_callbacks(
                seed_level=self._seed_level,
                block_on_failure=self._block_on_failure,
                fail_closed=self._fail_closed,
                validate_inputs=self._validate_inputs,
                validate_outputs=self._validate_outputs,
                validate_tools=self._validate_tools,
            )

        except ImportError as e:
            logger.warning(f"Could not create callbacks: {e}")
            return {}

    def get_stats(self) -> Dict[str, Any]:
        """
        Get validation statistics from the plugin.

        Returns statistics tracked by the SDK plugin including
        total validations, blocks, errors, and timing.
        """
        base_stats = {
            "framework": self.FRAMEWORK,
            "adk_available": self._adk_available,
        }

        # Get stats from plugin if available
        if self._plugin and hasattr(self._plugin, 'get_stats'):
            try:
                plugin_stats = self._plugin.get_stats()
                base_stats.update(plugin_stats)
            except Exception as e:
                logger.debug(f"Could not get plugin stats: {e}")
                base_stats.update(self._stats)
        else:
            base_stats.update(self._stats)

        return base_stats

    def get_violations(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get recent violations from the plugin.

        Returns violations tracked by the SDK plugin.
        """
        if self._plugin and hasattr(self._plugin, 'get_violations'):
            try:
                violations = self._plugin.get_violations()
                return violations[-limit:] if len(violations) > limit else violations
            except Exception as e:
                logger.debug(f"Could not get violations: {e}")

        return []

    def clear_violations(self) -> None:
        """Clear all stored violations in the plugin."""
        if self._plugin and hasattr(self._plugin, 'clear_violations'):
            try:
                self._plugin.clear_violations()
            except Exception as e:
                logger.debug(f"Could not clear violations: {e}")

    def reset_stats(self) -> None:
        """Reset validation statistics in the plugin."""
        if self._plugin and hasattr(self._plugin, 'reset_stats'):
            try:
                self._plugin.reset_stats()
            except Exception as e:
                logger.debug(f"Could not reset stats: {e}")

        # Also reset base stats
        self._stats = {
            "validations": 0,
            "blocks": 0,
            "passes": 0,
            "errors": 0,
            "total_latency_ms": 0.0,
        }

    def get_config(self) -> Dict[str, Any]:
        """
        Get current configuration.

        Returns:
            Configuration dictionary
        """
        return {
            "seed_level": self._seed_level,
            "block_on_failure": self._block_on_failure,
            "fail_closed": self._fail_closed,
            "validate_inputs": self._validate_inputs,
            "validate_outputs": self._validate_outputs,
            "validate_tools": self._validate_tools,
            "max_text_size": self._max_text_size,
            "validation_timeout": self._validation_timeout,
            "log_violations": self._log_violations,
            "adk_available": self._adk_available,
            "has_plugin": self._plugin is not None,
        }

    def is_ready(self) -> bool:
        """Check if the handler is ready for execution."""
        return self._validator is not None or self._plugin is not None


# Register the handler
def _register():
    """Register Google ADK handler on module import."""
    try:
        from claw_runtime.integrations import register_handler
        register_handler("google_adk", handler_class=GoogleADKHandler)
    except ImportError:
        pass


_register()
