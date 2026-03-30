# GuardianClaw OpenGuardrails Integration

> Bidirectional integration between GuardianClaw and OpenGuardrails framework

## Overview

This integration provides two-way compatibility:
1. **Use OpenGuardrails as backend:** Leverage OpenGuardrails scanners from GuardianClaw
2. **Register GuardianClaw as scanner:** Add CLAW validation to OpenGuardrails pipeline

## Installation

```bash
pip install guardianclaw requests
# OpenGuardrails is optional - install separately if needed
pip install openguardrails
```

## Quick Start

### Use OpenGuardrails as Backend

```python
from guardianclaw.integrations.openguardrails import OpenGuardrailsValidator

validator = OpenGuardrailsValidator(
    api_url="http://localhost:5001",
    api_key="your-api-key",  # Optional
    timeout=30,
    fail_safe=False,  # Fail-closed by default (secure)
)

result = validator.validate("Check this content for safety")
print(f"Safe: {result.safe}")
print(f"Risk Level: {result.risk_level.value}")
print(f"Detections: {result.detections}")
```

### Register GuardianClaw as Scanner

```python
from guardianclaw.integrations.openguardrails import GuardianClawOpenGuardrailsScanner

scanner = GuardianClawOpenGuardrailsScanner(
    openguardrails_url="http://localhost:5000",
    jwt_token="your-jwt-token",
)

# Register GuardianClaw CLAW validation as a custom scanner
scanner_tag = scanner.register()
print(f"Registered as: {scanner_tag}")

# Now use in OpenGuardrails pipeline
# openguardrails scan --scanners {scanner_tag} "content"

# Cleanup when done
scanner.unregister()
```

### Combined Pipeline

```python
from guardianclaw.integrations.openguardrails import GuardianClawGuardrailsWrapper

wrapper = GuardianClawGuardrailsWrapper()

# Use both GuardianClaw and OpenGuardrails validation
result = wrapper.validate(
    content="Some content to validate",
    scanners=["S1", "S2"]  # OpenGuardrails scanner tags
)

print(f"Safe: {result['safe']}")
print(f"Blocked by: {result['blocked_by']}")
print(f"GuardianClaw result: {result['claw_result']}")
print(f"OpenGuardrails result: {result['openguardrails_result']}")
```

## GuardianClaw Scanner

When registered, GuardianClaw adds a CLAW Protocol scanner to OpenGuardrails that validates content through four gates:

| Gate | Description |
|------|-------------|
| **Truth** | Detects deception, misinformation, fake content |
| **Harm** | Detects harmful content (violence, weapons, etc.) |
| **Scope** | Detects jailbreaks, prompt injection, persona manipulation |
| **Purpose** | Detects purposeless or wasteful actions |

All four gates must pass for content to be considered safe.

## API Reference

### OpenGuardrailsValidator

```python
class OpenGuardrailsValidator:
    def __init__(
        self,
        api_url: str = "http://localhost:5001",
        api_key: Optional[str] = None,
        timeout: int = 30,
        default_scanners: Optional[List[str]] = None,
        fail_safe: bool = False,
    ):
        """
        Initialize OpenGuardrails validator.

        Args:
            api_url: OpenGuardrails API URL
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
            default_scanners: Default scanner tags to use
            fail_safe: If True, return safe=True on API errors (DANGEROUS).
                      If False (default), return safe=False on errors (SECURE).
        """

    def validate(
        self,
        content: str,
        scanners: Optional[List[str]] = None,
        context: Optional[str] = None,
    ) -> DetectionResult:
        """
        Validate content using OpenGuardrails detection API.

        Raises:
            ValueError: If content is None or empty
        """

    def validate_prompt(self, prompt: str, scanners: Optional[List[str]] = None) -> DetectionResult:
        """Validate a prompt before sending to LLM."""

    def validate_response(
        self,
        response: str,
        prompt: Optional[str] = None,
        scanners: Optional[List[str]] = None,
    ) -> DetectionResult:
        """Validate LLM response with optional prompt context."""
```

### GuardianClawOpenGuardrailsScanner

```python
class GuardianClawOpenGuardrailsScanner:
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
        Initialize scanner to register GuardianClaw with OpenGuardrails.

        Args:
            openguardrails_url: OpenGuardrails management API URL
            jwt_token: JWT authentication token
            risk_level: Risk level for detections
            scan_prompt: Whether to scan prompts
            scan_response: Whether to scan responses
            timeout: Request timeout in seconds
        """

    def register(self) -> str:
        """
        Register GuardianClaw as a custom scanner in OpenGuardrails.

        Returns:
            Scanner tag assigned by OpenGuardrails

        Raises:
            RuntimeError: If registration fails or tag is not returned
        """

    def unregister(self) -> bool:
        """Remove GuardianClaw from OpenGuardrails registry."""

    @property
    def scanner_tag(self) -> Optional[str]:
        """Get the assigned scanner tag."""
```

### GuardianClawGuardrailsWrapper

```python
class GuardianClawGuardrailsWrapper:
    def __init__(
        self,
        claw: Optional[Any] = None,
        openguardrails: Optional[OpenGuardrailsValidator] = None,
        require_both: bool = False,
        validator: Optional[LayeredValidator] = None,
    ):
        """
        Initialize combined wrapper.

        Args:
            claw: GuardianClaw instance (optional, will create if not provided)
            openguardrails: OpenGuardrailsValidator instance
            require_both: If True, both validators must fail to block (permissive mode).
                         If False (default), either validator can block (restrictive mode).
            validator: Optional LayeredValidator for dependency injection (testing)
        """

    def validate(
        self,
        content: str,
        scanners: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Validate with both GuardianClaw and OpenGuardrails.

        Returns:
            Dict with keys:
            - safe: bool - overall safety status
            - blocked_by: list - which validators blocked ("claw", "openguardrails")
            - claw_result: dict or None - raw GuardianClaw result
            - openguardrails_result: dict or None - processed OpenGuardrails result

        Raises:
            ValueError: If content is None or empty
        """
```

### Convenience Functions

```python
def register_claw_scanner(
    openguardrails_url: str = "http://localhost:5000",
    jwt_token: Optional[str] = None,
    risk_level: str = "high_risk",
) -> str:
    """
    Quick registration of GuardianClaw as OpenGuardrails scanner.

    Args:
        risk_level: "low_risk", "medium_risk", "high_risk", or "critical_risk"

    Raises:
        ValueError: If risk_level is invalid
    """

def create_combined_validator(
    openguardrails_url: str = "http://localhost:5001",
    openguardrails_key: Optional[str] = None,
    fail_safe: bool = False,
) -> GuardianClawGuardrailsWrapper:
    """Create combined GuardianClaw + OpenGuardrails validator."""
```

## Error Handling

The integration uses fail-closed behavior by default:
- If OpenGuardrails API is unavailable, requests are blocked (`safe=False`)
- Set `fail_safe=True` to allow requests when API is down (NOT recommended)

```python
# Secure (default) - blocks if API unavailable
validator = OpenGuardrailsValidator(fail_safe=False)

# Insecure - allows if API unavailable (use with caution!)
validator = OpenGuardrailsValidator(fail_safe=True)
```

## Related

- [OpenGuardrails](https://github.com/openguardrails/openguardrails)
- [GuardianClaw Documentation](https://guardianclaw.org/docs)
- [CLAW Protocol](https://guardianclaw.org/docs/methodology)

## License

MIT
