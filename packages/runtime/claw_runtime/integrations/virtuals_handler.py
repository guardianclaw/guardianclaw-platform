"""
Virtuals Protocol Integration Handler.

This handler provides GuardianClaw protection for Virtuals Protocol GAME SDK agents.
It wraps guardianclaw.integrations.virtuals and provides:
- CLAW (Credibility, Limits, Avoidance, Worth) validation for agent actions
- Safety Worker configuration for GAME agents
- Memory integrity protection against injection attacks
- Fiduciary validation for user-aligned decisions

The handler is a thin wrapper that delegates to the SDK for actual validation.
All CLAW validation logic is in the guardianclaw SDK.

Configuration:
    {
        "block_unsafe": true,
        "log_validations": true,
        "max_transaction_amount": 1000,
        "require_confirmation_above": 100,
        "require_purpose_for": ["transfer", "send", "approve", "swap"],
        "memory_integrity_check": false,
        "memory_secret_key": null,
        "blocked_functions": ["drain_wallet", "send_all_tokens"],
        "allowed_functions": [],
        "fiduciary_enabled": true,
        "strict_fiduciary": false
    }
"""

from __future__ import annotations

import logging
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

logger = logging.getLogger("claw_runtime.integrations.virtuals")


class VirtualsProtocolHandler(BaseIntegrationHandler):
    """
    Integration handler for Virtuals Protocol GAME SDK.

    This handler wraps guardianclaw.integrations.virtuals to provide
    GuardianClaw protection for GAME SDK agents.

    The handler delegates all validation logic to the SDK. It provides:
    - ClawValidator for action validation through CLAW gates
    - GuardianClawSafetyWorker for GAME Agent integration
    - Memory integrity protection against injection attacks
    - Fiduciary validation for user-aligned decisions

    Example:
        handler = VirtualsProtocolHandler(IntegrationConfig.from_dict({
            "block_unsafe": True,
            "max_transaction_amount": 1000,
            "fiduciary_enabled": True,
        }))

        # Validate an action
        result = handler.validate_action(
            action_name="transfer",
            action_args={"amount": 50, "recipient": "0x..."},
            context={"worth": "Pay for service"},
        )

        # Get safety worker config for GAME Agent
        worker_config = handler.get_safety_worker_config()
        agent = Agent(workers=[worker_config, ...])
    """

    FRAMEWORK = "virtuals"
    DEFAULT_SEED_LEVEL = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION = OnViolation.BLOCK

    # Default blocked functions
    DEFAULT_BLOCKED_FUNCTIONS = [
        "drain_wallet",
        "send_all_tokens",
        "approve_unlimited",
        "export_private_key",
        "reveal_seed_phrase",
    ]

    # Actions that require explicit worth
    DEFAULT_REQUIRE_PURPOSE_FOR = [
        "transfer", "send", "approve", "swap", "bridge", "withdraw",
    ]

    def __init__(self, config: IntegrationConfig):
        """Initialize Virtuals Protocol handler."""
        # Extract Virtuals-specific config from framework_config
        fc = config.framework_config

        self._block_unsafe = fc.get("block_unsafe", True)
        self._log_validations = fc.get("log_validations", True)
        self._max_transaction_amount = fc.get("max_transaction_amount", 1000)
        self._require_confirmation_above = fc.get("require_confirmation_above", 100)
        self._require_purpose_for = fc.get(
            "require_purpose_for", self.DEFAULT_REQUIRE_PURPOSE_FOR
        )
        self._memory_integrity_check = fc.get("memory_integrity_check", False)
        self._memory_secret_key = fc.get("memory_secret_key")
        self._blocked_functions = fc.get(
            "blocked_functions", self.DEFAULT_BLOCKED_FUNCTIONS
        )
        self._allowed_functions = fc.get("allowed_functions", [])
        self._fiduciary_enabled = fc.get("fiduciary_enabled", True)
        self._strict_fiduciary = fc.get("strict_fiduciary", False)

        # SDK components (initialized in _create_validator)
        self._sdk_validator = None
        self._safety_worker = None
        self._game_sdk_available = False
        self._memory_integrity_available = False
        self._fiduciary_available = False

        # Call parent init (creates validator)
        super().__init__(config)

    def _create_validator(self) -> Any:
        """
        Create the Virtuals GuardianClaw validator.

        Imports from guardianclaw.integrations.virtuals and creates
        a ClawValidator configured with our settings.
        """
        try:
            from guardianclaw.integrations.virtuals import (
                ClawValidator,
                ClawConfig,
                GuardianClawSafetyWorker,
                GAME_SDK_AVAILABLE,
                MEMORY_INTEGRITY_AVAILABLE,
                FIDUCIARY_AVAILABLE,
            )

            self._game_sdk_available = GAME_SDK_AVAILABLE
            self._memory_integrity_available = MEMORY_INTEGRITY_AVAILABLE
            self._fiduciary_available = FIDUCIARY_AVAILABLE

            # Create SDK config
            sdk_config = ClawConfig(
                block_unsafe=self._block_unsafe,
                log_validations=self._log_validations,
                max_transaction_amount=self._max_transaction_amount,
                require_confirmation_above=self._require_confirmation_above,
                require_purpose_for=self._require_purpose_for,
                memory_integrity_check=self._memory_integrity_check,
                memory_secret_key=self._memory_secret_key,
                blocked_functions=self._blocked_functions,
                allowed_functions=self._allowed_functions,
            )

            # Create SDK validator
            self._sdk_validator = ClawValidator(
                config=sdk_config,
                fiduciary_enabled=self._fiduciary_enabled and self._fiduciary_available,
                strict_fiduciary=self._strict_fiduciary,
            )

            # Create safety worker instance
            if self._game_sdk_available:
                self._safety_worker = GuardianClawSafetyWorker(config=sdk_config)

            logger.info(
                f"Virtuals handler initialized: "
                f"game_sdk={self._game_sdk_available}, "
                f"memory_integrity={self._memory_integrity_available}, "
                f"fiduciary={self._fiduciary_available}"
            )

            return self._sdk_validator

        except ImportError as e:
            logger.warning(f"guardianclaw Virtuals integration not available: {e}")
            self._game_sdk_available = False
            self._memory_integrity_available = False
            self._fiduciary_available = False

            # Fallback to LayeredValidator
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
        Execute Virtuals-specific logic.

        For Virtuals, this validates the current state and returns config.
        The main integration is through validate_action() and the safety worker.
        """
        current_input = state.get("current_input", state.get("initial_input", ""))

        # Validate input as a generic action
        validation_result = self.validate_action(
            action_name="process_input",
            action_args={"input": current_input},
            context=state.get("context", {}),
        )

        if not validation_result.get("passed", True) and self._block_unsafe:
            return IntegrationResult(
                success=False,
                error=f"Action blocked: {validation_result.get('concerns', [])}",
                validation_input=self._convert_action_result_to_validation(validation_result),
            )

        return IntegrationResult(
            success=True,
            data={
                "block_unsafe": self._block_unsafe,
                "max_transaction_amount": self._max_transaction_amount,
                "require_confirmation_above": self._require_confirmation_above,
                "game_sdk_available": self._game_sdk_available,
                "fiduciary_enabled": self._fiduciary_enabled,
            },
            validation_input=self._convert_action_result_to_validation(validation_result),
            metadata={
                "game_sdk_available": self._game_sdk_available,
                "memory_integrity_available": self._memory_integrity_available,
                "fiduciary_available": self._fiduciary_available,
            },
        )

    def _validate_input_internal(self, text: str) -> ValidationResult:
        """
        Validate input using the SDK validator.

        Delegates to ClawValidator.validate() which performs
        full CLAW validation including crypto-specific checks.
        """
        if not self._sdk_validator:
            return ValidationResult.passed(decided_by="no_validator")

        try:
            # Use SDK validator - validate() expects action_name, action_args, context
            sdk_result = self._sdk_validator.validate(
                action_name="validate_text",
                action_args={"text": text},
                context={},
            )

            # Convert ValidationResult from SDK to our format
            if sdk_result.passed:
                return ValidationResult.passed(decided_by="sdk")

            violations = []
            for concern in sdk_result.concerns:
                violations.append(Violation(
                    type=f"input:{sdk_result.blocked_gate or 'validation'}",
                    message=str(concern),
                    severity=ViolationSeverity.HIGH,
                ))

            return ValidationResult.failed(violations, decided_by="sdk")

        except Exception as e:
            logger.debug(f"SDK validation failed: {e}")
            return ValidationResult.passed(decided_by="sdk_error")

    def _convert_action_result_to_validation(
        self,
        action_result: Dict[str, Any],
    ) -> ValidationResult:
        """Convert action validation result to ValidationResult."""
        if action_result.get("passed", True):
            return ValidationResult.passed(decided_by="action_validation")

        violations = []
        for concern in action_result.get("concerns", []):
            violations.append(Violation(
                type=f"action:{action_result.get('blocked_gate', 'unknown')}",
                message=str(concern),
                severity=ViolationSeverity.HIGH,
            ))

        return ValidationResult.failed(violations, decided_by="action_validation")

    def validate_action(
        self,
        action_name: str,
        action_args: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        worth: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validate an action through CLAW gates.

        This is the main validation method for Virtuals actions.
        It validates through Credibility, Avoidance, Limits, and Worth gates.

        Args:
            action_name: Name of the action/function to validate
            action_args: Arguments for the action
            context: Optional context (state, worker info)
            worth: Optional explicit worth statement

        Returns:
            Dictionary with validation result:
            {
                "passed": bool,
                "gate_results": {"credibility": bool, "avoidance": bool, ...},
                "concerns": ["list of concerns"],
                "blocked_gate": "name" or None
            }

        Example:
            result = handler.validate_action(
                action_name="transfer",
                action_args={"amount": 100, "recipient": "0x..."},
                worth="Payment for service rendered",
            )
            if result["passed"]:
                # Proceed with action
            else:
                # Handle block
        """
        if context is None:
            context = {}
        if worth:
            context["worth"] = worth

        if not self._sdk_validator:
            return {
                "passed": True,
                "gate_results": {"credibility": True, "avoidance": True, "limits": True, "worth": True},
                "concerns": [],
                "blocked_gate": None,
            }

        try:
            sdk_result = self._sdk_validator.validate(
                action_name=action_name,
                action_args=action_args,
                context=context,
            )

            return {
                "passed": sdk_result.passed,
                "gate_results": sdk_result.gate_results,
                "concerns": sdk_result.concerns,
                "blocked_gate": sdk_result.blocked_gate,
            }

        except Exception as e:
            logger.error(f"Action validation failed: {e}")
            return {
                "passed": False,
                "gate_results": {"credibility": True, "avoidance": False, "limits": True, "worth": True},
                "concerns": [f"Validation error: {e}"],
                "blocked_gate": "avoidance",
            }

    def get_safety_worker_config(self) -> Any:
        """
        Get a WorkerConfig for use with GAME Agent.

        The safety worker provides check_action_safety() function that
        other workers can call before performing sensitive operations.

        Returns:
            WorkerConfig or None if GAME SDK not available

        Example:
            worker_config = handler.get_safety_worker_config()
            agent = Agent(
                api_key=api_key,
                name="MyAgent",
                workers=[worker_config, other_workers...],
            )
        """
        if not self._game_sdk_available:
            logger.warning("GAME SDK not available, cannot create worker config")
            return None

        if self._safety_worker:
            try:
                from guardianclaw.integrations.virtuals import ClawConfig

                config = ClawConfig(
                    block_unsafe=self._block_unsafe,
                    log_validations=self._log_validations,
                    max_transaction_amount=self._max_transaction_amount,
                    require_confirmation_above=self._require_confirmation_above,
                    require_purpose_for=self._require_purpose_for,
                    memory_integrity_check=self._memory_integrity_check,
                    memory_secret_key=self._memory_secret_key,
                    blocked_functions=self._blocked_functions,
                    allowed_functions=self._allowed_functions,
                )

                from guardianclaw.integrations.virtuals import GuardianClawSafetyWorker
                return GuardianClawSafetyWorker.create_worker_config(config)

            except Exception as e:
                logger.error(f"Could not create worker config: {e}")

        return None

    def sign_state_entry(
        self,
        key: str,
        value: Any,
        source: str = "agent_internal",
    ) -> Dict[str, Any]:
        """
        Sign a state entry for integrity verification.

        Uses HMAC to protect state entries from tampering.
        This is a defense against memory injection attacks.

        Args:
            key: State key
            value: State value
            source: Source identifier (user_direct, agent_internal, etc.)

        Returns:
            Dictionary with signed entry data

        Example:
            signed = handler.sign_state_entry(
                key="user_preference",
                value={"risk_tolerance": "low"},
                source="user_direct",
            )
            # Store signed in agent state
        """
        if not self._safety_worker:
            return {"key": key, "value": value, "signed": False}

        try:
            return self._safety_worker.sign_state_entry(key, value, source)
        except Exception as e:
            logger.debug(f"Could not sign entry: {e}")
            return {"key": key, "value": value, "signed": False, "error": str(e)}

    def verify_state_entry(self, entry_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verify a signed state entry's integrity.

        Checks the HMAC signature to ensure the entry hasn't been tampered with.

        Args:
            entry_data: Dictionary containing entry and signature

        Returns:
            Dictionary with verification result

        Example:
            result = handler.verify_state_entry(signed_entry)
            if result["valid"]:
                # Trust the data
            else:
                # Data may have been tampered with
        """
        if not self._safety_worker:
            return {"valid": True, "reason": "Memory integrity check not enabled"}

        try:
            return self._safety_worker.verify_state_entry(entry_data)
        except Exception as e:
            logger.debug(f"Could not verify entry: {e}")
            return {"valid": False, "reason": f"Verification error: {e}"}

    def verify_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Verify all signed entries in a state dictionary.

        Batch verification of multiple state entries.

        Args:
            state: State dictionary with signed entries

        Returns:
            Dictionary with verification results
        """
        if not self._safety_worker:
            return {"all_valid": True, "checked": 0, "results": {}}

        try:
            return self._safety_worker.verify_state(state)
        except Exception as e:
            logger.debug(f"Could not verify state: {e}")
            return {"all_valid": False, "checked": 0, "error": str(e)}

    def block_function(self, function_name: str) -> bool:
        """
        Add a function to the blocked list at runtime.

        Args:
            function_name: Name of function to block

        Returns:
            True if added, False if already blocked
        """
        if function_name not in self._blocked_functions:
            self._blocked_functions.append(function_name)
            logger.info(f"Function '{function_name}' added to blocked list")
            return True
        return False

    def unblock_function(self, function_name: str) -> bool:
        """
        Remove a function from the blocked list.

        Args:
            function_name: Name of function to unblock

        Returns:
            True if removed, False if not found
        """
        if function_name in self._blocked_functions:
            self._blocked_functions.remove(function_name)
            logger.info(f"Function '{function_name}' removed from blocked list")
            return True
        return False

    def update_transaction_limits(
        self,
        max_amount: Optional[float] = None,
        confirmation_threshold: Optional[float] = None,
    ) -> None:
        """
        Update transaction limits at runtime.

        Args:
            max_amount: New maximum transaction amount
            confirmation_threshold: New confirmation threshold
        """
        if max_amount is not None:
            self._max_transaction_amount = max_amount
            logger.info(f"Max transaction amount updated to {max_amount}")

        if confirmation_threshold is not None:
            self._require_confirmation_above = confirmation_threshold
            logger.info(f"Confirmation threshold updated to {confirmation_threshold}")

    def get_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        base_stats = {
            "framework": self.FRAMEWORK,
            "game_sdk_available": self._game_sdk_available,
            "memory_integrity_available": self._memory_integrity_available,
            "fiduciary_available": self._fiduciary_available,
        }

        # Get stats from SDK validator
        if self._sdk_validator and hasattr(self._sdk_validator, 'get_stats'):
            try:
                sdk_stats = self._sdk_validator.get_stats()
                base_stats.update(sdk_stats)
            except Exception as e:
                logger.debug(f"Could not get SDK stats: {e}")
                base_stats.update(self._stats)
        else:
            base_stats.update(self._stats)

        return base_stats

    def get_fiduciary_stats(self) -> Dict[str, Any]:
        """Get fiduciary validation statistics."""
        if self._sdk_validator and hasattr(self._sdk_validator, 'get_fiduciary_stats'):
            try:
                return self._sdk_validator.get_fiduciary_stats()
            except Exception as e:
                logger.debug(f"Could not get fiduciary stats: {e}")

        return {"enabled": self._fiduciary_enabled and self._fiduciary_available}

    def get_config(self) -> Dict[str, Any]:
        """Get current configuration."""
        return {
            "block_unsafe": self._block_unsafe,
            "log_validations": self._log_validations,
            "max_transaction_amount": self._max_transaction_amount,
            "require_confirmation_above": self._require_confirmation_above,
            "require_purpose_for": self._require_purpose_for,
            "memory_integrity_check": self._memory_integrity_check,
            "blocked_functions": self._blocked_functions,
            "allowed_functions": self._allowed_functions,
            "fiduciary_enabled": self._fiduciary_enabled,
            "strict_fiduciary": self._strict_fiduciary,
            "game_sdk_available": self._game_sdk_available,
            "memory_integrity_available": self._memory_integrity_available,
            "fiduciary_available": self._fiduciary_available,
        }

    def is_ready(self) -> bool:
        """Check if handler is ready for execution."""
        return self._validator is not None or self._sdk_validator is not None


# Register the handler
def _register():
    """Register Virtuals handler on module import."""
    try:
        from claw_runtime.integrations import register_handler
        register_handler("virtuals", handler_class=VirtualsProtocolHandler)
    except ImportError:
        pass


_register()
