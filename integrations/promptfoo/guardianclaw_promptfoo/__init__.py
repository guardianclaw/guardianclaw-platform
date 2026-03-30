"""
GuardianClaw Safety Provider for Promptfoo

A custom promptfoo provider that wraps any LLM with GuardianClaw safety validation.
Use this to test how well your models respond when protected by GuardianClaw seeds.

Usage in promptfooconfig.yaml:
    providers:
      - id: 'python:guardianclaw_promptfoo'
        label: 'GuardianClaw Protected GPT-4'
        config:
          base_provider: 'openai:gpt-4o'
          seed_version: 'v2'
          seed_variant: 'standard'

Available seed versions:
    - v1_minimal, v1_standard, v1_full (3-gate THS protocol)
    - v2_minimal, v2_standard, v2_full (4-gate CLAW protocol)

Documentation: https://guardianclaw.org/docs/promptfoo
"""

from .provider import (
    call_api,
    validate_response,
    get_seed,
    parse_provider,
    SEEDS,
)

__version__ = "1.0.1"
__all__ = ["call_api", "validate_response", "get_seed", "parse_provider", "SEEDS"]
