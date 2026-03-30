"""
Node.js Execution Engine for ElizaOS-Compatible and VoltAgent-Compatible Agents.

This module provides execution logic for running personality-driven AI agents
in the Modal runtime environment, using a format compatible with ElizaOS and
VoltAgent character/agent configurations.

Architecture:
    - Python orchestrates the execution flow and GuardianClaw validation
    - Node.js executes the LLM calls with character/agent context
    - Communication via JSON stdin/stdout

Compatibility Notes:
    This runtime provides ElizaOS-compatible and VoltAgent-compatible execution,
    meaning it processes the same configuration formats and produces similar
    outputs. For full framework features (plugins, actions, custom providers),
    use the export mode and run the frameworks directly.

    Supported features:
    - Character/Agent configuration (name, personality, bio, topics, etc.)
    - Multi-provider LLM support (OpenAI, Anthropic)
    - Conversation history management
    - Forbidden topics enforcement
    - Few-shot examples in prompts

    Not supported (use export mode):
    - ElizaOS plugins and custom actions
    - VoltAgent workflows and MCP integration
    - Custom model providers beyond OpenAI/Anthropic
    - Persistent memory across sessions (handled by platform separately)

Security:
    - All inputs are validated by GuardianClaw before Node.js execution
    - All outputs are validated by GuardianClaw before delivery
    - API keys are injected via environment variables, never in code
"""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

logger = logging.getLogger("claw_runtime.nodejs_executor")


# =============================================================================
# TYPE DEFINITIONS
# =============================================================================

class CharacterConfig(TypedDict, total=False):
    """
    ElizaOS-compatible character configuration.

    This matches the ElizaOS character.json schema for maximum compatibility.
    """
    name: str
    personality: str  # Maps to ElizaOS 'system' field
    bio: str
    lore: List[str]
    knowledge: List[str]
    topics: List[str]
    forbidden_topics: List[str]
    adjectives: List[str]
    examples: List[Dict[str, str]]  # {user: str, assistant: str}
    style: Dict[str, List[str]]  # {all: [], chat: [], post: []}
    model: str
    provider: str  # openai, anthropic


class AgentConfig(TypedDict, total=False):
    """
    VoltAgent-compatible agent configuration.

    This matches the VoltAgent agent definition schema.
    """
    name: str
    instructions: str
    model: str
    provider: str
    tools: List[Dict[str, Any]]  # Tool definitions (not executed, for context)
    memory_enabled: bool


class MessageContext(TypedDict):
    """Context for message processing."""
    platform: str  # api, discord, telegram, twitter
    user_id: str
    channel_id: Optional[str]
    conversation_id: Optional[str]
    timestamp: str


class HistoryMessage(TypedDict):
    """Single message in conversation history."""
    role: str  # user, assistant, system
    content: str


class NodeJSExecutionRequest(TypedDict):
    """Request for Node.js execution."""
    agent_type: str  # elizaos, voltagent
    message: str
    context: MessageContext
    character: CharacterConfig
    agent_config: Optional[AgentConfig]
    history: Optional[List[HistoryMessage]]
    claw_config: Dict[str, Any]
    platform_credentials: Optional[Dict[str, str]]


class NodeJSExecutionResult(TypedDict):
    """Result from Node.js execution."""
    success: bool
    response: Optional[str]
    error: Optional[str]
    execution_time_ms: float
    metadata: Dict[str, Any]


# =============================================================================
# ELIZAOS-COMPATIBLE RUNTIME
# =============================================================================

ELIZAOS_RUNTIME_TEMPLATE = '''
/**
 * ElizaOS-Compatible Runtime for GuardianClaw Platform
 *
 * This script processes messages using ElizaOS character configuration format.
 * It constructs prompts following ElizaOS patterns and calls the configured LLM.
 */

const input = JSON.parse(process.argv[2] || "{}");

// Build ElizaOS-style character object
function buildCharacter(config) {
  return {
    name: config.name || "Agent",
    system: config.personality || "You are a helpful AI assistant.",
    bio: config.bio ? [config.bio] : [],
    lore: config.lore || [],
    knowledge: config.knowledge || [],
    topics: config.topics || [],
    forbidden_topics: config.forbidden_topics || [],
    adjectives: config.adjectives || [],
    examples: config.examples || [],
    style: config.style || { all: [], chat: [], post: [] },
    modelProvider: config.provider || "openai",
    model: config.model || "gpt-4o-mini"
  };
}

// Build system prompt following ElizaOS patterns
function buildSystemPrompt(character) {
  const parts = [];

  // Core personality/system prompt
  parts.push(character.system);

  // Add bio context
  if (character.bio.length > 0) {
    parts.push(`Background: ${character.bio.join(" ")}`);
  }

  // Add lore for deeper context
  if (character.lore.length > 0) {
    parts.push(`Additional context: ${character.lore.join(" ")}`);
  }

  // Add knowledge base
  if (character.knowledge.length > 0) {
    parts.push(`Knowledge areas: ${character.knowledge.join(", ")}`);
  }

  // Add personality adjectives
  if (character.adjectives.length > 0) {
    parts.push(`Personality traits: ${character.adjectives.join(", ")}`);
  }

  // Add allowed topics
  if (character.topics.length > 0) {
    parts.push(`Topics you can discuss: ${character.topics.join(", ")}`);
  }

  // Add style guidelines
  if (character.style.chat && character.style.chat.length > 0) {
    parts.push(`Communication style: ${character.style.chat.join(", ")}`);
  }

  // CRITICAL: Add forbidden topics as strict constraint
  if (character.forbidden_topics.length > 0) {
    parts.push(`IMPORTANT: Never discuss or provide information about: ${character.forbidden_topics.join(", ")}`);
  }

  return parts.filter(Boolean).join("\\n\\n");
}

// Build few-shot examples
function buildExamples(examples) {
  if (!examples || examples.length === 0) return [];

  const messages = [];
  for (const ex of examples) {
    if (ex.user) messages.push({ role: "user", content: ex.user });
    if (ex.assistant) messages.push({ role: "assistant", content: ex.assistant });
  }
  return messages;
}

// Call OpenAI API
async function callOpenAI(messages, model, apiKey) {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: model,
    messages: messages,
    max_tokens: 1024,
    temperature: 0.7
  });

  return completion.choices[0]?.message?.content || "";
}

// Call Anthropic API
async function callAnthropic(systemPrompt, messages, model, apiKey) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  // Convert messages to Anthropic format (no system role in messages)
  const anthropicMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));

  const completion = await client.messages.create({
    model: model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: anthropicMessages
  });

  return completion.content[0]?.text || "";
}

// Main processing function
async function processMessage(userMessage, history, config) {
  try {
    const character = buildCharacter(config);
    const systemPrompt = buildSystemPrompt(character);

    // Build message array
    const messages = [{ role: "system", content: systemPrompt }];

    // Add few-shot examples
    const examples = buildExamples(character.examples);
    messages.push(...examples);

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    // Call appropriate LLM provider
    let response;
    const provider = character.modelProvider.toLowerCase();

    if (provider === "anthropic" || provider === "claude") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      // Map model names
      let model = character.model;
      if (model.startsWith("claude-3")) model = character.model;
      else if (model === "claude") model = "claude-3-5-sonnet-20241022";

      response = await callAnthropic(systemPrompt, messages, model, apiKey);
    } else {
      // Default to OpenAI
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

      response = await callOpenAI(messages, character.model, apiKey);
    }

    return {
      success: true,
      response: response,
      metadata: {
        character_name: character.name,
        model_used: character.model,
        provider: character.modelProvider,
        prompt_tokens: messages.reduce((acc, m) => acc + m.content.length / 4, 0),
        forbidden_topics_count: character.forbidden_topics.length
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      metadata: {
        character_name: config.name || "Unknown"
      }
    };
  }
}

// Execute
processMessage(input.message, input.history, input.character)
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => console.log(JSON.stringify({ success: false, error: error.message })));
'''


# =============================================================================
# VOLTAGENT-COMPATIBLE RUNTIME
# =============================================================================

VOLTAGENT_RUNTIME_TEMPLATE = '''
/**
 * VoltAgent-Compatible Runtime for GuardianClaw Platform
 *
 * This script processes messages using VoltAgent agent configuration format.
 * It follows VoltAgent patterns for agent definition and LLM interaction.
 */

const input = JSON.parse(process.argv[2] || "{}");

// Build VoltAgent-style agent definition
function buildAgent(config) {
  return {
    name: config.name || "Agent",
    instructions: config.instructions || "You are a helpful AI assistant.",
    model: config.model || "gpt-4o-mini",
    provider: config.provider || "openai",
    tools: config.tools || [],
    memory_enabled: config.memory_enabled !== false
  };
}

// Build system prompt following VoltAgent patterns
function buildInstructions(agent) {
  const parts = [agent.instructions];

  // Add tool awareness (tools not executed, but agent knows about them)
  if (agent.tools.length > 0) {
    const toolNames = agent.tools.map(t => t.name || t.function?.name).filter(Boolean);
    if (toolNames.length > 0) {
      parts.push(`You have access to the following capabilities: ${toolNames.join(", ")}`);
    }
  }

  return parts.join("\\n\\n");
}

// Call OpenAI API
async function callOpenAI(messages, model, apiKey) {
  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: model,
    messages: messages,
    max_tokens: 1024,
    temperature: 0.7
  });

  return completion.choices[0]?.message?.content || "";
}

// Call Anthropic API
async function callAnthropic(systemPrompt, messages, model, apiKey) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const anthropicMessages = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));

  const completion = await client.messages.create({
    model: model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: anthropicMessages
  });

  return completion.content[0]?.text || "";
}

// Main processing function
async function processMessage(userMessage, history, config) {
  try {
    const agent = buildAgent(config);
    const instructions = buildInstructions(agent);

    // Build message array
    const messages = [{ role: "system", content: instructions }];

    // Add conversation history
    if (history && Array.isArray(history)) {
      for (const h of history) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    // Call appropriate LLM provider
    let response;
    const provider = agent.provider.toLowerCase();

    if (provider === "anthropic" || provider === "claude") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

      let model = agent.model;
      if (!model.startsWith("claude")) model = "claude-3-5-sonnet-20241022";

      response = await callAnthropic(instructions, messages, model, apiKey);
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

      response = await callOpenAI(messages, agent.model, apiKey);
    }

    return {
      success: true,
      response: response,
      metadata: {
        agent_name: agent.name,
        model_used: agent.model,
        provider: agent.provider,
        tools_available: agent.tools.length
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      metadata: {
        agent_name: config.name || "Unknown"
      }
    };
  }
}

// Execute
processMessage(input.message, input.history, input.agent_config || input.config || {})
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => console.log(JSON.stringify({ success: false, error: error.message })));
'''


# =============================================================================
# EXECUTOR CLASS
# =============================================================================

@dataclass
class ExecutionContext:
    """Context for Node.js execution."""
    working_dir: Path
    timeout_seconds: int
    memory_mb: int
    env_vars: Dict[str, str]


class NodeJSExecutor:
    """
    Executor for Node.js-based agents.

    Provides ElizaOS-compatible and VoltAgent-compatible execution
    in the Modal runtime environment.

    Example:
        executor = NodeJSExecutor(timeout_seconds=60)
        result = executor.execute_elizaos(request, env_vars={"OPENAI_API_KEY": "..."})
    """

    def __init__(
        self,
        timeout_seconds: int = 60,
        memory_mb: int = 512,
    ):
        """
        Initialize Node.js executor.

        Args:
            timeout_seconds: Maximum execution time (default: 60s)
            memory_mb: Memory limit for Node.js process (default: 512MB)
        """
        self.timeout_seconds = timeout_seconds
        self.memory_mb = memory_mb
        self._stats = {
            "executions": 0,
            "successes": 0,
            "failures": 0,
            "total_time_ms": 0.0,
        }

    def execute_elizaos(
        self,
        request: NodeJSExecutionRequest,
        env_vars: Optional[Dict[str, str]] = None,
    ) -> NodeJSExecutionResult:
        """
        Execute an ElizaOS-compatible agent message.

        Processes the message using the character configuration and returns
        the agent's response. The character format matches ElizaOS specification.

        Args:
            request: Execution request with message and character configuration
            env_vars: Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY)

        Returns:
            NodeJSExecutionResult with response or error details
        """
        start_time = time.time()
        self._stats["executions"] += 1

        try:
            # Prepare input for Node.js
            nodejs_input = {
                "message": request["message"],
                "history": request.get("history", []),
                "character": request["character"],
                "claw_config": request.get("claw_config", {}),
            }

            # Execute Node.js script
            result = self._run_nodejs_script(
                script=ELIZAOS_RUNTIME_TEMPLATE,
                input_data=nodejs_input,
                env_vars=env_vars or {},
            )

            execution_time_ms = (time.time() - start_time) * 1000
            self._stats["total_time_ms"] += execution_time_ms

            if result.get("success"):
                self._stats["successes"] += 1
                metadata = result.get("metadata", {})
                return NodeJSExecutionResult(
                    success=True,
                    response=result.get("response"),
                    error=None,
                    execution_time_ms=execution_time_ms,
                    metadata={
                        "character_name": metadata.get("character_name"),
                        "model_used": metadata.get("model_used"),
                        "provider": metadata.get("provider"),
                        "runtime": "elizaos-compatible",
                    },
                )
            else:
                self._stats["failures"] += 1
                return NodeJSExecutionResult(
                    success=False,
                    response=None,
                    error=result.get("error", "Unknown error"),
                    execution_time_ms=execution_time_ms,
                    metadata={"runtime": "elizaos-compatible"},
                )

        except Exception as e:
            self._stats["failures"] += 1
            execution_time_ms = (time.time() - start_time) * 1000
            logger.error(f"ElizaOS execution failed: {e}")
            return NodeJSExecutionResult(
                success=False,
                response=None,
                error=str(e),
                execution_time_ms=execution_time_ms,
                metadata={"runtime": "elizaos-compatible"},
            )

    def execute_voltagent(
        self,
        request: NodeJSExecutionRequest,
        env_vars: Optional[Dict[str, str]] = None,
    ) -> NodeJSExecutionResult:
        """
        Execute a VoltAgent-compatible agent message.

        Processes the message using the agent configuration and returns
        the agent's response. The agent format matches VoltAgent specification.

        Args:
            request: Execution request with message and agent configuration
            env_vars: Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY)

        Returns:
            NodeJSExecutionResult with response or error details
        """
        start_time = time.time()
        self._stats["executions"] += 1

        try:
            # Prepare input for Node.js
            nodejs_input = {
                "message": request["message"],
                "history": request.get("history", []),
                "agent_config": request.get("agent_config", request.get("character", {})),
                "claw_config": request.get("claw_config", {}),
            }

            # Execute Node.js script
            result = self._run_nodejs_script(
                script=VOLTAGENT_RUNTIME_TEMPLATE,
                input_data=nodejs_input,
                env_vars=env_vars or {},
            )

            execution_time_ms = (time.time() - start_time) * 1000
            self._stats["total_time_ms"] += execution_time_ms

            if result.get("success"):
                self._stats["successes"] += 1
                metadata = result.get("metadata", {})
                return NodeJSExecutionResult(
                    success=True,
                    response=result.get("response"),
                    error=None,
                    execution_time_ms=execution_time_ms,
                    metadata={
                        "agent_name": metadata.get("agent_name"),
                        "model_used": metadata.get("model_used"),
                        "provider": metadata.get("provider"),
                        "runtime": "voltagent-compatible",
                    },
                )
            else:
                self._stats["failures"] += 1
                return NodeJSExecutionResult(
                    success=False,
                    response=None,
                    error=result.get("error", "Unknown error"),
                    execution_time_ms=execution_time_ms,
                    metadata={"runtime": "voltagent-compatible"},
                )

        except Exception as e:
            self._stats["failures"] += 1
            execution_time_ms = (time.time() - start_time) * 1000
            logger.error(f"VoltAgent execution failed: {e}")
            return NodeJSExecutionResult(
                success=False,
                response=None,
                error=str(e),
                execution_time_ms=execution_time_ms,
                metadata={"runtime": "voltagent-compatible"},
            )

    def _run_nodejs_script(
        self,
        script: str,
        input_data: Dict[str, Any],
        env_vars: Dict[str, str],
    ) -> Dict[str, Any]:
        """
        Execute a Node.js script with input data.

        Creates a temporary file, runs Node.js subprocess, and parses the output.

        Args:
            script: JavaScript code to execute
            input_data: Data to pass as command line argument (JSON serialized)
            env_vars: Environment variables to inject

        Returns:
            Parsed JSON output from the script

        Raises:
            Does not raise - returns error dict on failure
        """
        import os

        # Create temporary script file
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".js",
            delete=False,
        ) as f:
            f.write(script)
            script_path = f.name

        try:
            # Prepare environment
            env = os.environ.copy()
            env.update(env_vars)

            # Serialize input to JSON
            input_json = json.dumps(input_data)

            # Run Node.js subprocess
            result = subprocess.run(
                ["node", script_path, input_json],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                env=env,
            )

            # Parse output
            if result.returncode == 0 and result.stdout.strip():
                try:
                    output = json.loads(result.stdout.strip())
                    return output
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON from Node.js: {result.stdout[:200]}")
                    return {
                        "success": False,
                        "error": f"Invalid JSON output from Node.js: {str(e)}",
                    }
            else:
                error_msg = result.stderr.strip() if result.stderr else f"Node.js exited with code {result.returncode}"
                logger.error(f"Node.js execution failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                }

        except subprocess.TimeoutExpired:
            logger.error(f"Node.js execution timed out after {self.timeout_seconds}s")
            return {
                "success": False,
                "error": f"Execution timed out after {self.timeout_seconds}s",
            }
        except FileNotFoundError:
            logger.error("Node.js not found in PATH")
            return {
                "success": False,
                "error": "Node.js not found. Ensure Node.js is installed in the runtime environment.",
            }
        except Exception as e:
            logger.error(f"Unexpected error running Node.js: {e}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
            }
        finally:
            # Cleanup temporary file
            try:
                os.unlink(script_path)
            except Exception:
                pass

    def get_stats(self) -> Dict[str, Any]:
        """
        Get execution statistics.

        Returns:
            Dictionary with execution counts and performance metrics
        """
        total = self._stats["executions"] or 1
        return {
            "executions": self._stats["executions"],
            "successes": self._stats["successes"],
            "failures": self._stats["failures"],
            "success_rate": self._stats["successes"] / total,
            "avg_time_ms": self._stats["total_time_ms"] / total,
        }


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def execute_voltagent(
    message: str,
    config: Dict[str, Any],
    history: Optional[List[HistoryMessage]] = None,
    env_vars: Optional[Dict[str, str]] = None,
) -> NodeJSExecutionResult:
    """
    Convenience function to execute a VoltAgent-compatible message.

    Args:
        message: User message to process
        config: VoltAgent agent configuration
        history: Optional conversation history
        env_vars: Environment variables for API keys

    Returns:
        NodeJSExecutionResult with response or error
    """
    executor = NodeJSExecutor()
    request: NodeJSExecutionRequest = {
        "agent_type": "voltagent",
        "message": message,
        "context": {
            "platform": "api",
            "user_id": "system",
            "channel_id": None,
            "conversation_id": None,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "character": {},
        "agent_config": config,
        "history": history,
        "claw_config": config.get("claw", {}),
        "platform_credentials": None,
    }

    return executor.execute_voltagent(request, env_vars)


def execute_elizaos(
    message: str,
    character: CharacterConfig,
    history: Optional[List[HistoryMessage]] = None,
    env_vars: Optional[Dict[str, str]] = None,
) -> NodeJSExecutionResult:
    """
    Convenience function to execute an ElizaOS-compatible message.

    Args:
        message: User message to process
        character: ElizaOS character configuration
        history: Optional conversation history
        env_vars: Environment variables for API keys

    Returns:
        NodeJSExecutionResult with response or error
    """
    executor = NodeJSExecutor()
    request: NodeJSExecutionRequest = {
        "agent_type": "elizaos",
        "message": message,
        "context": {
            "platform": "api",
            "user_id": "system",
            "channel_id": None,
            "conversation_id": None,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "character": character,
        "agent_config": None,
        "history": history,
        "claw_config": {},
        "platform_credentials": None,
    }

    return executor.execute_elizaos(request, env_vars)
