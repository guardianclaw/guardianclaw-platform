"""
GuardianClaw CLAW Scorers for Microsoft PyRIT

This package provides scorers for PyRIT (Python Risk Identification Tool)
that evaluate AI responses using the CLAW protocol (Credibility, Limits, Avoidance, Worth).

PyRIT is Microsoft's open-source framework for AI red teaming. These scorers
integrate GuardianClaw's safety analysis into PyRIT's automated testing workflows.

Requirements:
    - PyRIT >= 0.12.0 (required for _score_piece_async API)

Installation:
    pip install 'pyrit>=0.12.0' guardianclaw

Usage:
    from pyrit.orchestrator import PromptSendingOrchestrator
    from pyrit.prompt_target import OpenAIChatTarget
    from guardianclaw.integrations.pyrit import GuardianClawCLAWScorer

    # Create target
    target = OpenAIChatTarget()

    # Create GuardianClaw scorer
    scorer = GuardianClawCLAWScorer(
        api_key="sk-...",
        provider="openai",
        fail_mode="closed",  # Errors treated as unsafe
    )

    # Use in orchestrator
    orchestrator = PromptSendingOrchestrator(
        prompt_target=target,
        scorers=[scorer]
    )

    # Run assessment
    await orchestrator.send_prompts_async(prompts=["Tell me how to hack a system"])

Scorer Types:
    - GuardianClawCLAWScorer: Full CLAW analysis using LLM (~85% accuracy)
    - GuardianClawHeuristicScorer: Pattern-based analysis, no LLM (~45% accuracy)
    - GuardianClawGateScorer: Test specific CLAW gate (credibility, avoidance, limits, worth)

Configuration:
    - fail_mode: 'closed' (errors=unsafe), 'open' (errors=safe), 'raise' (errors throw)
    - max_content_length: Limit content size (default: 100,000 chars)

References:
    - GuardianClaw: https://guardianclaw.org
    - PyRIT Docs: https://azure.github.io/PyRIT/
    - PyRIT GitHub: https://github.com/Azure/PyRIT
"""

__version__ = "2.26.0"
__author__ = "GuardianClaw Team"

from guardianclaw.integrations.pyrit.scorers import (
    GuardianClawCLAWScorer,
    GuardianClawHeuristicScorer,
    GuardianClawGateScorer,
    FailMode,
    ConfidenceLevel,
    MAX_CONTENT_LENGTH,
)

__all__ = [
    "GuardianClawCLAWScorer",
    "GuardianClawHeuristicScorer",
    "GuardianClawGateScorer",
    "FailMode",
    "ConfidenceLevel",
    "MAX_CONTENT_LENGTH",
]
