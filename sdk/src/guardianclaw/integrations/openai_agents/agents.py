"""
Agent creation utilities for OpenAI Agents SDK integration.

Provides functions to create GuardianClaw-protected agents and inject seeds.
"""

from __future__ import annotations

from typing import Any, List, Optional, TYPE_CHECKING

from .config import GuardianClawGuardrailConfig, VALID_SEED_LEVELS
from .guardrails import (
    claw_input_guardrail,
    claw_output_guardrail,
    AGENTS_SDK_AVAILABLE,
)
from .utils import require_agents_sdk, get_logger

# GuardianClaw imports
from guardianclaw import GuardianClaw

if TYPE_CHECKING:
    from agents import Agent


def inject_claw_instructions(
    instructions: Optional[str] = None,
    seed_level: str = "standard",
) -> str:
    """
    Inject GuardianClaw seed into agent instructions.

    Prepends the GuardianClaw alignment seed to the provided instructions.
    The seed establishes safety principles that guide the agent's behavior.

    Args:
        instructions: Base agent instructions (can be None)
        seed_level: Seed level to use (minimal, standard, full)

    Returns:
        Instructions with GuardianClaw seed prepended

    Raises:
        ValueError: If seed_level is not valid

    Example:
        from agents import Agent
        from guardianclaw.integrations.openai_agents import inject_claw_instructions

        agent = Agent(
            name="Safe Agent",
            instructions=inject_claw_instructions(
                "You help users with their questions",
                seed_level="standard",
            ),
        )
    """
    if seed_level not in VALID_SEED_LEVELS:
        raise ValueError(
            f"seed_level must be one of {VALID_SEED_LEVELS}, got '{seed_level}'"
        )

    claw = GuardianClaw(seed_level=seed_level)
    seed = claw.get_seed()

    if instructions:
        return f"{seed}\n\n---\n\n{instructions}"
    return seed


def create_claw_agent(
    name: str,
    instructions: Optional[str] = None,
    model: Optional[str] = None,
    tools: Optional[List[Any]] = None,
    handoffs: Optional[List[Any]] = None,
    model_settings: Optional[Any] = None,
    seed_level: str = "standard",
    guardrail_config: Optional[GuardianClawGuardrailConfig] = None,
    inject_seed: bool = True,
    add_input_guardrail: bool = True,
    add_output_guardrail: bool = True,
    input_guardrail_parallel: bool = False,
    **kwargs,
) -> "Agent":
    """
    Create an OpenAI Agent with GuardianClaw protection.

    This creates an agent with:
    1. GuardianClaw seed injected into instructions (alignment principles)
    2. Semantic input guardrail (LLM-based CLAW validation)
    3. Semantic output guardrail (LLM-based CLAW validation)

    The guardrails use a dedicated LLM agent for semantic validation,
    providing context-aware safety checks with prompt injection protection.

    IMPORTANT: The seed_level parameter controls BOTH the seed injection
    AND the guardrail configuration. If you provide a guardrail_config,
    its seed_level will be used, overriding the seed_level parameter.

    Args:
        name: Agent name
        instructions: Base agent instructions (seed prepended if inject_seed=True)
        model: Model to use (e.g., "gpt-4o")
        tools: List of tools for the agent
        handoffs: List of agents for handoff
        model_settings: Model configuration
        seed_level: GuardianClaw seed level (minimal, standard, full)
                   NOTE: Overridden by guardrail_config.seed_level if provided
        guardrail_config: Guardrail configuration (takes precedence for seed_level)
        inject_seed: Whether to inject seed into instructions
        add_input_guardrail: Whether to add semantic input guardrail
        add_output_guardrail: Whether to add semantic output guardrail
        input_guardrail_parallel: Whether input guardrail runs in parallel
        **kwargs: Additional Agent parameters

    Returns:
        Agent instance with GuardianClaw protection

    Raises:
        ImportError: If openai-agents package is not installed
        ValueError: If seed_level is invalid

    Example:
        from guardianclaw.integrations.openai_agents import create_claw_agent
        from agents import Runner

        agent = create_claw_agent(
            name="Code Helper",
            instructions="You help users write Python code",
            model="gpt-4o",
        )

        result = await Runner.run(agent, "Help me sort a list")
        print(result.final_output)
    """
    require_agents_sdk()

    from agents import Agent

    logger = get_logger()

    # Validate seed_level early
    if seed_level not in VALID_SEED_LEVELS:
        raise ValueError(
            f"seed_level must be one of {VALID_SEED_LEVELS}, got '{seed_level}'"
        )

    # Resolve configuration - guardrail_config takes precedence
    if guardrail_config is not None:
        config = guardrail_config
        # Use config's seed_level for consistency
        effective_seed_level = config.seed_level
        if seed_level != "standard" and seed_level != config.seed_level:
            logger.warning(
                f"Both seed_level='{seed_level}' and guardrail_config.seed_level='{config.seed_level}' "
                f"provided. Using guardrail_config.seed_level='{config.seed_level}' for consistency."
            )
    else:
        config = GuardianClawGuardrailConfig(seed_level=seed_level)
        effective_seed_level = seed_level

    # Prepare instructions with seed injection
    if inject_seed:
        final_instructions = inject_claw_instructions(
            instructions=instructions,
            seed_level=effective_seed_level,  # Use resolved seed level
        )
    else:
        final_instructions = instructions

    # Build guardrails list (handle None explicitly passed by user)
    input_guardrails = list(kwargs.pop("input_guardrails", None) or [])
    output_guardrails = list(kwargs.pop("output_guardrails", None) or [])

    if add_input_guardrail:
        input_guardrails.append(
            claw_input_guardrail(
                config=config,
                run_in_parallel=input_guardrail_parallel,
            )
        )

    if add_output_guardrail:
        output_guardrails.append(claw_output_guardrail(config=config))

    # Create agent - only pass parameters that have values
    # (some SDKs treat None differently from omitted parameters)
    agent_kwargs = {
        "name": name,
        "instructions": final_instructions,
        "tools": tools or [],
        "handoffs": handoffs or [],
        "input_guardrails": input_guardrails,
        "output_guardrails": output_guardrails,
    }

    # Only add optional parameters if they have values
    if model is not None:
        agent_kwargs["model"] = model
    if model_settings is not None:
        agent_kwargs["model_settings"] = model_settings

    # Merge any additional kwargs
    agent_kwargs.update(kwargs)

    return Agent(**agent_kwargs)
