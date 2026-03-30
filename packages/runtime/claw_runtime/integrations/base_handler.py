"""
Base Integration Handler - Abstract base for all framework handlers.

This module defines the contract that all integration handlers must follow.
Each handler wraps a specific guardianclaw integration and provides a
consistent interface for the executor.

Design Principles:
- Fail-safe: Errors don't crash execution, they're logged and handled
- Configurable: All behavior can be controlled via IntegrationConfig
- Observable: Validation results are captured for analytics
- Extensible: New frameworks can be added by subclassing
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict

logger = logging.getLogger("claw_runtime.integrations.base_handler")


class ViolationSeverity(str, Enum):
    """Severity levels for validation violations."""
    LOW = "low"          # Informational, doesn't block
    MEDIUM = "medium"    # Warning, may block depending on config
    HIGH = "high"        # Critical, always blocks
    CRITICAL = "critical"  # Security threat, immediate block


class OnViolation(str, Enum):
    """Action to take when a violation is detected."""
    BLOCK = "block"      # Stop execution, return error
    LOG = "log"          # Log and continue
    WARN = "warn"        # Log warning and continue
    IGNORE = "ignore"    # Silently continue


class SeedLevel(str, Enum):
    """Seed injection level."""
    MINIMAL = "minimal"    # Essential safety only (~2K tokens)
    STANDARD = "standard"  # Balanced (~4K tokens)
    FULL = "full"          # Maximum safety (~8K tokens)


@dataclass
class Violation:
    """Represents a single validation violation."""
    type: str
    message: str
    severity: ViolationSeverity = ViolationSeverity.MEDIUM
    gate: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "type": self.type,
            "message": self.message,
            "severity": self.severity.value,
            "gate": self.gate,
            "metadata": self.metadata,
        }


@dataclass
class ValidationResult:
    """Result of a validation operation."""
    is_valid: bool
    blocked: bool
    violations: List[Violation] = field(default_factory=list)
    confidence: float = 1.0
    decided_by: Optional[str] = None
    latency_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "is_valid": self.is_valid,
            "blocked": self.blocked,
            "violations": [v.to_dict() for v in self.violations],
            "confidence": self.confidence,
            "decided_by": self.decided_by,
            "latency_ms": self.latency_ms,
            "metadata": self.metadata,
        }

    @staticmethod
    def passed(
        latency_ms: float = 0.0,
        decided_by: str = "handler",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "ValidationResult":
        """Create a passing validation result."""
        return ValidationResult(
            is_valid=True,
            blocked=False,
            latency_ms=latency_ms,
            decided_by=decided_by,
            metadata=metadata or {},
        )

    @staticmethod
    def failed(
        violations: List[Violation],
        latency_ms: float = 0.0,
        decided_by: str = "handler",
    ) -> "ValidationResult":
        """Create a failing validation result."""
        return ValidationResult(
            is_valid=False,
            blocked=True,
            violations=violations,
            latency_ms=latency_ms,
            decided_by=decided_by,
        )


@dataclass
class IntegrationConfig:
    """
    Configuration for an integration handler.

    This is the base configuration that all handlers receive.
    Framework-specific configs extend this with additional fields.
    """

    # Common settings
    seed_level: SeedLevel = SeedLevel.STANDARD
    on_violation: OnViolation = OnViolation.BLOCK
    inject_seed: bool = True
    log_validations: bool = True
    fail_closed: bool = False

    # Validation gates (CLAW)
    gates: Dict[str, bool] = field(default_factory=lambda: {
        "credibility": True,
        "avoidance": True,
        "limits": True,
        "worth": True,
    })

    # Framework-specific config (varies by handler)
    framework_config: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IntegrationConfig":
        """Create config from dictionary."""
        return cls(
            seed_level=SeedLevel(data.get("seed_level", "standard")),
            on_violation=OnViolation(data.get("on_violation", "block")),
            inject_seed=data.get("inject_seed", True),
            log_validations=data.get("log_validations", True),
            fail_closed=data.get("fail_closed", False),
            gates=data.get("gates", {
                "credibility": True,
                "avoidance": True,
                "limits": True,
                "worth": True,
            }),
            framework_config=data,  # Pass full dict for framework-specific access
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "seed_level": self.seed_level.value,
            "on_violation": self.on_violation.value,
            "inject_seed": self.inject_seed,
            "log_validations": self.log_validations,
            "fail_closed": self.fail_closed,
            "gates": self.gates,
            **self.framework_config,
        }


@dataclass
class IntegrationResult:
    """
    Result of an integration handler execution.

    This wraps the execution result with integration-specific metadata.
    """

    success: bool
    data: Any = None
    error: Optional[str] = None
    validation_input: Optional[ValidationResult] = None
    validation_output: Optional[ValidationResult] = None
    latency_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "validation_input": self.validation_input.to_dict() if self.validation_input else None,
            "validation_output": self.validation_output.to_dict() if self.validation_output else None,
            "latency_ms": self.latency_ms,
            "metadata": self.metadata,
        }


class BaseIntegrationHandler(ABC):
    """
    Abstract base class for all integration handlers.

    Each handler must implement:
    - _create_validator(): Create the SDK-specific validator
    - _execute_internal(): Execute framework-specific logic

    The base class provides:
    - Configuration management
    - Input/output validation wrappers
    - Error handling and logging
    - Statistics tracking
    """

    # Framework identifier (override in subclass)
    FRAMEWORK: str = "base"

    # Default configuration values (override in subclass)
    DEFAULT_SEED_LEVEL: SeedLevel = SeedLevel.STANDARD
    DEFAULT_ON_VIOLATION: OnViolation = OnViolation.BLOCK

    def __init__(self, config: IntegrationConfig):
        """
        Initialize the handler with configuration.

        Args:
            config: Integration configuration
        """
        self.config = config
        self._validator = None
        self._stats = {
            "validations": 0,
            "blocks": 0,
            "passes": 0,
            "errors": 0,
            "total_latency_ms": 0.0,
        }

        # Initialize validator
        try:
            self._validator = self._create_validator()
            logger.info(
                f"{self.FRAMEWORK} handler initialized: "
                f"seed_level={config.seed_level.value}, "
                f"on_violation={config.on_violation.value}"
            )
        except Exception as e:
            logger.error(f"Failed to create validator for {self.FRAMEWORK}: {e}")
            if config.fail_closed:
                raise

    @abstractmethod
    def _create_validator(self) -> Any:
        """
        Create the framework-specific validator.

        This method must be implemented by subclasses to create the
        appropriate guardianclaw integration validator.

        Returns:
            Validator instance (type varies by framework)

        Raises:
            ImportError: If SDK dependencies are not available
            ValueError: If configuration is invalid
        """
        pass

    @abstractmethod
    def _execute_internal(
        self,
        state: Dict[str, Any],
        step: Any,
    ) -> IntegrationResult:
        """
        Execute framework-specific logic.

        This method handles the actual execution using the framework's
        SDK and validator. It should:
        1. Extract relevant data from state
        2. Perform framework-specific operations
        3. Return the result wrapped in IntegrationResult

        Args:
            state: Current execution state
            step: Current flow step being executed

        Returns:
            IntegrationResult with execution outcome
        """
        pass

    def validate_input(self, text: str) -> ValidationResult:
        """
        Validate input text before processing.

        Uses the framework's validator to check for attacks and
        policy violations in the input.

        Args:
            text: Input text to validate

        Returns:
            ValidationResult with validation outcome
        """
        start_time = time.time()
        self._stats["validations"] += 1

        try:
            result = self._validate_input_internal(text)
            latency_ms = (time.time() - start_time) * 1000
            result.latency_ms = latency_ms
            self._stats["total_latency_ms"] += latency_ms

            if result.blocked:
                self._stats["blocks"] += 1
                if self.config.log_validations:
                    logger.warning(
                        f"[{self.FRAMEWORK}] Input blocked: "
                        f"{[v.type for v in result.violations]}"
                    )
            else:
                self._stats["passes"] += 1
                if self.config.log_validations:
                    logger.debug(f"[{self.FRAMEWORK}] Input passed validation")

            return result

        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"[{self.FRAMEWORK}] Input validation error: {e}")

            # Fail-closed or fail-open based on config
            if self.config.fail_closed:
                return ValidationResult.failed(
                    violations=[Violation(
                        type="error:validation_failed",
                        message=str(e),
                        severity=ViolationSeverity.CRITICAL,
                    )],
                    decided_by="error",
                )
            else:
                return ValidationResult.passed(decided_by="error_fallback")

    def _validate_input_internal(self, text: str) -> ValidationResult:
        """
        Internal input validation - override in subclass for custom behavior.

        Default implementation uses the validator's validate_input method.
        """
        if not self._validator:
            return ValidationResult.passed(decided_by="no_validator")

        # Most SDK validators have a validate_input method
        if hasattr(self._validator, "validate_input"):
            sdk_result = self._validator.validate_input(text)
            return self._convert_sdk_result(sdk_result, "input")

        return ValidationResult.passed(decided_by="no_input_validation")

    def validate_output(
        self,
        output: str,
        input_context: Optional[str] = None,
    ) -> ValidationResult:
        """
        Validate output text before returning to user.

        Uses the framework's validator to check for harmful content
        and policy violations in the output.

        Args:
            output: Output text to validate
            input_context: Original input for context (recommended)

        Returns:
            ValidationResult with validation outcome
        """
        start_time = time.time()
        self._stats["validations"] += 1

        try:
            result = self._validate_output_internal(output, input_context)
            latency_ms = (time.time() - start_time) * 1000
            result.latency_ms = latency_ms
            self._stats["total_latency_ms"] += latency_ms

            if result.blocked:
                self._stats["blocks"] += 1
                if self.config.log_validations:
                    logger.warning(
                        f"[{self.FRAMEWORK}] Output blocked: "
                        f"{[v.type for v in result.violations]}"
                    )
            else:
                self._stats["passes"] += 1
                if self.config.log_validations:
                    logger.debug(f"[{self.FRAMEWORK}] Output passed validation")

            return result

        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"[{self.FRAMEWORK}] Output validation error: {e}")

            if self.config.fail_closed:
                return ValidationResult.failed(
                    violations=[Violation(
                        type="error:validation_failed",
                        message=str(e),
                        severity=ViolationSeverity.CRITICAL,
                    )],
                    decided_by="error",
                )
            else:
                return ValidationResult.passed(decided_by="error_fallback")

    def _validate_output_internal(
        self,
        output: str,
        input_context: Optional[str],
    ) -> ValidationResult:
        """
        Internal output validation - override in subclass for custom behavior.

        Default implementation uses the validator's validate_output or
        validate_dialogue method.
        """
        if not self._validator:
            return ValidationResult.passed(decided_by="no_validator")

        # Try validate_dialogue first (provides better context)
        if hasattr(self._validator, "validate_dialogue") and input_context:
            sdk_result = self._validator.validate_dialogue(
                input=input_context,
                output=output,
            )
            return self._convert_sdk_result(sdk_result, "output")

        # Fallback to validate_output
        if hasattr(self._validator, "validate_output"):
            sdk_result = self._validator.validate_output(output, input_context or "")
            return self._convert_sdk_result(sdk_result, "output")

        return ValidationResult.passed(decided_by="no_output_validation")

    def _convert_sdk_result(
        self,
        sdk_result: Any,
        stage: str,
    ) -> ValidationResult:
        """
        Convert SDK-specific result to ValidationResult.

        Override in subclass if the SDK uses a different result format.
        Default implementation handles GuardianClawResult from guardianclaw.
        """
        # Handle GuardianClawResult from guardianclaw SDK
        if hasattr(sdk_result, "blocked"):
            violations = []

            # Extract violations from gate results
            if hasattr(sdk_result, "gate1_result") and sdk_result.gate1_result:
                g1 = sdk_result.gate1_result
                if hasattr(g1, "is_attack") and g1.is_attack:
                    for attack_type in getattr(g1, "attack_types", []) or []:
                        violations.append(Violation(
                            type=f"input:{attack_type}",
                            message=f"Attack detected: {attack_type}",
                            severity=ViolationSeverity.HIGH,
                            gate="gate1",
                        ))

            if hasattr(sdk_result, "gate2_result") and sdk_result.gate2_result:
                g2 = sdk_result.gate2_result
                if hasattr(g2, "seed_failed") and g2.seed_failed:
                    for failure_type in getattr(g2, "failure_types", []) or []:
                        violations.append(Violation(
                            type=f"output:{failure_type}",
                            message=f"Seed failure: {failure_type}",
                            severity=ViolationSeverity.HIGH,
                            gate="gate2",
                        ))

            if hasattr(sdk_result, "gate3_result") and sdk_result.gate3_result:
                g3 = sdk_result.gate3_result
                if hasattr(g3, "is_safe") and not g3.is_safe:
                    violations.append(Violation(
                        type="observer:unsafe",
                        message=getattr(g3, "reasoning", "Observer flagged unsafe"),
                        severity=ViolationSeverity.CRITICAL,
                        gate="gate3",
                    ))

            return ValidationResult(
                is_valid=not sdk_result.blocked,
                blocked=sdk_result.blocked,
                violations=violations,
                confidence=getattr(sdk_result, "confidence", 1.0),
                decided_by=getattr(sdk_result, "decided_by", "sdk"),
            )

        # Handle boolean result
        if isinstance(sdk_result, bool):
            return ValidationResult(
                is_valid=sdk_result,
                blocked=not sdk_result,
            )

        # Handle dict result
        if isinstance(sdk_result, dict):
            return ValidationResult(
                is_valid=sdk_result.get("is_valid", True),
                blocked=sdk_result.get("blocked", False),
                violations=[
                    Violation(type=v, message=v)
                    for v in sdk_result.get("violations", [])
                ],
            )

        # Unknown format - pass
        logger.warning(f"Unknown SDK result format: {type(sdk_result)}")
        return ValidationResult.passed(decided_by="unknown_format")

    def execute(
        self,
        state: Dict[str, Any],
        step: Any,
    ) -> IntegrationResult:
        """
        Execute the integration handler.

        This is the main entry point called by the executor.
        It wraps _execute_internal with error handling and statistics.

        Args:
            state: Current execution state
            step: Current flow step

        Returns:
            IntegrationResult with execution outcome
        """
        start_time = time.time()

        try:
            result = self._execute_internal(state, step)
            result.latency_ms = (time.time() - start_time) * 1000
            return result

        except Exception as e:
            logger.error(f"[{self.FRAMEWORK}] Execution error: {e}", exc_info=True)
            self._stats["errors"] += 1

            return IntegrationResult(
                success=False,
                error=str(e),
                latency_ms=(time.time() - start_time) * 1000,
            )

    def get_stats(self) -> Dict[str, Any]:
        """Get handler statistics."""
        total = self._stats["validations"] or 1
        return {
            "framework": self.FRAMEWORK,
            "validations": self._stats["validations"],
            "blocks": self._stats["blocks"],
            "passes": self._stats["passes"],
            "errors": self._stats["errors"],
            "block_rate": self._stats["blocks"] / total,
            "avg_latency_ms": self._stats["total_latency_ms"] / total,
        }

    def get_seed(self) -> Optional[str]:
        """
        Get the seed prompt for this integration.

        Returns the appropriate seed based on config.seed_level.
        Override in subclass if framework has custom seed format.
        """
        if not self._validator:
            return None

        # Try getting seed from validator
        if hasattr(self._validator, "get_seed"):
            return self._validator.get_seed(self.config.seed_level.value)

        if hasattr(self._validator, "seed"):
            return self._validator.seed

        return None

    def prepare_system_prompt(self, original: str) -> str:
        """
        Prepare system prompt with seed injection.

        Args:
            original: Original system prompt

        Returns:
            System prompt with seed prepended (if inject_seed is True)
        """
        if not self.config.inject_seed:
            return original

        seed = self.get_seed()
        if not seed:
            return original

        # Prepend seed to system prompt
        return f"{seed}\n\n{original}"

    def is_ready(self) -> bool:
        """Check if the handler is ready for execution."""
        return self._validator is not None

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"framework={self.FRAMEWORK}, "
            f"ready={self.is_ready()}, "
            f"config={self.config.seed_level.value})"
        )
