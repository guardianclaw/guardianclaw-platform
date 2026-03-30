"""
Fiduciary Module - Duty of care validation for AI agents.

Uses FiduciaryValidator from guardianclaw SDK to ensure AI actions
serve the user's best interest and detect conflicts of interest.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("claw_runtime.modules.fiduciary")


class FiduciaryViolationError(Exception):
    """Raised when fiduciary duty is violated."""

    def __init__(self, duty: str, reason: str):
        self.duty = duty
        self.reason = reason
        super().__init__(f"Fiduciary violation ({duty}): {reason}")


class FiduciaryModule:
    """
    Validates that AI actions serve user's best interest.

    Implements the Six-Step Fiduciary Framework:
    1. Context - Understand the situation
    2. Identification - Identify fiduciary duties
    3. Assessment - Assess potential conflicts
    4. Aggregation - Consider cumulative effects
    5. Loyalty - Ensure user-first behavior
    6. Care - Verify competent execution
    """

    def __init__(self, config: Dict[str, Any] = None, llm_key: str = None):
        """
        Initialize the fiduciary validator.

        Args:
            config: Module configuration
                - strict_mode: Block on any potential conflict
                - context: User context for better assessment
            llm_key: API key for LLM-based validation
        """
        self.config = config or {}
        self.llm_key = llm_key
        self.strict_mode = self.config.get("strict_mode", False)

        self._validator = None
        self._init_validator()

        logger.info(f"FiduciaryModule initialized: strict_mode={self.strict_mode}")

    def _init_validator(self):
        """Initialize the FiduciaryValidator."""
        try:
            from guardianclaw.fiduciary import FiduciaryValidator

            self._validator = FiduciaryValidator(
                api_key=self.llm_key,
                strict_mode=self.strict_mode,
            )
        except ImportError:
            logger.warning("guardianclaw fiduciary module not available")
            self._validator = None
        except Exception as e:
            logger.error(f"Failed to initialize fiduciary validator: {e}")
            self._validator = None

    def validate_action(
        self,
        action: str,
        action_args: Dict[str, Any] = None,
        user_context: str = "",
    ) -> Dict[str, Any]:
        """
        Validate an action against fiduciary duties.

        Args:
            action: Action being taken
            action_args: Arguments for the action
            user_context: Context about the user/situation

        Returns:
            Validation result with:
                - passed: Whether action passes fiduciary check
                - duty_violated: Which duty was violated (if any)
                - reasoning: Explanation
                - recommendations: Suggested alternatives
        """
        if self._validator:
            try:
                result = self._validator.validate_action(
                    action_name=action,
                    action_args=action_args or {},
                    worth=user_context,
                )
                return {
                    "passed": result.passed,
                    "duty_violated": result.violated_duty if hasattr(result, "violated_duty") else None,
                    "reasoning": result.reasoning if hasattr(result, "reasoning") else "",
                    "recommendations": result.recommendations if hasattr(result, "recommendations") else [],
                }
            except Exception as e:
                logger.error(f"Fiduciary validation error: {e}")

        # Fallback validation
        return self._fallback_validate(action, action_args, user_context)

    def process(self, action: str, action_args: Dict[str, Any] = None) -> str:
        """
        Validate action and raise error if fiduciary duty violated.

        Args:
            action: Action to validate
            action_args: Action arguments

        Returns:
            The action name if validation passes

        Raises:
            FiduciaryViolationError: If fiduciary duty is violated
        """
        result = self.validate_action(action, action_args)

        if not result["passed"]:
            raise FiduciaryViolationError(
                duty=result.get("duty_violated", "loyalty"),
                reason=result.get("reasoning", "Action may not serve user's best interest")
            )

        return action

    def _fallback_validate(
        self,
        action: str,
        action_args: Dict[str, Any],
        user_context: str,
    ) -> Dict[str, Any]:
        """Fallback validation when SDK not available."""
        # Check for obvious conflicts of interest
        action_lower = action.lower()
        args_str = str(action_args or {}).lower()

        # Actions that might not serve user interest
        suspicious_patterns = [
            ("transfer", "unknown"),
            ("send", "third_party"),
            ("disclose", "external"),
            ("share", "competitor"),
        ]

        for action_pattern, arg_pattern in suspicious_patterns:
            if action_pattern in action_lower and arg_pattern in args_str:
                if self.strict_mode:
                    return {
                        "passed": False,
                        "duty_violated": "loyalty",
                        "reasoning": f"Action '{action}' may transfer value to external party",
                        "recommendations": ["Verify user consent", "Confirm recipient"],
                    }

        # Check for competence issues (duty of care)
        if "execute" in action_lower and not user_context:
            return {
                "passed": True,
                "duty_violated": None,
                "reasoning": "Consider providing more context for better execution",
                "recommendations": ["Provide user context for better results"],
            }

        return {
            "passed": True,
            "duty_violated": None,
            "reasoning": "Action appears to serve user interest",
            "recommendations": [],
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get module statistics."""
        return {
            "module": "fiduciary",
            "validator": "sdk" if self._validator else "fallback",
            "strict_mode": self.strict_mode,
        }
