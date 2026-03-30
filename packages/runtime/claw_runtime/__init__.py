"""
GuardianClaw Runtime - Serverless Python runtime for agent execution.

This package provides:
- AgentExecutor: Executes agent flows with GuardianClaw protection
- GuardianClawAdapter: Unified interface to GuardianClaw SDK (ADR-004)
- FlowParser: Parses visual flow into executable steps
- Modal.com integration for serverless deployment

Usage:
    # Local execution
    from claw_runtime import AgentExecutor

    executor = AgentExecutor(
        flow=flow_dict,
        llm_config={"provider": "openai", "model": "gpt-4o-mini"},
        claw_config={"gate1_enabled": True, "gate2_enabled": True},
    )
    result = executor.run("Hello, how can you help?")

    # Modal.com execution
    import modal
    from claw_runtime.main import execute_agent

    result = execute_agent.remote(
        flow=flow_dict,
        input_text="Hello",
        llm_config={...},
        claw_config={...},
    )
"""

from claw_runtime.interfaces import (
    ValidationResultDict,
    StatsDict,
    ExecutionResult,
    FlowNodeDict,
    FlowEdgeDict,
    FlowDict,
)
from claw_runtime.adapters import create_claw_adapter, GuardianClawAdapter
from claw_runtime.flow_parser import FlowParser, ParsedFlow, FlowStep
from claw_runtime.executor import AgentExecutor

__version__ = "0.1.0"

__all__ = [
    # Types
    "ValidationResultDict",
    "StatsDict",
    "ExecutionResult",
    "FlowNodeDict",
    "FlowEdgeDict",
    "FlowDict",
    # Adapters
    "create_claw_adapter",
    "GuardianClawAdapter",
    # Flow parsing
    "FlowParser",
    "ParsedFlow",
    "FlowStep",
    # Executor
    "AgentExecutor",
]
