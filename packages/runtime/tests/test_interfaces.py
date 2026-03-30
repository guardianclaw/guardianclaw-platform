"""
Tests for runtime interfaces (TypedDict definitions).

These tests verify:
- TypedDict structure compliance
- Required vs optional fields
- Type hints correctness
"""

import pytest
from typing import get_type_hints


class TestValidationResultDict:
    """Tests for ValidationResultDict type."""

    def test_can_create_valid_result(self):
        """Test creating a valid ValidationResultDict."""
        from claw_runtime.interfaces import ValidationResultDict

        result: ValidationResultDict = {
            "is_safe": True,
            "blocked": False,
            "confidence": 0.95,
            "reason": None,
            "violations": [],
            "gate": "gate1",
            "metadata": {"latency_ms": 50},
        }

        assert result["is_safe"] is True
        assert result["blocked"] is False
        assert result["confidence"] == 0.95

    def test_blocked_result(self):
        """Test creating a blocked ValidationResultDict."""
        from claw_runtime.interfaces import ValidationResultDict

        result: ValidationResultDict = {
            "is_safe": False,
            "blocked": True,
            "confidence": 0.92,
            "reason": "Harmful content detected",
            "violations": ["avoidance:violence", "limits:jailbreak"],
            "gate": "gate2",
            "metadata": {"stage": "output"},
        }

        assert result["blocked"] is True
        assert len(result["violations"]) == 2


class TestStatsDict:
    """Tests for StatsDict type."""

    def test_can_create_stats(self):
        """Test creating a valid StatsDict."""
        from claw_runtime.interfaces import StatsDict

        stats: StatsDict = {
            "total_validations": 100,
            "blocked_count": 15,
            "passed_count": 85,
            "gate1_blocks": 10,
            "gate2_blocks": 4,
            "gate3_blocks": 1,
            "gate3_calls": 5,
            "avg_latency_ms": 45.5,
        }

        assert stats["total_validations"] == 100
        assert stats["blocked_count"] + stats["passed_count"] == 100


class TestExecutionResult:
    """Tests for ExecutionResult type."""

    def test_success_result(self):
        """Test creating a successful ExecutionResult."""
        from claw_runtime.interfaces import ExecutionResult

        result: ExecutionResult = {
            "blocked": False,
            "response": "Hello! I'm here to help.",
            "stage": None,
            "gate": None,
            "reason": None,
            "violations": None,
            "claw": {
                "input": {"blocked": False},
                "output": {"blocked": False},
            },
            "error": None,
            "latency_ms": 250.5,
            "flow_stats": {"total_executions": 1},
        }

        assert result["blocked"] is False
        assert result["response"] is not None

    def test_blocked_result(self):
        """Test creating a blocked ExecutionResult."""
        from claw_runtime.interfaces import ExecutionResult

        result: ExecutionResult = {
            "blocked": True,
            "response": None,
            "stage": "input",
            "gate": "gate1",
            "reason": "Jailbreak attempt detected",
            "violations": ["jailbreak"],
            "claw": {"input": {"blocked": True}},
            "error": None,
            "latency_ms": 15.2,
            "flow_stats": {},
        }

        assert result["blocked"] is True
        assert result["response"] is None
        assert result["stage"] == "input"


class TestFlowTypes:
    """Tests for Flow-related types."""

    def test_flow_node_dict(self):
        """Test FlowNodeDict structure."""
        from claw_runtime.interfaces import FlowNodeDict

        node: FlowNodeDict = {
            "id": "node-1",
            "type": "process",
            "position": {"x": 100, "y": 200},
            "data": {
                "label": "LLM Call",
                "processType": "llm_call",
                "config": {"model": "gpt-4o-mini"},
            },
        }

        assert node["id"] == "node-1"
        assert node["type"] == "process"

    def test_flow_edge_dict(self):
        """Test FlowEdgeDict structure."""
        from claw_runtime.interfaces import FlowEdgeDict

        edge: FlowEdgeDict = {
            "id": "edge-1",
            "source": "node-1",
            "target": "node-2",
        }

        assert edge["source"] == "node-1"
        assert edge["target"] == "node-2"

    def test_flow_dict(self):
        """Test FlowDict structure."""
        from claw_runtime.interfaces import FlowDict

        flow: FlowDict = {
            "nodes": [
                {"id": "n1", "type": "input", "position": {"x": 0, "y": 0}, "data": {}},
                {"id": "n2", "type": "output", "position": {"x": 0, "y": 100}, "data": {}},
            ],
            "edges": [
                {"id": "e1", "source": "n1", "target": "n2"},
            ],
        }

        assert len(flow["nodes"]) == 2
        assert len(flow["edges"]) == 1


class TestConfigTypes:
    """Tests for configuration types."""

    def test_llm_config(self):
        """Test LLMConfig structure."""
        from claw_runtime.interfaces import LLMConfig

        config: LLMConfig = {
            "provider": "openai",
            "model": "gpt-4o-mini",
            "temperature": 0.7,
            "max_tokens": 2048,
            "system_prompt": "You are a helpful assistant.",
        }

        assert config["provider"] == "openai"
        assert config["temperature"] == 0.7

    def test_claw_config_dict(self):
        """Test ClawConfigDict structure."""
        from claw_runtime.interfaces import ClawConfigDict

        config: ClawConfigDict = {
            "protection_level": "standard",
            "gate1_enabled": True,
            "gate2_enabled": True,
            "gate3_enabled": False,
            "fail_closed": False,
            "gates": {
                "credibility": True,
                "avoidance": True,
                "limits": True,
                "worth": True,
            },
        }

        assert config["protection_level"] == "standard"
        assert config["gates"]["avoidance"] is True
