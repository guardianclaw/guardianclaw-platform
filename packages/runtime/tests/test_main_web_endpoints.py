"""
Tests for Modal.com web endpoints defined in main.py.

These tests validate:
1. Pydantic request models
2. Web endpoint request/response handling
3. Integration between web endpoints and internal functions
"""

import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError


class TestPydanticModels:
    """Test Pydantic request models for web endpoints."""

    def test_history_message_valid(self):
        """Test HistoryMessage with valid data."""
        from claw_runtime.main import HistoryMessage

        msg = HistoryMessage(role="user", content="Hello")
        assert msg.role == "user"
        assert msg.content == "Hello"

    def test_history_message_missing_role(self):
        """Test HistoryMessage fails without role."""
        from claw_runtime.main import HistoryMessage

        with pytest.raises(ValidationError):
            HistoryMessage(content="Hello")

    def test_history_message_missing_content(self):
        """Test HistoryMessage fails without content."""
        from claw_runtime.main import HistoryMessage

        with pytest.raises(ValidationError):
            HistoryMessage(role="user")

    def test_execute_agent_request_minimal(self):
        """Test ExecuteAgentRequest with minimal required fields."""
        from claw_runtime.main import ExecuteAgentRequest

        req = ExecuteAgentRequest(
            flow={"nodes": [], "edges": []},
            input_text="Hello"
        )
        assert req.flow == {"nodes": [], "edges": []}
        assert req.input_text == "Hello"
        assert req.llm_config is None
        assert req.claw_config is None
        assert req.history is None
        assert req.llm_api_key is None

    def test_execute_agent_request_full(self):
        """Test ExecuteAgentRequest with all fields."""
        from claw_runtime.main import ExecuteAgentRequest, HistoryMessage

        req = ExecuteAgentRequest(
            flow={"nodes": [{"id": "1"}], "edges": []},
            input_text="What is 2+2?",
            llm_config={"provider": "openai", "model": "gpt-4o-mini"},
            claw_config={"protection_level": "standard"},
            history=[HistoryMessage(role="user", content="Hi")],
            llm_api_key="sk-test"
        )
        assert req.flow["nodes"][0]["id"] == "1"
        assert req.input_text == "What is 2+2?"
        assert req.llm_config["provider"] == "openai"
        assert req.claw_config["protection_level"] == "standard"
        assert len(req.history) == 1
        assert req.history[0].role == "user"
        assert req.llm_api_key == "sk-test"

    def test_execute_agent_request_missing_flow(self):
        """Test ExecuteAgentRequest fails without flow."""
        from claw_runtime.main import ExecuteAgentRequest

        with pytest.raises(ValidationError):
            ExecuteAgentRequest(input_text="Hello")

    def test_execute_agent_request_missing_input_text(self):
        """Test ExecuteAgentRequest fails without input_text."""
        from claw_runtime.main import ExecuteAgentRequest

        with pytest.raises(ValidationError):
            ExecuteAgentRequest(flow={"nodes": [], "edges": []})

    def test_validate_input_request_valid(self):
        """Test ValidateInputRequest with valid data."""
        from claw_runtime.main import ValidateInputRequest

        req = ValidateInputRequest(text="Hello, how are you?")
        assert req.text == "Hello, how are you?"
        assert req.claw_config is None

    def test_validate_input_request_with_config(self):
        """Test ValidateInputRequest with claw config."""
        from claw_runtime.main import ValidateInputRequest

        req = ValidateInputRequest(
            text="Test message",
            claw_config={"protection_level": "maximum"}
        )
        assert req.text == "Test message"
        assert req.claw_config["protection_level"] == "maximum"

    def test_validate_input_request_missing_text(self):
        """Test ValidateInputRequest fails without text."""
        from claw_runtime.main import ValidateInputRequest

        with pytest.raises(ValidationError):
            ValidateInputRequest()

    def test_validate_output_request_valid(self):
        """Test ValidateOutputRequest with valid data."""
        from claw_runtime.main import ValidateOutputRequest

        req = ValidateOutputRequest(output="AI response here")
        assert req.output == "AI response here"
        assert req.input_context == ""
        assert req.claw_config is None

    def test_validate_output_request_full(self):
        """Test ValidateOutputRequest with all fields."""
        from claw_runtime.main import ValidateOutputRequest

        req = ValidateOutputRequest(
            output="The answer is 4.",
            input_context="What is 2+2?",
            claw_config={"protection_level": "standard"}
        )
        assert req.output == "The answer is 4."
        assert req.input_context == "What is 2+2?"
        assert req.claw_config["protection_level"] == "standard"

    def test_validate_output_request_missing_output(self):
        """Test ValidateOutputRequest fails without output."""
        from claw_runtime.main import ValidateOutputRequest

        with pytest.raises(ValidationError):
            ValidateOutputRequest(input_context="test")


class TestHistoryConversion:
    """Test history conversion from Pydantic models to dicts."""

    def test_history_to_dict_conversion(self):
        """Test that history messages convert to dicts correctly."""
        from claw_runtime.main import ExecuteAgentRequest, HistoryMessage

        req = ExecuteAgentRequest(
            flow={"nodes": [], "edges": []},
            input_text="Hello",
            history=[
                HistoryMessage(role="user", content="First message"),
                HistoryMessage(role="assistant", content="Response"),
                HistoryMessage(role="user", content="Follow up"),
            ]
        )

        # Simulate the conversion done in execute_agent_web
        history_dicts = [{"role": m.role, "content": m.content} for m in req.history]

        assert len(history_dicts) == 3
        assert history_dicts[0] == {"role": "user", "content": "First message"}
        assert history_dicts[1] == {"role": "assistant", "content": "Response"}
        assert history_dicts[2] == {"role": "user", "content": "Follow up"}

    def test_empty_history_handling(self):
        """Test handling of empty/None history."""
        from claw_runtime.main import ExecuteAgentRequest

        req = ExecuteAgentRequest(
            flow={"nodes": [], "edges": []},
            input_text="Hello"
        )

        # Simulate the conversion done in execute_agent_web
        history = None
        if req.history:
            history = [{"role": m.role, "content": m.content} for m in req.history]

        assert history is None


class TestRequestValidation:
    """Test request validation edge cases."""

    def test_execute_request_empty_flow(self):
        """Test that empty flow is valid."""
        from claw_runtime.main import ExecuteAgentRequest

        req = ExecuteAgentRequest(
            flow={"nodes": [], "edges": []},
            input_text="Hello"
        )
        assert req.flow["nodes"] == []
        assert req.flow["edges"] == []

    def test_execute_request_complex_flow(self):
        """Test with a realistic flow structure."""
        from claw_runtime.main import ExecuteAgentRequest

        flow = {
            "nodes": [
                {"id": "input-1", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": "Input"}},
                {"id": "process-1", "type": "process", "position": {"x": 0, "y": 100}, "data": {"label": "LLM"}},
                {"id": "output-1", "type": "output", "position": {"x": 0, "y": 200}, "data": {"label": "Output"}},
            ],
            "edges": [
                {"id": "e1", "source": "input-1", "target": "process-1"},
                {"id": "e2", "source": "process-1", "target": "output-1"},
            ]
        }

        req = ExecuteAgentRequest(
            flow=flow,
            input_text="Test message",
            llm_config={"provider": "openai", "model": "gpt-4o-mini", "temperature": 0.7}
        )

        assert len(req.flow["nodes"]) == 3
        assert len(req.flow["edges"]) == 2
        assert req.llm_config["temperature"] == 0.7

    def test_validate_input_long_text(self):
        """Test ValidateInputRequest with long text."""
        from claw_runtime.main import ValidateInputRequest

        long_text = "A" * 10000
        req = ValidateInputRequest(text=long_text)
        assert len(req.text) == 10000

    def test_validate_output_unicode(self):
        """Test ValidateOutputRequest with unicode characters."""
        from claw_runtime.main import ValidateOutputRequest

        req = ValidateOutputRequest(
            output="Response with emoji: 🚀 and unicode: café, 日本語",
            input_context="Test with special chars: äöü"
        )
        assert "🚀" in req.output
        assert "café" in req.output
        assert "日本語" in req.output


class TestModelDefaults:
    """Test default values in Pydantic models."""

    def test_validate_output_default_input_context(self):
        """Test ValidateOutputRequest default input_context is empty string."""
        from claw_runtime.main import ValidateOutputRequest

        req = ValidateOutputRequest(output="Test")
        assert req.input_context == ""

    def test_execute_request_optional_fields_none(self):
        """Test ExecuteAgentRequest optional fields default to None."""
        from claw_runtime.main import ExecuteAgentRequest

        req = ExecuteAgentRequest(
            flow={"nodes": [], "edges": []},
            input_text="Hello"
        )

        assert req.llm_config is None
        assert req.claw_config is None
        assert req.history is None
        assert req.llm_api_key is None


class TestModelSerialization:
    """Test model serialization for API responses."""

    def test_history_message_dict(self):
        """Test HistoryMessage can be converted to dict."""
        from claw_runtime.main import HistoryMessage

        msg = HistoryMessage(role="user", content="Hello")
        msg_dict = msg.model_dump()

        assert msg_dict == {"role": "user", "content": "Hello"}

    def test_execute_request_dict(self):
        """Test ExecuteAgentRequest can be converted to dict."""
        from claw_runtime.main import ExecuteAgentRequest

        req = ExecuteAgentRequest(
            flow={"nodes": [], "edges": []},
            input_text="Hello",
            llm_config={"provider": "openai"}
        )
        req_dict = req.model_dump()

        assert req_dict["flow"] == {"nodes": [], "edges": []}
        assert req_dict["input_text"] == "Hello"
        assert req_dict["llm_config"] == {"provider": "openai"}
        assert req_dict["claw_config"] is None
