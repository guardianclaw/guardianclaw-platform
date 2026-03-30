"""
GuardianClaw Integrations

Framework integrations for GuardianClaw AI safety validation.

Each integration is a subpackage with:
- __init__.py: The integration module
- example.py: Usage examples

Base classes (for integration developers):
    from guardianclaw.integrations._base import ClawIntegration
    from guardianclaw.integrations._base import AsyncClawIntegration

Available integrations:
    from guardianclaw.integrations.google_adk import GuardianClawPlugin  # Google ADK
    from guardianclaw.integrations.anthropic_sdk import GuardianClawAnthropic
    from guardianclaw.integrations.mcp_server import create_claw_mcp_server
    from guardianclaw.integrations.openai_agents import create_claw_agent
    from guardianclaw.integrations.agent_validation import SafetyValidator
    from guardianclaw.integrations.solana_agent_kit import ClawValidator
    from guardianclaw.integrations.virtuals import GuardianClawSafetyWorker
    from guardianclaw.integrations.garak import TruthGate, HarmGate  # Garak probes
    from guardianclaw.integrations.openguardrails import OpenGuardrailsValidator
    from guardianclaw.integrations.pyrit import GuardianClawCLAWScorer  # PyRIT scorers

External packages (npm/PyPI):
    See packages/ directory for:
    - elizaos: npm install @guardianclaw/elizaos-plugin
    - promptfoo: pip install guardianclaw-promptfoo
    - solana-agent-kit: npm install @guardianclaw/solana-agent-kit

Garak (NVIDIA LLM Vulnerability Scanner):
    Install: python -m guardianclaw.integrations.garak.install
    Usage: garak --model_type openai --model_name gpt-4o --probes claw_claw

OpenAI Agents SDK:
    from guardianclaw.integrations.openai_agents import (
        create_claw_agent,
        claw_input_guardrail,
        claw_output_guardrail,
    )

Coinbase Ecosystem (AgentKit + x402):
    from guardianclaw.integrations.coinbase import (
        # AgentKit guardrails
        claw_action_provider,
        GuardianClawActionProvider,
        TransactionValidator,
        validate_address,
        assess_defi_risk,
        # x402 payment validation
        GuardianClawX402Middleware,
        claw_x402_action_provider,
        claw_x402_hooks,
        PaymentValidationResult,
        PaymentRiskLevel,
        # Configuration
        get_default_config,
        SecurityProfile,
        ChainType,
    )

Google Agent Development Kit (ADK):
    from guardianclaw.integrations.google_adk import (
        # Plugin (global guardrails)
        GuardianClawPlugin,
        create_claw_plugin,
        # Callbacks (per-agent guardrails)
        create_before_model_callback,
        create_after_model_callback,
        create_before_tool_callback,
        create_after_tool_callback,
        create_claw_callbacks,
    )
"""

# Base classes for integration developers
from guardianclaw.integrations._base import ClawIntegration, AsyncClawIntegration

__all__ = [
    # Base classes
    'ClawIntegration',
    'AsyncClawIntegration',
    # Integration subpackages
    'agent_validation',
    'anthropic_sdk',
    'coinbase',
    'garak',
    'google_adk',
    'mcp_server',
    'openai_agents',
    'openguardrails',
    'pyrit',
    'solana_agent_kit',
    'virtuals',
]
