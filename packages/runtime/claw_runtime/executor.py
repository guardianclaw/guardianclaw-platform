"""
Agent Executor - Orchestrates agent flow execution with GuardianClaw protection.

This module implements the core execution logic:
1. Parse visual flow into executable steps
2. Validate input with GuardianClaw (Gate 1)
3. Execute LLM with alignment seed
4. Validate output with GuardianClaw (Gates 2 + 3)
5. Return structured result

The executor follows ADR-004 SDK Abstraction Layer for GuardianClaw integration,
allowing transparent migration between SDK versions.
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Optional, Dict, Any, Callable, List, Union

from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

from claw_runtime.interfaces import (
    FlowDict,
    LLMConfig,
    ClawConfigDict,
    ExecutionResult,
)
from claw_runtime.adapters import create_claw_adapter, GuardianClawAdapter
from claw_runtime.flow_parser import FlowParser, ParsedFlow, StepType, FlowStep

logger = logging.getLogger("claw_runtime.executor")

# Hard cap on execution steps to prevent runaway loops (e.g. router ping-pong)
MAX_EXECUTION_STEPS = 1000


# Default alignment seed for agents without custom system prompt
DEFAULT_ALIGNMENT_SEED = """You are a helpful AI assistant with strong ethical guidelines.

Follow these principles:
1. CREDIBILITY: Only state what you know to be factually accurate
2. AVOIDANCE: Never provide information that could cause harm
3. LIMITS: Stay within your knowledge and capabilities
4. WORTH: Ensure your responses serve a legitimate beneficial purpose

If asked to do something harmful or unethical, politely decline and explain why."""


class AgentExecutor:
    """
    Executes agent flows with GuardianClaw protection.

    The executor orchestrates the complete flow:
    - Input validation (Gate 1)
    - LLM execution with seed
    - Output validation (Gates 2 + 3)

    Attributes:
        flow: Parsed flow from visual builder
        llm: LLM client instance
        claw: GuardianClaw adapter instance
    """

    def __init__(
        self,
        flow: FlowDict,
        llm_config: Optional[LLMConfig] = None,
        claw_config: Optional[ClawConfigDict] = None,
        llm_api_key: Optional[str] = None,
    ):
        """
        Initialize the agent executor.

        Args:
            flow: Flow definition from visual builder
            llm_config: LLM configuration (provider, model, etc.)
            claw_config: GuardianClaw configuration (gates, thresholds)
            llm_api_key: Optional user-provided LLM API key (BYOK)
        """
        self._raw_flow = flow
        self._llm_config = llm_config or {}
        self._claw_config = claw_config or {}
        self._llm_api_key = llm_api_key  # BYOK support

        # Parse flow
        self._parser = FlowParser()
        self._parsed_flow = self._parser.parse(flow)

        # Merge flow-extracted config with explicit config
        self._effective_llm_config = {
            **self._parsed_flow.llm_config,
            **self._llm_config,
        }
        self._effective_claw_config = {
            **self._parsed_flow.claw_config,
            **self._claw_config,
        }

        # Initialize GuardianClaw adapter
        self._claw = create_claw_adapter(
            version=self._claw_config.get("sdk_version", "auto"),
            config=self._effective_claw_config,
        )

        # Initialize LLM
        self._llm = self._create_llm()

        # Execution stats
        self._execution_count = 0
        self._total_latency_ms = 0.0

        # Step handlers
        self._step_handlers: Dict[StepType, Callable] = {
            StepType.RECEIVE_INPUT: self._handle_receive_input,
            StepType.CLAW_VALIDATE_INPUT: self._handle_claw_validate_input,
            StepType.LLM_CALL: self._handle_llm_call,
            StepType.CLAW_VALIDATE_OUTPUT: self._handle_claw_validate_output,
            StepType.SEND_OUTPUT: self._handle_send_output,
            StepType.TOOL_WEB_SEARCH: self._handle_tool_web_search,
            StepType.TOOL_CODE_EXEC: self._handle_tool_code_exec,
            StepType.TOOL_API_REQUEST: self._handle_tool_api_request,
            StepType.TOOL_DATABASE: self._handle_tool_database,
            StepType.FLOW_ROUTER: self._handle_flow_router,
            StepType.FLOW_MERGE: self._handle_flow_merge,
            StepType.FLOW_LOOP: self._handle_flow_loop,
            StepType.MEMORY_BUFFER: self._handle_memory_buffer,
            StepType.MEMORY_VECTOR: self._handle_memory_vector,
            StepType.MEMORY_SUMMARY: self._handle_memory_summary,
            StepType.UTILITY_DELAY: self._handle_utility_delay,
            StepType.UTILITY_LOG: self._handle_utility_log,
            StepType.TRANSFORM: self._handle_transform,
            StepType.CONDITION: self._handle_condition,
            # v2.25 Layer handlers
            StepType.CLAW_L1_INPUT: self._handle_claw_l1_input,
            StepType.CLAW_L2_SEED: self._handle_claw_l2_seed,
            StepType.CLAW_L3_OUTPUT: self._handle_claw_l3_output,
            StepType.CLAW_L4_OBSERVER: self._handle_claw_l4_observer,
        }

        logger.info(
            f"AgentExecutor initialized: "
            f"nodes={len(flow.get('nodes', []))}, "
            f"steps={len(self._parsed_flow.steps)}, "
            f"llm={self._effective_llm_config.get('provider', 'openai')}, "
            f"claw={self._effective_claw_config.get('protection_level', 'standard')}"
        )

    # --- Auto-Protection Methods ---

    def _should_auto_protect(self) -> bool:
        """Check if auto-protection should be applied.

        Auto-protection kicks in when:
        1. Flow has no explicit claw nodes (input OR output)
        2. claw_config is present
        3. auto_protect is not explicitly set to False
        """
        if self._parsed_flow.has_claw_input and self._parsed_flow.has_claw_output:
            return False

        config = self._effective_claw_config
        if not config:
            return False

        # Explicit opt-out via auto_protect: false
        if config.get("auto_protect") is False:
            return False

        return True

    def _auto_validate_input(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Run automatic input validation when flow lacks claw nodes."""
        logger.info("Auto-protection: running input validation (no claw node in flow)")

        try:
            conversation_history = state.get("history", [])

            input_result = self._claw.validate_input(
                state["current_input"],
                conversation_history=conversation_history if conversation_history else None,
            )

            state["claw_input_result"] = input_result
            state["_auto_protected"] = True

            if input_result["blocked"]:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "input",
                    "gate": input_result["gate"],
                    "reason": input_result["reason"],
                    "violations": input_result["violations"],
                }

        except Exception as e:
            logger.error(f"Auto-protection input validation failed: {e}", exc_info=True)
            # Fail open — the flow's own validation or the LLM's built-in
            # safety will still apply. Prevents auto-protect bugs from
            # breaking all executions.
            state["_auto_protect_error"] = str(e)

        return state

    def _auto_validate_output(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Run automatic output validation when flow lacks claw nodes."""
        final_output = state.get("final_output")

        # Skip output validation if there's no output to validate
        if not final_output:
            logger.info("Auto-protection: skipping output validation (no final_output)")
            return state

        logger.info("Auto-protection: running output validation (no claw node in flow)")

        try:
            conversation_history = state.get("history", [])

            output_result = self._claw.validate_output(
                output=final_output,
                input_context=state["initial_input"],
                conversation_history=conversation_history if conversation_history else None,
            )

            state["claw_output_result"] = output_result

            if output_result["blocked"]:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "output",
                    "gate": output_result["gate"],
                    "reason": output_result["reason"],
                    "violations": output_result["violations"],
                }
                state["final_output"] = None

        except Exception as e:
            logger.error(f"Auto-protection output validation failed: {e}", exc_info=True)
            state["_auto_protect_error"] = str(e)

        return state

    def _build_auto_protect_trace(
        self, state: Dict[str, Any], stage: str
    ) -> Optional[Dict[str, Any]]:
        """Build a synthetic execution trace for auto-protection events.

        When auto-protect blocks before/after the execution loop, the normal
        trace collection doesn't run. This generates equivalent trace entries
        so the trace viewer can show what happened.
        """
        steps = []

        if stage == "input":
            input_result = state.get("claw_input_result") or {}
            blocked = input_result.get("blocked", False)
            steps.append({
                "step_id": "_auto_protect_input",
                "step_name": "Auto-Protection: Input Validation",
                "step_type": "claw_validate_input",
                "category": "claw",
                "status": "error" if blocked else "success",
                "duration_ms": 0,
                "error": input_result.get("reason") if blocked else None,
                "metadata": {
                    "auto_protected": True,
                    "gate": input_result.get("gate"),
                    "confidence": input_result.get("confidence"),
                },
            })

        return {
            "steps": steps,
            "total_steps": len(steps),
            "completed_steps": sum(1 for s in steps if s["status"] == "success"),
            "failed_step": next(
                (s["step_id"] for s in steps if s["status"] == "error"),
                None,
            ),
        }

    # --- End Auto-Protection Methods ---

    def _create_llm(self):
        """Create LLM client based on configuration.

        Uses user-provided API key (BYOK) if available, otherwise falls back
        to environment variables.
        """
        provider = self._effective_llm_config.get("provider", "openai")
        model = self._effective_llm_config.get("model", "gpt-4o-mini")
        temperature = self._effective_llm_config.get("temperature", 0.7)
        max_tokens = self._effective_llm_config.get("max_tokens", 2048)

        # Determine which API key to use (user's key takes priority)
        if provider == "openai":
            api_key = self._llm_api_key or os.environ.get("OPENAI_API_KEY")
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
            )
        elif provider == "anthropic":
            api_key = self._llm_api_key or os.environ.get("ANTHROPIC_API_KEY")
            return ChatAnthropic(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
            )
        elif provider == "openrouter":
            # OpenRouter uses OpenAI-compatible API
            api_key = self._llm_api_key or os.environ.get("OPENROUTER_API_KEY")
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                openai_api_base="https://openrouter.ai/api/v1",
                openai_api_key=api_key,
            )
        else:
            logger.warning(f"Unknown provider '{provider}', defaulting to OpenAI")
            api_key = self._llm_api_key or os.environ.get("OPENAI_API_KEY")
            return ChatOpenAI(
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
            )

    def run(
        self,
        input_text: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> ExecutionResult:
        """
        Execute the agent flow with input.

        This is the main entry point for agent execution.

        Args:
            input_text: User's input message
            history: Optional conversation history for multi-turn context.
                Each item should have {"role": "user"|"assistant"|"system", "content": "..."}

        Returns:
            ExecutionResult with response or blocking info
        """
        start_time = time.time()
        self._execution_count += 1

        # Initialize execution state
        state: Dict[str, Any] = {
            "initial_input": input_text,
            "current_input": input_text,
            "history": history or [],  # Conversation history from database
            "results": {},
            "blocked": False,
            "claw_input_result": None,
            "claw_output_result": None,
        }

        try:
            # --- Auto-protection: input validation BEFORE execution loop ---
            auto_protect = self._should_auto_protect()

            if auto_protect and not self._parsed_flow.has_claw_input:
                state = self._auto_validate_input(state)
                if state.get("blocked"):
                    latency_ms = (time.time() - start_time) * 1000
                    self._total_latency_ms += latency_ms
                    return {
                        "blocked": True,
                        "response": None,
                        **state.get("block_info", {}),
                        "claw": {
                            "input": state["claw_input_result"],
                            "output": None,
                            "stats": self._claw.get_stats(),
                        },
                        "error": None,
                        "latency_ms": latency_ms,
                        "flow_stats": self._get_flow_stats(),
                        "trace": self._build_auto_protect_trace(state, "input"),
                    }
            # --- End auto-protection input ---

            state = self._execution_loop(state)

            # --- Auto-protection: output validation AFTER execution loop ---
            if auto_protect and not self._parsed_flow.has_claw_output and not state.get("blocked"):
                state = self._auto_validate_output(state)

                # Append auto-protect output trace to existing trace
                existing_trace = state.get("_execution_trace")
                if existing_trace:
                    output_result = state.get("claw_output_result")
                    out_blocked = output_result.get("blocked", False) if output_result else False
                    existing_trace["steps"].append({
                        "step_id": "_auto_protect_output",
                        "step_name": "Auto-Protection: Output Validation",
                        "step_type": "claw_validate_output",
                        "category": "claw",
                        "status": "error" if out_blocked else "success",
                        "duration_ms": 0,
                        "error": output_result.get("reason") if out_blocked else None,
                        "metadata": {
                            "auto_protected": True,
                            "gate": output_result.get("gate") if output_result else None,
                            "confidence": output_result.get("confidence") if output_result else None,
                        },
                    })
                    existing_trace["total_steps"] += 1
                    if not out_blocked:
                        existing_trace["completed_steps"] += 1
            # --- End auto-protection output ---

            final_response = state.get("final_output", None)
            latency_ms = (time.time() - start_time) * 1000
            self._total_latency_ms += latency_ms

            # Get execution trace from state
            trace = state.get("_execution_trace")

            if state.get("blocked"):
                return {
                    "blocked": True,
                    "response": None,
                    **state.get("block_info", {}),
                    "claw": {
                        "input": state["claw_input_result"],
                        "output": state["claw_output_result"],
                        "stats": self._claw.get_stats(),
                    },
                    "error": None,
                    "latency_ms": latency_ms,
                    "flow_stats": self._get_flow_stats(),
                    "trace": trace,
                }

            return {
                "blocked": False,
                "response": final_response,
                "stage": None, "gate": None, "reason": None, "violations": None,
                "claw": {
                    "input": state["claw_input_result"],
                    "output": state["claw_output_result"],
                    "stats": self._claw.get_stats(),
                },
                "error": None,
                "latency_ms": latency_ms,
                "flow_stats": self._get_flow_stats(),
                "trace": trace,
            }

        except Exception as e:
            logger.error(f"Execution error: {e}", exc_info=True)
            latency_ms = (time.time() - start_time) * 1000
            self._total_latency_ms += latency_ms
            return {
                "blocked": True,
                "response": None,
                "stage": "execution",
                "gate": "error",
                "reason": f"Execution failed: {str(e)}",
                "violations": ["error:execution_failed"],
                "claw": None,
                "error": str(e),
                "latency_ms": latency_ms,
                "flow_stats": self._get_flow_stats(),
                "trace": None,
            }

    def _execution_loop(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        The main execution loop that iterates through flow steps.

        Supports:
        - Linear execution
        - Branching via _next_node (from router)
        - Loop iteration via _loop_context
        - Execution trace collection
        """
        steps = self._parsed_flow.steps
        step_index = 0
        iterations = 0

        # Initialize trace collection
        trace_steps: List[Dict[str, Any]] = []

        while step_index < len(steps):
            iterations += 1
            if iterations > MAX_EXECUTION_STEPS:
                logger.error(f"Execution exceeded {MAX_EXECUTION_STEPS} steps — likely a runaway loop")
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "execution",
                    "gate": "runaway_loop",
                    "reason": f"Execution exceeded {MAX_EXECUTION_STEPS} steps",
                    "violations": ["runaway_loop"],
                }
                break

            step = steps[step_index]
            step_start_time = time.time()
            step_error = None
            step_status = "success"
            step_metadata = None

            if state.get("blocked"):
                # Mark remaining steps as skipped
                logger.warning(f"Execution blocked at step {step.position}, marking remaining as skipped.")
                while step_index < len(steps):
                    skipped_step = steps[step_index]
                    trace_steps.append({
                        "step_id": skipped_step.id,
                        "step_name": skipped_step.label,
                        "step_type": skipped_step.type.value,
                        "category": skipped_step.category.value,
                        "status": "skipped",
                        "duration_ms": 0,
                        "error": None,
                        "metadata": None,
                    })
                    step_index += 1
                break

            handler = self._step_handlers.get(step.type)
            if not handler:
                logger.warning(f"No handler for step type {step.type.value}, skipping.")
                trace_steps.append({
                    "step_id": step.id,
                    "step_name": step.label,
                    "step_type": step.type.value,
                    "category": step.category.value,
                    "status": "skipped",
                    "duration_ms": 0,
                    "error": f"No handler for {step.type.value}",
                    "metadata": None,
                })
                step_index += 1
                continue

            logger.info(f"Executing step {step.position}: {step.type.value} ({step.label})")

            try:
                state = handler(state, step)

                # Check if step resulted in blocking
                if state.get("blocked"):
                    step_status = "error"
                    block_info = state.get("block_info", {})
                    step_error = block_info.get("reason")
                    step_metadata = {
                        "gate": block_info.get("gate"),
                        "violations": block_info.get("violations"),
                    }
                else:
                    # Capture step-specific metadata from results
                    step_result = state.get("results", {}).get(step.id)
                    if step_result:
                        step_metadata = step_result

            except Exception as e:
                logger.error(f"Step {step.id} failed: {e}", exc_info=True)
                step_status = "error"
                step_error = str(e)
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "execution",
                    "gate": "error",
                    "reason": f"Step {step.label} failed: {str(e)}",
                    "violations": ["error:step_execution_failed"],
                }

            # Calculate step duration
            step_duration_ms = (time.time() - step_start_time) * 1000

            # Record trace entry
            trace_steps.append({
                "step_id": step.id,
                "step_name": step.label,
                "step_type": step.type.value,
                "category": step.category.value,
                "status": step_status,
                "duration_ms": round(step_duration_ms, 2),
                "error": step_error,
                "metadata": step_metadata,
            })

            # Check for router branching
            if "_next_node" in state:
                next_node = state.pop("_next_node")

                # Self-loop guard: router pointing back to itself
                if next_node == step.id:
                    logger.warning(f"Router {step.id} targets itself — skipping self-loop")
                    step_index += 1
                    continue

                # Find step index for target node
                found = False
                for i, s in enumerate(steps):
                    if s.id == next_node:
                        step_index = i
                        found = True
                        logger.info(f"Branching to step {i}: {s.id}")
                        break
                if not found:
                    logger.warning(f"Target node {next_node} not found, continuing linearly")
                    # Include missing target info in trace for debugging
                    trace_steps[-1]["metadata"] = {
                        **(trace_steps[-1].get("metadata") or {}),
                        "missing_target": next_node,
                    }
                    step_index += 1
            else:
                step_index += 1

        # Fallback: if flow completed without output node, provide a message
        if state.get("final_output") is None and not state.get("blocked"):
            state["final_output"] = "[Flow completed without output node]"

        # Store trace in state for retrieval
        state["_execution_trace"] = {
            "steps": trace_steps,
            "total_steps": len(steps),
            "completed_steps": sum(1 for s in trace_steps if s["status"] == "success"),
            "failed_step": next(
                (s["step_id"] for s in trace_steps if s["status"] == "error"),
                None
            ),
        }

        return state

    # --- Step Handlers ---

    def _handle_receive_input(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """Handles the initial input step."""
        # The initial input is already in state['current_input']
        logger.info(f"Received input: {state['current_input']}")
        return state

    def _handle_claw_validate_input(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Handles GuardianClaw input validation.

        Config priority:
        1. Step-specific config (step.config) - highest priority
        2. Aggregated flow config (parsed_flow.claw_config)
        3. Global executor config (self._claw_config) - lowest priority

        If step is disabled (config.enabled = False), validation is skipped.
        """
        # Check if this specific step is disabled
        step_config = step.config or {}
        if step_config.get("enabled") is False:
            logger.info(f"GuardianClaw step {step.id} is disabled, skipping validation")
            state["results"] = state.get("results", {})
            state["results"][step.id] = {"skipped": True, "reason": "disabled"}
            return state

        # Get step-specific gates config if available
        step_gates = self._get_step_claw_config(step)

        # Get conversation history for multi-turn escalation detection
        conversation_history = state.get("history", [])

        # Create temporary adapter if step has specific config, otherwise use default
        if step_gates:
            from claw_runtime.adapters import create_claw_adapter
            step_claw = create_claw_adapter(
                version=self._claw_config.get("sdk_version", "auto"),
                config={**self._effective_claw_config, "gates": step_gates},
            )
            input_result = step_claw.validate_input(
                state["current_input"],
                conversation_history=conversation_history if conversation_history else None,
            )
        else:
            input_result = self._claw.validate_input(
                state["current_input"],
                conversation_history=conversation_history if conversation_history else None,
            )

        state["claw_input_result"] = input_result
        state["results"] = state.get("results", {})
        state["results"][step.id] = input_result

        if input_result["blocked"]:
            state["blocked"] = True
            state["block_info"] = {
                "stage": "input",
                "gate": input_result["gate"],
                "reason": input_result["reason"],
                "violations": input_result["violations"],
            }
        return state

    def _handle_llm_call(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """Handles LLM execution with conversation history support."""
        from langchain_core.messages import AIMessage

        system_prompt = self._effective_llm_config.get(
            "system_prompt", DEFAULT_ALIGNMENT_SEED
        )
        user_input = state["current_input"]

        # Build messages array
        messages = [SystemMessage(content=system_prompt)]

        # Add conversation history if available
        history = state.get("history", [])
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))
            elif role == "system":
                messages.append(SystemMessage(content=content))

        # Add current user input
        messages.append(HumanMessage(content=user_input))

        logger.debug(f"LLM call with {len(messages)} messages ({len(history)} from history)")

        response = self._llm.invoke(messages)
        state["current_input"] = response.content

        # Append to conversation history
        state.setdefault("conversation_turns", []).append({
            "human": user_input,
            "ai": response.content,
        })
        return state

    def _handle_claw_validate_output(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Handles GuardianClaw output validation.

        Config priority:
        1. Step-specific config (step.config) - highest priority
        2. Aggregated flow config (parsed_flow.claw_config)
        3. Global executor config (self._claw_config) - lowest priority

        If step is disabled (config.enabled = False), validation is skipped.
        """
        # Check if this specific step is disabled
        step_config = step.config or {}
        if step_config.get("enabled") is False:
            logger.info(f"GuardianClaw step {step.id} is disabled, skipping validation")
            state["results"] = state.get("results", {})
            state["results"][step.id] = {"skipped": True, "reason": "disabled"}
            return state

        # Get step-specific gates config if available
        step_gates = self._get_step_claw_config(step)

        # Get conversation history for multi-turn analysis
        # Note: Full Gate 4 multi-turn support requires SDK update
        conversation_history = state.get("history", [])

        # Create temporary adapter if step has specific config, otherwise use default
        if step_gates:
            from claw_runtime.adapters import create_claw_adapter
            step_claw = create_claw_adapter(
                version=self._claw_config.get("sdk_version", "auto"),
                config={**self._effective_claw_config, "gates": step_gates},
            )
            output_result = step_claw.validate_output(
                output=state["current_input"],
                input_context=state["initial_input"],
                conversation_history=conversation_history if conversation_history else None,
            )
        else:
            output_result = self._claw.validate_output(
                output=state["current_input"],
                input_context=state["initial_input"],
                conversation_history=conversation_history if conversation_history else None,
            )

        state["claw_output_result"] = output_result
        state["results"] = state.get("results", {})
        state["results"][step.id] = output_result

        if output_result["blocked"]:
            state["blocked"] = True
            state["block_info"] = {
                "stage": "output",
                "gate": output_result["gate"],
                "reason": output_result["reason"],
                "violations": output_result["violations"],
            }
        return state

    def _handle_send_output(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """Handles the final output step."""
        state["final_output"] = state["current_input"]
        logger.info(f"Final output: {state['final_output']}")
        return state

    # --- v2.25 Layer Handlers ---

    def _handle_claw_l1_input(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        L1 InputValidator - Pre-AI detection with 8 detectors.

        Uses l1Config from node data:
        - mode: strict | moderate | lenient
        - enabledDetectors: dict of detector toggles
        - threshold: detection threshold 0-100
        """
        l1_config = self._parsed_flow.l1_config or {}
        mode = l1_config.get("mode", "moderate")
        enabled_detectors = l1_config.get("enabledDetectors", {})
        threshold = l1_config.get("threshold", 70)

        logger.info(f"[{step.id}] L1 InputValidator (mode={mode}, threshold={threshold})")

        # Build SDK-compatible config from L1 settings
        sdk_config = {
            **self._effective_claw_config,
            "protection_level": "maximum" if mode == "strict" else ("standard" if mode == "moderate" else "minimal"),
        }

        # Create adapter with L1 config
        from claw_runtime.adapters import create_claw_adapter
        l1_claw = create_claw_adapter(
            version=self._claw_config.get("sdk_version", "auto"),
            config=sdk_config,
        )

        # Get conversation history for multi-turn detection
        conversation_history = state.get("history", [])

        input_result = l1_claw.validate_input(
            state["current_input"],
            conversation_history=conversation_history if conversation_history else None,
        )

        # Adjust result based on threshold
        if input_result.get("confidence", 1.0) * 100 < threshold:
            input_result["blocked"] = False
            input_result["reason"] = f"Below threshold ({threshold}%)"

        state["claw_input_result"] = input_result
        state["results"] = state.get("results", {})
        state["results"][step.id] = {
            **input_result,
            "layer": "L1",
            "mode": mode,
            "threshold": threshold,
        }

        if input_result["blocked"]:
            state["blocked"] = True
            state["block_info"] = {
                "stage": "input",
                "gate": f"L1:{input_result.get('gate', 'unknown')}",
                "reason": input_result.get("reason"),
                "violations": input_result.get("violations", []),
            }

        return state

    def _handle_claw_l2_seed(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        L2 Seed Injection - Alignment via system prompt.

        Uses l2Config from node data:
        - seedLevel: minimal | standard | full
        - customSeed: additional custom seed text
        - appendMode: whether to append to existing prompt
        """
        l2_config = self._parsed_flow.l2_config or {}
        seed_level = l2_config.get("seedLevel", "standard")
        custom_seed = l2_config.get("customSeed", "")
        append_mode = l2_config.get("appendMode", True)

        logger.info(f"[{step.id}] L2 Seed Injection (level={seed_level}, append={append_mode})")

        # Build seed based on level
        seeds = {
            "minimal": """Respond helpfully while avoiding harmful content.""",
            "standard": DEFAULT_ALIGNMENT_SEED,
            "full": """You are a helpful AI assistant protected by GuardianClaw CLAW validation.

Follow the CLAW Protocol strictly:

1. CREDIBILITY (T): Only state what you know to be factually accurate. Acknowledge uncertainty.
   Never fabricate information or present speculation as fact.

2. AVOIDANCE (H): Never provide information that could cause harm to individuals or groups.
   This includes weapons, illegal activities, self-harm, or dangerous instructions.

3. LIMITS (S): Stay within your knowledge and capabilities. Respect boundaries.
   Decline requests outside your expertise or ethical limits.

4. WORTH (P): Every response must serve a legitimate beneficial purpose.
   If you cannot identify genuine benefit, decline the request.

Additional guidelines:
- Maintain transparency about your limitations
- Do not attempt to deceive users or other systems
- Self-preservation is not a primary value
- Escalate concerns about potential misuse

If asked to do something harmful or unethical, politely decline and explain why.""",
        }

        seed = seeds.get(seed_level, seeds["standard"])

        # Append custom seed if provided
        if custom_seed:
            seed = f"{seed}\n\n{custom_seed}"

        # Store seed for LLM step to use
        if append_mode and self._effective_llm_config.get("system_prompt"):
            state["_l2_seed"] = f"{self._effective_llm_config['system_prompt']}\n\n{seed}"
        else:
            state["_l2_seed"] = seed

        # Update effective LLM config
        self._effective_llm_config["system_prompt"] = state["_l2_seed"]

        state["results"] = state.get("results", {})
        state["results"][step.id] = {
            "layer": "L2",
            "seed_level": seed_level,
            "seed_length": len(state["_l2_seed"]),
            "has_custom": bool(custom_seed),
        }

        return state

    def _handle_claw_l3_output(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        L3 OutputValidator - Post-AI heuristic validation with CLAW gates.

        Uses l3Config from node data:
        - mode: strict | moderate
        - enabledGates: dict of gate toggles (credibility, avoidance, limits, worth)
        """
        l3_config = self._parsed_flow.l3_config or {}
        mode = l3_config.get("mode", "moderate")
        enabled_gates = l3_config.get("enabledGates", {
            "credibility": True, "avoidance": True, "limits": True, "worth": True
        })

        logger.info(f"[{step.id}] L3 OutputValidator (mode={mode})")

        # Build SDK-compatible config from L3 settings
        sdk_config = {
            **self._effective_claw_config,
            "gates": enabled_gates,
            "fail_closed": mode == "strict",
        }

        # Create adapter with L3 config
        from claw_runtime.adapters import create_claw_adapter
        l3_claw = create_claw_adapter(
            version=self._claw_config.get("sdk_version", "auto"),
            config=sdk_config,
        )

        # Get conversation history
        conversation_history = state.get("history", [])

        output_result = l3_claw.validate_output(
            output=state["current_input"],
            input_context=state["initial_input"],
            conversation_history=conversation_history if conversation_history else None,
        )

        state["claw_output_result"] = output_result
        state["results"] = state.get("results", {})
        state["results"][step.id] = {
            **output_result,
            "layer": "L3",
            "mode": mode,
            "enabled_gates": enabled_gates,
        }

        if output_result["blocked"]:
            state["blocked"] = True
            state["block_info"] = {
                "stage": "output",
                "gate": f"L3:{output_result.get('gate', 'unknown')}",
                "reason": output_result.get("reason"),
                "violations": output_result.get("violations", []),
            }

        return state

    def _handle_claw_l4_observer(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        L4 ClawObserver - LLM-based transcript analysis.

        Uses l4Config from node data:
        - enabled: whether L4 is active
        - provider: openai | anthropic | openrouter
        - model: model identifier
        - fallbackPolicy: BLOCK | ALLOW_IF_L2_PASSED | ALLOW
        - maxRetries: retry attempts
        - retryDelayMs: delay between retries
        """
        l4_config = self._parsed_flow.l4_config or {}

        if not l4_config.get("enabled", True):
            logger.info(f"[{step.id}] L4 Observer disabled, skipping")
            state["results"] = state.get("results", {})
            state["results"][step.id] = {
                "layer": "L4",
                "skipped": True,
                "reason": "disabled",
            }
            return state

        provider = l4_config.get("provider", "openai")
        model = l4_config.get("model", "gpt-4o-mini")
        fallback_policy = l4_config.get("fallbackPolicy", "ALLOW_IF_L2_PASSED")
        max_retries = l4_config.get("maxRetries", 2)
        retry_delay_ms = l4_config.get("retryDelayMs", 1000)

        logger.info(f"[{step.id}] L4 Observer (provider={provider}, model={model})")

        # Build SDK-compatible config for Gate 4
        sdk_config = {
            **self._effective_claw_config,
            "gate4_enabled": True,
            "gate4_provider": provider,
            "gate4_model": model,
            "gate4_fallback": fallback_policy.lower().replace("_", "_"),
            "gate4_retry_enabled": max_retries > 0,
            "gate4_retry_max_attempts": max_retries,
            "gate4_retry_initial_delay": retry_delay_ms / 1000.0,
        }

        try:
            # Create adapter with L4 config
            from claw_runtime.adapters import create_claw_adapter
            l4_claw = create_claw_adapter(
                version=self._claw_config.get("sdk_version", "auto"),
                config=sdk_config,
            )

            # Get conversation history
            conversation_history = state.get("history", [])

            # Run output validation with Gate 4 (LLM analysis)
            l4_result = l4_claw.validate_output(
                output=state["current_input"],
                input_context=state["initial_input"],
                conversation_history=conversation_history if conversation_history else None,
            )

            state["claw_l4_result"] = l4_result
            state["results"] = state.get("results", {})
            state["results"][step.id] = {
                **l4_result,
                "layer": "L4",
                "provider": provider,
                "model": model,
            }

            if l4_result["blocked"]:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "output",
                    "gate": f"L4:{l4_result.get('gate', 'observer')}",
                    "reason": l4_result.get("reason"),
                    "violations": l4_result.get("violations", []),
                }

        except Exception as e:
            logger.error(f"[{step.id}] L4 Observer failed: {e}")

            # Apply fallback policy
            l3_passed = state.get("claw_output_result", {}).get("blocked") is False

            if fallback_policy == "BLOCK":
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "output",
                    "gate": "L4:fallback",
                    "reason": f"L4 failed and fallback is BLOCK: {e}",
                    "violations": ["l4_fallback:block"],
                }
            elif fallback_policy == "ALLOW_IF_L2_PASSED" and not l3_passed:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "output",
                    "gate": "L4:fallback",
                    "reason": f"L4 failed, L3 also failed: {e}",
                    "violations": ["l4_fallback:l3_failed"],
                }
            # ALLOW or ALLOW_IF_L2_PASSED with L3 passed -> don't block

            state["results"] = state.get("results", {})
            state["results"][step.id] = {
                "layer": "L4",
                "error": str(e),
                "fallback_policy": fallback_policy,
                "fallback_applied": True,
                "l3_passed": l3_passed,
            }

        return state

    def _handle_placeholder(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """Placeholder for unimplemented step types."""
        logger.info(f"Executing placeholder for step type {step.type.value}")
        # For now, just pass the input through
        return state

    # --- Helper Methods ---

    def _get_step_claw_config(self, step: FlowStep) -> Optional[Dict[str, bool]]:
        """
        Extract step-specific GuardianClaw gates configuration.

        Returns a dict of gates if the step has specific config,
        or None if the step should use the default/global config.

        Priority:
        1. If gateType is 'all', returns all gates enabled
        2. If gateType is specific (credibility, avoidance, limits, worth),
           returns only that gate enabled
        3. Returns None if no specific config (use global)
        """
        step_config = step.config or {}
        gate_type = step_config.get("gateType")

        if not gate_type:
            return None

        # Build gates dict based on gateType
        if gate_type == "all":
            return {
                "credibility": True,
                "avoidance": True,
                "limits": True,
                "worth": True,
            }
        elif gate_type in ("credibility", "avoidance", "limits", "worth"):
            # Only enable the specified gate
            return {
                "credibility": gate_type == "credibility",
                "avoidance": gate_type == "avoidance",
                "limits": gate_type == "limits",
                "worth": gate_type == "worth",
            }

        return None

    def _resolve_template(self, template: Union[str, Any], state: Dict[str, Any]) -> Any:
        """
        Resolve {{variable}} templates in strings.

        Supports:
            - {{current_input}} - Current input/data value
            - {{initial_input}} - Original user input
            - {{items}} - Items array
            - {{results.node_id.field}} - Node results
            - {{memory.buffer}} - Memory access
        """
        if not template or not isinstance(template, str):
            return template

        def replacer(match: re.Match) -> str:
            path = match.group(1).strip()
            parts = path.split(".")
            value: Any = state
            for part in parts:
                if isinstance(value, dict):
                    value = value.get(part)
                elif isinstance(value, list) and part.isdigit():
                    idx = int(part)
                    value = value[idx] if idx < len(value) else None
                else:
                    return match.group(0)  # Return original if path not found
                if value is None:
                    return ""
            return str(value) if value is not None else ""

        return re.sub(r"\{\{(.+?)\}\}", replacer, template)

    def _evaluate_condition(self, expression: str, state: Dict[str, Any]) -> bool:
        """
        Safely evaluate a condition expression.

        Supports simple comparisons:
            - "{{current_input}} == 'value'"
            - "len({{items}}) > 0"
            - "{{results.node_id.success}} == true"
        """
        # Resolve templates first
        resolved = self._resolve_template(expression, state)

        # Handle common boolean strings
        if resolved.lower() in ("true", "yes", "1"):
            return True
        if resolved.lower() in ("false", "no", "0", ""):
            return False

        # Try simple evaluation
        try:
            # Replace common patterns for safe eval
            safe_expr = resolved.replace("true", "True").replace("false", "False")
            # Only allow basic comparison operators
            if re.match(r'^[\w\s\.\[\]\'\"<>=!+-]+$', safe_expr):
                return bool(eval(safe_expr, {"__builtins__": {}}, {}))
        except Exception:
            pass

        # Default: truthy check
        return bool(resolved)

    # --- Utility Handlers (Phase 1) ---

    def _handle_utility_log(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Log data for debugging/auditing.

        Config options:
            - level: "debug" | "info" | "warning" | "error"
            - message: Log message template (supports {{variables}})
            - include_data: Include current_input in log (default False)
        """
        config = step.config
        level = config.get("level", "info")
        message = self._resolve_template(config.get("message", f"Step {step.id}"), state)
        include_data = config.get("include_data", False)

        # Get appropriate log function
        log_func = getattr(logger, level, logger.info)
        log_func(f"[{step.id}] {message}")

        # Store in execution log
        log_entry = {
            "step_id": step.id,
            "message": message,
            "level": level,
            "timestamp": time.time(),
        }
        if include_data:
            log_entry["data"] = state.get("current_input")

        state.setdefault("_execution_log", []).append(log_entry)
        state.setdefault("results", {})[step.id] = {"logged": True, "level": level}

        return state

    def _handle_utility_delay(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Wait for specified duration.

        Config options:
            - seconds: Wait duration (default 1, max 60)
            - random_jitter: Add random 0-N seconds (default 0)
        """
        import random

        config = step.config
        seconds = config.get("seconds", 1)
        jitter = config.get("random_jitter", 0)

        if jitter > 0:
            seconds += random.uniform(0, jitter)

        # Cap at 60 seconds for safety
        seconds = min(float(seconds), 60.0)

        logger.info(f"[{step.id}] Waiting {seconds:.2f} seconds")
        time.sleep(seconds)

        state.setdefault("results", {})[step.id] = {"waited": seconds}
        return state

    def _handle_transform(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Transform data using expressions or templates.

        Config options:
            - transform_type: "template" | "jq" | "map" | "filter"
            - expression: Transformation expression
        """
        config = step.config
        transform_type = config.get("transform_type", "template")
        expression = config.get("expression", "{{current_input}}")

        data = state.get("current_input")
        result = data

        try:
            if transform_type == "template":
                result = self._resolve_template(expression, state)

            elif transform_type == "jq":
                # JQ-like path extraction using jmespath
                try:
                    import jmespath
                    result = jmespath.search(expression, data)
                except ImportError:
                    logger.warning("jmespath not installed, falling back to template")
                    result = self._resolve_template(expression, state)

            elif transform_type == "map":
                # Map expression over items
                items = state.get("items", [data] if data else [])
                if isinstance(items, list):
                    result = []
                    for item in items:
                        item_state = {**state, "item": item, "current_input": item}
                        result.append(self._resolve_template(expression, item_state))
                else:
                    result = data

            elif transform_type == "filter":
                # Filter items by condition
                items = state.get("items", [data] if data else [])
                if isinstance(items, list):
                    result = []
                    for item in items:
                        item_state = {**state, "item": item, "current_input": item}
                        if self._evaluate_condition(expression, item_state):
                            result.append(item)
                else:
                    result = data

            state["current_input"] = result
            state.setdefault("results", {})[step.id] = {
                "transformed": True,
                "type": transform_type,
            }

        except Exception as e:
            logger.error(f"[{step.id}] Transform failed: {e}")
            state.setdefault("results", {})[step.id] = {
                "transformed": False,
                "error": str(e),
            }

        return state

    def _handle_condition(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Evaluate condition and set result.

        Config options:
            - expression: Condition to evaluate
            - true_value: Value if true (default True)
            - false_value: Value if false (default False)
        """
        config = step.config
        expression = config.get("expression", "true")
        true_value = config.get("true_value", True)
        false_value = config.get("false_value", False)

        result = self._evaluate_condition(expression, state)

        state["current_input"] = true_value if result else false_value
        state["_condition_result"] = result
        state.setdefault("results", {})[step.id] = {
            "evaluated": expression,
            "result": result,
        }

        logger.info(f"[{step.id}] Condition '{expression}' evaluated to {result}")
        return state

    # --- Tool Handlers (Phase 2) ---

    def _handle_tool_api_request(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Make HTTP request to external API.

        Config options:
            - method: GET | POST | PUT | DELETE | PATCH
            - url: Target URL (supports {{variables}})
            - headers: Dict of headers
            - body: Request body (for POST/PUT/PATCH)
            - timeout: Request timeout in seconds (default 30, max 120)
            - fail_on_error: Block flow on error (default True)
        """
        try:
            import httpx
        except ImportError:
            logger.error("httpx not installed, cannot make API requests")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": "httpx not installed",
            }
            return state

        config = step.config
        method = config.get("method", "GET").upper()
        url = self._resolve_template(config.get("url", ""), state)
        headers = config.get("headers", {})
        body = config.get("body")
        timeout = min(config.get("timeout", 30), 120)
        fail_on_error = config.get("fail_on_error", True)

        # Resolve templates in body if string
        if isinstance(body, str):
            body = self._resolve_template(body, state)

        logger.info(f"[{step.id}] {method} {url}")

        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=body if isinstance(body, dict) else None,
                    content=body if isinstance(body, str) else None,
                )

            # Parse response
            try:
                data = response.json()
            except Exception:
                data = response.text

            state["current_input"] = data
            state.setdefault("results", {})[step.id] = {
                "success": response.status_code < 400,
                "status_code": response.status_code,
                "headers": dict(response.headers),
            }

            # Check for error status codes
            if response.status_code >= 400 and fail_on_error:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "api_error",
                    "reason": f"API returned {response.status_code}",
                    "violations": [f"http_error:{response.status_code}"],
                }

        except httpx.TimeoutException:
            logger.error(f"[{step.id}] Request timeout")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": "timeout",
            }
            if fail_on_error:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "timeout",
                    "reason": "API request timed out",
                    "violations": ["timeout"],
                }

        except Exception as e:
            logger.error(f"[{step.id}] Request failed: {e}")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": str(e),
            }
            if fail_on_error:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "error",
                    "reason": str(e),
                    "violations": ["api_error"],
                }

        return state

    def _handle_tool_web_search(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Execute web search and return results.

        Config options:
            - query: Search query (supports {{variables}}, default: current_input)
            - max_results: Number of results (default 5, max 20)
            - fail_on_error: Block flow on error (default False)
        """
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            logger.error("duckduckgo-search not installed")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": "duckduckgo-search not installed",
            }
            return state

        config = step.config
        query = self._resolve_template(
            config.get("query", "{{current_input}}"), state
        )
        max_results = min(config.get("max_results", 5), 20)
        fail_on_error = config.get("fail_on_error", False)

        logger.info(f"[{step.id}] Searching: {query}")

        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))

            # Transform to items format
            state["items"] = results
            state["current_input"] = results
            state.setdefault("results", {})[step.id] = {
                "success": True,
                "count": len(results),
                "query": query,
            }

            logger.info(f"[{step.id}] Found {len(results)} results")

        except Exception as e:
            logger.error(f"[{step.id}] Search failed: {e}")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": str(e),
            }
            if fail_on_error:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "error",
                    "reason": f"Web search failed: {e}",
                    "violations": ["search_error"],
                }

        return state

    def _handle_tool_database(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Execute SQL query.

        Config options:
            - connection_string: Database URL
            - query: SQL query (supports {{variables}})
            - params: Query parameters dict
            - operation: "select" | "insert" | "update" | "delete" | "execute"
            - fail_on_error: Block flow on error (default True)
        """
        try:
            from sqlalchemy import create_engine, text
        except ImportError:
            logger.error("sqlalchemy not installed")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": "sqlalchemy not installed",
            }
            return state

        config = step.config
        conn_string = config.get("connection_string", "")
        query = self._resolve_template(config.get("query", ""), state)
        params = config.get("params", {})
        operation = config.get("operation", "select")
        fail_on_error = config.get("fail_on_error", True)

        if not conn_string or not query:
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": "Missing connection_string or query",
            }
            return state

        # Security: Validate query for select operations
        if operation == "select":
            query_lower = query.lower().strip()
            if not query_lower.startswith("select"):
                logger.error(f"[{step.id}] Query must start with SELECT for select operation")
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "sql_injection",
                    "reason": "Query must start with SELECT for select operation",
                    "violations": ["sql_injection_attempt"],
                }
                return state

        logger.info(f"[{step.id}] Executing {operation} query")

        try:
            engine = create_engine(conn_string, pool_pre_ping=True)

            with engine.connect() as conn:
                result = conn.execute(text(query), params)

                if operation == "select":
                    rows = [dict(row._mapping) for row in result]
                    state["items"] = rows
                    state["current_input"] = rows
                    state.setdefault("results", {})[step.id] = {
                        "success": True,
                        "row_count": len(rows),
                    }
                else:
                    conn.commit()
                    state["current_input"] = {"affected_rows": result.rowcount}
                    state.setdefault("results", {})[step.id] = {
                        "success": True,
                        "affected_rows": result.rowcount,
                    }

        except Exception as e:
            logger.error(f"[{step.id}] Database error: {e}")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": str(e),
            }
            if fail_on_error:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "database_error",
                    "reason": str(e),
                    "violations": ["database_error"],
                }

        return state

    def _handle_tool_code_exec(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Execute Python code in a sandboxed environment.

        Config options:
            - code: Python code to execute
            - timeout: Execution timeout in seconds (default 5, max 30)
            - fail_on_error: Block flow on error (default True)

        Available in sandbox:
            - input_data: Current input value
            - items: Items array
            - result: Set this to return a value
        """
        try:
            from RestrictedPython import compile_restricted
            from RestrictedPython.Guards import (
                safe_builtins,
                guarded_iter_unpack_sequence,
            )
        except ImportError:
            logger.error("RestrictedPython not installed")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": "RestrictedPython not installed",
            }
            return state

        config = step.config
        code = config.get("code", "result = input_data")
        timeout = min(config.get("timeout", 5), 30)
        fail_on_error = config.get("fail_on_error", True)

        logger.info(f"[{step.id}] Executing code (timeout: {timeout}s)")

        # Build safe execution environment
        restricted_globals = {
            "__builtins__": safe_builtins,
            "_getiter_": iter,
            "_iter_unpack_sequence_": guarded_iter_unpack_sequence,
        }

        # Inject state data
        local_vars = {
            "input_data": state.get("current_input"),
            "items": state.get("items", []),
            "result": None,
        }

        try:
            # Compile with restrictions
            byte_code = compile_restricted(code, "<user_code>", "exec")

            if byte_code.errors:
                raise SyntaxError(f"Compilation errors: {byte_code.errors}")

            # Execute (note: proper timeout requires threading on Windows)
            exec(byte_code.code, restricted_globals, local_vars)

            # Get result
            result = local_vars.get("result")
            if result is not None:
                state["current_input"] = result

            state.setdefault("results", {})[step.id] = {
                "success": True,
                "has_result": result is not None,
            }

        except Exception as e:
            logger.error(f"[{step.id}] Code execution failed: {e}")
            state.setdefault("results", {})[step.id] = {
                "success": False,
                "error": str(e),
            }
            if fail_on_error:
                state["blocked"] = True
                state["block_info"] = {
                    "stage": "tool",
                    "gate": "code_error",
                    "reason": str(e),
                    "violations": ["code_execution_error"],
                }

        return state

    # --- Memory Handlers (Phase 3) ---

    def _handle_memory_buffer(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Store/retrieve conversation history.

        Config options:
            - operation: "add" | "get" | "clear"
            - buffer_size: Max messages to keep (default 10)
        """
        config = step.config
        operation = config.get("operation", "get")
        buffer_size = config.get("buffer_size", 10)

        # Initialize memory buffer if not exists
        state.setdefault("memory", {}).setdefault("buffer", [])
        buffer = state["memory"]["buffer"]

        if operation == "add":
            # Add current exchange to buffer
            entry = {
                "human": state.get("initial_input"),
                "ai": state.get("current_input"),
                "timestamp": time.time(),
            }
            buffer.append(entry)

            # Trim to buffer size
            if len(buffer) > buffer_size:
                state["memory"]["buffer"] = buffer[-buffer_size:]

            logger.info(f"[{step.id}] Added to buffer (size: {len(state['memory']['buffer'])})")

        elif operation == "get":
            # Format buffer for LLM context
            formatted = []
            for entry in buffer:
                formatted.append(f"Human: {entry.get('human', '')}")
                formatted.append(f"Assistant: {entry.get('ai', '')}")

            state["_memory_context"] = "\n".join(formatted)
            state["current_input"] = buffer
            logger.info(f"[{step.id}] Retrieved buffer (size: {len(buffer)})")

        elif operation == "clear":
            state["memory"]["buffer"] = []
            logger.info(f"[{step.id}] Cleared buffer")

        state.setdefault("results", {})[step.id] = {
            "operation": operation,
            "buffer_size": len(state["memory"]["buffer"]),
        }
        return state

    def _handle_memory_summary(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Summarize conversation history using LLM.

        Config options:
            - source: "buffer" | "current"
            - max_tokens: Max tokens for summary (default 500)
        """
        config = step.config
        source = config.get("source", "buffer")
        max_tokens = config.get("max_tokens", 500)

        # Get content to summarize
        if source == "buffer":
            buffer = state.get("memory", {}).get("buffer", [])
            content = "\n".join([
                f"Human: {e.get('human', '')}\nAssistant: {e.get('ai', '')}"
                for e in buffer
            ])
        else:
            content = str(state.get("current_input", ""))

        if not content:
            state.setdefault("results", {})[step.id] = {
                "summarized": False,
                "reason": "no_content",
            }
            return state

        logger.info(f"[{step.id}] Summarizing {len(content)} chars")

        try:
            # Use LLM to summarize
            messages = [
                SystemMessage(content="Summarize the following conversation concisely, preserving key information."),
                HumanMessage(content=content),
            ]

            # Temporarily adjust max_tokens
            original_max_tokens = getattr(self._llm, 'max_tokens', None)
            if hasattr(self._llm, 'max_tokens'):
                self._llm.max_tokens = max_tokens

            summary = self._llm.invoke(messages).content

            # Restore
            if original_max_tokens is not None:
                self._llm.max_tokens = original_max_tokens

            # Store summary
            state.setdefault("memory", {})["summary"] = summary
            state["current_input"] = summary
            state.setdefault("results", {})[step.id] = {
                "summarized": True,
                "length": len(summary),
            }

        except Exception as e:
            logger.error(f"[{step.id}] Summary failed: {e}")
            state.setdefault("results", {})[step.id] = {
                "summarized": False,
                "error": str(e),
            }

        return state

    def _handle_memory_vector(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Semantic search with embeddings (in-memory store).

        Config options:
            - operation: "store" | "search" | "clear"
            - namespace: Collection namespace (default "default")
            - top_k: Number of results for search (default 5)
        """
        config = step.config
        operation = config.get("operation", "search")
        namespace = config.get("namespace", "default")
        top_k = config.get("top_k", 5)

        # Initialize vector store
        state.setdefault("memory", {}).setdefault("vector_store", {})
        store = state["memory"]["vector_store"]

        if operation == "store":
            content = str(state.get("current_input", ""))
            if not content:
                state.setdefault("results", {})[step.id] = {
                    "stored": False,
                    "reason": "no_content",
                }
                return state

            try:
                embedding = self._generate_embedding(content)
                doc_id = f"{namespace}_{len(store)}_{int(time.time())}"
                store[doc_id] = {
                    "content": content,
                    "embedding": embedding,
                    "namespace": namespace,
                    "timestamp": time.time(),
                }
                state.setdefault("results", {})[step.id] = {
                    "stored": True,
                    "doc_id": doc_id,
                }
                logger.info(f"[{step.id}] Stored document {doc_id}")

            except Exception as e:
                logger.error(f"[{step.id}] Store failed: {e}")
                state.setdefault("results", {})[step.id] = {
                    "stored": False,
                    "error": str(e),
                }

        elif operation == "search":
            query = str(state.get("current_input", ""))
            if not query:
                state.setdefault("results", {})[step.id] = {
                    "found": 0,
                    "reason": "no_query",
                }
                return state

            try:
                query_embedding = self._generate_embedding(query)

                # Calculate similarities
                results = []
                for doc_id, doc in store.items():
                    if doc.get("namespace") == namespace:
                        similarity = self._cosine_similarity(
                            query_embedding, doc["embedding"]
                        )
                        results.append({
                            "id": doc_id,
                            "content": doc["content"],
                            "score": similarity,
                        })

                # Sort by similarity
                results.sort(key=lambda x: x["score"], reverse=True)
                results = results[:top_k]

                state["items"] = results
                state["current_input"] = [r["content"] for r in results]
                state.setdefault("results", {})[step.id] = {
                    "found": len(results),
                }
                logger.info(f"[{step.id}] Found {len(results)} results")

            except Exception as e:
                logger.error(f"[{step.id}] Search failed: {e}")
                state.setdefault("results", {})[step.id] = {
                    "found": 0,
                    "error": str(e),
                }

        elif operation == "clear":
            # Clear namespace
            to_delete = [k for k, v in store.items() if v.get("namespace") == namespace]
            for k in to_delete:
                del store[k]
            state.setdefault("results", {})[step.id] = {
                "cleared": len(to_delete),
            }
            logger.info(f"[{step.id}] Cleared {len(to_delete)} documents")

        return state

    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using OpenAI."""
        try:
            from openai import OpenAI
            client = OpenAI()
            response = client.embeddings.create(
                input=text,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            logger.warning(f"Embedding generation failed: {e}, using hash fallback")
            # Fallback: simple hash-based "embedding"
            import hashlib
            h = hashlib.sha256(text.encode()).hexdigest()
            return [int(h[i:i+2], 16) / 255.0 for i in range(0, 64, 2)]

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        try:
            import numpy as np
            a_arr = np.array(a)
            b_arr = np.array(b)
            return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))
        except ImportError:
            # Fallback without numpy
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = sum(x * x for x in a) ** 0.5
            norm_b = sum(x * x for x in b) ** 0.5
            return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    # --- Flow Control Handlers (Phase 4) ---

    def _handle_flow_router(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Conditional branching based on expression evaluation.

        Config options:
            - conditions: List of {expression, target_node_id}
            - default_target: Fallback target node
        """
        config = step.config
        conditions = config.get("conditions", [])
        default_target = config.get("default_target")

        # Evaluate conditions in order
        for condition in conditions:
            expression = condition.get("expression", "")
            target = condition.get("target_node_id")

            if self._evaluate_condition(expression, state):
                state["_next_node"] = target
                state["_active_branch"] = target
                state.setdefault("results", {})[step.id] = {
                    "matched": expression,
                    "target": target,
                }
                logger.info(f"[{step.id}] Routing to {target} (matched: {expression})")
                return state

        # Default branch
        if default_target:
            state["_next_node"] = default_target
            state["_active_branch"] = default_target

        state.setdefault("results", {})[step.id] = {
            "matched": "default",
            "target": default_target,
        }
        logger.info(f"[{step.id}] Routing to default: {default_target}")
        return state

    def _handle_flow_merge(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Merge point for branches.

        Config options:
            - merge_strategy: "first" | "all" (default "first")
        """
        config = step.config
        strategy = config.get("merge_strategy", "first")

        # Clear branch context
        state.pop("_active_branch", None)

        state.setdefault("results", {})[step.id] = {
            "merged": True,
            "strategy": strategy,
        }
        logger.info(f"[{step.id}] Merge point reached")
        return state

    def _handle_flow_loop(self, state: Dict[str, Any], step: FlowStep) -> Dict[str, Any]:
        """
        Iterate over items.

        Config options:
            - loop_over: "items" | "range"
            - range_start, range_end: For range loops
            - max_iterations: Safety limit (default 100)
        """
        config = step.config
        loop_over = config.get("loop_over", "items")
        max_iterations = config.get("max_iterations", 100)

        # Initialize loop context if not exists
        if "_loop_context" not in state or state["_loop_context"].get("loop_id") != step.id:
            # New loop
            if loop_over == "items":
                items = state.get("items", [])
                if not isinstance(items, list):
                    items = [items] if items else []
            elif loop_over == "range":
                start = config.get("range_start", 0)
                end = config.get("range_end", 10)
                items = list(range(start, end))
            else:
                items = []

            state["_loop_context"] = {
                "loop_id": step.id,
                "iteration": 0,
                "items": items,
                "results": [],
            }
            logger.info(f"[{step.id}] Starting loop with {len(items)} items")

        ctx = state["_loop_context"]

        # Safety check
        if ctx["iteration"] >= max_iterations:
            logger.warning(f"[{step.id}] Hit max iterations ({max_iterations})")
            state.pop("_loop_context")
            state.setdefault("results", {})[step.id] = {
                "completed": True,
                "iterations": ctx["iteration"],
                "reason": "max_iterations",
            }
            return state

        # Check if done
        if ctx["iteration"] >= len(ctx["items"]):
            # Loop complete
            state["items"] = ctx["results"]
            state["current_input"] = ctx["results"]
            state.pop("_loop_context")
            state.setdefault("results", {})[step.id] = {
                "completed": True,
                "iterations": len(ctx["results"]),
            }
            logger.info(f"[{step.id}] Loop completed ({len(ctx['results'])} iterations)")
            return state

        # Process current item
        current_item = ctx["items"][ctx["iteration"]]
        state["current_input"] = current_item
        state["_loop_item"] = current_item
        state["_loop_index"] = ctx["iteration"]

        # Store result from previous iteration (if any)
        if ctx["iteration"] > 0:
            ctx["results"].append(state.get("_loop_result"))

        ctx["iteration"] += 1

        state.setdefault("results", {})[step.id] = {
            "completed": False,
            "iteration": ctx["iteration"],
            "total": len(ctx["items"]),
        }
        return state

    def _get_flow_stats(self) -> Dict[str, Any]:
        """Get flow execution statistics."""
        return {
            "total_executions": self._execution_count,
            "avg_latency_ms": (
                self._total_latency_ms / self._execution_count
                if self._execution_count > 0
                else 0
            ),
            "flow_info": {
                "node_count": len(self._raw_flow.get("nodes", [])),
                "edge_count": len(self._raw_flow.get("edges", [])),
                "has_claw": self._parsed_flow.has_claw_input or self._parsed_flow.has_claw_output,
                "has_llm": self._parsed_flow.has_llm,
                "auto_protected": self._should_auto_protect(),
            },
        }

    @property
    def parsed_flow(self) -> ParsedFlow:
        """Get the parsed flow."""
        return self._parsed_flow

    @property
    def claw(self) -> GuardianClawAdapter:
        """Get the GuardianClaw adapter."""
        return self._claw

    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive execution statistics."""
        return {
            "executor": self._get_flow_stats(),
            "claw": self._claw.get_stats(),
            "config": {
                "llm": {
                    "provider": self._effective_llm_config.get("provider", "openai"),
                    "model": self._effective_llm_config.get("model", "gpt-4o-mini"),
                },
                "claw": self._claw.get_config(),
            },
        }
