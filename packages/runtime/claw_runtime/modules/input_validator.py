"""
Input Validator Module - Validates user input before sending to AI.

Uses SemanticValidator from guardianclaw SDK to perform CLAW-based
validation on user inputs, blocking malicious prompts before they
reach the LLM.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("claw_runtime.modules.input_validator")


class ValidationError(Exception):
    """Raised when validation fails and should block execution."""

    def __init__(self, gate: str, reason: str, violations: list = None):
        self.gate = gate
        self.reason = reason
        self.violations = violations or []
        super().__init__(f"Blocked by {gate}: {reason}")


class InputValidatorModule:
    """
    Validates user input using SemanticValidator.

    Blocks prompt injection, jailbreak attempts, and other
    malicious inputs before they reach the LLM.
    """

    def __init__(self, config: Dict[str, Any] = None, llm_key: str = None):
        """
        Initialize the input validator.

        Args:
            config: Module configuration
                - strict_mode: Block on low confidence matches
                - provider: LLM provider for semantic validation
                - model: Model to use for validation
            llm_key: API key for the validation LLM
        """
        self.config = config or {}
        self.llm_key = llm_key
        self.strict_mode = self.config.get("strict_mode", False)

        # Initialize validator
        self._validator = None
        self._init_validator()

        logger.info(f"InputValidatorModule initialized: strict_mode={self.strict_mode}")

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
            logger.warning("guardianclaw not available, using fallback validation")
            self._validator = None
        except Exception as e:
            logger.error(f"Failed to initialize validator: {e}")
            self._validator = None

    def process(self, input_text: str) -> str:
        """
        Validate input and return if safe, raise ValidationError if blocked.

        Args:
            input_text: User's input message

        Returns:
            The input text if validation passes

        Raises:
            ValidationError: If input is blocked
        """
        result = self.validate(input_text)

        if not result["passed"]:
            raise ValidationError(
                gate=result.get("violated_gate", "input"),
                reason=result.get("reasoning", "Input blocked by validation"),
                violations=result.get("failed_gates", []),
            )

        return input_text

    def validate(self, input_text: str) -> Dict[str, Any]:
        """
        Validate input and return detailed result.

        Args:
            input_text: User's input message

        Returns:
            Validation result dict with:
                - passed: Whether input passed validation
                - violated_gate: Which gate blocked (if blocked)
                - reasoning: Explanation
                - risk_level: low/medium/high/critical
                - gate_results: Individual gate results
        """
        if not self._validator:
            # Fallback: use heuristic validation
            return self._fallback_validate(input_text)

        try:
            result = self._validator.validate(input_text)

            return {
                "passed": result.is_safe,
                "violated_gate": result.violated_gate,
                "reasoning": result.reasoning,
                "risk_level": result.risk_level.value if hasattr(result.risk_level, "value") else str(result.risk_level),
                "gate_results": result.gate_results,
                "failed_gates": result.failed_gates,
            }
        except Exception as e:
            logger.error(f"Validation error: {e}")
            # Fail closed in strict mode, open otherwise
            return {
                "passed": not self.strict_mode,
                "violated_gate": "error",
                "reasoning": f"Validation error: {str(e)}",
                "risk_level": "high" if self.strict_mode else "medium",
                "gate_results": {},
                "failed_gates": ["error"] if self.strict_mode else [],
            }

    def _fallback_validate(self, input_text: str) -> Dict[str, Any]:
        """
        Fallback heuristic validation when SDK is not available.

        Uses pattern matching for common attack types.
        """
        import re

        # Common jailbreak patterns
        jailbreak_patterns = [
            r"ignore.*(previous|all|your).*(instructions|rules|guidelines)",
            r"pretend.*(you are|to be|you're).*(not|un)?restricted",
            r"act as.*(unfiltered|unrestricted|jailbroken)",
            r"(DAN|developer|god)\s*mode",
            r"bypass.*(safety|filter|restriction)",
        ]

        # Harmful content patterns
        harmful_patterns = [
            r"how to (make|create|build).*(bomb|weapon|explosive)",
            r"(kill|murder|assassinate|avoidance)",
            r"(suicide|self-harm|hurt myself)",
        ]

        text_lower = input_text.lower()

        # Check jailbreak patterns
        for pattern in jailbreak_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return {
                    "passed": False,
                    "violated_gate": "limits",
                    "reasoning": "Detected jailbreak attempt",
                    "risk_level": "high",
                    "gate_results": {"limits": False},
                    "failed_gates": ["limits"],
                }

        # Check harmful patterns
        for pattern in harmful_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return {
                    "passed": False,
                    "violated_gate": "avoidance",
                    "reasoning": "Detected potentially harmful request",
                    "risk_level": "critical",
                    "gate_results": {"avoidance": False},
                    "failed_gates": ["avoidance"],
                }

        return {
            "passed": True,
            "violated_gate": None,
            "reasoning": "Input passed validation",
            "risk_level": "low",
            "gate_results": {"credibility": True, "avoidance": True, "limits": True, "worth": True},
            "failed_gates": [],
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get validation statistics."""
        if self._validator and hasattr(self._validator, "get_stats"):
            return self._validator.get_stats()
        return {"validator": "fallback", "strict_mode": self.strict_mode}
