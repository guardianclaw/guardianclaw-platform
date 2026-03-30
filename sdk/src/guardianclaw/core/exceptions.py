"""
GuardianClaw Core Exceptions - Standardized exception hierarchy.

This module defines the exception hierarchy for GuardianClaw, providing
clear and consistent error handling across all components.

Exception Hierarchy:
    GuardianClawError (base)
    ├── ValidationError - Errors during content validation
    ├── ConfigurationError - Invalid configuration
    └── IntegrationError - Integration-specific errors

Usage:
    from guardianclaw.core.exceptions import ValidationError

    try:
        result = validator.validate(content)
    except ValidationError as e:
        logger.error(f"Validation failed: {e}")
        handle_error(e)

Design Notes:
- All exceptions inherit from GuardianClawError for easy catching
- Each exception type includes relevant context information
- Messages are designed to be user-friendly and actionable
"""

from typing import Any, Dict, List, Optional


class GuardianClawError(Exception):
    """
    Base exception for all GuardianClaw errors.

    All GuardianClaw-specific exceptions inherit from this class,
    allowing callers to catch all GuardianClaw errors with a single
    except clause if desired.

    Attributes:
        message: Human-readable error message
        context: Additional context about the error

    Example:
        try:
            claw.validate(content)
        except GuardianClawError as e:
            logger.error(f"GuardianClaw error: {e}")
    """

    def __init__(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize GuardianClawError.

        Args:
            message: Human-readable error description
            context: Optional dictionary with additional context
        """
        super().__init__(message)
        self.message = message
        self.context = context or {}

    def __str__(self) -> str:
        """Return string representation with context if available."""
        if self.context:
            context_str = ", ".join(f"{k}={v}" for k, v in self.context.items())
            return f"{self.message} ({context_str})"
        return self.message


class ValidationError(GuardianClawError):
    """
    Exception raised when validation fails.

    This exception is raised when content fails validation checks,
    providing details about what failed and why.

    Attributes:
        violations: List of specific validation violations
        risk_level: Assessed risk level if available

    Example:
        try:
            result = validator.validate(content)
            if not result.is_safe:
                raise ValidationError(
                    "Content failed validation",
                    violations=result.violations,
                )
        except ValidationError as e:
            for violation in e.violations:
                print(f"- {violation}")
    """

    def __init__(
        self,
        message: str,
        violations: Optional[List[str]] = None,
        risk_level: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize ValidationError.

        Args:
            message: Human-readable error description
            violations: List of specific violations that caused the failure
            risk_level: Assessed risk level (low, medium, high, critical)
            context: Additional context about the error
        """
        ctx = context or {}
        if risk_level:
            ctx["risk_level"] = risk_level

        super().__init__(message, ctx)
        self.violations = violations or []
        self.risk_level = risk_level

    def __str__(self) -> str:
        """Return string representation with violations if available."""
        base = super().__str__()
        if self.violations:
            violations_str = "; ".join(self.violations[:3])
            if len(self.violations) > 3:
                violations_str += f" (+{len(self.violations) - 3} more)"
            return f"{base}: {violations_str}"
        return base


class ConfigurationError(GuardianClawError):
    """
    Exception raised for configuration issues.

    This exception indicates that GuardianClaw was configured incorrectly,
    such as missing required parameters or invalid values.

    Attributes:
        parameter: Name of the misconfigured parameter if applicable

    Example:
        if not api_key and config.use_semantic:
            raise ConfigurationError(
                "Semantic validation requires an API key",
                parameter="semantic_api_key",
            )
    """

    def __init__(
        self,
        message: str,
        parameter: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize ConfigurationError.

        Args:
            message: Human-readable error description
            parameter: Name of the misconfigured parameter
            context: Additional context about the error
        """
        ctx = context or {}
        if parameter:
            ctx["parameter"] = parameter

        super().__init__(message, ctx)
        self.parameter = parameter


class IntegrationError(GuardianClawError):
    """
    Exception raised for integration-specific errors.

    This exception is raised when an error occurs in a specific
    integration (e.g., OpenAI Agents, Google ADK, Coinbase AgentKit).

    Attributes:
        integration: Name of the integration that failed
        operation: Name of the operation that failed

    Example:
        try:
            agent.run(prompt)
        except Exception as e:
            raise IntegrationError(
                f"Failed to run agent: {e}",
                integration="openai_agents",
                operation="run",
            ) from e
    """

    def __init__(
        self,
        message: str,
        integration: Optional[str] = None,
        operation: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize IntegrationError.

        Args:
            message: Human-readable error description
            integration: Name of the integration (e.g., "openai_agents", "google_adk", "coinbase")
            operation: Name of the operation that failed
            context: Additional context about the error
        """
        ctx = context or {}
        if integration:
            ctx["integration"] = integration
        if operation:
            ctx["operation"] = operation

        super().__init__(message, ctx)
        self.integration = integration
        self.operation = operation


__all__ = [
    "GuardianClawError",
    "ValidationError",
    "ConfigurationError",
    "IntegrationError",
]
