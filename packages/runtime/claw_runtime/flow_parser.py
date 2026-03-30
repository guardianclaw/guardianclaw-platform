"""
Flow Parser - Converts visual builder flow to executable steps.

This module parses the React Flow graph from the visual builder
into a linear sequence of execution steps.

The parser handles:
- Topological sorting of nodes
- Node type classification
- Configuration extraction
- GuardianClaw node identification
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Any, Set

from claw_runtime.interfaces import FlowDict, FlowNodeDict, FlowEdgeDict

logger = logging.getLogger("claw_runtime.flow_parser")


class NodeCategory(str, Enum):
    """Node categories from the visual builder."""

    INPUT = "input"
    PROCESS = "process"
    FLOW = "flow"
    MEMORY = "memory"
    CLAW = "claw"
    TOOL = "tool"
    UTILITY = "utility"
    OUTPUT = "output"
    UNKNOWN = "unknown"


class StepType(str, Enum):
    """Execution step types."""

    RECEIVE_INPUT = "receive_input"
    CLAW_VALIDATE_INPUT = "claw_validate_input"
    LLM_CALL = "llm_call"
    TRANSFORM = "transform"
    CONDITION = "condition"
    CLAW_VALIDATE_OUTPUT = "claw_validate_output"
    TOOL_WEB_SEARCH = "tool_web_search"
    TOOL_CODE_EXEC = "tool_code_exec"
    TOOL_API_REQUEST = "tool_api_request"
    TOOL_DATABASE = "tool_database"
    SEND_OUTPUT = "send_output"
    FLOW_ROUTER = "flow_router"
    FLOW_MERGE = "flow_merge"
    FLOW_LOOP = "flow_loop"
    MEMORY_BUFFER = "memory_buffer"
    MEMORY_VECTOR = "memory_vector"
    MEMORY_SUMMARY = "memory_summary"
    UTILITY_DELAY = "utility_delay"
    UTILITY_LOG = "utility_log"
    # v2.25 Layer types
    CLAW_L1_INPUT = "claw_l1_input"
    CLAW_L2_SEED = "claw_l2_seed"
    CLAW_L3_OUTPUT = "claw_l3_output"
    CLAW_L4_OBSERVER = "claw_l4_observer"


@dataclass
class FlowStep:
    """A single execution step in the parsed flow."""

    id: str
    """Unique step identifier (from node ID)."""

    type: StepType
    """Type of execution step."""

    category: NodeCategory
    """Node category from visual builder."""

    config: Dict[str, Any] = field(default_factory=dict)
    """Step-specific configuration."""

    label: str = ""
    """Human-readable label."""

    position: int = 0
    """Execution order position."""


@dataclass
class ParsedFlow:
    """Result of parsing a visual flow."""

    steps: List[FlowStep]
    """Ordered list of execution steps."""

    has_claw_input: bool = False
    """Whether flow has input validation."""

    has_claw_output: bool = False
    """Whether flow has output validation."""

    has_llm: bool = False
    """Whether flow has LLM processing."""

    claw_config: Dict[str, Any] = field(default_factory=dict)
    """Aggregated GuardianClaw configuration from nodes."""

    llm_config: Dict[str, Any] = field(default_factory=dict)
    """LLM configuration from process nodes."""

    input_step: Optional[FlowStep] = None
    """The input step (entry point)."""

    output_step: Optional[FlowStep] = None
    """The output step (exit point)."""

    # v2.25 Layer configurations
    l1_config: Optional[Dict[str, Any]] = None
    """L1 InputValidator configuration (v2.25)."""

    l2_config: Optional[Dict[str, Any]] = None
    """L2 Seed Injection configuration (v2.25)."""

    l3_config: Optional[Dict[str, Any]] = None
    """L3 OutputValidator configuration (v2.25)."""

    l4_config: Optional[Dict[str, Any]] = None
    """L4 ClawObserver configuration (v2.25)."""

    is_v25_architecture: bool = False
    """True if flow uses v2.25 layer architecture."""

    warnings: List[str] = field(default_factory=list)
    """Warnings generated during parsing (cycles, disconnected nodes, etc.)."""


class FlowParser:
    """
    Parses visual builder flows into executable step sequences.

    The parser performs:
    1. Node categorization by type
    2. Topological sort based on edges
    3. Configuration extraction
    4. GuardianClaw node detection

    Example:
        parser = FlowParser()
        parsed = parser.parse({
            "nodes": [...],
            "edges": [...]
        })

        for step in parsed.steps:
            print(f"{step.position}: {step.type.value}")
    """

    def __init__(self):
        """Initialize the flow parser."""
        self._step_type_map = {
            # Input nodes
            ("input", "user_message"): StepType.RECEIVE_INPUT,
            ("input", "api_call"): StepType.RECEIVE_INPUT,
            ("input", "webhook"): StepType.RECEIVE_INPUT,
            # Process nodes
            ("process", "llm_call"): StepType.LLM_CALL,
            ("process", "transform"): StepType.TRANSFORM,
            ("process", "condition"): StepType.CONDITION,
            # Flow nodes
            ("flow", "router"): StepType.FLOW_ROUTER,
            ("flow", "merge"): StepType.FLOW_MERGE,
            ("flow", "loop"): StepType.FLOW_LOOP,
            # Memory nodes
            ("memory", "buffer"): StepType.MEMORY_BUFFER,
            ("memory", "vector"): StepType.MEMORY_VECTOR,
            ("memory", "summary"): StepType.MEMORY_SUMMARY,
            # GuardianClaw nodes - Legacy v2.18 gates
            # NOTE: Type is determined by position, not gate type
            ("claw", "credibility"): StepType.CLAW_VALIDATE_INPUT,
            ("claw", "avoidance"): StepType.CLAW_VALIDATE_INPUT,
            ("claw", "limits"): StepType.CLAW_VALIDATE_INPUT,
            ("claw", "worth"): StepType.CLAW_VALIDATE_INPUT,
            ("claw", "all"): StepType.CLAW_VALIDATE_INPUT,
            # GuardianClaw nodes - v2.25 Layer architecture
            ("claw", "input_validator"): StepType.CLAW_L1_INPUT,
            ("claw", "seed_injection"): StepType.CLAW_L2_SEED,
            ("claw", "output_validator"): StepType.CLAW_L3_OUTPUT,
            ("claw", "observer"): StepType.CLAW_L4_OBSERVER,
            # Tool nodes
            ("tool", "web_search"): StepType.TOOL_WEB_SEARCH,
            ("tool", "code_exec"): StepType.TOOL_CODE_EXEC,
            ("tool", "api_request"): StepType.TOOL_API_REQUEST,
            ("tool", "database"): StepType.TOOL_DATABASE,
            # Utility nodes
            ("utility", "delay"): StepType.UTILITY_DELAY,
            ("utility", "log"): StepType.UTILITY_LOG,
            # Output nodes
            ("output", "response"): StepType.SEND_OUTPUT,
            ("output", "webhook"): StepType.SEND_OUTPUT,
            ("output", "store"): StepType.SEND_OUTPUT,
            # Social output types
            ("output", "twitter_post"): StepType.SEND_OUTPUT,
            ("output", "discord_message"): StepType.SEND_OUTPUT,
            ("output", "telegram_message"): StepType.SEND_OUTPUT,
        }

    def parse(self, flow: FlowDict) -> ParsedFlow:
        """
        Parse a visual flow into executable steps.

        Args:
            flow: Flow definition from visual builder

        Returns:
            ParsedFlow with ordered execution steps
        """
        nodes = flow.get("nodes", [])
        edges = flow.get("edges", [])

        if not nodes:
            logger.warning("Empty flow - no nodes to parse")
            return ParsedFlow(steps=[])

        # Build adjacency map
        adjacency = self._build_adjacency_map(edges)

        # Categorize nodes
        categorized = self._categorize_nodes(nodes)

        # Topological sort
        sorted_node_ids, parse_warnings = self._topological_sort(nodes, adjacency)

        # Convert to steps
        steps: List[FlowStep] = []
        claw_config: Dict[str, Any] = {"gates": {}}
        llm_config: Dict[str, Any] = {}

        # v2.25 Layer configurations
        l1_config: Optional[Dict[str, Any]] = None
        l2_config: Optional[Dict[str, Any]] = None
        l3_config: Optional[Dict[str, Any]] = None
        l4_config: Optional[Dict[str, Any]] = None
        is_v25_architecture = False

        for position, node_id in enumerate(sorted_node_ids):
            node = categorized.get(node_id)
            if not node:
                continue

            step = self._node_to_step(node, position)
            steps.append(step)

            # Aggregate configurations
            if step.category == NodeCategory.CLAW:
                # Check if this is a v2.25 layer node
                node_data = node.get("data", {})
                if "layerType" in node_data:
                    is_v25_architecture = True
                    layer_type = node_data["layerType"]

                    if layer_type == "input_validator" and "l1Config" in node_data:
                        l1_config = dict(node_data["l1Config"])
                    elif layer_type == "seed_injection" and "l2Config" in node_data:
                        l2_config = dict(node_data["l2Config"])
                    elif layer_type == "output_validator" and "l3Config" in node_data:
                        l3_config = dict(node_data["l3Config"])
                    elif layer_type == "observer" and "l4Config" in node_data:
                        l4_config = dict(node_data["l4Config"])

                # Also extract legacy config for backward compatibility
                self._extract_claw_config(step, claw_config)
            elif step.category == NodeCategory.PROCESS and step.type == StepType.LLM_CALL:
                self._extract_llm_config(step, llm_config)

        # Determine GuardianClaw node types based on position relative to LLM
        # Only for legacy gates, not v2.25 layers (which have explicit types)
        self._determine_claw_types(steps)

        # Find input/output steps
        input_step = next((s for s in steps if s.category == NodeCategory.INPUT), None)
        output_step = next((s for s in reversed(steps) if s.category == NodeCategory.OUTPUT), None)

        # Check for GuardianClaw nodes (after type determination)
        # Include both legacy and v2.25 input validation step types
        has_claw_input = any(
            s.type in (StepType.CLAW_VALIDATE_INPUT, StepType.CLAW_L1_INPUT)
            for s in steps
        )
        # Include both legacy and v2.25 output validation step types
        has_claw_output = any(
            s.type in (StepType.CLAW_VALIDATE_OUTPUT, StepType.CLAW_L3_OUTPUT)
            for s in steps
        )
        has_llm = any(s.type == StepType.LLM_CALL for s in steps)

        # M5: Warn if multiple INPUT nodes exist
        input_count = sum(1 for s in steps if s.category == NodeCategory.INPUT)
        if input_count > 1:
            parse_warnings.append(
                f"Multiple input nodes detected ({input_count}). "
                "Only the first will receive user input at runtime."
            )
            logger.warning(f"Flow has {input_count} input nodes — only first is used")

        return ParsedFlow(
            steps=steps,
            has_claw_input=has_claw_input,
            has_claw_output=has_claw_output,
            has_llm=has_llm,
            claw_config=claw_config,
            llm_config=llm_config,
            input_step=input_step,
            output_step=output_step,
            l1_config=l1_config,
            l2_config=l2_config,
            l3_config=l3_config,
            l4_config=l4_config,
            is_v25_architecture=is_v25_architecture,
            warnings=parse_warnings,
        )

    def _build_adjacency_map(
        self,
        edges: List[FlowEdgeDict],
    ) -> Dict[str, Set[str]]:
        """Build adjacency map from edges (source -> targets)."""
        adjacency: Dict[str, Set[str]] = {}

        for edge in edges:
            source = edge.get("source", "")
            target = edge.get("target", "")

            if source and target:
                if source not in adjacency:
                    adjacency[source] = set()
                adjacency[source].add(target)

        return adjacency

    def _categorize_nodes(
        self,
        nodes: List[FlowNodeDict],
    ) -> Dict[str, FlowNodeDict]:
        """Create node lookup by ID."""
        return {node["id"]: node for node in nodes}

    def _get_node_category(self, node_type: str) -> NodeCategory:
        """Determine node category from type string."""
        node_type_lower = node_type.lower()

        if "input" in node_type_lower:
            return NodeCategory.INPUT
        elif "process" in node_type_lower:
            return NodeCategory.PROCESS
        elif "flow" in node_type_lower:
            return NodeCategory.FLOW
        elif "memory" in node_type_lower:
            return NodeCategory.MEMORY
        elif "claw" in node_type_lower:
            return NodeCategory.CLAW
        elif "tool" in node_type_lower:
            return NodeCategory.TOOL
        elif "utility" in node_type_lower:
            return NodeCategory.UTILITY
        elif "output" in node_type_lower:
            return NodeCategory.OUTPUT
        else:
            return NodeCategory.UNKNOWN

    def _get_subtype(self, node: FlowNodeDict) -> str:
        """Extract subtype from node data."""
        data = node.get("data", {})

        # v2.25: Check layerType first (takes priority over gateType)
        if "layerType" in data:
            return data["layerType"]

        # Check type-specific fields
        for field in [
            "inputType",
            "processType",
            "flowType",
            "memoryType",
            "gateType",
            "toolType",
            "utilityType",
            "outputType",
        ]:
            value = data.get(field)
            if value:
                return value

        # Fallback to data.subtype for drag-and-drop
        if "subtype" in data:
            return data["subtype"]

        return ""

    def _topological_sort(
        self,
        nodes: List[FlowNodeDict],
        adjacency: Dict[str, Set[str]],
    ) -> tuple:
        """
        Topological sort of nodes based on edges.

        Uses Kahn's algorithm with fallback to category-based ordering.
        Returns (sorted_ids, warnings) where warnings contains cycle
        and disconnected node info.
        """
        node_ids = [n["id"] for n in nodes]
        node_map = {n["id"]: n for n in nodes}
        warnings: List[str] = []

        # Build the set of all nodes that participate in at least one edge
        # (either as source or target). Nodes outside this set are disconnected.
        connected_nodes: Set[str] = set()
        for source, targets in adjacency.items():
            if targets:  # source has outgoing edges
                connected_nodes.add(source)
                connected_nodes.update(targets)

        # Detect disconnected nodes upfront (before Kahn's)
        for nid in node_ids:
            if nid not in connected_nodes:
                warnings.append(f"Disconnected node: '{nid}' has no connections")
                logger.warning(f"Disconnected node: '{nid}'")

        # Calculate in-degrees
        in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}
        for targets in adjacency.values():
            for target in targets:
                if target in in_degree:
                    in_degree[target] += 1

        # Start with nodes that have no incoming edges
        queue = [nid for nid in node_ids if in_degree[nid] == 0]

        # Sort queue by category priority (inputs first)
        category_priority = {
            NodeCategory.INPUT: 0,
            NodeCategory.CLAW: 1,
            NodeCategory.PROCESS: 2,
            NodeCategory.FLOW: 3,
            NodeCategory.MEMORY: 4,
            NodeCategory.TOOL: 5,
            NodeCategory.UTILITY: 6,
            NodeCategory.OUTPUT: 7,
            NodeCategory.UNKNOWN: 8,
        }

        def get_priority(node_id: str) -> int:
            node = node_map.get(node_id, {})
            node_type = node.get("type", "")
            category = self._get_node_category(node_type)
            return category_priority.get(category, 9)

        queue.sort(key=get_priority)

        sorted_nodes: List[str] = []

        while queue:
            current = queue.pop(0)
            sorted_nodes.append(current)

            for neighbor in adjacency.get(current, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    inserted = False
                    neighbor_priority = get_priority(neighbor)
                    for i, q_node in enumerate(queue):
                        if get_priority(q_node) > neighbor_priority:
                            queue.insert(i, neighbor)
                            inserted = True
                            break
                    if not inserted:
                        queue.append(neighbor)

        # Nodes left after Kahn's have in_degree > 0 — they're in cycles
        remaining = [nid for nid in node_ids if nid not in sorted_nodes]
        for nid in remaining:
            warnings.append(f"Cycle detected: node '{nid}' is part of a dependency cycle")
            logger.warning(f"Cycle detected involving node '{nid}'")

        # Append remaining to sorted (linear fallback, don't crash)
        remaining.sort(key=get_priority)
        sorted_nodes.extend(remaining)

        return sorted_nodes, warnings

    def _node_to_step(self, node: FlowNodeDict, position: int) -> FlowStep:
        """Convert a node to an execution step."""
        node_type = node.get("type", "")
        category = self._get_node_category(node_type)
        subtype = self._get_subtype(node)
        data = node.get("data", {})

        # Determine step type
        lookup_key = (category.value, subtype)
        step_type = self._step_type_map.get(lookup_key)

        if step_type is None:
            fallback = StepType.RECEIVE_INPUT if category == NodeCategory.INPUT else StepType.SEND_OUTPUT
            if subtype:
                logger.warning(
                    "Unknown subtype '%s' for category '%s' on node '%s' — falling back to %s",
                    subtype, category.value, node.get("id", "?"), fallback.value,
                )
            step_type = fallback

        # Extract config from data
        config = dict(data.get("config", {}))

        # Include type-specific data in config
        for key in [
            "inputType",
            "processType",
            "flowType",
            "memoryType",
            "gateType",
            "toolType",
            "utilityType",
            "outputType",
            "subtype",
        ]:
            if key in data:
                config[key] = data[key]

        return FlowStep(
            id=node["id"],
            type=step_type,
            category=category,
            config=config,
            label=data.get("label", node_type),
            position=position,
        )

    def _extract_claw_config(
        self,
        step: FlowStep,
        claw_config: Dict[str, Any],
    ) -> None:
        """Extract GuardianClaw configuration from a claw step."""
        gate_type = step.config.get("gateType", "all")
        gates = claw_config.setdefault("gates", {})

        if gate_type == "all":
            gates["credibility"] = True
            gates["avoidance"] = True
            gates["limits"] = True
            gates["worth"] = True
        elif gate_type in ("credibility", "avoidance", "limits", "worth"):
            gates[gate_type] = True

        # Extract strict mode
        if step.config.get("strictMode"):
            claw_config["fail_closed"] = True

        # Extract protection level
        if "protectionLevel" in step.config:
            claw_config["protection_level"] = step.config["protectionLevel"]

    def _extract_llm_config(
        self,
        step: FlowStep,
        llm_config: Dict[str, Any],
    ) -> None:
        """Extract LLM configuration from a process step."""
        config = step.config

        if "provider" in config:
            llm_config["provider"] = config["provider"]
        if "model" in config:
            llm_config["model"] = config["model"]
        if "temperature" in config:
            llm_config["temperature"] = config["temperature"]
        if "maxTokens" in config:
            llm_config["max_tokens"] = config["maxTokens"]
        if "systemPrompt" in config:
            llm_config["system_prompt"] = config["systemPrompt"]

    def _determine_claw_types(self, steps: List[FlowStep]) -> None:
        """
        Determine whether GuardianClaw nodes validate input or output.

        The type is determined by position relative to the LLM node(s):
        - GuardianClaw nodes BEFORE the first LLM = VALIDATE_INPUT
        - GuardianClaw nodes AFTER the last LLM = VALIDATE_OUTPUT
        - GuardianClaw nodes between LLMs = VALIDATE_OUTPUT (safer default)

        If no LLM exists:
        - GuardianClaw nodes in first half = VALIDATE_INPUT
        - GuardianClaw nodes in second half = VALIDATE_OUTPUT

        Users can override this by setting validationStage in the node config:
        - config.validationStage = "input" -> VALIDATE_INPUT
        - config.validationStage = "output" -> VALIDATE_OUTPUT
        """
        if not steps:
            return

        # Find LLM positions
        llm_positions = [
            i for i, step in enumerate(steps)
            if step.type == StepType.LLM_CALL
        ]

        first_llm_pos = llm_positions[0] if llm_positions else None
        last_llm_pos = llm_positions[-1] if llm_positions else None

        # Midpoint for flows without LLM
        midpoint = len(steps) // 2

        for step in steps:
            if step.category != NodeCategory.CLAW:
                continue

            # Check for explicit override in config
            validation_stage = step.config.get("validationStage")
            if validation_stage == "input":
                step.type = StepType.CLAW_VALIDATE_INPUT
                logger.debug(
                    f"GuardianClaw {step.id}: VALIDATE_INPUT (explicit config)"
                )
                continue
            elif validation_stage == "output":
                step.type = StepType.CLAW_VALIDATE_OUTPUT
                logger.debug(
                    f"GuardianClaw {step.id}: VALIDATE_OUTPUT (explicit config)"
                )
                continue

            # Determine by position
            if first_llm_pos is not None:
                # Has LLM - use position relative to LLM
                if step.position < first_llm_pos:
                    step.type = StepType.CLAW_VALIDATE_INPUT
                    logger.debug(
                        f"GuardianClaw {step.id}: VALIDATE_INPUT (before LLM at {first_llm_pos})"
                    )
                else:
                    step.type = StepType.CLAW_VALIDATE_OUTPUT
                    logger.debug(
                        f"GuardianClaw {step.id}: VALIDATE_OUTPUT (after LLM at {first_llm_pos})"
                    )
            else:
                # No LLM - use midpoint heuristic
                if step.position < midpoint:
                    step.type = StepType.CLAW_VALIDATE_INPUT
                    logger.debug(
                        f"GuardianClaw {step.id}: VALIDATE_INPUT (before midpoint, no LLM)"
                    )
                else:
                    step.type = StepType.CLAW_VALIDATE_OUTPUT
                    logger.debug(
                        f"GuardianClaw {step.id}: VALIDATE_OUTPUT (after midpoint, no LLM)"
                    )
