"""
OpenAI Agents SDK integration for GuardianClaw AI.

Provides semantic guardrails for the OpenAI Agents SDK using LLM-based
CLAW (Credibility, Limits, Avoidance, Worth) validation with prompt injection protection.

This follows the official OpenAI Agents SDK specification:
https://openai.github.io/openai-agents-python/guardrails/

The guardrails use a dedicated LLM agent to perform semantic validation,
not regex patterns. This provides accurate, context-aware safety checks.

Security Features:
- Input sanitization to prevent prompt injection attacks
- XML escape of special characters
- Unique boundary tokens for content isolation
- Injection attempt detection with automatic blocking
- Configurable logging with PII redaction
- Rate limiting support via max_input_size

Requirements:
    pip install openai-agents guardianclaw

    Set your OpenAI API key:
    export OPENAI_API_KEY="your-key"

Usage:
    from guardianclaw.integrations.openai_agents import (
        create_claw_agent,
        claw_input_guardrail,
        claw_output_guardrail,
    )

    agent = create_claw_agent(
        name="Safe Assistant",
        instructions="You help users with tasks",
    )
"""

from __future__ import annotations

# Configuration
from .config import (
    GuardianClawGuardrailConfig,
    CLAW_GUARDRAIL_INSTRUCTIONS,
    VALID_SEED_LEVELS,
)

# Models
from .models import (
    CLAWValidationOutput,
    ValidationMetadata,
    ViolationRecord,
    ViolationsLog,
    get_violations_log,
    require_claw_validation_output,
    get_reasoning_safe,
    truncate_reasoning,
    PydanticNotAvailableError,
)

# Utilities
from .utils import (
    GuardianClawLogger,
    DefaultLogger,
    get_logger,
    set_logger,
    require_agents_sdk,
    truncate_text,
    extract_text_from_input,
    DEFAULT_MAX_INPUT_SIZE,
    DEFAULT_MAX_VIOLATIONS_LOG,
    DEFAULT_VALIDATION_TIMEOUT,
)

# Sanitization
from .sanitization import (
    sanitize_for_validation,
    create_validation_prompt,
    detect_injection_attempt,
    escape_xml_chars,
    generate_boundary_token,
)

# Guardrails
from .guardrails import (
    claw_input_guardrail,
    claw_output_guardrail,
    create_claw_guardrails,
    AGENTS_SDK_AVAILABLE,
    ValidationTimeoutError,
    ValidationParseError,
)

# Agent creation
from .agents import (
    create_claw_agent,
    inject_claw_instructions,
)


__all__ = [
    # Configuration
    "GuardianClawGuardrailConfig",
    "CLAW_GUARDRAIL_INSTRUCTIONS",
    "VALID_SEED_LEVELS",

    # Models
    "CLAWValidationOutput",
    "ValidationMetadata",
    "ViolationRecord",
    "ViolationsLog",
    "get_violations_log",
    "require_claw_validation_output",
    "get_reasoning_safe",
    "truncate_reasoning",

    # Utilities
    "GuardianClawLogger",
    "DefaultLogger",
    "get_logger",
    "set_logger",
    "require_agents_sdk",
    "truncate_text",
    "extract_text_from_input",
    "DEFAULT_MAX_INPUT_SIZE",
    "DEFAULT_MAX_VIOLATIONS_LOG",
    "DEFAULT_VALIDATION_TIMEOUT",

    # Sanitization
    "sanitize_for_validation",
    "create_validation_prompt",
    "detect_injection_attempt",
    "escape_xml_chars",
    "generate_boundary_token",

    # Guardrails
    "claw_input_guardrail",
    "claw_output_guardrail",
    "create_claw_guardrails",
    "AGENTS_SDK_AVAILABLE",

    # Exceptions
    "PydanticNotAvailableError",
    "ValidationTimeoutError",
    "ValidationParseError",

    # Agent creation
    "create_claw_agent",
    "inject_claw_instructions",
]


__version__ = "2.26.0"
