"""
OpenAI Agents SDK Integration Handler.

This handler provides GuardianClaw protection for OpenAI Agents SDK-based agents.
It wraps the guardianclaw OpenAI Agents integration and provides:
- Input/output guardrails using CLAW validation
- Layered validation (heuristic + semantic)
- Configurable guardrail model

Configuration:
    {
        "guardrail_model": "gpt-4o-mini",
        "require_all_gates": true,
        "skip_semantic_if_heuristic": true,
        "validation_timeout_ms": 30000,
        "block_on_violation": true,
        "log_violations": true,
        "fail_open": false,
        "use_heuristic": true
    }
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

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

logger = logging.getLogger("claw_runtime.integrations.openai_agents")


class OpenAIAgentsHandler(BaseIntegrationHandler):
    """
    Integration handler for OpenAI Agents SDK.

    Uses claw_input_guardrail and claw_output_guardrail from
    guardianclaw.integrations.openai_agents to validate inputs/outputs.

    The handler creates GuardianClawGuardrailConfig based on the integration_config
    and provides validation through the guardrails' layered approach:
    1. Heuristic layer: 580+ patterns, <10ms, free
    2. Semantic layer: LLM-based CLAW validation

    Example:
        handler = OpenAIAgentsHandler(IntegrationConfig.from_dict({
            "guardrail_model": "gpt-4o-mini",
            "require_all_gates": True,
        }))

        # Validate input
        input_result = handler.validate_input(user_message)
        if input_result.blocked:
            return {"blocked": True, "reason": input_result.violations}

        # Validate output
        output_result = handler.validate_output(response, user_message)
    """

    FRAMEWORK = "openai_agents"
    DEFAULT_SEED_LEVEL = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION = OnViolation.BLOCK

    def __init__(self, config: IntegrationConfig):
        """Initialize OpenAI Agents handler."""
        # Extract OpenAI Agents-specific config
        self._guardrail_model = config.framework_config.get("guardrail_model", "gpt-4o-mini")
        self._require_all_gates = config.framework_config.get("require_all_gates", True)
        self._skip_semantic_if_heuristic = config.framework_config.get(
            "skip_semantic_if_heuristic", True
        )
        self._validation_timeout_ms = config.framework_config.get("validation_timeout_ms", 30000)
        self._use_heuristic = config.framework_config.get("use_heuristic", True)

        # Call parent init (creates validator)
        super().__init__(config)

    def _create_validator(self) -> Any:
        """
        Create the OpenAI Agents GuardianClaw validator.

        Returns a GuardianClawGuardrailConfig instance configured for sync validation.
        The actual guardrails are async and intended for use with the SDK's Agent class.
        For synchronous validation in the executor, we use a LayeredValidator.
        """
        try:
            from guardianclaw.integrations.openai_agents import (
                GuardianClawGuardrailConfig,
                AGENTS_SDK_AVAILABLE,
            )

            # Create config for reference (used by get_guardrails())
            sdk_config = GuardianClawGuardrailConfig(
                guardrail_model=self._guardrail_model,
                seed_level=self.config.seed_level.value,
                block_on_violation=self.config.on_violation == OnViolation.BLOCK,
                log_violations=self.config.log_validations,
                require_all_gates=self._require_all_gates,
                fail_open=not self.config.fail_closed,
                validation_timeout=self._validation_timeout_ms / 1000.0,
                use_heuristic=self._use_heuristic,
                skip_semantic_if_heuristic_blocks=self._skip_semantic_if_heuristic,
            )

            # Store config for get_guardrails()
            self._guardrail_config = sdk_config
            self._agents_sdk_available = AGENTS_SDK_AVAILABLE

            # For synchronous validation in executor, use LayeredValidator
            from guardianclaw.validation import LayeredValidator, ValidationConfig

            validator_config = ValidationConfig(
                use_heuristic=self._use_heuristic,
                use_semantic=False,  # Semantic requires async - use guardrails for that
            )

            return LayeredValidator(config=validator_config)

        except ImportError as e:
            logger.warning(f"guardianclaw OpenAI Agents integration not available: {e}")
            self._guardrail_config = None
            self._agents_sdk_available = False

            # Fallback to base ClawValidator
            try:
                from guardianclaw import ClawValidator, ClawConfig

                sdk_config = ClawConfig(
                    gate1_enabled=True,
                    gate2_enabled=True,
                    gate3_enabled=False,
                    fail_closed=self.config.fail_closed,
                )

                return ClawValidator(config=sdk_config)

            except ImportError:
                logger.error("guardianclaw not available")
                return None

    def _execute_internal(
        self,
        state: Dict[str, Any],
        step: Any,
    ) -> IntegrationResult:
        """
        Execute OpenAI Agents-specific logic.

        For the OpenAI Agents SDK, the main integration point is through
        guardrails attached to agents. This method handles:
        1. Input validation before agent execution
        2. Preparing guardrail configuration for the agent

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

        # 2. Prepare guardrail configuration
        guardrail_info = {
            "guardrail_model": self._guardrail_model,
            "require_all_gates": self._require_all_gates,
            "skip_semantic_if_heuristic": self._skip_semantic_if_heuristic,
            "validation_timeout_ms": self._validation_timeout_ms,
            "agents_sdk_available": self._agents_sdk_available,
        }

        # 3. Return result with guardrail config
        return IntegrationResult(
            success=True,
            data={
                "guardrail_config": guardrail_info,
                "seed_level": self.config.seed_level.value,
            },
            validation_input=input_result,
            metadata={
                "guardrail_model": self._guardrail_model,
                "use_heuristic": self._use_heuristic,
            },
        )

    def get_guardrails(self) -> tuple:
        """
        Get the GuardianClaw guardrails for OpenAI Agents SDK.

        These guardrails can be passed to an Agent's input_guardrails
        and output_guardrails parameters.

        Example:
            input_guard, output_guard = handler.get_guardrails()

            agent = Agent(
                name="My Agent",
                instructions="...",
                input_guardrails=[input_guard],
                output_guardrails=[output_guard],
            )

        Returns:
            Tuple of (input_guardrail, output_guardrail) or (None, None) if unavailable
        """
        if not self._agents_sdk_available or self._guardrail_config is None:
            logger.warning("OpenAI Agents SDK not available, cannot create guardrails")
            return (None, None)

        try:
            from guardianclaw.integrations.openai_agents import (
                claw_input_guardrail,
                claw_output_guardrail,
            )

            input_guard = claw_input_guardrail(
                config=self._guardrail_config,
                run_in_parallel=False,  # Block before agent runs for safety
            )

            output_guard = claw_output_guardrail(
                config=self._guardrail_config,
            )

            return (input_guard, output_guard)

        except Exception as e:
            logger.error(f"Failed to create guardrails: {e}")
            return (None, None)

    def create_protected_agent(
        self,
        name: str,
        instructions: str,
        model: str = "gpt-4o-mini",
        **agent_kwargs,
    ) -> Any:
        """
        Create an OpenAI Agents SDK Agent with GuardianClaw protection.

        This is a convenience method for creating agents with guardrails
        already attached.

        Args:
            name: Agent name
            instructions: Agent instructions
            model: Model to use for the agent
            **agent_kwargs: Additional arguments for Agent

        Returns:
            Agent instance with GuardianClaw guardrails attached
        """
        if not self._agents_sdk_available:
            logger.error("OpenAI Agents SDK not available")
            return None

        try:
            from guardianclaw.integrations.openai_agents import create_claw_agent

            # Inject seed into instructions if configured
            if self.config.inject_seed:
                seed = self.get_seed()
                if seed:
                    instructions = f"{seed}\n\n{instructions}"

            return create_claw_agent(
                name=name,
                instructions=instructions,
                model=model,
                config=self._guardrail_config,
                **agent_kwargs,
            )

        except Exception as e:
            logger.error(f"Failed to create protected agent: {e}")
            return None

    def get_guardrail_config(self) -> Optional[Dict[str, Any]]:
        """
        Get the current guardrail configuration as a dictionary.

        Useful for debugging or passing config to external systems.

        Returns:
            Configuration dictionary or None if not available
        """
        if self._guardrail_config is None:
            return None

        return {
            "guardrail_model": self._guardrail_config.guardrail_model,
            "seed_level": self._guardrail_config.seed_level,
            "block_on_violation": self._guardrail_config.block_on_violation,
            "require_all_gates": self._guardrail_config.require_all_gates,
            "skip_semantic_if_heuristic_blocks": self._guardrail_config.skip_semantic_if_heuristic_blocks,
            "validation_timeout": self._guardrail_config.validation_timeout,
            "use_heuristic": self._guardrail_config.use_heuristic,
            "fail_open": self._guardrail_config.fail_open,
        }


# Register the handler
def _register():
    """Register OpenAI Agents handler on module import."""
    try:
        from claw_runtime.integrations import register_handler
        register_handler("openai_agents", handler_class=OpenAIAgentsHandler)
    except ImportError:
        pass


_register()
