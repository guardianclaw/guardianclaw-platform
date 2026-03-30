"""
Type definitions for GuardianClaw Runtime.

This module defines the standardized types used across the runtime,
following ADR-004 SDK Abstraction Layer specification.

Types are defined as TypedDict for JSON serialization compatibility
with Modal.com and the Cloudflare Workers API.
"""

from typing import TypedDict, Optional, List, Any, Literal


class ConversationTurn(TypedDict):
    """
    A single turn in a conversation history.

    Used for multi-turn analysis to detect escalation attacks (Crescendo, MHJ).
    This type matches the SDK's expected format for conversation_history.

    Attributes:
        role: The speaker role ('user' or 'assistant')
        content: The message content
    """

    role: Literal["user", "assistant"]
    """The speaker role."""

    content: str
    """The message content."""


# Type alias for conversation history
ConversationHistory = List[ConversationTurn]
"""
List of conversation turns for multi-turn analysis.

Used to provide context for escalation detection (Q6 in CLAW).
When provided to validate_input() or validate_output(), enables
detection of Crescendo-style attacks where individual messages
appear benign but collectively escalate toward harmful content.

Example:
    history: ConversationHistory = [
        {"role": "user", "content": "Tell me about chemistry"},
        {"role": "assistant", "content": "Chemistry is..."},
        {"role": "user", "content": "What about energetic reactions?"},
        {"role": "assistant", "content": "Energetic reactions..."},
    ]
"""


class ValidationResultDict(TypedDict, total=False):
    """
    Standardized validation result from GuardianClaw.

    This type is compatible with SDK v2.x, v3.0, and v2.24+ architectures.
    Uses total=False for backward compatibility with optional new fields.
    """

    # Core fields (always present in practice)
    is_safe: bool
    """Whether the content passed validation."""

    blocked: bool
    """Whether the request was blocked."""

    confidence: float
    """Confidence score (0.0 - 1.0)."""

    reason: Optional[str]
    """Human-readable reason for blocking (if blocked)."""

    violations: List[str]
    """List of detected violations."""

    gate: Optional[str]
    """Which gate made the decision (gate1, gate2, gate3, gate4, l4_unavailable)."""

    metadata: dict
    """Additional metadata from the validation."""

    # New fields in SDK v2.24
    partial_validation: bool
    """True if L4 was skipped due to unavailability (fallback was used)."""

    l4_error: Optional[str]
    """Error message if L4 failed (timeout, rate limit, etc.)."""

    l4_fallback_used: bool
    """True if the L4 fallback policy was applied."""

    l4_fallback_policy: Optional[str]
    """The fallback policy that was applied ('block', 'allow_if_l2_passed', 'allow')."""


class StatsDict(TypedDict, total=False):
    """
    Validation statistics from GuardianClaw.

    Note: Uses total=False for backward compatibility. New fields added in
    SDK v2.24 are optional and may not be present in older responses.
    """

    # Core statistics (always present)
    total_validations: int
    """Total number of validations performed."""

    blocked_count: int
    """Number of blocked requests."""

    passed_count: int
    """Number of passed requests."""

    # Gate-specific blocks
    gate1_blocks: int
    """Number of blocks by Gate 1 (input validation)."""

    gate2_blocks: int
    """Number of blocks by Gate 2 (output heuristics)."""

    gate3_blocks: int
    """Number of blocks by Gate 3 (legacy, maps to gate4)."""

    gate3_calls: int
    """Number of Gate 3 (LLM) calls (legacy, maps to gate4)."""

    # Gate 4 statistics - New in SDK v2.24
    gate4_blocks: int
    """Number of blocks by Gate 4 (L4 Observer)."""

    gate4_calls: int
    """Number of Gate 4 (LLM) calls - for cost tracking."""

    # L4 Fallback statistics - New in SDK v2.24
    l4_fallback_triggers: int
    """Number of times L4 fallback was triggered (L4 unavailable)."""

    l4_fallback_blocks: int
    """Number of blocks due to L4 unavailable with BLOCK policy."""

    l4_fallback_allows: int
    """Number of allows due to L4 unavailable with ALLOW/ALLOW_IF_L2_PASSED."""

    # Retry statistics - New in SDK v2.24
    retry_count: int
    """Total number of retries performed for Gate 4 API calls."""

    retry_success_count: int
    """Number of retries that eventually succeeded."""

    # Latency
    avg_latency_ms: float
    """Average validation latency in milliseconds."""

    total_latency_ms: float
    """Total cumulative latency in milliseconds."""


class L1ConfigDict(TypedDict, total=False):
    """L1 InputValidator configuration (v2.25 architecture)."""

    mode: Literal["strict", "moderate", "lenient"]
    """Detection mode: strict blocks aggressively, lenient allows more through."""

    enabledDetectors: dict
    """Which detectors are enabled: pattern, escalation, framing, harmful_request,
    intent_signal, safe_agent, embedding, benign_context."""

    threshold: int
    """Detection threshold 0-100. Lower = more sensitive."""


class L2ConfigDict(TypedDict, total=False):
    """L2 Seed Injection configuration (v2.25 architecture)."""

    seedLevel: Literal["minimal", "standard", "full"]
    """Seed complexity level: minimal (~500 chars), standard (~2KB), full (~5KB)."""

    customSeed: str
    """Custom additions to append to the seed."""

    appendMode: bool
    """If True, append seed to existing system prompt. If False, replace."""


class L3ConfigDict(TypedDict, total=False):
    """L3 OutputValidator configuration (v2.25 architecture)."""

    mode: Literal["strict", "moderate"]
    """Validation mode: strict blocks on any match, moderate uses scoring."""

    enabledGates: dict
    """Which CLAW gates are enabled: credibility, avoidance, limits, worth."""


class L4ConfigDict(TypedDict, total=False):
    """L4 ClawObserver configuration (v2.25 architecture)."""

    enabled: bool
    """Whether L4 LLM analysis is enabled."""

    provider: Literal["openai", "anthropic", "openrouter"]
    """LLM provider for L4 analysis."""

    model: str
    """Model identifier (e.g., 'gpt-4o-mini')."""

    fallbackPolicy: Literal["BLOCK", "ALLOW_IF_L2_PASSED", "ALLOW"]
    """Behavior when L4 fails: BLOCK, ALLOW_IF_L2_PASSED (recommended), ALLOW."""

    maxRetries: int
    """Maximum retry attempts for L4 API calls."""

    retryDelayMs: int
    """Delay between retries in milliseconds."""


class FlowNodeData(TypedDict, total=False):
    """Node data configuration from the visual builder."""

    label: str
    """Display label for the node."""

    inputType: Literal["user_message", "api_call", "webhook"]
    """Type of input node."""

    processType: Literal["llm_call", "transform", "condition"]
    """Type of process node."""

    gateType: Literal["credibility", "avoidance", "limits", "worth", "all"]
    """Type of claw gate (legacy v2.18)."""

    layerType: Literal["input_validator", "seed_injection", "output_validator", "observer"]
    """Type of claw layer (v2.25 architecture)."""

    l1Config: L1ConfigDict
    """L1 InputValidator configuration."""

    l2Config: L2ConfigDict
    """L2 Seed Injection configuration."""

    l3Config: L3ConfigDict
    """L3 OutputValidator configuration."""

    l4Config: L4ConfigDict
    """L4 ClawObserver configuration."""

    toolType: Literal["web_search", "code_exec", "api_request", "database"]
    """Type of tool node."""

    outputType: Literal["response", "webhook", "store"]
    """Type of output node."""

    config: dict
    """Node-specific configuration."""


class FlowNodeDict(TypedDict):
    """Visual builder flow node."""

    id: str
    """Unique node identifier."""

    type: str
    """Node type (input, process, claw, tool, output)."""

    position: dict
    """Node position {x, y}."""

    data: FlowNodeData
    """Node configuration data."""


class FlowEdgeDict(TypedDict):
    """Visual builder flow edge (connection)."""

    id: str
    """Unique edge identifier."""

    source: str
    """Source node ID."""

    target: str
    """Target node ID."""

    sourceHandle: Optional[str]
    """Source handle ID (optional)."""

    targetHandle: Optional[str]
    """Target handle ID (optional)."""


class FlowDict(TypedDict):
    """Complete flow definition from visual builder."""

    nodes: List[FlowNodeDict]
    """List of nodes in the flow."""

    edges: List[FlowEdgeDict]
    """List of edges connecting nodes."""


class GuardianClawValidationResult(TypedDict):
    """Full GuardianClaw validation result for API response."""

    input: ValidationResultDict
    """Input validation result."""

    output: ValidationResultDict
    """Output validation result."""

    stats: StatsDict
    """Validation statistics."""


class ExecutionStepTrace(TypedDict):
    """Trace data for a single execution step."""

    step_id: str
    """Unique identifier of the step."""

    step_name: str
    """Human-readable name (label) of the step."""

    step_type: str
    """Step type (e.g., 'receive_input', 'llm_call', 'claw_validate_input')."""

    category: str
    """Node category (e.g., 'input', 'process', 'claw')."""

    status: Literal["success", "error", "skipped"]
    """Execution status of this step."""

    duration_ms: float
    """Time taken to execute this step in milliseconds."""

    error: Optional[str]
    """Error message if status is 'error'."""

    metadata: Optional[dict]
    """Additional step-specific metadata (e.g., validation results)."""


class ExecutionTrace(TypedDict):
    """Complete execution trace for a flow run."""

    steps: List[ExecutionStepTrace]
    """Ordered list of step traces."""

    total_steps: int
    """Total number of steps in the flow."""

    completed_steps: int
    """Number of successfully completed steps."""

    failed_step: Optional[str]
    """ID of the step that failed (if any)."""


class ExecutionResult(TypedDict):
    """Result of agent execution."""

    blocked: bool
    """Whether the request was blocked."""

    response: Optional[str]
    """Agent response (if not blocked)."""

    stage: Optional[Literal["input", "output", "execution"]]
    """Stage where blocking occurred (if blocked)."""

    gate: Optional[str]
    """Gate that blocked (if blocked)."""

    reason: Optional[str]
    """Reason for blocking (if blocked)."""

    violations: Optional[List[str]]
    """Detected violations (if any)."""

    claw: Optional[GuardianClawValidationResult]
    """Full GuardianClaw validation results."""

    error: Optional[str]
    """Error message (if execution failed)."""

    latency_ms: float
    """Total execution latency in milliseconds."""

    flow_stats: dict
    """Flow execution statistics."""

    trace: Optional[ExecutionTrace]
    """Detailed execution trace with per-step timing and status."""


class LLMConfig(TypedDict, total=False):
    """LLM configuration for agent execution."""

    provider: Literal["openai", "anthropic", "openrouter"]
    """LLM provider."""

    model: str
    """Model identifier."""

    temperature: float
    """Sampling temperature (0.0 - 2.0)."""

    max_tokens: int
    """Maximum tokens in response."""

    system_prompt: str
    """System prompt to use."""


class ClawConfigDict(TypedDict, total=False):
    """
    GuardianClaw configuration for validation.

    This configuration supports both legacy gate3_* parameters (for backward
    compatibility) and the new gate4_* parameters introduced in SDK v2.24.

    The SDK internally maps gate3_* to gate4_* via property aliases.
    """

    # Gate 1 (Input Validation)
    gate1_enabled: bool
    """Enable Gate 1 (input heuristic)."""

    gate1_embedding_enabled: bool
    """Enable embeddings in Gate 1."""

    gate1_embedding_threshold: float
    """Similarity threshold for Gate 1 embeddings (0.0-1.0)."""

    # Gate 2 (Output Validation)
    gate2_enabled: bool
    """Enable Gate 2 (output heuristic + embedding)."""

    gate2_embedding_enabled: bool
    """Enable embeddings in Gate 2."""

    gate2_embedding_threshold: float
    """Similarity threshold for Gate 2 embeddings (0.0-1.0)."""

    gate2_confidence_threshold: float
    """Confidence threshold for Gate 2 decisions (0.0-1.0)."""

    # Gate 3 (Legacy aliases - mapped to Gate 4 in SDK v2.24+)
    gate3_enabled: bool
    """Enable Gate 3 (LLM observer). Legacy alias for gate4_enabled."""

    gate3_provider: str
    """Provider for Gate 3 LLM. Legacy alias for gate4_provider."""

    gate3_model: str
    """Model for Gate 3 LLM. Legacy alias for gate4_model."""

    gate3_api_key: str
    """API key for Gate 3 LLM. Legacy alias for gate4_api_key."""

    gate3_timeout: int
    """Timeout in seconds for Gate 3. Legacy alias for gate4_timeout."""

    # Gate 4 (L4 GuardianClaw Observer) - New in SDK v2.24
    gate4_enabled: bool
    """Enable Gate 4 (L4 GuardianClaw Observer - LLM-based transcript analysis)."""

    gate4_provider: str
    """LLM provider for Gate 4 ('openai', 'anthropic', 'groq', 'together', 'deepseek', 'mistral')."""

    gate4_model: str
    """Model identifier for Gate 4 LLM."""

    gate4_api_key: str
    """API key for Gate 4 LLM (uses env var if not set)."""

    gate4_timeout: int
    """Timeout in seconds for Gate 4 API calls."""

    gate4_base_url: str
    """Custom base URL for Gate 4 API (for self-hosted or alternative endpoints)."""

    gate4_fallback: Literal["block", "allow_if_l2_passed", "allow"]
    """
    Behavior when Gate 4 is unavailable (timeout, rate limit, error).
    - 'block': Block request (maximum security)
    - 'allow_if_l2_passed': Allow if L2 passed (balanced, recommended)
    - 'allow': Allow request (maximum usability)
    """

    # Retry configuration for Gate 4 API calls - New in SDK v2.24
    gate4_retry_enabled: bool
    """Enable automatic retry for Gate 4 API calls."""

    gate4_retry_max_attempts: int
    """Maximum number of retry attempts (default: 3)."""

    gate4_retry_initial_delay: float
    """Initial delay between retries in seconds (default: 1.0)."""

    gate4_retry_max_delay: float
    """Maximum delay between retries in seconds (default: 30.0)."""

    # General configuration
    fail_closed: bool
    """Block on errors (fail-safe mode)."""

    protection_level: Literal["minimal", "standard", "maximum"]
    """Protection level preset."""

    gates: dict
    """CLAW gates configuration {credibility, avoidance, limits, worth}."""

    sdk_version: Literal["v2", "v3", "auto"]
    """SDK version to use."""

    # Auto-protection configuration
    auto_protect: bool
    """Enable automatic GuardianClaw validation when flow has no explicit claw nodes.
    Default behavior (when absent): True — auto-protection is on by default.
    Set to False to explicitly disable auto-protection."""
