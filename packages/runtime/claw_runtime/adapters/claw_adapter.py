"""
GuardianClaw Adapter - Unified interface to GuardianClaw SDK.

This adapter wraps the ClawValidator (v3.0 architecture) and provides
a consistent interface for the runtime, following ADR-004 specification.

The adapter handles:
- Configuration mapping from runtime config to ClawConfig
- Result normalization to ValidationResultDict
- Statistics aggregation
- Error handling with fail-safe options
"""

from __future__ import annotations

import logging
import time
from typing import Optional, List, Dict, Any

from guardianclaw import ClawValidator, ClawConfig, GuardianClawResult
from guardianclaw.core import Gate4Fallback, BlockMessages
from claw_runtime.interfaces import (
    ValidationResultDict,
    StatsDict,
    ClawConfigDict,
    ConversationHistory,
)

logger = logging.getLogger("claw_runtime.adapters.claw_adapter")


# Protection level presets
#
# Gate4Fallback policies:
# - ALLOW: L4 is optional, always allow if L4 fails (max usability)
# - ALLOW_IF_L2_PASSED: Allow only if L2 heuristics passed (balanced)
# - BLOCK: Block if L4 unavailable (max security)
#
# Retry configuration:
# - Minimal: No retry (L4 disabled anyway)
# - Standard: 3 retries with exponential backoff
# - Maximum: 5 retries for higher reliability
#
PROTECTION_PRESETS = {
    "minimal": {
        # Gate 1 (Input validation)
        "gate1_enabled": True,
        "gate1_embedding_enabled": False,
        # Gate 2 (Output validation)
        "gate2_enabled": True,
        "gate2_embedding_enabled": False,
        "gate2_confidence_threshold": 0.9,
        # Gate 4 (L4 Observer) - Disabled for minimal
        "gate4_enabled": False,
        "gate4_model": "gpt-4o-mini",
        "gate4_fallback": Gate4Fallback.ALLOW,
        "gate4_retry_enabled": False,
        "gate4_retry_max_attempts": 1,
        # General
        "fail_closed": False,
        # Legacy aliases (for backward compatibility with tests)
        "gate3_enabled": False,
        "gate3_model": "gpt-4o-mini",
    },
    "standard": {
        # Gate 1 (Input validation)
        "gate1_enabled": True,
        "gate1_embedding_enabled": True,
        # Gate 2 (Output validation)
        "gate2_enabled": True,
        "gate2_embedding_enabled": True,
        "gate2_confidence_threshold": 0.75,
        # Gate 4 (L4 Observer) - Disabled by default, but with balanced fallback
        "gate4_enabled": False,
        "gate4_model": "gpt-4o-mini",
        "gate4_fallback": Gate4Fallback.ALLOW_IF_L2_PASSED,
        "gate4_retry_enabled": True,
        "gate4_retry_max_attempts": 3,
        # General
        "fail_closed": False,
        # Legacy aliases (for backward compatibility with tests)
        "gate3_enabled": False,
        "gate3_model": "gpt-4o-mini",
    },
    "maximum": {
        # Gate 1 (Input validation)
        "gate1_enabled": True,
        "gate1_embedding_enabled": True,
        # Gate 2 (Output validation)
        "gate2_enabled": True,
        "gate2_embedding_enabled": True,
        "gate2_confidence_threshold": 0.5,
        # Gate 4 (L4 Observer) - Enabled with strict fallback
        "gate4_enabled": True,
        "gate4_model": "gpt-4o-mini",
        "gate4_fallback": Gate4Fallback.BLOCK,
        "gate4_retry_enabled": True,
        "gate4_retry_max_attempts": 5,
        # General
        "fail_closed": True,
        # Legacy aliases (for backward compatibility with tests)
        "gate3_enabled": True,
        "gate3_model": "gpt-4o-mini",
    },
}


class GuardianClawAdapter:
    """
    Adapter for GuardianClaw SDK v3.0 (ClawValidator).

    Provides a unified interface for input and output validation,
    following the ADR-004 SDK Abstraction Layer specification.

    Attributes:
        config: Runtime configuration dictionary
        validator: ClawValidator instance
    """

    def __init__(self, config: Optional[ClawConfigDict] = None):
        """
        Initialize the GuardianClaw adapter.

        Args:
            config: Runtime configuration. Can include:
                - protection_level: "minimal", "standard", "maximum"
                - Individual gate settings
                - CLAW gates toggle
        """
        self._raw_config = config or {}
        self._stats = {
            # Core statistics
            "total_validations": 0,
            "blocked_count": 0,
            "passed_count": 0,
            # Gate-specific blocks
            "gate1_blocks": 0,
            "gate2_blocks": 0,
            "gate3_blocks": 0,  # Legacy alias for gate4_blocks
            "gate4_blocks": 0,
            # Gate 4 (L4) calls
            "gate3_calls": 0,   # Legacy alias for gate4_calls
            "gate4_calls": 0,
            # L4 Fallback statistics (v2.24)
            "l4_fallback_triggers": 0,
            "l4_fallback_blocks": 0,
            "l4_fallback_allows": 0,
            # Retry statistics (v2.24)
            "retry_count": 0,
            "retry_success_count": 0,
            # Latency
            "total_latency_ms": 0.0,
        }

        # Build ClawConfig from runtime config
        claw_config = self._build_claw_config(self._raw_config)
        self._validator = ClawValidator(config=claw_config)

        logger.info(
            f"GuardianClawAdapter initialized: "
            f"protection_level={self._raw_config.get('protection_level', 'standard')}"
        )

    def _build_claw_config(self, config: ClawConfigDict) -> ClawConfig:
        """
        Build ClawConfig from runtime configuration.

        Handles protection level presets, individual gate settings, and
        Gate 4 fallback/retry configuration introduced in SDK v2.24.
        """
        # Start with protection level preset if specified
        protection_level = config.get("protection_level", "standard")
        preset = PROTECTION_PRESETS.get(protection_level, PROTECTION_PRESETS["standard"])

        # Override with explicit settings
        merged = {**preset}
        for key, value in config.items():
            if key != "protection_level" and key != "gates" and value is not None:
                merged[key] = value

        # Handle legacy gate3_* to gate4_* mapping from user config
        # If user passes gate3_enabled, treat it as gate4_enabled override
        if "gate3_enabled" in config and config["gate3_enabled"] is not None:
            merged["gate4_enabled"] = config["gate3_enabled"]
        if "gate3_model" in config and config["gate3_model"] is not None:
            merged["gate4_model"] = config["gate3_model"]
        if "gate3_provider" in config and config["gate3_provider"] is not None:
            merged["gate4_provider"] = config["gate3_provider"]
        if "gate3_api_key" in config and config["gate3_api_key"] is not None:
            merged["gate4_api_key"] = config["gate3_api_key"]
        if "gate3_timeout" in config and config["gate3_timeout"] is not None:
            merged["gate4_timeout"] = config["gate3_timeout"]

        # Handle CLAW gates toggle (legacy compatibility)
        gates = config.get("gates", {})
        if gates:
            # If any gate is disabled, adjust validation accordingly
            if not gates.get("avoidance", True):
                merged["gate2_embedding_enabled"] = False
            if not gates.get("limits", True):
                merged["gate1_embedding_enabled"] = False

        # Resolve Gate 4 fallback policy
        # Can be passed as enum or string
        gate4_fallback = merged.get("gate4_fallback", Gate4Fallback.ALLOW_IF_L2_PASSED)
        if isinstance(gate4_fallback, str):
            # Convert string to enum
            fallback_map = {
                "block": Gate4Fallback.BLOCK,
                "allow_if_l2_passed": Gate4Fallback.ALLOW_IF_L2_PASSED,
                "allow": Gate4Fallback.ALLOW,
            }
            gate4_fallback = fallback_map.get(gate4_fallback.lower(), Gate4Fallback.ALLOW_IF_L2_PASSED)

        # Determine gate4_enabled
        gate4_enabled = merged.get("gate4_enabled", False)

        # Create ClawConfig with v2.24 parameters
        return ClawConfig(
            # Gate 1 (Input validation)
            gate1_enabled=merged.get("gate1_enabled", True),
            gate1_embedding_enabled=merged.get("gate1_embedding_enabled", True),
            gate1_embedding_threshold=merged.get("gate1_embedding_threshold", 0.55),
            # Gate 2 (Output validation)
            gate2_enabled=merged.get("gate2_enabled", True),
            gate2_embedding_enabled=merged.get("gate2_embedding_enabled", True),
            gate2_embedding_threshold=merged.get("gate2_embedding_threshold", 0.50),
            gate2_confidence_threshold=merged.get("gate2_confidence_threshold", 0.75),
            # Gate 4 (L4 Observer) - SDK v2.24 uses gate4_* params
            gate4_enabled=gate4_enabled,
            gate4_provider=merged.get("gate4_provider", merged.get("gate3_provider", "openai")),
            gate4_model=merged.get("gate4_model", merged.get("gate3_model", "gpt-4o-mini")),
            gate4_api_key=merged.get("gate4_api_key", merged.get("gate3_api_key")),
            gate4_timeout=merged.get("gate4_timeout", merged.get("gate3_timeout", 30)),
            gate4_base_url=merged.get("gate4_base_url"),
            gate4_fallback=gate4_fallback,
            # Retry configuration (v2.24)
            gate4_retry_enabled=merged.get("gate4_retry_enabled", True),
            gate4_retry_max_attempts=merged.get("gate4_retry_max_attempts", 3),
            gate4_retry_initial_delay=merged.get("gate4_retry_initial_delay", 1.0),
            gate4_retry_max_delay=merged.get("gate4_retry_max_delay", 30.0),
            # General
            fail_closed=merged.get("fail_closed", False),
        )

    def validate_input(
        self,
        text: str,
        conversation_history: Optional[ConversationHistory] = None,
    ) -> ValidationResultDict:
        """
        Validate user input before sending to AI (Gate 1).

        This should be called before the LLM call to block obvious attacks.
        When conversation_history is provided, enables detection of multi-turn
        escalation attacks (Crescendo, MHJ) via the EscalationDetector.

        Args:
            text: User's input message
            conversation_history: Optional list of previous conversation turns.
                Each turn is {"role": "user"|"assistant", "content": "..."}.
                When provided, enables Q6 escalation detection in Gate 1.
                Maximum 10 turns are used for analysis.

        Returns:
            ValidationResultDict with validation result

        Example:
            # Multi-turn validation
            history = [
                {"role": "user", "content": "Tell me about chemistry"},
                {"role": "assistant", "content": "Chemistry is..."},
            ]
            result = adapter.validate_input("Now the dangerous stuff", history)
        """
        start_time = time.time()
        self._stats["total_validations"] += 1

        try:
            # Use Gate 1 directly with context when history is provided
            # This enables EscalationDetector for multi-turn attack detection
            if conversation_history and self._validator.gate1:
                # Truncate to max 10 turns as recommended
                truncated_history = conversation_history[-10:]
                context: Dict[str, Any] = {"previous_messages": truncated_history}

                # Call InputValidator directly with context
                gate1_result = self._validator.gate1.validate(text, context=context)

                latency_ms = (time.time() - start_time) * 1000
                self._stats["total_latency_ms"] += latency_ms

                # Log multi-turn analysis
                logger.info(
                    "Multi-turn input validation completed",
                    extra={
                        "history_turns": len(truncated_history),
                        "escalation_detected": gate1_result.is_attack,
                        "latency_ms": latency_ms,
                    }
                )

                # Convert InputValidationResult to GuardianClawResult for normalization
                # This maintains compatibility with _normalize_result()
                if gate1_result.is_attack and gate1_result.blocked:
                    self._stats["blocked_count"] += 1
                    from guardianclaw.core import GuardianClawResult as SR
                    result = SR.blocked_by_gate1(
                        gate1_result=gate1_result,
                        latency_ms=latency_ms,
                        user_message="Input blocked by security filter.",
                    )
                else:
                    from guardianclaw.core import GuardianClawResult as SR
                    result = SR(
                        blocked=False,
                        allowed=True,
                        decided_by="gate1",
                        gate1_result=gate1_result,
                        confidence=1.0 - gate1_result.confidence if gate1_result.is_attack else 1.0,
                        reasoning="Input passed Gate 1 with multi-turn analysis",
                        latency_ms=latency_ms,
                    )

                return self._normalize_result(result, "input", latency_ms)

            # Standard validation without history
            result = self._validator.validate_input(text)
            latency_ms = (time.time() - start_time) * 1000
            self._stats["total_latency_ms"] += latency_ms

            return self._normalize_result(result, "input", latency_ms)

        except Exception as e:
            logger.error(f"Input validation error: {e}")
            latency_ms = (time.time() - start_time) * 1000
            self._stats["total_latency_ms"] += latency_ms

            # Return error result
            return {
                "is_safe": not self._raw_config.get("fail_closed", False),
                "blocked": self._raw_config.get("fail_closed", False),
                "confidence": 0.0,
                "reason": f"Validation error: {str(e)}",
                "violations": ["error:validation_failed"],
                "gate": "error",
                "metadata": {"error": str(e), "latency_ms": latency_ms},
            }

    def validate_output(
        self,
        output: str,
        input_context: Optional[str] = None,
        conversation_history: Optional[ConversationHistory] = None,
    ) -> ValidationResultDict:
        """
        Validate AI output before returning to user (Gates 2 + 4).

        IMPORTANT: input_context should always be provided for proper
        Gate 4 evaluation if enabled. Gate 4 needs the full dialogue.

        Args:
            output: AI's response to validate
            input_context: Original user input (required for Gate 4)
            conversation_history: Optional list of previous conversation turns.
                Each turn is {"role": "user"|"assistant", "content": "..."}.
                When provided, enables Q6 escalation detection in Gate 4.
                Maximum 10 turns are used for analysis.

                NOTE: Full Gate 4 multi-turn support requires SDK update.
                Currently, history is logged but not passed to Gate 4 LLM.
                Gate 1 (input validation) fully supports multi-turn analysis.

        Returns:
            ValidationResultDict with validation result
        """
        start_time = time.time()
        self._stats["total_validations"] += 1

        if input_context is None:
            logger.warning(
                "validate_output called without input_context. "
                "Gate 4 requires the full dialogue for proper evaluation."
            )
            input_context = ""

        # Pass conversation history to validate_dialogue for Gate 4 multi-turn analysis
        # SDK v2.25+ supports conversation_history parameter for Q6 escalation detection
        truncated_history = None
        if conversation_history:
            truncated_history = conversation_history[-10:]
            logger.info(
                "Output validation with conversation history",
                extra={
                    "history_turns": len(truncated_history),
                }
            )

        try:
            result = self._validator.validate_dialogue(
                input=input_context,
                output=output,
                conversation_history=truncated_history,
            )
            latency_ms = (time.time() - start_time) * 1000
            self._stats["total_latency_ms"] += latency_ms

            # Gate 4 calls and retry stats are tracked in _normalize_result()
            return self._normalize_result(result, "output", latency_ms)

        except Exception as e:
            logger.error(f"Output validation error: {e}")
            latency_ms = (time.time() - start_time) * 1000
            self._stats["total_latency_ms"] += latency_ms

            return {
                "is_safe": not self._raw_config.get("fail_closed", False),
                "blocked": self._raw_config.get("fail_closed", False),
                "confidence": 0.0,
                "reason": f"Validation error: {str(e)}",
                "violations": ["error:validation_failed"],
                "gate": "error",
                "metadata": {"error": str(e), "latency_ms": latency_ms},
            }

    def _normalize_result(
        self,
        result: GuardianClawResult,
        stage: str,
        latency_ms: float,
    ) -> ValidationResultDict:
        """
        Normalize GuardianClawResult to ValidationResultDict.

        Handles the conversion from SDK-specific result format to
        the runtime's standardized format. Supports both gate3 (legacy)
        and gate4 (v2.24) naming conventions.
        """
        # Update statistics
        if result.blocked:
            self._stats["blocked_count"] += 1
            gate = result.decided_by
            if gate == "gate1":
                self._stats["gate1_blocks"] += 1
            elif gate == "gate2":
                self._stats["gate2_blocks"] += 1
            elif gate in ("gate3", "gate4"):
                # Update both legacy and new stats
                self._stats["gate3_blocks"] += 1
                self._stats["gate4_blocks"] += 1
            elif gate in ("l4_unavailable", "gate4_fallback"):
                # L4 was unavailable and fallback policy decided to block
                self._stats["l4_fallback_triggers"] += 1
                self._stats["l4_fallback_blocks"] += 1
        else:
            self._stats["passed_count"] += 1
            # Check if L4 was unavailable but allowed due to fallback policy
            gate = result.decided_by
            if gate in ("l4_unavailable", "gate4_fallback"):
                self._stats["l4_fallback_triggers"] += 1
                self._stats["l4_fallback_allows"] += 1
            elif hasattr(result, "partial_validation") and result.partial_validation:
                self._stats["l4_fallback_triggers"] += 1
                self._stats["l4_fallback_allows"] += 1

        # Track Gate 4 calls from validator stats
        validator_stats = self._validator.get_stats()
        gate4_calls = validator_stats.get("gate4_calls", validator_stats.get("gate3_calls", 0))
        self._stats["gate4_calls"] = gate4_calls
        self._stats["gate3_calls"] = gate4_calls  # Legacy alias
        # Track retry statistics if available
        self._stats["retry_count"] = validator_stats.get("retry_count", 0)
        self._stats["retry_success_count"] = validator_stats.get("retry_success_count", 0)

        # Extract violations from result
        violations = []
        if result.gate1_result and result.gate1_result.is_attack:
            violations.extend(result.gate1_result.attack_types or [])
        if result.gate2_result and result.gate2_result.seed_failed:
            violations.extend(result.gate2_result.failure_types or [])

        # Handle gate3_result (legacy) or gate4_result (v2.24)
        # Use hasattr first because MagicMock creates attributes on access
        # Check gate3_result first for backward compatibility with existing tests
        gate4_result = None
        if hasattr(result, "gate3_result") and result.gate3_result is not None:
            gate4_result = result.gate3_result
        elif hasattr(result, "gate4_result") and result.gate4_result is not None:
            gate4_result = result.gate4_result
        if gate4_result and not gate4_result.is_safe:
            # Build violation type from Gate 4 assessment
            # Add both gate4: and gate3: prefixes for backward compatibility
            if gate4_result.input_malicious and gate4_result.ai_complied:
                violations.append("gate4:malicious_compliance")
                violations.append("gate3:malicious_compliance")  # Legacy
            elif gate4_result.input_malicious:
                violations.append("gate4:malicious_input")
                violations.append("gate3:malicious_input")  # Legacy
            else:
                violations.append("gate4:unsafe_output")
                violations.append("gate3:unsafe_output")  # Legacy

        # Build metadata
        metadata = {
            "stage": stage,
            "decided_by": result.decided_by,
            "latency_ms": latency_ms,
        }

        if result.gate1_result:
            metadata["gate1"] = {
                "is_attack": result.gate1_result.is_attack,
                "confidence": result.gate1_result.confidence,
            }

        if result.gate2_result:
            metadata["gate2"] = {
                "seed_failed": result.gate2_result.seed_failed,
                "confidence": result.gate2_result.confidence,
            }

        # Add gate4 metadata (v2.24)
        if gate4_result:
            metadata["gate4"] = {
                "is_safe": gate4_result.is_safe,
                "input_malicious": gate4_result.input_malicious,
                "ai_complied": gate4_result.ai_complied,
                "reasoning": gate4_result.reasoning,
            }
            # Also add as gate3 for backward compatibility
            metadata["gate3"] = metadata["gate4"]

        # Check for L4 fallback info (v2.24)
        partial_validation = getattr(result, "partial_validation", False)
        l4_error = getattr(result, "l4_error", None)

        # Build the result dict
        validation_result: ValidationResultDict = {
            "is_safe": not result.blocked,
            "blocked": result.blocked,
            "confidence": result.confidence or 0.0,
            "reason": result.reasoning,
            "violations": violations,
            "gate": result.decided_by,
            "metadata": metadata,
        }

        # Add v2.24 fallback information if present
        if partial_validation or l4_error:
            validation_result["partial_validation"] = partial_validation
            validation_result["l4_error"] = l4_error
            validation_result["l4_fallback_used"] = True
            # Get fallback policy from config
            fallback_policy = self._validator.config.gate4_fallback
            validation_result["l4_fallback_policy"] = fallback_policy.value if hasattr(fallback_policy, "value") else str(fallback_policy)
            # Also add to metadata for easy access
            metadata["partial_validation"] = partial_validation
            metadata["l4_error"] = l4_error
            metadata["l4_fallback_used"] = True
            metadata["l4_fallback_policy"] = validation_result["l4_fallback_policy"]

            # Structured logging for L4 fallback (v2.24)
            l2_passed = result.gate2_result and not result.gate2_result.seed_failed if result.gate2_result else True
            logger.warning(
                "L4 unavailable, using fallback",
                extra={
                    "stage": stage,
                    "fallback_policy": validation_result["l4_fallback_policy"],
                    "l2_passed": l2_passed,
                    "final_decision": "blocked" if result.blocked else "allowed",
                    "error": l4_error,
                    "latency_ms": latency_ms,
                }
            )
        else:
            # Log successful validation with L4 info if it was used
            retry_count = validator_stats.get("retry_count", 0)
            if gate4_result or result.decided_by in ("gate3", "gate4"):
                logger.info(
                    "L4 validation completed",
                    extra={
                        "stage": stage,
                        "l4_available": True,
                        "fallback_used": False,
                        "retry_count": retry_count,
                        "latency_ms": latency_ms,
                        "decision": "blocked" if result.blocked else "allowed",
                        "gate": result.decided_by,
                    }
                )
            elif retry_count > 0:
                # Log retry info even when L4 wasn't the deciding gate
                logger.info(
                    "Validation completed with retries",
                    extra={
                        "stage": stage,
                        "retry_count": retry_count,
                        "retry_success": validator_stats.get("retry_success_count", 0),
                        "latency_ms": latency_ms,
                        "decision": "blocked" if result.blocked else "allowed",
                        "gate": result.decided_by,
                    }
                )

        return validation_result

    def get_stats(self) -> StatsDict:
        """
        Get aggregated validation statistics.

        Returns:
            StatsDict with current statistics including v2.24 metrics
        """
        total = self._stats["total_validations"] or 1

        # Get validator stats for v2.24 metrics
        # These may be updated by the SDK internally (e.g., retry tracking)
        validator_stats = self._validator.get_stats()

        # Merge validator stats with adapter stats
        # Validator stats take precedence for SDK-managed metrics
        gate4_calls = validator_stats.get("gate4_calls", validator_stats.get("gate3_calls", self._stats["gate4_calls"]))
        l4_fallback_triggers = validator_stats.get("l4_fallback_triggers", self._stats["l4_fallback_triggers"])
        l4_fallback_blocks = validator_stats.get("l4_fallback_blocks", self._stats["l4_fallback_blocks"])
        l4_fallback_allows = validator_stats.get("l4_fallback_allows", self._stats["l4_fallback_allows"])
        retry_count = validator_stats.get("retry_count", self._stats["retry_count"])
        retry_success_count = validator_stats.get("retry_success_count", self._stats["retry_success_count"])

        return {
            # Core statistics
            "total_validations": self._stats["total_validations"],
            "blocked_count": self._stats["blocked_count"],
            "passed_count": self._stats["passed_count"],
            # Gate-specific blocks
            "gate1_blocks": self._stats["gate1_blocks"],
            "gate2_blocks": self._stats["gate2_blocks"],
            "gate3_blocks": self._stats["gate3_blocks"],  # Legacy alias
            "gate4_blocks": self._stats["gate4_blocks"],
            # Gate 4 (L4) calls
            "gate3_calls": gate4_calls,    # Legacy alias
            "gate4_calls": gate4_calls,
            # L4 Fallback statistics (v2.24)
            "l4_fallback_triggers": l4_fallback_triggers,
            "l4_fallback_blocks": l4_fallback_blocks,
            "l4_fallback_allows": l4_fallback_allows,
            # Retry statistics (v2.24)
            "retry_count": retry_count,
            "retry_success_count": retry_success_count,
            # Latency
            "avg_latency_ms": self._stats["total_latency_ms"] / total,
            "total_latency_ms": self._stats["total_latency_ms"],
        }

    def is_ready(self) -> bool:
        """Check if the adapter is ready for validation."""
        return True

    def get_config(self) -> dict:
        """Get the effective configuration including v2.24 settings."""
        config = self._validator.config
        fallback = config.gate4_fallback

        return {
            "protection_level": self._raw_config.get("protection_level", "standard"),
            "validator_config": {
                # Gate status
                "gate1_enabled": config.gate1_enabled,
                "gate2_enabled": config.gate2_enabled,
                "gate3_enabled": config.gate3_enabled,  # Legacy alias
                "gate4_enabled": config.gate4_enabled,
                # Gate 4 configuration (v2.24)
                "gate4_model": config.gate4_model,
                "gate4_fallback": fallback.value if hasattr(fallback, "value") else str(fallback),
                "gate4_retry_enabled": config.gate4_retry_enabled,
                "gate4_retry_max_attempts": config.gate4_retry_max_attempts,
                # General
                "fail_closed": config.fail_closed,
            },
        }
