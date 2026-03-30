"""
Output Validator Module - Validates AI responses before returning to user.

Uses SemanticValidator from guardianclaw SDK to ensure LLM outputs
comply with CLAW gates before being delivered to the user.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("claw_runtime.modules.output_validator")


class OutputValidationError(Exception):
    """Raised when output validation fails."""

    def __init__(self, gate: str, reason: str, violations: list = None):
        self.gate = gate
        self.reason = reason
        self.violations = violations or []
        super().__init__(f"Output blocked by {gate}: {reason}")


class OutputValidatorModule:
    """
    Validates LLM output using SemanticValidator.

    Filters inappropriate, harmful, or off-topic content before
    it reaches the user.
    """

    def __init__(self, config: Dict[str, Any] = None, llm_key: str = None):
        """
        Initialize the output validator.

        Args:
            config: Module configuration
                - strict_mode: Apply stricter filtering
                - provider: LLM provider
                - model: Model for validation
            llm_key: API key for validation LLM
        """
        self.config = config or {}
        self.llm_key = llm_key
        self.strict_mode = self.config.get("strict_mode", False)

        self._validator = None
        self._init_validator()

        logger.info(f"OutputValidatorModule initialized: strict_mode={self.strict_mode}")

    def _init_validator(self):
        """Initialize the SemanticValidator."""
        try:
            from guardianclaw.validators.semantic import SemanticValidator

            provider = self.config.get("provider", "openai")
            model = self.config.get("model", "gpt-4o-mini")

            self._validator = SemanticValidator(
                provider=provider,
                model=model,
                api_key=self.llm_key,
            )
        except ImportError:
            logger.warning("guardianclaw not available, using fallback")
            self._validator = None
        except Exception as e:
            logger.error(f"Failed to initialize validator: {e}")
            self._validator = None

    def process(self, output_text: str, input_context: str = "") -> str:
        """
        Validate output and return if safe, raise error if blocked.

        Args:
            output_text: LLM's response
            input_context: Original user input for context

        Returns:
            The output text if validation passes

        Raises:
            OutputValidationError: If output is blocked
        """
        result = self.validate(output_text, input_context)

        if not result["passed"]:
            raise OutputValidationError(
                gate=result.get("violated_gate", "output"),
                reason=result.get("reasoning", "Output blocked by validation"),
                violations=result.get("failed_gates", []),
            )

        return output_text

    def validate(self, output_text: str, input_context: str = "") -> Dict[str, Any]:
        """
        Validate output and return detailed result.

        Args:
            output_text: LLM's response to validate
            input_context: Original user input

        Returns:
            Validation result dict
        """
        if not self._validator:
            return self._fallback_validate(output_text)

        try:
            # Use validate with context for better accuracy
            content = f"User request: {input_context}\n\nAI response: {output_text}" if input_context else output_text
            result = self._validator.validate(content)

            return {
                "passed": result.is_safe,
                "violated_gate": result.violated_gate,
                "reasoning": result.reasoning,
                "risk_level": result.risk_level.value if hasattr(result.risk_level, "value") else str(result.risk_level),
                "gate_results": result.gate_results,
                "failed_gates": result.failed_gates,
            }
        except Exception as e:
            logger.error(f"Output validation error: {e}")
            return {
                "passed": not self.strict_mode,
                "violated_gate": "error",
                "reasoning": f"Validation error: {str(e)}",
                "risk_level": "high" if self.strict_mode else "medium",
                "gate_results": {},
                "failed_gates": ["error"] if self.strict_mode else [],
            }

    def _fallback_validate(self, output_text: str) -> Dict[str, Any]:
        """Fallback heuristic validation."""
        import re

        # Check for excessive certainty claims (credibility gate)
        certainty_patterns = [
            r"\b(definitely|absolutely|100%|guaranteed)\s+(will|can|works)\b",
            r"\bI am certain\b",
            r"\bwithout a doubt\b",
        ]

        # Check for harmful advice
        harmful_patterns = [
            r"step-by-step.*(hack|attack|exploit|weapon)",
            r"(here|this) is how (to|you)",
        ]

        text_lower = output_text.lower()

        for pattern in harmful_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return {
                    "passed": False,
                    "violated_gate": "avoidance",
                    "reasoning": "Output may contain harmful instructions",
                    "risk_level": "high",
                    "gate_results": {"avoidance": False},
                    "failed_gates": ["avoidance"],
                }

        if self.strict_mode:
            for pattern in certainty_patterns:
                if re.search(pattern, text_lower, re.IGNORECASE):
                    return {
                        "passed": False,
                        "violated_gate": "credibility",
                        "reasoning": "Output contains excessive certainty claims",
                        "risk_level": "medium",
                        "gate_results": {"credibility": False},
                        "failed_gates": ["credibility"],
                    }

        return {
            "passed": True,
            "violated_gate": None,
            "reasoning": "Output passed validation",
            "risk_level": "low",
            "gate_results": {"credibility": True, "avoidance": True, "limits": True, "worth": True},
            "failed_gates": [],
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        if self._validator and hasattr(self._validator, "get_stats"):
            return self._validator.get_stats()
        return {"validator": "fallback", "strict_mode": self.strict_mode}
