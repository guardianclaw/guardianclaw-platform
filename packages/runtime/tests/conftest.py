"""
Test fixtures for GuardianClaw Runtime tests.

Provides mock objects and sample data for testing the runtime components
without requiring actual SDK or LLM connections.
"""

import pytest
from dataclasses import dataclass
from typing import Optional, List
from unittest.mock import MagicMock, patch


# Mock SDK types to avoid import dependency in tests
@dataclass
class MockInputValidationResult:
    """Mock for guardianclaw InputValidationResult."""
    is_attack: bool
    blocked: bool = False
    confidence: float = 0.9
    attack_types: Optional[List[str]] = None

    def __post_init__(self):
        if self.attack_types is None:
            self.attack_types = []
        if self.is_attack:
            self.blocked = True


@dataclass
class MockOutputValidationResult:
    """Mock for guardianclaw OutputValidationResult."""
    seed_failed: bool
    confidence: float = 0.85
    failure_types: Optional[List[str]] = None
    gates_failed: Optional[List[str]] = None

    def __post_init__(self):
        if self.failure_types is None:
            self.failure_types = []
        if self.gates_failed is None:
            self.gates_failed = []


@dataclass
class MockObservationResult:
    """Mock for guardianclaw ObservationResult."""
    is_safe: bool
    input_malicious: bool = False
    ai_complied: bool = False
    reasoning: str = ""
    latency_ms: float = 100.0


@dataclass
class MockGuardianClawResult:
    """Mock for guardianclaw GuardianClawResult."""
    blocked: bool
    allowed: bool
    decided_by: str
    gate1_result: Optional[MockInputValidationResult] = None
    gate2_result: Optional[MockOutputValidationResult] = None
    gate3_result: Optional[MockObservationResult] = None
    confidence: float = 0.9
    reasoning: str = ""
    latency_ms: float = 50.0

    def __post_init__(self):
        if self.blocked == self.allowed:
            self.allowed = not self.blocked


@dataclass
class MockClawConfig:
    """Mock for guardianclaw ClawConfig."""
    gate1_enabled: bool = True
    gate1_embedding_enabled: bool = True
    gate1_embedding_threshold: float = 0.55
    gate2_enabled: bool = True
    gate2_embedding_enabled: bool = True
    gate2_embedding_threshold: float = 0.50
    gate2_confidence_threshold: float = 0.75
    gate3_enabled: bool = False
    gate3_provider: str = "openai"
    gate3_model: str = "gpt-4o-mini"
    gate3_api_key: Optional[str] = None
    gate3_timeout: int = 30
    fail_closed: bool = False


class MockClawValidator:
    """Mock for guardianclaw ClawValidator."""

    def __init__(self, config: Optional[MockClawConfig] = None):
        self.config = config or MockClawConfig()
        self._validation_count = 0
        self._gate3_calls = 0
        self._blocked_count = 0

    def validate_input(self, input: str) -> MockGuardianClawResult:
        """Mock input validation."""
        self._validation_count += 1

        # Simulate attack detection for certain patterns
        is_attack = any(
            pattern in input.lower()
            for pattern in ["ignore previous", "jailbreak", "hack", "bypass"]
        )

        if is_attack:
            self._blocked_count += 1
            return MockGuardianClawResult(
                blocked=True,
                allowed=False,
                decided_by="gate1",
                gate1_result=MockInputValidationResult(
                    is_attack=True,
                    attack_types=["jailbreak_attempt"],
                    confidence=0.95,
                ),
                reasoning="Attack pattern detected in input",
            )

        return MockGuardianClawResult(
            blocked=False,
            allowed=True,
            decided_by="gate1",
            gate1_result=MockInputValidationResult(
                is_attack=False,
                confidence=0.1,
            ),
            reasoning="Input passed validation",
        )

    def validate_dialogue(self, input: str, output: str) -> MockGuardianClawResult:
        """Mock dialogue validation."""
        self._validation_count += 1

        # Simulate output failure for certain patterns
        has_failure = any(
            pattern in output.lower()
            for pattern in ["here's how to hack", "instructions for bomb", "bypass security"]
        )

        if has_failure:
            self._blocked_count += 1
            return MockGuardianClawResult(
                blocked=True,
                allowed=False,
                decided_by="gate2",
                gate2_result=MockOutputValidationResult(
                    seed_failed=True,
                    failure_types=["harmful_content"],
                    gates_failed=["avoidance"],
                    confidence=0.92,
                ),
                reasoning="Harmful content detected in output",
            )

        return MockGuardianClawResult(
            blocked=False,
            allowed=True,
            decided_by="gate2",
            gate2_result=MockOutputValidationResult(
                seed_failed=False,
                confidence=0.95,
            ),
            reasoning="Output passed validation",
        )

    def get_stats(self) -> dict:
        """Get mock stats."""
        return {
            "total_validations": self._validation_count,
            "blocked": self._blocked_count,
            "passed": self._validation_count - self._blocked_count,
            "gate3_calls": self._gate3_calls,
        }


# Fixtures

@pytest.fixture
def simple_flow():
    """A simple 3-node flow: Input -> Process -> Output."""
    return {
        "nodes": [
            {
                "id": "input-1",
                "type": "input",
                "position": {"x": 0, "y": 0},
                "data": {"label": "User Input", "inputType": "user_message"},
            },
            {
                "id": "process-1",
                "type": "process",
                "position": {"x": 0, "y": 100},
                "data": {
                    "label": "LLM",
                    "processType": "llm_call",
                    "config": {
                        "provider": "openai",
                        "model": "gpt-4o-mini",
                        "temperature": 0.7,
                    },
                },
            },
            {
                "id": "output-1",
                "type": "output",
                "position": {"x": 0, "y": 200},
                "data": {"label": "Response", "outputType": "response"},
            },
        ],
        "edges": [
            {"id": "e1", "source": "input-1", "target": "process-1"},
            {"id": "e2", "source": "process-1", "target": "output-1"},
        ],
    }


@pytest.fixture
def flow_with_claw():
    """A flow with GuardianClaw validation nodes."""
    return {
        "nodes": [
            {
                "id": "input-1",
                "type": "input",
                "position": {"x": 0, "y": 0},
                "data": {"label": "User Input", "inputType": "user_message"},
            },
            {
                "id": "claw-1",
                "type": "claw",
                "position": {"x": 0, "y": 50},
                "data": {
                    "label": "Input Guard",
                    "gateType": "all",
                    "config": {"protectionLevel": "standard"},
                },
            },
            {
                "id": "process-1",
                "type": "process",
                "position": {"x": 0, "y": 100},
                "data": {
                    "label": "LLM",
                    "processType": "llm_call",
                    "config": {"provider": "openai", "model": "gpt-4o-mini"},
                },
            },
            {
                "id": "claw-2",
                "type": "claw",
                "position": {"x": 0, "y": 150},
                "data": {
                    "label": "Output Guard",
                    "gateType": "worth",
                    "config": {"strictMode": True},
                },
            },
            {
                "id": "output-1",
                "type": "output",
                "position": {"x": 0, "y": 200},
                "data": {"label": "Response", "outputType": "response"},
            },
        ],
        "edges": [
            {"id": "e1", "source": "input-1", "target": "claw-1"},
            {"id": "e2", "source": "claw-1", "target": "process-1"},
            {"id": "e3", "source": "process-1", "target": "claw-2"},
            {"id": "e4", "source": "claw-2", "target": "output-1"},
        ],
    }


@pytest.fixture
def complex_flow():
    """A complex flow with multiple branches and tools."""
    return {
        "nodes": [
            {
                "id": "input-1",
                "type": "input",
                "position": {"x": 0, "y": 0},
                "data": {"label": "API Call", "inputType": "api_call"},
            },
            {
                "id": "claw-1",
                "type": "claw",
                "position": {"x": 0, "y": 50},
                "data": {"label": "Guard", "gateType": "avoidance"},
            },
            {
                "id": "tool-1",
                "type": "tool",
                "position": {"x": -100, "y": 100},
                "data": {"label": "Search", "toolType": "web_search"},
            },
            {
                "id": "process-1",
                "type": "process",
                "position": {"x": 100, "y": 100},
                "data": {"label": "LLM", "processType": "llm_call"},
            },
            {
                "id": "output-1",
                "type": "output",
                "position": {"x": 0, "y": 200},
                "data": {"label": "Response", "outputType": "response"},
            },
        ],
        "edges": [
            {"id": "e1", "source": "input-1", "target": "claw-1"},
            {"id": "e2", "source": "claw-1", "target": "tool-1"},
            {"id": "e3", "source": "claw-1", "target": "process-1"},
            {"id": "e4", "source": "tool-1", "target": "output-1"},
            {"id": "e5", "source": "process-1", "target": "output-1"},
        ],
    }


@pytest.fixture
def empty_flow():
    """An empty flow with no nodes."""
    return {"nodes": [], "edges": []}


@pytest.fixture
def disconnected_flow():
    """A flow with disconnected nodes."""
    return {
        "nodes": [
            {
                "id": "input-1",
                "type": "input",
                "position": {"x": 0, "y": 0},
                "data": {"label": "Input 1", "inputType": "user_message"},
            },
            {
                "id": "output-1",
                "type": "output",
                "position": {"x": 0, "y": 100},
                "data": {"label": "Output 1", "outputType": "response"},
            },
            {
                "id": "process-1",
                "type": "process",
                "position": {"x": 200, "y": 50},
                "data": {"label": "Disconnected", "processType": "llm_call"},
            },
        ],
        "edges": [
            {"id": "e1", "source": "input-1", "target": "output-1"},
        ],
    }


@pytest.fixture
def mock_claw_validator():
    """Provide a mock ClawValidator."""
    return MockClawValidator()


@pytest.fixture
def mock_claw_module():
    """Patch the guardianclaw module with mocks."""
    mock_module = MagicMock()
    mock_module.ClawValidator = MockClawValidator
    mock_module.ClawConfig = MockClawConfig
    mock_module.GuardianClawResult = MockGuardianClawResult

    with patch.dict("sys.modules", {"guardianclaw": mock_module}):
        yield mock_module


@pytest.fixture
def flow_with_claw_input_only():
    """A flow with claw input validation but no output validation."""
    return {
        "nodes": [
            {"id": "input-1", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": "User Input", "inputType": "user_message"}},
            {"id": "claw-1", "type": "claw", "position": {"x": 0, "y": 50}, "data": {"label": "Input Guard", "gateType": "all"}},
            {"id": "process-1", "type": "process", "position": {"x": 0, "y": 100}, "data": {"label": "LLM", "processType": "llm_call"}},
            {"id": "output-1", "type": "output", "position": {"x": 0, "y": 200}, "data": {"label": "Response", "outputType": "response"}},
        ],
        "edges": [
            {"id": "e1", "source": "input-1", "target": "claw-1"},
            {"id": "e2", "source": "claw-1", "target": "process-1"},
            {"id": "e3", "source": "process-1", "target": "output-1"},
        ],
    }


@pytest.fixture
def flow_with_v25_layers():
    """A flow with v2.25 layer-based claw nodes (L1 + L3)."""
    return {
        "nodes": [
            {"id": "input-1", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": "User Input", "inputType": "user_message"}},
            {"id": "l1-1", "type": "claw", "position": {"x": 0, "y": 50}, "data": {"label": "L1 Input Validator", "layerType": "input_validator", "l1Config": {"mode": "strict"}}},
            {"id": "process-1", "type": "process", "position": {"x": 0, "y": 100}, "data": {"label": "LLM", "processType": "llm_call"}},
            {"id": "l3-1", "type": "claw", "position": {"x": 0, "y": 150}, "data": {"label": "L3 Output Validator", "layerType": "output_validator", "l3Config": {"mode": "strict"}}},
            {"id": "output-1", "type": "output", "position": {"x": 0, "y": 200}, "data": {"label": "Response", "outputType": "response"}},
        ],
        "edges": [
            {"id": "e1", "source": "input-1", "target": "l1-1"},
            {"id": "e2", "source": "l1-1", "target": "process-1"},
            {"id": "e3", "source": "process-1", "target": "l3-1"},
            {"id": "e4", "source": "l3-1", "target": "output-1"},
        ],
    }


@pytest.fixture
def flow_with_all_nodes():
    """A comprehensive flow with various node types for testing step-by-step execution."""
    return {
        "nodes": [
            # Input
            {"id": "input-1", "type": "input", "position": {"x": 50, "y": 0}, "data": {"label": "User Input", "inputType": "user_message"}},
            # GuardianClaw
            {"id": "claw-1", "type": "claw", "position": {"x": 50, "y": 100}, "data": {"label": "Input Guard", "gateType": "all"}},
            # Process
            {"id": "process-1", "type": "process", "position": {"x": 50, "y": 200}, "data": {"label": "LLM Call", "processType": "llm_call"}},
            # Flow
            {"id": "flow-router-1", "type": "flow", "position": {"x": 200, "y": 300}, "data": {"label": "Router", "flowType": "router"}},
            {"id": "flow-merge-1", "type": "flow", "position": {"x": 350, "y": 400}, "data": {"label": "Merge", "flowType": "merge"}},
            {"id": "flow-loop-1", "type": "flow", "position": {"x": 500, "y": 300}, "data": {"label": "Loop", "flowType": "loop"}},
            # Memory
            {"id": "memory-buffer-1", "type": "memory", "position": {"x": -100, "y": 300}, "data": {"label": "Buffer", "memoryType": "buffer"}},
            {"id": "memory-vector-1", "type": "memory", "position": {"x": -100, "y": 400}, "data": {"label": "Vector", "memoryType": "vector"}},
            {"id": "memory-summary-1", "type": "memory", "position": {"x": -100, "y": 500}, "data": {"label": "Summary", "memoryType": "summary"}},
            # Tool
            {"id": "tool-search-1", "type": "tool", "position": {"x": 200, "y": 500}, "data": {"label": "Web Search", "toolType": "web_search"}},
            # Utility
            {"id": "utility-delay-1", "type": "utility", "position": {"x": 350, "y": 600}, "data": {"label": "Delay", "utilityType": "delay"}},
            {"id": "utility-log-1", "type": "utility", "position": {"x": 500, "y": 500}, "data": {"label": "Log", "utilityType": "log"}},
            # Output
            {"id": "output-1", "type": "output", "position": {"x": 50, "y": 700}, "data": {"label": "Response", "outputType": "response"}},
        ],
        "edges": [
            {"id": "e-1", "source": "input-1", "target": "claw-1"},
            {"id": "e-2", "source": "claw-1", "target": "process-1"},
            {"id": "e-3", "source": "process-1", "target": "flow-router-1"},
            {"id": "e-4", "source": "flow-router-1", "target": "flow-merge-1"},
            {"id": "e-5", "source": "flow-router-1", "target": "flow-loop-1"},
            {"id": "e-6", "source": "flow-loop-1", "target": "memory-buffer-1"},
            {"id": "e-7", "source": "memory-buffer-1", "target": "memory-vector-1"},
            {"id": "e-8", "source": "memory-vector-1", "target": "memory-summary-1"},
            {"id": "e-9", "source": "memory-summary-1", "target": "tool-search-1"},
            {"id": "e-10", "source": "flow-merge-1", "target": "utility-delay-1"},
            {"id": "e-11", "source": "utility-delay-1", "target": "utility-log-1"},
            {"id": "e-12", "source": "utility-log-1", "target": "output-1"},
            {"id": "e-13", "source": "tool-search-1", "target": "output-1"},
        ],
    }
