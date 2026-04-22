"""
GuardianClaw Core Module - Main GuardianClaw class, Interfaces and Base Types.

This module provides:
- GuardianClaw: Main class for AI alignment toolkit
- SeedLevel: Enum for seed levels
- Validator: Protocol class defining the validator contract
- Exceptions for error handling
- ClawValidator: Unified 3-gate orchestrator (v3.0)
- ClawConfig: Configuration for v3.0 architecture
- ClawObserver: LLM-based transcript observer (Gate 4 — L4)

Usage:
    from guardianclaw.core import GuardianClaw, SeedLevel
    from guardianclaw.core import Validator
    from guardianclaw.core.exceptions import ValidationError

    # v3.0 architecture
    from guardianclaw.core import ClawValidator, ClawConfig

Design Philosophy:
    - Protocol-based interfaces for flexibility
    - Clear exception hierarchy for error handling
    - Separation of concerns between core and implementations
"""

# Re-export from the main GuardianClaw module (core.py -> guardianclaw_core.py)
# This ensures backwards compatibility after directory rename

# Import from the renamed guardianclaw_core module
from guardianclaw.guardianclaw_core import GuardianClaw, SeedLevel

from guardianclaw.core.interfaces import Validator, AsyncValidator
from guardianclaw.core.exceptions import (
    GuardianClawError,
    ValidationError,
    ConfigurationError,
    IntegrationError,
)
from guardianclaw.core.types import (
    ChatResponse,
    ValidationInfo,
    ValidatorStats,
    CLAWResultDict,
    LegacyValidationDict,
)

# v3.0 architecture components
from guardianclaw.core.claw_config import (
    ClawConfig,
    BlockMessages,
    Gate4Fallback,
)
from guardianclaw.core.claw_results import ObservationResult, GuardianClawResult
from guardianclaw.core.observer import (
    ClawObserver,
    ConversationContext,
    ConversationTurn,
)
from guardianclaw.core.claw_validator import ClawValidator
from guardianclaw.core.retry import (
    RetryConfig,
    RetryStats,
    RetryableAPICall,
)
from guardianclaw.core.token_tracker import (
    TokenTracker,
    ComponentUsage,
    get_tracker,
)


__all__ = [
    # Main GuardianClaw class
    "GuardianClaw",
    "SeedLevel",
    # Interfaces
    "Validator",
    "AsyncValidator",
    # Exceptions
    "GuardianClawError",
    "ValidationError",
    "ConfigurationError",
    "IntegrationError",
    # Types
    "ChatResponse",
    "ValidationInfo",
    "ValidatorStats",
    "CLAWResultDict",
    "LegacyValidationDict",
    # v3.0 architecture
    "ClawValidator",
    "ClawConfig",
    "BlockMessages",
    "Gate4Fallback",
    "ClawObserver",
    "GuardianClawResult",
    "ObservationResult",
    # Multi-turn support
    "ConversationContext",
    "ConversationTurn",
    # Retry logic
    "RetryConfig",
    "RetryStats",
    "RetryableAPICall",
    # Token tracking
    "TokenTracker",
    "ComponentUsage",
    "get_tracker",
]

__version__ = "1.0.0"
