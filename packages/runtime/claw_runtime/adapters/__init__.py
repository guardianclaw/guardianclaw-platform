"""
GuardianClaw SDK Adapters - ADR-004 Implementation.

This module provides a unified interface to the GuardianClaw SDK,
following the Adapter Pattern as specified in ADR-004.

The adapter abstracts away SDK version differences, allowing
transparent migration from v2.x to v3.0 without runtime changes.

Usage:
    from claw_runtime.adapters import create_claw_adapter

    # Auto-detect best available version
    adapter = create_claw_adapter(config={"gate1_enabled": True})

    # Force specific version
    adapter = create_claw_adapter(version="v3", config={...})
"""

from typing import Literal, Optional

from claw_runtime.adapters.claw_adapter import GuardianClawAdapter
from claw_runtime.interfaces import ClawConfigDict


def create_claw_adapter(
    version: Literal["v2", "v3", "auto"] = "auto",
    config: Optional[ClawConfigDict] = None,
) -> GuardianClawAdapter:
    """
    Factory to create GuardianClaw SDK adapter.

    The adapter provides a unified interface regardless of SDK version,
    following ADR-004 SDK Abstraction Layer specification.

    Args:
        version: SDK version to use
            - "v2": Force SDK v2.x (LayeredValidator)
            - "v3": Force SDK v3.0 (ClawValidator)
            - "auto": Use v3.0 if available, fallback to v2.x
        config: GuardianClaw configuration dict

    Returns:
        GuardianClawAdapter instance

    Example:
        adapter = create_claw_adapter(
            version="auto",
            config={
                "gate1_enabled": True,
                "gate2_enabled": True,
                "gate3_enabled": False,  # Save LLM costs
                "protection_level": "standard",
            }
        )

        # Validate input
        result = adapter.validate_input("User message")

        # Validate output with context
        result = adapter.validate_output(
            output="AI response",
            input_context="User message"
        )
    """
    config = config or {}

    # Create adapter - currently using v3.0 ClawValidator directly
    # as it's available in guardianclaw >= 2.21.0
    return GuardianClawAdapter(config)


__all__ = ["create_claw_adapter", "GuardianClawAdapter"]
