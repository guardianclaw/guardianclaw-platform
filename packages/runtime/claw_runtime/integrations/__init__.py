"""
Integration Handlers - Framework-specific execution handlers.

This module provides a unified interface for executing agents built with
different AI frameworks (Coinbase AgentKit, OpenAI Agents SDK, etc.).

Each handler wraps the corresponding guardianclaw integration and provides:
- Configuration mapping from platform UI to SDK
- Execution orchestration
- Result normalization
- Error handling with fallbacks

Usage:
    from claw_runtime.integrations import get_integration_handler

    # Get handler for a specific framework
    handler = get_integration_handler("coinbase", integration_config)

    # Execute with the handler
    result = handler.execute(state, step)

Supported Frameworks:
    - coinbase: Coinbase AgentKit with GuardianClawActionProvider
    - solana_agent_kit: Solana Agent Kit with GuardianClawSolanaProvider
    - openai_agents: OpenAI Agents SDK with GuardianClawGuardrail
    - google_adk: Google ADK with GuardianClawADKWrapper
    - virtuals: Virtuals Protocol with ClawValidator
    - elizaos: ElizaOS social agents with GuardianClawPlugin (Node.js runtime)
    - voltagent: VoltAgent with GuardianClawGuardrails (Node.js runtime)
"""

from __future__ import annotations

import logging
from typing import Dict, Any, Optional, Type, Callable

from claw_runtime.integrations.base_handler import (
    BaseIntegrationHandler,
    IntegrationConfig,
    IntegrationResult,
)

logger = logging.getLogger("claw_runtime.integrations")

# Registry of framework handlers
# Populated lazily to avoid import errors if SDK not available
_HANDLER_REGISTRY: Dict[str, Type[BaseIntegrationHandler]] = {}
_HANDLER_FACTORIES: Dict[str, Callable[..., BaseIntegrationHandler]] = {}


def register_handler(
    framework: str,
    handler_class: Optional[Type[BaseIntegrationHandler]] = None,
    factory: Optional[Callable[..., BaseIntegrationHandler]] = None,
) -> None:
    """
    Register a handler for a framework.

    Args:
        framework: Framework identifier (e.g., "coinbase", "openai_agents")
        handler_class: Handler class to instantiate
        factory: Alternative factory function for custom instantiation

    Either handler_class or factory must be provided, not both.
    """
    if handler_class and factory:
        raise ValueError("Provide either handler_class or factory, not both")
    if not handler_class and not factory:
        raise ValueError("Must provide either handler_class or factory")

    if handler_class:
        _HANDLER_REGISTRY[framework] = handler_class
        logger.debug(f"Registered handler class for {framework}: {handler_class.__name__}")
    else:
        _HANDLER_FACTORIES[framework] = factory
        logger.debug(f"Registered handler factory for {framework}")


def get_integration_handler(
    framework: str,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[BaseIntegrationHandler]:
    """
    Get an integration handler for a framework.

    This is the main entry point for getting framework-specific handlers.
    Returns None if the framework is not supported or handler creation fails.

    Args:
        framework: Framework identifier (e.g., "coinbase", "openai_agents")
        config: Integration configuration from agent.integration_config[framework]

    Returns:
        BaseIntegrationHandler instance or None if not available

    Example:
        handler = get_integration_handler("coinbase", {
            "spending_limits": {"max_single": 100},
            "blocklist": ["0x123..."],
        })

        if handler:
            result = handler.execute(state, step)
    """
    config = config or {}

    # Check factory first (allows custom instantiation)
    if framework in _HANDLER_FACTORIES:
        try:
            return _HANDLER_FACTORIES[framework](config)
        except Exception as e:
            logger.error(f"Factory failed for {framework}: {e}")
            return None

    # Check class registry
    if framework in _HANDLER_REGISTRY:
        try:
            handler_class = _HANDLER_REGISTRY[framework]
            return handler_class(IntegrationConfig.from_dict(config))
        except Exception as e:
            logger.error(f"Handler creation failed for {framework}: {e}")
            return None

    # Try lazy loading
    handler = _lazy_load_handler(framework, config)
    if handler:
        return handler

    logger.warning(f"No handler available for framework: {framework}")
    return None


def _lazy_load_handler(
    framework: str,
    config: Dict[str, Any],
) -> Optional[BaseIntegrationHandler]:
    """
    Attempt to lazy-load a handler for a framework.

    This allows handlers to be loaded on-demand without requiring
    all SDK dependencies to be installed.
    """
    handler_modules = {
        "coinbase": "claw_runtime.integrations.coinbase_handler",
        "solana_agent_kit": "claw_runtime.integrations.solana_handler",
        "openai_agents": "claw_runtime.integrations.openai_agents_handler",
        "google_adk": "claw_runtime.integrations.google_adk_handler",
        "virtuals": "claw_runtime.integrations.virtuals_handler",
        # Node.js runtime handlers
        "elizaos": "claw_runtime.integrations.elizaos_handler",
        "voltagent": "claw_runtime.integrations.voltagent_handler",
    }

    module_path = handler_modules.get(framework)
    if not module_path:
        return None

    try:
        import importlib
        module = importlib.import_module(module_path)

        # Convention: handler class is named {Framework}Handler
        # e.g., CoinbaseHandler, OpenaiAgentsHandler
        class_name = _framework_to_class_name(framework)
        handler_class = getattr(module, class_name, None)

        if handler_class and issubclass(handler_class, BaseIntegrationHandler):
            # Register for future use
            register_handler(framework, handler_class=handler_class)
            return handler_class(IntegrationConfig.from_dict(config))

    except ImportError as e:
        logger.debug(f"Could not import handler for {framework}: {e}")
    except Exception as e:
        logger.error(f"Error loading handler for {framework}: {e}")

    return None


def _framework_to_class_name(framework: str) -> str:
    """Convert framework ID to handler class name."""
    parts = framework.split("_")
    return "".join(part.capitalize() for part in parts) + "Handler"


def list_available_frameworks() -> list[str]:
    """
    List all frameworks that have registered handlers.

    Returns:
        List of framework identifiers
    """
    frameworks = set(_HANDLER_REGISTRY.keys()) | set(_HANDLER_FACTORIES.keys())
    return sorted(frameworks)


def is_framework_supported(framework: str) -> bool:
    """
    Check if a framework has a registered handler.

    Args:
        framework: Framework identifier

    Returns:
        True if handler is available
    """
    return framework in _HANDLER_REGISTRY or framework in _HANDLER_FACTORIES


# Export public API
__all__ = [
    "BaseIntegrationHandler",
    "IntegrationConfig",
    "IntegrationResult",
    "get_integration_handler",
    "register_handler",
    "list_available_frameworks",
    "is_framework_supported",
]
