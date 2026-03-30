"""
Tests for FlowParser - Visual flow to executable steps conversion.

These tests verify:
- Node categorization by type
- Topological sorting of flow graphs
- Configuration extraction from nodes
- GuardianClaw node detection
- Edge cases (empty flows, disconnected nodes, cycles)
"""

import pytest
from claw_runtime.flow_parser import (
    FlowParser,
    ParsedFlow,
    FlowStep,
    NodeCategory,
    StepType,
)


class TestFlowParser:
    """Tests for the FlowParser class."""

    def test_parse_simple_flow(self, simple_flow):
        """Test parsing a simple 3-node linear flow."""
        parser = FlowParser()
        result = parser.parse(simple_flow)

        assert isinstance(result, ParsedFlow)
        assert len(result.steps) == 3
        assert result.has_llm is True
        assert result.has_claw_input is False
        assert result.has_claw_output is False
        assert result.input_step is not None
        assert result.output_step is not None

    def test_parse_flow_with_claw(self, flow_with_claw):
        """Test parsing a flow with GuardianClaw validation nodes."""
        parser = FlowParser()
        result = parser.parse(flow_with_claw)

        assert len(result.steps) == 5
        assert result.has_llm is True
        assert result.has_claw_input is True
        assert result.has_claw_output is True

        # Verify GuardianClaw config extraction
        assert "gates" in result.claw_config
        gates = result.claw_config["gates"]
        assert gates.get("credibility") is True
        assert gates.get("avoidance") is True
        assert gates.get("limits") is True
        assert gates.get("worth") is True

        # Verify strict mode from claw-2
        assert result.claw_config.get("fail_closed") is True

    def test_parse_empty_flow(self, empty_flow):
        """Test parsing an empty flow."""
        parser = FlowParser()
        result = parser.parse(empty_flow)

        assert len(result.steps) == 0
        assert result.has_llm is False
        assert result.has_claw_input is False
        assert result.input_step is None
        assert result.output_step is None

    def test_parse_disconnected_flow(self, disconnected_flow):
        """Test parsing a flow with disconnected nodes."""
        parser = FlowParser()
        result = parser.parse(disconnected_flow)

        # All nodes should be included
        assert len(result.steps) == 3

        # Disconnected nodes should still be categorized
        node_ids = [s.id for s in result.steps]
        assert "input-1" in node_ids
        assert "output-1" in node_ids
        assert "process-1" in node_ids

    def test_topological_order(self, simple_flow):
        """Test that nodes are sorted in topological order."""
        parser = FlowParser()
        result = parser.parse(simple_flow)

        # Input should come before Process, Process before Output
        positions = {s.id: s.position for s in result.steps}

        assert positions["input-1"] < positions["process-1"]
        assert positions["process-1"] < positions["output-1"]

    def test_node_categorization(self, complex_flow):
        """Test correct categorization of node types."""
        parser = FlowParser()
        result = parser.parse(complex_flow)

        categories = {s.id: s.category for s in result.steps}

        assert categories["input-1"] == NodeCategory.INPUT
        assert categories["claw-1"] == NodeCategory.CLAW
        assert categories["tool-1"] == NodeCategory.TOOL
        assert categories["process-1"] == NodeCategory.PROCESS
        assert categories["output-1"] == NodeCategory.OUTPUT

    def test_step_type_mapping(self, complex_flow):
        """Test correct step type assignment."""
        parser = FlowParser()
        result = parser.parse(complex_flow)

        step_types = {s.id: s.type for s in result.steps}

        assert step_types["input-1"] == StepType.RECEIVE_INPUT
        assert step_types["claw-1"] == StepType.CLAW_VALIDATE_INPUT
        assert step_types["tool-1"] == StepType.TOOL_WEB_SEARCH
        assert step_types["process-1"] == StepType.LLM_CALL
        assert step_types["output-1"] == StepType.SEND_OUTPUT

    def test_llm_config_extraction(self, simple_flow):
        """Test extraction of LLM configuration from process nodes."""
        parser = FlowParser()
        result = parser.parse(simple_flow)

        assert result.llm_config.get("provider") == "openai"
        assert result.llm_config.get("model") == "gpt-4o-mini"
        assert result.llm_config.get("temperature") == 0.7

    def test_claw_gates_extraction(self, flow_with_claw):
        """Test extraction of CLAW gates from GuardianClaw nodes."""
        parser = FlowParser()
        result = parser.parse(flow_with_claw)

        gates = result.claw_config.get("gates", {})

        # "all" gate type should enable all CLAW gates
        assert gates.get("credibility") is True
        assert gates.get("avoidance") is True
        assert gates.get("limits") is True
        assert gates.get("worth") is True

    def test_protection_level_extraction(self, flow_with_claw):
        """Test extraction of protection level from GuardianClaw nodes."""
        parser = FlowParser()
        result = parser.parse(flow_with_claw)

        assert result.claw_config.get("protection_level") == "standard"

    def test_step_labels(self, simple_flow):
        """Test that step labels are preserved."""
        parser = FlowParser()
        result = parser.parse(simple_flow)

        labels = {s.id: s.label for s in result.steps}

        assert labels["input-1"] == "User Input"
        assert labels["process-1"] == "LLM"
        assert labels["output-1"] == "Response"

    def test_flow_missing_nodes_key(self):
        """Test handling of flow without nodes key."""
        parser = FlowParser()
        result = parser.parse({"edges": []})

        assert len(result.steps) == 0

    def test_flow_missing_edges_key(self):
        """Test handling of flow without edges key."""
        parser = FlowParser()
        flow = {
            "nodes": [
                {"id": "n1", "type": "input", "data": {}},
                {"id": "n2", "type": "output", "data": {}},
            ]
        }
        result = parser.parse(flow)

        # Nodes should still be parsed, just not connected
        assert len(result.steps) == 2


class TestFlowStep:
    """Tests for the FlowStep dataclass."""

    def test_flow_step_creation(self):
        """Test creating a FlowStep."""
        step = FlowStep(
            id="test-1",
            type=StepType.LLM_CALL,
            category=NodeCategory.PROCESS,
            config={"model": "gpt-4"},
            label="Test LLM",
            position=0,
        )

        assert step.id == "test-1"
        assert step.type == StepType.LLM_CALL
        assert step.category == NodeCategory.PROCESS
        assert step.config["model"] == "gpt-4"
        assert step.label == "Test LLM"
        assert step.position == 0

    def test_flow_step_defaults(self):
        """Test FlowStep default values."""
        step = FlowStep(
            id="test-1",
            type=StepType.RECEIVE_INPUT,
            category=NodeCategory.INPUT,
        )

        assert step.config == {}
        assert step.label == ""
        assert step.position == 0


class TestParsedFlow:
    """Tests for the ParsedFlow dataclass."""

    def test_parsed_flow_defaults(self):
        """Test ParsedFlow default values."""
        parsed = ParsedFlow(steps=[])

        assert parsed.has_claw_input is False
        assert parsed.has_claw_output is False
        assert parsed.has_llm is False
        assert parsed.claw_config == {}
        assert parsed.llm_config == {}
        assert parsed.input_step is None
        assert parsed.output_step is None


class TestNodeCategory:
    """Tests for the NodeCategory enum."""

    def test_node_category_values(self):
        """Test that all expected categories exist."""
        assert NodeCategory.INPUT.value == "input"
        assert NodeCategory.PROCESS.value == "process"
        assert NodeCategory.CLAW.value == "claw"
        assert NodeCategory.TOOL.value == "tool"
        assert NodeCategory.OUTPUT.value == "output"
        assert NodeCategory.UNKNOWN.value == "unknown"


class TestStepType:
    """Tests for the StepType enum."""

    def test_step_type_values(self):
        """Test that all expected step types exist."""
        assert StepType.RECEIVE_INPUT.value == "receive_input"
        assert StepType.LLM_CALL.value == "llm_call"
        assert StepType.CLAW_VALIDATE_INPUT.value == "claw_validate_input"
        assert StepType.CLAW_VALIDATE_OUTPUT.value == "claw_validate_output"
        assert StepType.TOOL_WEB_SEARCH.value == "tool_web_search"
        assert StepType.SEND_OUTPUT.value == "send_output"


class TestCycleDetection:
    """Tests for cycle and disconnected node detection in topological sort."""

    def test_cycle_detection_warns(self):
        """A→B→A cycle should produce a warning."""
        parser = FlowParser()
        flow = {
            "nodes": [
                {"id": "a", "type": "process", "data": {"label": "A", "processType": "llm_call"}},
                {"id": "b", "type": "process", "data": {"label": "B", "processType": "llm_call"}},
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "b"},
                {"id": "e2", "source": "b", "target": "a"},
            ],
        }
        result = parser.parse(flow)

        # Both nodes should still be present (parser doesn't crash)
        assert len(result.steps) == 2
        # Warnings should contain cycle info
        cycle_warnings = [w for w in result.warnings if "Cycle" in w]
        assert len(cycle_warnings) > 0

    def test_disconnected_node_warning(self):
        """An isolated node with no edges should produce a disconnected warning."""
        parser = FlowParser()
        flow = {
            "nodes": [
                {"id": "input-1", "type": "input", "data": {"label": "Input", "inputType": "user_message"}},
                {"id": "output-1", "type": "output", "data": {"label": "Output", "outputType": "response"}},
                {"id": "orphan", "type": "process", "data": {"label": "Orphan", "processType": "llm_call"}},
            ],
            "edges": [
                {"id": "e1", "source": "input-1", "target": "output-1"},
            ],
        }
        result = parser.parse(flow)

        assert len(result.steps) == 3
        disconnected_warnings = [w for w in result.warnings if "Disconnected" in w]
        assert len(disconnected_warnings) > 0
        assert any("orphan" in w for w in disconnected_warnings)

    def test_multiple_inputs_warning(self):
        """Flow with 2+ INPUT nodes should produce a warning."""
        parser = FlowParser()
        flow = {
            "nodes": [
                {"id": "input-1", "type": "input", "data": {"label": "Input 1", "inputType": "user_message"}},
                {"id": "input-2", "type": "input", "data": {"label": "Input 2", "inputType": "webhook"}},
                {"id": "output-1", "type": "output", "data": {"label": "Output", "outputType": "response"}},
            ],
            "edges": [
                {"id": "e1", "source": "input-1", "target": "output-1"},
                {"id": "e2", "source": "input-2", "target": "output-1"},
            ],
        }
        result = parser.parse(flow)

        multi_input_warnings = [w for w in result.warnings if "Multiple input" in w]
        assert len(multi_input_warnings) == 1

    def test_no_warnings_for_clean_flow(self, simple_flow):
        """A well-formed flow should produce no warnings."""
        parser = FlowParser()
        result = parser.parse(simple_flow)

        assert len(result.warnings) == 0
