"""
Tests for Node.js Executor.

These tests verify the Node.js execution engine used for running
ElizaOS and VoltAgent agents in the Modal runtime.
"""

import pytest
import json
import subprocess
from unittest.mock import MagicMock, patch, mock_open
from typing import Dict, Any

from claw_runtime.nodejs_executor import (
    NodeJSExecutor,
    NodeJSExecutionResult,
    ELIZAOS_RUNTIME_TEMPLATE,
    execute_voltagent,
)


# Test fixtures

@pytest.fixture
def executor() -> NodeJSExecutor:
    """Create a default NodeJSExecutor instance."""
    return NodeJSExecutor(timeout_seconds=30, memory_mb=256)


@pytest.fixture
def sample_character() -> Dict[str, Any]:
    """Sample ElizaOS character configuration."""
    return {
        "name": "TestBot",
        "personality": "A helpful test assistant",
        "bio": "Created for testing purposes",
        "topics": ["testing", "development"],
        "forbidden_topics": ["violence", "illegal activities"],
    }


@pytest.fixture
def sample_request(sample_character) -> Dict[str, Any]:
    """Sample execution request."""
    return {
        "agent_type": "elizaos",
        "message": "Hello, how are you?",
        "context": {
            "platform": "api",
            "user_id": "test_user",
            "channel_id": None,
            "conversation_id": "test_conv_123",
            "timestamp": "2025-01-15T12:00:00Z",
        },
        "character": sample_character,
        "history": [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello! How can I help?"},
        ],
        "claw_config": {
            "seed_level": "standard",
            "gates": {"credibility": True, "avoidance": True, "limits": True, "worth": True},
        },
        "platform_credentials": None,
    }


# Tests for NodeJSExecutor initialization

class TestNodeJSExecutorInit:
    """Tests for NodeJSExecutor initialization."""

    def test_default_initialization(self):
        """Test executor with default values."""
        executor = NodeJSExecutor()

        assert executor.timeout_seconds == 60
        assert executor.memory_mb == 512

    def test_custom_initialization(self):
        """Test executor with custom values."""
        executor = NodeJSExecutor(timeout_seconds=120, memory_mb=1024)

        assert executor.timeout_seconds == 120
        assert executor.memory_mb == 1024

    def test_initial_stats(self, executor):
        """Test initial statistics are zeroed."""
        stats = executor.get_stats()

        assert stats["executions"] == 0
        assert stats["successes"] == 0
        assert stats["failures"] == 0
        assert stats["avg_time_ms"] == 0.0


# Tests for ElizaOS execution

class TestElizaOSExecution:
    """Tests for ElizaOS agent execution."""

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_successful_execution(self, mock_run, executor, sample_request):
        """Test successful ElizaOS execution."""
        mock_run.return_value = {
            "success": True,
            "response": "Hello! I'm doing great, thanks for asking.",
            "metadata": {
                "character_name": "TestBot",
                "model_used": "gpt-4o-mini",
                "provider": "openai",
            },
        }

        result = executor.execute_elizaos(sample_request)

        assert result["success"] is True
        assert result["response"] is not None
        assert "Hello" in result["response"]
        assert result["error"] is None
        assert result["execution_time_ms"] >= 0
        assert result["metadata"]["character_name"] == "TestBot"
        assert result["metadata"]["runtime"] == "elizaos-compatible"

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_failed_execution(self, mock_run, executor, sample_request):
        """Test failed ElizaOS execution."""
        mock_run.return_value = {
            "success": False,
            "error": "OpenAI API key not configured",
        }

        result = executor.execute_elizaos(sample_request)

        assert result["success"] is False
        assert result["response"] is None
        assert "OpenAI" in result["error"]

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_exception_handling(self, mock_run, executor, sample_request):
        """Test exception handling during execution."""
        mock_run.side_effect = Exception("Unexpected error")

        result = executor.execute_elizaos(sample_request)

        assert result["success"] is False
        assert "Unexpected error" in result["error"]

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_stats_after_execution(self, mock_run, executor, sample_request):
        """Test statistics are updated after execution."""
        mock_run.return_value = {"success": True, "response": "Test"}

        executor.execute_elizaos(sample_request)
        executor.execute_elizaos(sample_request)

        stats = executor.get_stats()

        assert stats["executions"] == 2
        assert stats["successes"] == 2
        assert stats["failures"] == 0
        assert stats["success_rate"] == 1.0

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_stats_with_failures(self, mock_run, executor, sample_request):
        """Test statistics track failures correctly."""
        mock_run.side_effect = [
            {"success": True, "response": "OK"},
            {"success": False, "error": "Failed"},
            {"success": True, "response": "OK"},
        ]

        executor.execute_elizaos(sample_request)
        executor.execute_elizaos(sample_request)
        executor.execute_elizaos(sample_request)

        stats = executor.get_stats()

        assert stats["executions"] == 3
        assert stats["successes"] == 2
        assert stats["failures"] == 1
        assert stats["success_rate"] == pytest.approx(0.666, rel=0.01)


# Tests for Node.js script execution

class TestNodeJSScriptExecution:
    """Tests for low-level Node.js script execution."""

    @patch("subprocess.run")
    @patch("tempfile.NamedTemporaryFile")
    def test_successful_script_run(self, mock_tempfile, mock_subprocess, executor):
        """Test successful Node.js script execution."""
        # Setup mocks
        mock_file = MagicMock()
        mock_file.name = "/tmp/test_script.js"
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_tempfile.return_value = mock_file

        mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='{"success": true, "response": "Hello"}',
            stderr="",
        )

        result = executor._run_nodejs_script(
            script="console.log('test')",
            input_data={"message": "test"},
            env_vars={"OPENAI_API_KEY": "test_key"},
        )

        assert result["success"] is True
        assert result["response"] == "Hello"

    @patch("subprocess.run")
    @patch("tempfile.NamedTemporaryFile")
    def test_invalid_json_output(self, mock_tempfile, mock_subprocess, executor):
        """Test handling of invalid JSON output from Node.js."""
        mock_file = MagicMock()
        mock_file.name = "/tmp/test_script.js"
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_tempfile.return_value = mock_file

        mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout="This is not valid JSON",
            stderr="",
        )

        result = executor._run_nodejs_script(
            script="console.log('invalid')",
            input_data={},
            env_vars={},
        )

        assert result["success"] is False
        assert "Invalid JSON" in result["error"]

    @patch("subprocess.run")
    @patch("tempfile.NamedTemporaryFile")
    def test_non_zero_exit_code(self, mock_tempfile, mock_subprocess, executor):
        """Test handling of non-zero exit code."""
        mock_file = MagicMock()
        mock_file.name = "/tmp/test_script.js"
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_tempfile.return_value = mock_file

        mock_subprocess.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="Error: Cannot find module 'openai'",
        )

        result = executor._run_nodejs_script(
            script="require('openai')",
            input_data={},
            env_vars={},
        )

        assert result["success"] is False
        assert "Cannot find module" in result["error"]

    @patch("subprocess.run")
    @patch("tempfile.NamedTemporaryFile")
    def test_timeout_handling(self, mock_tempfile, mock_subprocess, executor):
        """Test timeout handling."""
        mock_file = MagicMock()
        mock_file.name = "/tmp/test_script.js"
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_tempfile.return_value = mock_file

        mock_subprocess.side_effect = subprocess.TimeoutExpired(
            cmd=["node", "test.js"],
            timeout=30,
        )

        result = executor._run_nodejs_script(
            script="while(true){}",
            input_data={},
            env_vars={},
        )

        assert result["success"] is False
        assert "timed out" in result["error"]

    @patch("subprocess.run")
    @patch("tempfile.NamedTemporaryFile")
    def test_nodejs_not_found(self, mock_tempfile, mock_subprocess, executor):
        """Test handling when Node.js is not installed."""
        mock_file = MagicMock()
        mock_file.name = "/tmp/test_script.js"
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)
        mock_tempfile.return_value = mock_file

        mock_subprocess.side_effect = FileNotFoundError("node not found")

        result = executor._run_nodejs_script(
            script="console.log('test')",
            input_data={},
            env_vars={},
        )

        assert result["success"] is False
        assert "Node.js not found" in result["error"]


# Tests for runtime template

class TestRuntimeTemplate:
    """Tests for the ElizaOS runtime template."""

    def test_template_contains_required_imports(self):
        """Test template has required imports."""
        assert "require" in ELIZAOS_RUNTIME_TEMPLATE
        assert "JSON.parse" in ELIZAOS_RUNTIME_TEMPLATE

    def test_template_handles_character_config(self):
        """Test template processes character configuration."""
        assert "character" in ELIZAOS_RUNTIME_TEMPLATE
        assert "name" in ELIZAOS_RUNTIME_TEMPLATE
        assert "personality" in ELIZAOS_RUNTIME_TEMPLATE

    def test_template_builds_messages(self):
        """Test template builds conversation messages."""
        assert "messages" in ELIZAOS_RUNTIME_TEMPLATE
        assert "systemPrompt" in ELIZAOS_RUNTIME_TEMPLATE
        assert "history" in ELIZAOS_RUNTIME_TEMPLATE

    def test_template_has_error_handling(self):
        """Test template has error handling."""
        assert "catch" in ELIZAOS_RUNTIME_TEMPLATE
        assert "error" in ELIZAOS_RUNTIME_TEMPLATE


# Tests for VoltAgent execution

class TestVoltAgentExecution:
    """Tests for VoltAgent execution function."""

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_voltagent_execution(self, mock_run):
        """Test VoltAgent execution with mocked Node.js."""
        mock_run.return_value = {
            "success": True,
            "response": "Hello! I'm your VoltAgent assistant.",
            "metadata": {
                "agent_name": "TestAgent",
                "model_used": "gpt-4o-mini",
                "provider": "openai",
            },
        }

        result = execute_voltagent(
            message="Test message",
            config={"name": "TestAgent", "instructions": "You are a test agent"},
        )

        assert result["success"] is True
        assert result["response"] is not None
        assert result["metadata"]["runtime"] == "voltagent-compatible"

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_voltagent_with_tools(self, mock_run):
        """Test VoltAgent with tool definitions."""
        mock_run.return_value = {
            "success": True,
            "response": "I can help with weather and search.",
            "metadata": {
                "agent_name": "ToolAgent",
                "model_used": "gpt-4o-mini",
                "provider": "openai",
                "tools_available": 2,
            },
        }

        result = execute_voltagent(
            message="What tools do you have?",
            config={
                "name": "ToolAgent",
                "instructions": "Be helpful",
                "tools": [
                    {"name": "weather", "description": "Get weather"},
                    {"name": "search", "description": "Search the web"},
                ],
            },
        )

        assert result["success"] is True


# Integration tests

class TestNodeJSExecutorIntegration:
    """Integration tests for Node.js executor."""

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_full_execution_flow(self, mock_run, sample_request):
        """Test complete execution flow."""
        mock_run.return_value = {
            "success": True,
            "response": "I'm TestBot! Happy to help with testing.",
            "character_name": "TestBot",
            "model_used": "gpt-4o-mini",
        }

        executor = NodeJSExecutor(timeout_seconds=60, memory_mb=512)

        # Execute
        result = executor.execute_elizaos(sample_request)

        # Verify result
        assert result["success"] is True
        assert "TestBot" in result["response"]

        # Verify mock was called with correct arguments
        mock_run.assert_called_once()
        call_args = mock_run.call_args

        # Check input data
        input_data = call_args[1]["input_data"] if "input_data" in call_args[1] else call_args[0][1]
        assert input_data["message"] == "Hello, how are you?"
        assert input_data["character"]["name"] == "TestBot"

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_execution_with_history(self, mock_run, sample_request):
        """Test execution preserves conversation history."""
        mock_run.return_value = {
            "success": True,
            "response": "Based on our conversation...",
            "character_name": "TestBot",
            "model_used": "gpt-4o-mini",
        }

        executor = NodeJSExecutor()
        result = executor.execute_elizaos(sample_request)

        # Verify history was passed
        call_args = mock_run.call_args
        input_data = call_args[1]["input_data"] if "input_data" in call_args[1] else call_args[0][1]

        assert len(input_data["history"]) == 2
        assert input_data["history"][0]["role"] == "user"
        assert input_data["history"][1]["role"] == "assistant"

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_execution_without_history(self, mock_run, sample_request):
        """Test execution works without history."""
        sample_request["history"] = None

        mock_run.return_value = {
            "success": True,
            "response": "Hello!",
            "character_name": "TestBot",
            "model_used": "gpt-4o-mini",
        }

        executor = NodeJSExecutor()
        result = executor.execute_elizaos(sample_request)

        assert result["success"] is True

    @patch("claw_runtime.nodejs_executor.NodeJSExecutor._run_nodejs_script")
    def test_character_config_passed_correctly(self, mock_run, sample_request):
        """Test character configuration is passed to Node.js."""
        mock_run.return_value = {
            "success": True,
            "response": "Test",
            "character_name": "TestBot",
            "model_used": "gpt-4o-mini",
        }

        executor = NodeJSExecutor()
        executor.execute_elizaos(sample_request)

        call_args = mock_run.call_args
        input_data = call_args[1]["input_data"] if "input_data" in call_args[1] else call_args[0][1]
        character = input_data["character"]

        assert character["name"] == "TestBot"
        assert character["personality"] == "A helpful test assistant"
        assert "testing" in character["topics"]
        assert "violence" in character["forbidden_topics"]
