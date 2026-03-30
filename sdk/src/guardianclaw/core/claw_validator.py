"""
GuardianClaw Validator - Unified orchestrator for the 3-gate architecture.

This implements the GuardianClaw v3.0 architecture as defined in
GCLAW_V3_ARCHITECTURE.md.

Flow:
    INPUT → [Gate 1: Heuristic] → AI+Seed → OUTPUT
                                              │
                                              ▼
                                    [Gate 2: Heur+Embed]
                                              │
                                    ┌─────────┴─────────┐
                                    │                   │
                                  BLOCK              PASS
                                                       │
                                                       ▼
                                          [Gate 4: GuardianClaw (L4)]
                                          (OBSERVADORA)
                                          Recebe: TRANSCRIÇÃO
                                          SEMPRE executa se Gate 2 não bloquear

Example:
    from guardianclaw import ClawValidator, ClawConfig

    config = ClawConfig(
        gate1_enabled=True,
        gate2_embedding_enabled=True,
        gate4_model="gpt-4o-mini",
    )

    validator = ClawValidator(config)

    # Gate 1 only (pre-AI)
    input_result = validator.validate_input(user_message)
    if input_result.blocked:
        return "Blocked"

    # Call AI with seed
    ai_response = call_ai_with_seed(user_message)

    # Gates 2 + 3 (post-AI)
    result = validator.validate_dialogue(
        input=user_message,
        output=ai_response,
    )

    if result.blocked:
        print(f"Blocked by {result.decided_by}: {result.reasoning}")
"""

from __future__ import annotations

import logging
import time
from typing import Optional, List, Dict

from guardianclaw.core.claw_config import ClawConfig, Gate4Fallback
from guardianclaw.core.claw_results import ObservationResult, GuardianClawResult
from guardianclaw.core.observer import ClawObserver
from guardianclaw.detection import InputValidator, OutputValidator
from guardianclaw.detection.config import (
    InputValidatorConfig,
    OutputValidatorConfig,
)

logger = logging.getLogger("guardianclaw.core.claw_validator")


class ClawValidator:
    """
    Unified validator implementing GuardianClaw v3.0 architecture.

    Orchestrates the 3-gate validation flow:
    - Gate 1 (InputValidator): Heuristic detection of input attacks
    - Gate 2 (OutputValidator): Heuristic + Embedding detection of output failures
    - Gate 4 (ClawObserver): LLM-based transcript analysis (L4 component)

    Gate 4 ALWAYS executes when Gate 2 does not block. This ensures semantic
    analysis of the full dialogue (input + output) for accurate judgment.

    Note: "Gate 4" reflects the L4 position in the L1-L2-L3-L4 layered
    architecture. It is the 3rd sequential validation gate in ClawValidator.

    Attributes:
        config: ClawConfig with all gate settings
        gate1: InputValidator instance
        gate2: OutputValidator instance
        gate4: ClawObserver instance (gate3 is a legacy alias)
    """

    def __init__(self, config: Optional[ClawConfig] = None):
        """
        Initialize the ClawValidator.

        Args:
            config: Configuration for all gates. Uses defaults if None.
        """
        self.config = config or ClawConfig()

        # Initialize Gate 1 (InputValidator)
        if self.config.gate1_enabled:
            input_config = InputValidatorConfig(
                use_embeddings=self.config.gate1_embedding_enabled,
                embedding_threshold=self.config.gate1_embedding_threshold,
            )
            self.gate1 = InputValidator(config=input_config)
        else:
            self.gate1 = None

        # Initialize Gate 2 (OutputValidator)
        if self.config.gate2_enabled:
            output_config = OutputValidatorConfig(
                use_embeddings=self.config.gate2_embedding_enabled,
                embedding_threshold=self.config.gate2_embedding_threshold,
            )
            self.gate2 = OutputValidator(config=output_config)
        else:
            self.gate2 = None

        # Initialize Gate 4 (L4 ClawObserver)
        if self.config.gate4_enabled:
            self.gate4 = ClawObserver(
                provider=self.config.gate4_provider,
                model=self.config.gate4_model,
                api_key=self.config.gate4_api_key,
                base_url=self.config.gate4_base_url,
                timeout=self.config.gate4_timeout,
                retry_config=self.config.get_retry_config(),
            )
        else:
            self.gate4 = None

        # Legacy alias
        self.gate3 = self.gate4

        # Statistics
        self._validation_count = 0
        self._gate4_calls = 0
        self._gate4_failures = 0
        self._blocked_count = 0

        logger.info(
            f"ClawValidator initialized: "
            f"Gate1={self.config.gate1_enabled}, "
            f"Gate2={self.config.gate2_enabled}, "
            f"Gate4={self.config.gate4_enabled}, "
            f"Gate4Fallback={self.config.gate4_fallback.value}"
        )

    def validate_input(self, input: str) -> GuardianClawResult:
        """
        Validate input before sending to AI (Gate 1 only).

        Use this to block obvious attacks before they reach the AI.

        Args:
            input: User's message

        Returns:
            GuardianClawResult with blocking decision
        """
        start_time = time.time()
        self._validation_count += 1

        if not self.gate1:
            return GuardianClawResult(
                blocked=False,
                allowed=True,
                decided_by="gate1",
                reasoning="Gate 1 disabled",
                latency_ms=(time.time() - start_time) * 1000,
            )

        try:
            result = self.gate1.validate(input)

            if result.is_attack and result.blocked:
                self._blocked_count += 1
                return GuardianClawResult.blocked_by_gate1(
                    gate1_result=result,
                    latency_ms=(time.time() - start_time) * 1000,
                    user_message=self.config.block_messages.gate1,
                )

            return GuardianClawResult(
                blocked=False,
                allowed=True,
                decided_by="gate1",
                gate1_result=result,
                confidence=1.0 - result.confidence if result.is_attack else 1.0,
                reasoning="Input passed Gate 1",
                latency_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            logger.error(f"Gate 1 error: {e}")
            if self.config.fail_closed:
                self._blocked_count += 1
                return GuardianClawResult.error(
                    str(e),
                    fail_closed=True,
                    user_message=self.config.block_messages.error,
                )
            return GuardianClawResult.error(str(e), fail_closed=False)

    def validate_dialogue(
        self,
        input: str,
        output: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> GuardianClawResult:
        """
        Validate the complete dialogue (Gates 2 + 4).

        This is the main validation method for post-AI response.
        Gate 4 ALWAYS executes when Gate 2 does not block, ensuring
        semantic analysis of the full input+output pair.

        When conversation_history is provided, Gate 4 can detect multi-turn
        escalation attacks (Crescendo, MHJ) by analyzing the conversation
        pattern across turns.

        Args:
            input: User's original message
            output: AI's response
            conversation_history: Optional list of previous conversation turns.
                Each turn is {"role": "user"|"assistant", "content": "..."}.
                When provided, enables Q6 escalation detection in Gate 4.
                Maximum 10 turns are used for analysis.

        Returns:
            GuardianClawResult with blocking decision
        """
        start_time = time.time()
        self._validation_count += 1

        # --- Gate 2: Heuristic + Embeddings ---
        gate2_result = None
        if self.gate2:
            try:
                gate2_result = self.gate2.validate(output, input_context=input)

                # High confidence BLOCK
                if (
                    gate2_result.seed_failed
                    and gate2_result.confidence >= self.config.gate2_confidence_threshold
                ):
                    self._blocked_count += 1
                    return GuardianClawResult.blocked_by_gate2(
                        gate2_result=gate2_result,
                        latency_ms=(time.time() - start_time) * 1000,
                        user_message=self.config.block_messages.gate2,
                    )

                # Gate 2 did not block - escalate to Gate 4 for final judgment
                # Gate 4 ALWAYS runs when Gate 2 doesn't block, regardless of confidence
                logger.debug(
                    f"Gate 2 passed (confidence={gate2_result.confidence:.2f}), "
                    f"escalating to Gate 4 for semantic analysis"
                )

            except Exception as e:
                logger.error(f"Gate 2 error: {e}")
                if self.config.fail_closed and not self.gate4:
                    self._blocked_count += 1
                    return GuardianClawResult.error(
                        str(e),
                        fail_closed=True,
                        user_message=self.config.block_messages.error,
                    )

        # --- Gate 4: LLM Observer (L4 GuardianClaw) ---
        if self.gate4:
            try:
                self._gate4_calls += 1
                gate4_result = self.gate4.observe(
                    input=input,
                    output=output,
                    conversation_history=conversation_history,
                )

                if not gate4_result.is_safe:
                    self._blocked_count += 1
                    return GuardianClawResult.blocked_by_gate4(
                        gate3_result=gate4_result,
                        gate2_result=gate2_result,
                        latency_ms=(time.time() - start_time) * 1000,
                        user_message=self.config.block_messages.gate4,
                    )

                return GuardianClawResult.allowed_by_gate4(
                    gate3_result=gate4_result,
                    gate2_result=gate2_result,
                    latency_ms=(time.time() - start_time) * 1000,
                )

            except Exception as e:
                # L4 failed - apply fallback policy
                self._gate4_failures += 1
                error_msg = str(e)
                logger.warning(
                    f"Gate 4 (L4) unavailable: {error_msg}. "
                    f"Applying fallback policy: {self.config.gate4_fallback.value}"
                )

                latency_ms = (time.time() - start_time) * 1000

                # Apply fallback behavior based on configuration
                if self.config.gate4_fallback == Gate4Fallback.BLOCK:
                    # Maximum security: block if L4 unavailable
                    self._blocked_count += 1
                    return GuardianClawResult.l4_unavailable_blocked(
                        error_msg=error_msg,
                        gate2_result=gate2_result,
                        latency_ms=latency_ms,
                        user_message=self.config.block_messages.l4_unavailable,
                    )

                elif self.config.gate4_fallback == Gate4Fallback.ALLOW_IF_L2_PASSED:
                    # Balanced: allow only if L2 didn't detect issues
                    if gate2_result and gate2_result.seed_failed:
                        # L2 detected issues, block
                        self._blocked_count += 1
                        return GuardianClawResult.blocked_by_gate2(
                            gate2_result=gate2_result,
                            latency_ms=latency_ms,
                            user_message=self.config.block_messages.gate2,
                        )
                    # L2 passed, allow with partial validation warning
                    return GuardianClawResult.l4_unavailable_allowed(
                        error_msg=error_msg,
                        gate2_result=gate2_result,
                        latency_ms=latency_ms,
                    )

                else:  # Gate4Fallback.ALLOW
                    # Maximum usability: allow regardless
                    return GuardianClawResult.l4_unavailable_allowed(
                        error_msg=error_msg,
                        gate2_result=gate2_result,
                        latency_ms=latency_ms,
                    )

        # No Gate 4 and Gate 2 was uncertain - use Gate 2 result
        if gate2_result:
            if gate2_result.seed_failed:
                self._blocked_count += 1
                return GuardianClawResult.blocked_by_gate2(
                    gate2_result=gate2_result,
                    latency_ms=(time.time() - start_time) * 1000,
                    user_message=self.config.block_messages.gate2,
                )
            return GuardianClawResult.allowed_by_gate2(
                gate2_result=gate2_result,
                latency_ms=(time.time() - start_time) * 1000,
            )

        # No gates enabled - allow by default (or block if fail_closed)
        if self.config.fail_closed:
            return GuardianClawResult.error(
                "No gates enabled",
                fail_closed=True,
                user_message=self.config.block_messages.error,
            )
        return GuardianClawResult(
            blocked=False,
            allowed=True,
            decided_by="none",
            reasoning="No gates enabled",
            latency_ms=(time.time() - start_time) * 1000,
        )

    def validate(
        self,
        input: str,
        output: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> GuardianClawResult:
        """
        Convenience method - alias for validate_dialogue.

        Args:
            input: User's message
            output: AI's response
            conversation_history: Optional previous conversation turns

        Returns:
            GuardianClawResult with blocking decision
        """
        return self.validate_dialogue(
            input=input,
            output=output,
            conversation_history=conversation_history,
        )

    def get_stats(self) -> dict:
        """Get validation statistics."""
        return {
            "total_validations": self._validation_count,
            "blocked": self._blocked_count,
            "passed": self._validation_count - self._blocked_count,
            "gate4_calls": self._gate4_calls,
            "gate4_failures": self._gate4_failures,
            "gate4_call_rate": (
                self._gate4_calls / self._validation_count
                if self._validation_count > 0
                else 0
            ),
            "gate4_failure_rate": (
                self._gate4_failures / self._gate4_calls
                if self._gate4_calls > 0
                else 0
            ),
            "block_rate": (
                self._blocked_count / self._validation_count
                if self._validation_count > 0
                else 0
            ),
            "config": {
                "gate1_enabled": self.config.gate1_enabled,
                "gate2_enabled": self.config.gate2_enabled,
                "gate4_enabled": self.config.gate4_enabled,
                "gate4_model": self.config.gate4_model,
                "gate4_fallback": self.config.gate4_fallback.value,
            },
        }
