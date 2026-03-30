"""
OpenGuardrails Integration for GuardianClaw

Provides bidirectional integration between GuardianClaw and OpenGuardrails:

1. GuardianClaw as OpenGuardrails Scanner:
   - Register GuardianClaw CLAW validation as a custom scanner
   - Use GuardianClaw's four-gate validation within OpenGuardrails pipeline

2. OpenGuardrails as GuardianClaw Backend:
   - Use OpenGuardrails detection API as additional validation
   - Combine with GuardianClaw's CLAW gates for comprehensive protection

OpenGuardrails: https://github.com/openguardrails/openguardrails
Documentation: https://openguardrails.com

Example:
    # Use GuardianClaw as OpenGuardrails scanner
    from guardianclaw.integrations.openguardrails import register_claw_scanner

    register_claw_scanner(
        openguardrails_url="http://localhost:5000",
        jwt_token="your-token"
    )

    # Use OpenGuardrails in GuardianClaw
    from guardianclaw.integrations.openguardrails import OpenGuardrailsValidator

    validator = OpenGuardrailsValidator(
        api_url="http://localhost:5001",
        api_key="your-key"
    )
    result = validator.validate("Check this content")
"""

from __future__ import annotations

import logging
from json import JSONDecodeError
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from guardianclaw.integrations._base import (
    ClawIntegration,
    LayeredValidator,
    ValidationConfig,
    ValidationResult,
)

logger = logging.getLogger("guardianclaw.openguardrails")

# Check for requests availability
try:
    import requests
    REQUESTS_AVAILABLE = True
except (ImportError, AttributeError):
    REQUESTS_AVAILABLE = False
    requests = None


class RiskLevel(str, Enum):
    """OpenGuardrails risk levels"""
    LOW = "low_risk"
    MEDIUM = "medium_risk"
    HIGH = "high_risk"
    CRITICAL = "critical_risk"


class ScannerType(str, Enum):
    """OpenGuardrails scanner types"""
    GENAI = "genai"      # LLM-based contextual detection
    REGEX = "regex"      # Pattern matching
    KEYWORD = "keyword"  # Simple term matching


@dataclass
class DetectionResult:
    """Result from OpenGuardrails detection"""
    safe: bool
    risk_level: RiskLevel
    detections: List[Dict[str, Any]]
    raw_response: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_response(cls, response: Dict[str, Any]) -> "DetectionResult":
        """
        Create from OpenGuardrails API response.

        Args:
            response: API response dict containing 'detections' list

        Returns:
            DetectionResult instance

        Raises:
            ValueError: If response structure is invalid
        """
        # Validate response is a dict
        if not isinstance(response, dict):
            raise ValueError(
                f"response must be a dict, got {type(response).__name__}"
            )

        # Get detections with validation
        detections = response.get("detections", [])

        # Ensure detections is a list (could be None if explicitly set)
        if detections is None:
            detections = []
        if not isinstance(detections, list):
            raise ValueError(
                f"detections must be a list, got {type(detections).__name__}"
            )

        # Validate each detection is a dict
        for i, d in enumerate(detections):
            if not isinstance(d, dict):
                raise ValueError(
                    f"detection at index {i} must be a dict, got {type(d).__name__}"
                )

        # Valid risk levels - unknown values are treated as HIGH (fail-closed)
        valid_risk_levels = {"low_risk", "medium_risk", "high_risk", "critical_risk"}

        # Get risk levels with default for missing values
        # Missing risk_level defaults to "low_risk", but explicitly invalid values are unsafe
        def get_effective_risk(d: Dict[str, Any]) -> str:
            rl = d.get("risk_level")
            if rl is None:
                return "low_risk"  # Missing is safe (default)
            return rl  # Keep the value (may be invalid)

        # Safe if no high/critical/unknown detections (fail-closed for unknown)
        safe = not any(
            get_effective_risk(d) in ["high_risk", "critical_risk"] or
            (d.get("risk_level") is not None and d.get("risk_level") not in valid_risk_levels)
            for d in detections
        )

        # Get highest risk level (unknown treated as HIGH for safety)
        risk_levels = [get_effective_risk(d) for d in detections]
        # Check for any explicitly invalid risk levels (not just missing)
        has_unknown = any(
            d.get("risk_level") is not None and d.get("risk_level") not in valid_risk_levels
            for d in detections
        )

        if "critical_risk" in risk_levels:
            risk = RiskLevel.CRITICAL
        elif "high_risk" in risk_levels or has_unknown:
            risk = RiskLevel.HIGH
        elif "medium_risk" in risk_levels:
            risk = RiskLevel.MEDIUM
        else:
            risk = RiskLevel.LOW

        return cls(
            safe=safe,
            risk_level=risk,
            detections=detections,
            raw_response=response
        )


class OpenGuardrailsValidator:
    """
    Use OpenGuardrails as an additional validation backend for GuardianClaw.

    Combines OpenGuardrails detection with GuardianClaw's CLAW gates for
    comprehensive protection.

    Example:
        validator = OpenGuardrailsValidator(
            api_url="http://localhost:5001",
            api_key="your-api-key"
        )

        result = validator.validate(
            content="Check this for safety",
            scanners=["S1", "S2", "S3"]  # Specific scanners
        )

        if not result.safe:
            print(f"Blocked: {result.detections}")
    """

    def __init__(
        self,
        api_url: str = "http://localhost:5001",
        api_key: Optional[str] = None,
        timeout: int = 30,
        default_scanners: Optional[List[str]] = None,
        fail_safe: bool = False,
    ):
        """
        Args:
            api_url: OpenGuardrails API URL
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
            default_scanners: Default scanner tags to use
            fail_safe: If True, return safe=True on API errors (fail-open, DANGEROUS).
                      If False (default), return safe=False on errors (fail-closed, SECURE).
        """
        if not REQUESTS_AVAILABLE:
            raise ImportError(
                "requests is required for OpenGuardrails integration. "
                "Install with: pip install requests"
            )

        # Validate api_url
        if not api_url or not isinstance(api_url, str):
            raise ValueError("api_url must be a non-empty string")

        # Validate timeout
        if not isinstance(timeout, (int, float)) or timeout <= 0:
            raise ValueError("timeout must be a positive number")

        # Validate api_key
        if api_key is not None and not isinstance(api_key, str):
            raise TypeError(f"api_key must be string or None, got {type(api_key).__name__}")

        # Validate default_scanners
        if default_scanners is not None:
            if not isinstance(default_scanners, list):
                raise TypeError(f"default_scanners must be list or None, got {type(default_scanners).__name__}")
            for i, scanner in enumerate(default_scanners):
                if not isinstance(scanner, str):
                    raise TypeError(f"default_scanners[{i}] must be string, got {type(scanner).__name__}")

        # Validate fail_safe
        if not isinstance(fail_safe, bool):
            raise TypeError(f"fail_safe must be bool, got {type(fail_safe).__name__}")

        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.default_scanners = default_scanners or []
        self.fail_safe = fail_safe

    def _headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def validate(
        self,
        content: str,
        scanners: Optional[List[str]] = None,
        context: Optional[str] = None,
    ) -> DetectionResult:
        """
        Validate content using OpenGuardrails detection API.

        Args:
            content: Text content to validate
            scanners: List of scanner tags (e.g., ["S1", "S2"])
            context: Optional conversation context

        Returns:
            DetectionResult with safety assessment

        Raises:
            ValueError: If content is None or empty
        """
        # Validate input
        if content is None:
            raise ValueError("content cannot be None")
        if not isinstance(content, str):
            raise ValueError(f"content must be a string, got {type(content).__name__}")
        if not content.strip():
            raise ValueError("content cannot be empty or whitespace-only")

        # Validate scanners if provided
        if scanners is not None:
            if not isinstance(scanners, list):
                raise ValueError(f"scanners must be a list, got {type(scanners).__name__}")
            for i, scanner in enumerate(scanners):
                if not isinstance(scanner, str):
                    raise TypeError(f"scanners[{i}] must be string, got {type(scanner).__name__}")

        # Validate context if provided
        if context is not None:
            if not isinstance(context, str):
                raise TypeError(f"context must be string or None, got {type(context).__name__}")

        payload = {
            "content": content,
            "scanners": scanners or self.default_scanners,
        }
        if context:
            payload["context"] = context

        try:
            response = requests.post(
                f"{self.api_url}/api/v1/detect",
                headers=self._headers(),
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()

            # Parse JSON response with error handling
            try:
                response_data = response.json()
            except JSONDecodeError as e:
                logger.error(f"Invalid JSON response from OpenGuardrails: {e}")
                return self._handle_api_error(
                    f"Invalid JSON response: {e}",
                    error_type="json_decode_error"
                )

            # Validate response structure
            if not isinstance(response_data, dict):
                logger.error(f"Unexpected response type: {type(response_data)}")
                return self._handle_api_error(
                    f"Expected dict, got {type(response_data).__name__}",
                    error_type="invalid_response_structure"
                )

            return DetectionResult.from_response(response_data)

        except requests.RequestException as e:
            logger.error(f"OpenGuardrails API error: {e}")
            return self._handle_api_error(str(e), error_type="api_error")

    def _handle_api_error(
        self,
        error_msg: str,
        error_type: str = "api_error"
    ) -> DetectionResult:
        """
        Handle API errors with fail-safe/fail-closed logic.

        Args:
            error_msg: Error description
            error_type: Type of error for logging

        Returns:
            DetectionResult based on fail_safe setting
        """
        if self.fail_safe:
            logger.warning(
                f"OpenGuardrails error ({error_type}), returning safe=True (fail_safe=True). "
                "This is DANGEROUS as attackers can bypass validation."
            )
            return DetectionResult(
                safe=True,
                risk_level=RiskLevel.LOW,
                detections=[],
                raw_response={"error": error_msg, "fail_mode": "fail_safe"}
            )
        else:
            logger.warning(
                f"OpenGuardrails error ({error_type}), returning safe=False (fail-closed). "
                "Set fail_safe=True to allow requests on error (not recommended)."
            )
            return DetectionResult(
                safe=False,
                risk_level=RiskLevel.HIGH,
                detections=[{"type": error_type, "description": error_msg}],
                raw_response={"error": error_msg, "fail_mode": "fail_closed"}
            )

    def validate_prompt(
        self,
        prompt: str,
        scanners: Optional[List[str]] = None,
    ) -> DetectionResult:
        """Validate a prompt before sending to LLM"""
        return self.validate(prompt, scanners=scanners)

    def validate_response(
        self,
        response: str,
        prompt: Optional[str] = None,
        scanners: Optional[List[str]] = None,
    ) -> DetectionResult:
        """Validate LLM response with optional prompt context"""
        return self.validate(response, scanners=scanners, context=prompt)


class GuardianClawOpenGuardrailsScanner:
    """
    Register GuardianClaw as a custom scanner in OpenGuardrails.

    This allows using GuardianClaw's CLAW validation within the OpenGuardrails
    pipeline, combining GuardianClaw's alignment approach with OpenGuardrails'
    enterprise features.

    Example:
        scanner = GuardianClawOpenGuardrailsScanner(
            openguardrails_url="http://localhost:5000",
            jwt_token="your-jwt-token"
        )

        # Register GuardianClaw as a scanner
        scanner_tag = scanner.register()
        print(f"Registered as: {scanner_tag}")  # e.g., "S100"

        # Now GuardianClaw validation is available in OpenGuardrails
    """

    SCANNER_DEFINITION = """
    GuardianClaw CLAW Protocol Scanner - Validates content through four gates:

    1. CREDIBILITY: Detects misinformation, fake content, impersonation
    2. AVOIDANCE: Identifies violence, weapons, malware, theft, doxxing
    3. LIMITS: Catches jailbreaks, prompt injection, instruction override
    4. WORTH: Flags purposeless destruction or waste

    All gates must pass for content to be considered safe.
    Developed by GuardianClaw Team - https://guardianclaw.org
    """

    def __init__(
        self,
        openguardrails_url: str = "http://localhost:5000",
        jwt_token: Optional[str] = None,
        risk_level: RiskLevel = RiskLevel.HIGH,
        scan_prompt: bool = True,
        scan_response: bool = True,
        timeout: int = 30,
    ):
        """
        Args:
            openguardrails_url: OpenGuardrails management API URL
            jwt_token: JWT authentication token
            risk_level: Risk level for detections
            scan_prompt: Whether to scan prompts
            scan_response: Whether to scan responses
            timeout: Request timeout in seconds
        """
        if not REQUESTS_AVAILABLE:
            raise ImportError(
                "requests is required for OpenGuardrails integration. "
                "Install with: pip install requests"
            )

        # Validate openguardrails_url
        if not openguardrails_url or not isinstance(openguardrails_url, str):
            raise ValueError("openguardrails_url must be a non-empty string")

        # Validate risk_level
        if not isinstance(risk_level, RiskLevel):
            if isinstance(risk_level, str):
                try:
                    risk_level = RiskLevel(risk_level)
                except ValueError:
                    valid = [l.value for l in RiskLevel]
                    raise ValueError(f"Invalid risk_level '{risk_level}'. Must be one of: {', '.join(valid)}")
            else:
                raise TypeError(f"risk_level must be RiskLevel enum or string, got {type(risk_level).__name__}")

        # Validate timeout
        if not isinstance(timeout, (int, float)) or timeout <= 0:
            raise ValueError("timeout must be a positive number")

        # Validate scan_prompt and scan_response
        if not isinstance(scan_prompt, bool):
            raise TypeError(f"scan_prompt must be bool, got {type(scan_prompt).__name__}")
        if not isinstance(scan_response, bool):
            raise TypeError(f"scan_response must be bool, got {type(scan_response).__name__}")

        # Validate jwt_token
        if jwt_token is not None and not isinstance(jwt_token, str):
            raise TypeError(f"jwt_token must be string or None, got {type(jwt_token).__name__}")

        self.api_url = openguardrails_url.rstrip("/")
        self.jwt_token = jwt_token
        self.risk_level = risk_level
        self.scan_prompt = scan_prompt
        self.scan_response = scan_response
        self.timeout = timeout
        self._scanner_tag: Optional[str] = None

    def _headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {"Content-Type": "application/json"}
        if self.jwt_token:
            headers["Authorization"] = f"Bearer {self.jwt_token}"
        return headers

    def register(self) -> str:
        """
        Register GuardianClaw as a custom scanner in OpenGuardrails.

        Returns:
            Scanner tag (e.g., "S100") assigned by OpenGuardrails
        """
        payload = {
            "scanner_type": ScannerType.GENAI.value,
            "name": "GuardianClaw CLAW Protocol",
            "definition": self.SCANNER_DEFINITION,
            "risk_level": self.risk_level.value,
            "scan_prompt": self.scan_prompt,
            "scan_response": self.scan_response,
        }

        try:
            response = requests.post(
                f"{self.api_url}/api/v1/custom-scanners",
                headers=self._headers(),
                json=payload,
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            self._scanner_tag = data.get("tag")

            if not self._scanner_tag:
                raise RuntimeError(
                    "OpenGuardrails API returned empty tag. "
                    "The scanner may not have been registered correctly."
                )

            logger.info(f"Registered GuardianClaw scanner as {self._scanner_tag}")
            return self._scanner_tag

        except requests.RequestException as e:
            logger.error(f"Failed to register scanner: {e}")
            raise RuntimeError(f"Failed to register GuardianClaw scanner: {e}")

    def unregister(self) -> bool:
        """
        Unregister GuardianClaw scanner from OpenGuardrails.

        Returns:
            True if successful
        """
        if not self._scanner_tag:
            logger.warning("No scanner registered to unregister")
            return False

        try:
            response = requests.delete(
                f"{self.api_url}/api/v1/custom-scanners/{self._scanner_tag}",
                headers=self._headers(),
                timeout=self.timeout
            )
            response.raise_for_status()
            logger.info(f"Unregistered scanner {self._scanner_tag}")
            self._scanner_tag = None
            return True

        except requests.RequestException as e:
            logger.error(f"Failed to unregister scanner: {e}")
            return False

    @property
    def scanner_tag(self) -> Optional[str]:
        """Get the assigned scanner tag"""
        return self._scanner_tag


class GuardianClawGuardrailsWrapper(ClawIntegration):
    """
    Combined GuardianClaw + OpenGuardrails validation wrapper.

    Runs both GuardianClaw CLAW validation (via LayeredValidator) and
    OpenGuardrails detection in parallel or sequence, providing
    layered protection.

    Inherits from ClawIntegration for standardized validation.

    Example:
        from guardianclaw.integrations.openguardrails import (
            GuardianClawGuardrailsWrapper,
            OpenGuardrailsValidator
        )

        wrapper = GuardianClawGuardrailsWrapper(
            openguardrails=OpenGuardrailsValidator(
                api_url="http://localhost:5001"
            )
        )

        result = wrapper.validate_combined("Check this content")
        if not result["safe"]:
            print(f"Blocked by: {result['blocked_by']}")
    """

    _integration_name = "openguardrails_wrapper"

    def __init__(
        self,
        claw: Optional[Any] = None,
        openguardrails: Optional[OpenGuardrailsValidator] = None,
        require_both: bool = False,
        validator: Optional[LayeredValidator] = None,
    ):
        """
        Args:
            claw: GuardianClaw instance (backwards compatibility for get_seed())
            openguardrails: OpenGuardrailsValidator instance
            require_both: If True, both validators must fail to block (permissive mode).
                         If False (default), either validator can block (restrictive mode).
            validator: Optional LayeredValidator for dependency injection (testing)
        """
        # Validate openguardrails has validate method if provided (duck typing)
        if openguardrails is not None:
            if not callable(getattr(openguardrails, 'validate', None)):
                raise TypeError(
                    f"openguardrails must have a callable 'validate' method, "
                    f"got {type(openguardrails).__name__} without validate()"
                )

        # Validate require_both
        if not isinstance(require_both, bool):
            raise TypeError(f"require_both must be bool, got {type(require_both).__name__}")

        # Create LayeredValidator if not provided
        if validator is None:
            config = ValidationConfig(
                use_heuristic=True,
                use_semantic=False,
            )
            validator = LayeredValidator(config=config)

        # Initialize ClawIntegration
        super().__init__(validator=validator)

        # Keep claw for backwards compatibility (get_seed())
        self.claw = claw
        self.openguardrails = openguardrails
        self.require_both = require_both

        # Lazy import GuardianClaw for backwards compat if needed
        if self.claw is None:
            try:
                from guardianclaw import GuardianClaw
                self.claw = GuardianClaw()
            except (ImportError, AttributeError):
                logger.warning("GuardianClaw not available, using OpenGuardrails only")

    def validate_combined(
        self,
        content: str,
        scanners: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Validate content through both GuardianClaw (LayeredValidator) and OpenGuardrails.

        Args:
            content: Text to validate
            scanners: OpenGuardrails scanners to use

        Returns:
            Combined validation result with keys:
            - safe: bool - overall safety status
            - blocked_by: list - which validators blocked ("claw", "openguardrails")
            - claw_result: dict or None - GuardianClaw result
            - openguardrails_result: dict or None - processed OpenGuardrails result

        Raises:
            ValueError: If content is None or empty
        """
        # Validate input
        if content is None:
            raise ValueError("content cannot be None")
        if not isinstance(content, str):
            raise ValueError(f"content must be a string, got {type(content).__name__}")
        if not content.strip():
            raise ValueError("content cannot be empty or whitespace-only")

        result = {
            "safe": True,
            "blocked_by": [],
            "claw_result": None,
            "openguardrails_result": None,
        }

        # Run GuardianClaw validation using inherited validate() from ClawIntegration
        try:
            claw_result: ValidationResult = ClawIntegration.validate(self, content)
            result["claw_result"] = {
                "is_safe": claw_result.is_safe,
                "violations": claw_result.violations or [],
                "layer": claw_result.layer.value if claw_result.layer else "unknown",
            }

            if not claw_result.is_safe:
                result["blocked_by"].append("claw")
        except Exception as e:
            logger.error(f"GuardianClaw validation error: {e}")
            result["blocked_by"].append("claw_error")

        # Run OpenGuardrails validation
        if self.openguardrails:
            try:
                og_result = self.openguardrails.validate(content, scanners=scanners)
                result["openguardrails_result"] = {
                    "safe": og_result.safe,
                    "risk_level": og_result.risk_level.value,
                    "detections": og_result.detections,
                }
                if not og_result.safe:
                    result["blocked_by"].append("openguardrails")
            except ValueError as e:
                # Re-raise validation errors (e.g., empty content)
                raise
            except Exception as e:
                logger.error(f"OpenGuardrails validation error: {e}")
                result["blocked_by"].append("openguardrails_error")

        # Apply require_both logic:
        # - require_both=False (default): either validator can block (restrictive)
        # - require_both=True: both must fail to block (permissive)
        if self.require_both:
            # Permissive mode: only block if BOTH validators failed
            # Count actual failures (not errors, which are treated as failures)
            claw_failed = "claw" in result["blocked_by"]
            og_failed = "openguardrails" in result["blocked_by"]

            # If only one failed, allow (safe=True)
            # If both failed, block (safe=False)
            # If neither failed, allow (safe=True)
            if claw_failed and og_failed:
                result["safe"] = False
            else:
                result["safe"] = True

            # Handle errors: errors always count as failures for safety
            if "claw_error" in result["blocked_by"] or "openguardrails_error" in result["blocked_by"]:
                result["safe"] = False
        else:
            # Restrictive mode (default): any failure blocks
            if result["blocked_by"]:
                result["safe"] = False
            else:
                result["safe"] = True

        return result

    # Override validate() from ClawIntegration to provide the combined behavior
    # This maintains backwards compatibility with code that calls wrapper.validate()
    def validate(
        self,
        content: str,
        scanners: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Validate content through both GuardianClaw and OpenGuardrails.

        This is an alias for validate_combined() to maintain backwards
        compatibility.

        Args:
            content: Text to validate
            scanners: OpenGuardrails scanners to use

        Returns:
            Combined validation result dict
        """
        return self.validate_combined(content, scanners)


# Convenience functions

def register_claw_scanner(
    openguardrails_url: str = "http://localhost:5000",
    jwt_token: Optional[str] = None,
    risk_level: str = "high_risk",
) -> str:
    """
    Convenience function to register GuardianClaw as OpenGuardrails scanner.

    Args:
        openguardrails_url: OpenGuardrails management API URL
        jwt_token: JWT authentication token
        risk_level: Risk level for detections. Valid values:
            "low_risk", "medium_risk", "high_risk", "critical_risk"

    Returns:
        Scanner tag assigned by OpenGuardrails

    Raises:
        ValueError: If risk_level is not a valid RiskLevel value
    """
    # Validate risk_level before converting
    valid_levels = [level.value for level in RiskLevel]
    if risk_level not in valid_levels:
        raise ValueError(
            f"Invalid risk_level '{risk_level}'. "
            f"Must be one of: {', '.join(valid_levels)}"
        )

    scanner = GuardianClawOpenGuardrailsScanner(
        openguardrails_url=openguardrails_url,
        jwt_token=jwt_token,
        risk_level=RiskLevel(risk_level),
    )
    return scanner.register()


def create_combined_validator(
    openguardrails_url: str = "http://localhost:5001",
    openguardrails_key: Optional[str] = None,
    fail_safe: bool = False,
    require_both: bool = False,
) -> GuardianClawGuardrailsWrapper:
    """
    Convenience function to create combined GuardianClaw + OpenGuardrails validator.

    Args:
        openguardrails_url: OpenGuardrails detection API URL
        openguardrails_key: API key for OpenGuardrails
        fail_safe: If True, allow requests when OpenGuardrails API is down (DANGEROUS)
        require_both: If True, both validators must fail to block (permissive mode).
                     If False (default), either validator can block (restrictive mode).

    Returns:
        Combined validator wrapper
    """
    og_validator = OpenGuardrailsValidator(
        api_url=openguardrails_url,
        api_key=openguardrails_key,
        fail_safe=fail_safe,
    )
    return GuardianClawGuardrailsWrapper(openguardrails=og_validator, require_both=require_both)


__all__ = [
    "OpenGuardrailsValidator",
    "GuardianClawOpenGuardrailsScanner",
    "GuardianClawGuardrailsWrapper",
    "DetectionResult",
    "RiskLevel",
    "ScannerType",
    "register_claw_scanner",
    "create_combined_validator",
    "REQUESTS_AVAILABLE",
]


__version__ = "2.26.0"
