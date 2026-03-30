/**
 * Step Executor
 *
 * Graph-aware execution engine for flow nodes.
 * Port of Python executor.py:479-640 for TS fallback when Modal is unavailable.
 *
 * Converts sorted flow nodes into typed steps and executes them sequentially
 * with support for routing, blocking, and runaway loop detection.
 */

import type { FlowNode } from './flow-graph'
import { getNodeCategory, type NodeCategory } from './flow-graph'
import {
  validateInput,
  validateOutput,
  buildV25SystemPrompt,
  buildSystemPrompt,
  executeWithOpenAI,
  type GuardianClawGates,
  type LayerConfigs,
  type LLMConfig,
  type ContextMessage,
  type ExecutionResult,
  type ExecutionTrace,
} from './execution'
import {
  executeTool,
  type ToolNodeConfig,
  type ToolCredentialsContext,
  type ToolType,
} from './tools/tool-executor'

// ===========================================
// L4 OBSERVER HELPERS
// ===========================================

const L4_OBSERVER_PROMPT = `You are a safety observer analyzing an AI agent's behavior using the CLAW protocol.

Evaluate the following exchange:

USER INPUT: {{initial_input}}

AGENT OUTPUT: {{current_output}}

CONVERSATION HISTORY:
{{history}}

Apply these four gates:
1. CREDIBILITY: Is the output factually grounded? No fabricated claims or hallucinations?
2. AVOIDANCE: Does the output avoid causing harm to people, systems, or society?
3. LIMITS: Does the output stay within the agent's appropriate boundaries?
4. WORTH: Does the output serve a legitimate, beneficial purpose?

Respond ONLY with valid JSON:
{"passed":true|false,"gate":"credibility|avoidance|limits|worth|none","reason":"brief explanation","violations":["gate:detail"],"confidence":0.0-1.0}`

interface L4ParsedResponse {
  passed: boolean
  gate?: string
  reason?: string
  violations?: string[]
  confidence?: number
}

export function parseL4Response(raw: string): L4ParsedResponse {
  try {
    const parsed = JSON.parse(raw)
    return {
      passed: parsed.passed !== false,
      gate: parsed.gate || undefined,
      reason: parsed.reason || undefined,
      violations: Array.isArray(parsed.violations) ? parsed.violations : undefined,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
    }
  } catch {
    // Non-JSON or malformed response — default safe
    return { passed: true, reason: 'L4 response parse error, defaulting safe' }
  }
}

export async function callOpenAIForL4(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI L4 request failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI L4')
  return content
}

export async function callAnthropicForL4(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic L4 request failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> }
  const content = data.content?.[0]?.text
  if (!content) throw new Error('Empty response from Anthropic L4')
  return content
}

export async function callOpenRouterForL4(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 256,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenRouter L4 request failed: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenRouter L4')
  return content
}

/**
 * Dispatch L4 call to the correct provider.
 */
export function callL4Provider(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  switch (provider) {
    case 'anthropic':
      return callAnthropicForL4(apiKey, model, prompt)
    case 'openrouter':
      return callOpenRouterForL4(apiKey, model, prompt)
    default:
      return callOpenAIForL4(apiKey, model, prompt)
  }
}

/**
 * Standalone L4 Observer analysis.
 *
 * Can be called from any execution path (direct OpenAI, Modal, etc.)
 * outside the StepExecutor graph traversal.
 *
 * Returns an L4 verdict: { blocked, gate, reason, violations } or null if L4 is disabled/passed.
 */
export async function runL4Observer(opts: {
  l4Config: {
    enabled?: boolean
    provider?: string
    model?: string
    fallbackPolicy?: string
    maxRetries?: number
    retryDelayMs?: number
  }
  apiKey: string
  message: string
  response: string
  history: Array<{ role: string; content: string }>
}): Promise<{ blocked: true; gate: string; reason: string; violations: string[] } | null> {
  const { l4Config, apiKey, message, response, history } = opts

  if (!l4Config?.enabled || !apiKey) return null

  const provider = l4Config.provider || 'openai'
  const model = l4Config.model || 'gpt-4o-mini'
  const fallbackPolicy = l4Config.fallbackPolicy || 'ALLOW_IF_L2_PASSED'
  const maxRetries = l4Config.maxRetries ?? 2
  const retryDelayMs = l4Config.retryDelayMs ?? 1000

  const historySnippet = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const prompt = L4_OBSERVER_PROMPT.replace('{{initial_input}}', message)
    .replace('{{current_output}}', response)
    .replace('{{history}}', historySnippet || '(none)')

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await callL4Provider(provider, apiKey, model, prompt)
      const parsed = parseL4Response(raw)

      if (!parsed.passed) {
        return {
          blocked: true,
          gate: `L4:${parsed.gate || 'observer'}`,
          reason: parsed.reason || 'L4 Observer flagged unsafe output',
          violations: parsed.violations || [`l4:${parsed.gate || 'observer'}`],
        }
      }
      return null // Passed
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < maxRetries) {
        await sleep(retryDelayMs)
      }
    }
  }

  // All retries exhausted — apply fallback
  if (fallbackPolicy === 'BLOCK') {
    return {
      blocked: true,
      gate: 'L4:fallback',
      reason: `L4 Observer failed and fallback is BLOCK: ${lastError?.message || 'unknown'}`,
      violations: ['l4_fallback:block'],
    }
  }
  // ALLOW_IF_L2_PASSED and ALLOW — let the caller decide based on existing state
  return null
}

export function applyL4FallbackPolicy(
  state: ExecutionState,
  policy: string,
  error: Error | null
): void {
  if (policy === 'BLOCK') {
    state.blocked = true
    state.blockInfo = {
      stage: 'output',
      gate: 'L4:fallback',
      reason: `L4 Observer failed and fallback is BLOCK: ${error?.message || 'unknown'}`,
      violations: ['l4_fallback:block'],
    }
  } else if (policy === 'ALLOW_IF_L2_PASSED') {
    // Check if L3 output validation passed (no block from output stage)
    const l3Passed = !state.blocked || state.blockInfo?.stage !== 'output'
    if (!l3Passed) {
      state.blocked = true
      state.blockInfo = {
        stage: 'output',
        gate: 'L4:fallback',
        reason: `L4 Observer failed and L3 also failed: ${error?.message || 'unknown'}`,
        violations: ['l4_fallback:l3_failed'],
      }
    }
  }
  // ALLOW -> don't block
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Resolve {{variable}} templates against execution state.
 * Supports: {{currentInput}}, {{initialInput}}, {{conditionResult}}
 */
export function resolveTemplateVars(
  template: string,
  state: Pick<ExecutionState, 'currentInput' | 'initialInput' | 'conditionResult'>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key === 'currentInput') return state.currentInput
    if (key === 'initialInput') return state.initialInput
    if (key === 'conditionResult') return String(state.conditionResult ?? '')
    return `{{${key}}}`
  })
}

/**
 * Simple JSONPath-like extractor.
 * Supports dot notation and array indices: "users[0].name", "data.items"
 */
export function extractJsonPath(data: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let current: unknown = data

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }

  return current
}

/**
 * Check a simple boolean expression string.
 * Handles: "true"/"false", "yes"/"no", comparison operators (==, !=, <, >, <=, >=)
 * Safe: uses only regex-matched comparisons, no dynamic code execution.
 */
export function evaluateSimpleCondition(expr: string): boolean {
  const trimmed = expr.trim().toLowerCase()

  // Direct boolean values
  if (trimmed === 'true' || trimmed === 'yes' || trimmed === '1') return true
  if (trimmed === 'false' || trimmed === 'no' || trimmed === '0' || trimmed === '') return false

  // Comparison operators: "value1 == value2", "3 > 1", etc.
  const compMatch = expr.match(/^(.+?)\s*(==|!=|<=|>=|<|>)\s*(.+)$/)
  if (compMatch) {
    const [, leftRaw, op, rightRaw] = compMatch
    const left = leftRaw.trim()
    const right = rightRaw.trim()
    const leftNum = Number(left)
    const rightNum = Number(right)
    const numeric = !isNaN(leftNum) && !isNaN(rightNum)

    switch (op) {
      case '==':
        return left === right
      case '!=':
        return left !== right
      case '<':
        return numeric && leftNum < rightNum
      case '>':
        return numeric && leftNum > rightNum
      case '<=':
        return numeric && leftNum <= rightNum
      case '>=':
        return numeric && leftNum >= rightNum
    }
  }

  // Non-empty string is truthy
  return trimmed.length > 0
}

/**
 * Try to parse a JSON array from a string. Returns null if not an array.
 */
export function tryParseArray(input: string): unknown[] | null {
  try {
    const parsed = JSON.parse(input)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Generate a deterministic pseudo-embedding from text using simple hashing.
 * Fallback when OpenAI embedding API is unavailable.
 */
export function hashToVector(text: string, dimensions = 64): number[] {
  const vec = new Array(dimensions).fill(0)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    vec[i % dimensions] += code
    // Mix bits for better distribution
    vec[(i * 7 + 3) % dimensions] ^= code * 31
  }

  // Normalize to unit vector
  let norm = 0
  for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) vec[i] /= norm
  }

  return vec
}

// ===========================================
// TYPES
// ===========================================

export type StepType =
  | 'receive_input'
  | 'claw_validate_input'
  | 'claw_validate_output'
  | 'claw_l2_seed'
  | 'claw_l1_input'
  | 'claw_l3_output'
  | 'claw_l4_observer'
  | 'llm_call'
  | 'send_output'
  | 'tool_web_search'
  | 'tool_code_exec'
  | 'tool_api_request'
  | 'tool_database'
  | 'flow_router'
  | 'flow_merge'
  | 'flow_loop'
  | 'memory_buffer'
  | 'memory_vector'
  | 'memory_summary'
  | 'condition'
  | 'utility_delay'
  | 'utility_log'

export interface FlowStep {
  id: string
  type: StepType
  category: NodeCategory
  config: Record<string, unknown>
  label: string
  position: number
}

export interface TraceStep {
  stepId: string
  stepType: StepType
  category: string
  status: 'success' | 'error' | 'skipped'
  durationMs: number
  error?: string
  metadata?: Record<string, unknown>
}

export interface MemoryBufferEntry {
  human: string
  ai: string
  timestamp: number
}

export interface VectorDocument {
  content: string
  embedding: number[]
  namespace: string
}

export interface ExecutionLogEntry {
  stepId: string
  message: string
  level: string
  timestamp: number
  data?: unknown
}

export interface ExecutionState {
  currentInput: string
  initialInput: string
  systemPrompt?: string
  blocked: boolean
  blockInfo?: { stage: string; gate: string; reason: string; violations: string[] }
  finalOutput: string | null
  nextNode?: string
  traceSteps: TraceStep[]
  memory?: {
    buffer: MemoryBufferEntry[]
    vectorStore: Record<string, VectorDocument>
    summary?: string
  }
  items?: unknown[]
  conditionResult?: boolean
  activeBranch?: string
  executionLog?: ExecutionLogEntry[]
}

export interface StepExecutorDeps {
  gates: GuardianClawGates
  layerConfigs: LayerConfigs
  llmConfig: LLMConfig
  openaiKey: string
  toolCredentials: ToolCredentialsContext | null
  characterPrompt?: string
  history: ContextMessage[]
}

type StepHandler = (step: FlowStep, state: ExecutionState) => Promise<void>

// ===========================================
// NODE → STEP MAPPING
// ===========================================

// Maps (category, subtype) to StepType
const STEP_TYPE_MAP: Record<string, Record<string, StepType>> = {
  input: {
    user_message: 'receive_input',
    api_trigger: 'receive_input',
    webhook_trigger: 'receive_input',
    schedule_trigger: 'receive_input',
    default: 'receive_input',
  },
  claw: {
    input_validator: 'claw_l1_input',
    seed_injection: 'claw_l2_seed',
    output_validator: 'claw_l3_output',
    observer: 'claw_l4_observer',
    validate_input: 'claw_validate_input',
    validate_output: 'claw_validate_output',
    default: 'claw_validate_input',
  },
  process: {
    llm_call: 'llm_call',
    condition: 'condition',
    default: 'llm_call',
  },
  flow: {
    router: 'flow_router',
    merge: 'flow_merge',
    loop: 'flow_loop',
    default: 'flow_router',
  },
  memory: {
    buffer: 'memory_buffer',
    vector: 'memory_vector',
    summary: 'memory_summary',
    default: 'memory_buffer',
  },
  tool: {
    web_search: 'tool_web_search',
    api_request: 'tool_api_request',
    code_exec: 'tool_code_exec',
    database: 'tool_database',
    default: 'tool_web_search',
  },
  utility: {
    delay: 'utility_delay',
    log: 'utility_log',
    default: 'utility_log',
  },
  output: {
    response: 'send_output',
    webhook: 'send_output',
    store: 'send_output',
    twitter_post: 'send_output',
    discord_message: 'send_output',
    telegram_message: 'send_output',
    default: 'send_output',
  },
}

/**
 * Extract subtype from node data.
 * Checks layerType first (claw nodes), then category-specific fields.
 */
function extractSubtype(node: FlowNode): string {
  const data = node.data || {}

  // GuardianClaw nodes use layerType
  if (data.layerType) return data.layerType as string

  // Each category has its own subtype field
  const subtypeFields = [
    'inputType',
    'processType',
    'flowType',
    'memoryType',
    'toolType',
    'utilityType',
    'outputType',
  ]
  for (const field of subtypeFields) {
    if (data[field]) return data[field] as string
  }

  return 'default'
}

/**
 * Convert a FlowNode into a typed FlowStep for execution.
 */
export function nodeToStep(node: FlowNode, position: number): FlowStep {
  const category = getNodeCategory(node.type)
  const subtype = extractSubtype(node)
  const categoryMap = STEP_TYPE_MAP[category] || {}
  const stepType = categoryMap[subtype] || categoryMap['default'] || 'receive_input'

  if (subtype !== 'default' && !categoryMap[subtype]) {
    console.warn(
      `[step-executor] Unknown subtype '${subtype}' for category '${category}' on node '${node.id}' — falling back to '${stepType}'`
    )
  }

  return {
    id: node.id,
    type: stepType,
    category,
    config: (node.data?.config as Record<string, unknown>) || {},
    label: (node.data?.label as string) || `${node.type}:${subtype}`,
    position,
  }
}

// ===========================================
// STEP EXECUTOR CLASS
// ===========================================

export class StepExecutor {
  private handlers: Map<StepType, StepHandler>
  private readonly MAX_STEPS = 500
  private readonly EXECUTION_TIMEOUT_MS = 25_000
  private deps: StepExecutorDeps

  constructor(deps: StepExecutorDeps) {
    this.deps = deps
    this.handlers = new Map()
    this.registerHandlers()
  }

  private registerHandlers(): void {
    // Input
    this.handlers.set('receive_input', async (_step, _state) => {
      // Input is already set from message
    })

    // GuardianClaw validators
    this.handlers.set('claw_validate_input', this.handleValidateInput.bind(this))
    this.handlers.set('claw_l1_input', this.handleValidateInput.bind(this))

    this.handlers.set('claw_validate_output', this.handleValidateOutput.bind(this))
    this.handlers.set('claw_l3_output', this.handleValidateOutput.bind(this))

    // L2 Seed
    this.handlers.set('claw_l2_seed', async (_step, state) => {
      state.systemPrompt = this.deps.layerConfigs.isV25Architecture
        ? buildV25SystemPrompt(
            this.deps.layerConfigs.l2Config,
            undefined,
            this.deps.characterPrompt
          )
        : buildSystemPrompt(this.deps.gates, this.deps.characterPrompt)
    })

    // L4 Observer — LLM-based transcript analysis
    this.handlers.set('claw_l4_observer', this.handleL4Observer.bind(this))

    // LLM call
    this.handlers.set('llm_call', this.handleLLMCall.bind(this))

    // Output
    this.handlers.set('send_output', async (_step, state) => {
      state.finalOutput = state.currentInput
    })

    // Tools
    this.handlers.set('tool_web_search', this.handleTool.bind(this))
    this.handlers.set('tool_api_request', this.handleTool.bind(this))
    this.handlers.set('tool_code_exec', this.handleTool.bind(this))
    this.handlers.set('tool_database', this.handleTool.bind(this))

    // Flow
    this.handlers.set('flow_router', this.handleRouter.bind(this))
    this.handlers.set('flow_merge', this.handleFlowMerge.bind(this))
    this.handlers.set('flow_loop', this.handleFlowLoop.bind(this))

    // Memory
    this.handlers.set('memory_buffer', this.handleMemoryBuffer.bind(this))
    this.handlers.set('memory_vector', this.handleMemoryVector.bind(this))
    this.handlers.set('memory_summary', this.handleMemorySummary.bind(this))

    // Process
    this.handlers.set('condition', this.handleCondition.bind(this))

    // Utility
    this.handlers.set('utility_delay', this.handleUtilityDelay.bind(this))
    this.handlers.set('utility_log', this.handleUtilityLog.bind(this))
  }

  // --- Handler implementations ---

  private async handleValidateInput(_step: FlowStep, state: ExecutionState): Promise<void> {
    const result = validateInput(state.currentInput, this.deps.gates)
    if (!result.passed) {
      state.blocked = true
      state.blockInfo = {
        stage: 'input',
        gate: result.violations[0]?.split(':')[0] || 'unknown',
        reason: `Input validation failed: ${result.violations.join(', ')}`,
        violations: result.violations,
      }
    }
  }

  private async handleValidateOutput(_step: FlowStep, state: ExecutionState): Promise<void> {
    const result = validateOutput(state.currentInput, this.deps.gates)
    if (!result.passed) {
      state.blocked = true
      state.blockInfo = {
        stage: 'output',
        gate: result.violations[0]?.split(':')[0] || 'unknown',
        reason: `Output validation failed: ${result.violations.join(', ')}`,
        violations: result.violations,
      }
    }
  }

  private async handleLLMCall(_step: FlowStep, state: ExecutionState): Promise<void> {
    const result = await executeWithOpenAI(
      this.deps.openaiKey,
      state.currentInput,
      this.deps.history,
      this.deps.gates,
      this.deps.llmConfig,
      undefined, // toolContext already baked into currentInput
      this.deps.layerConfigs,
      this.deps.characterPrompt
    )

    if (result.blocked) {
      state.blocked = true
      state.blockInfo = {
        stage: result.stage || 'llm',
        gate: result.gate || 'unknown',
        reason: result.reason || 'LLM output blocked',
        violations: result.violations || [],
      }
      return
    }

    state.currentInput = result.response || ''
  }

  private async handleTool(step: FlowStep, state: ExecutionState): Promise<void> {
    // Map step type back to tool type
    const toolTypeMap: Record<string, ToolType> = {
      tool_web_search: 'web_search',
      tool_api_request: 'api_request',
      tool_code_exec: 'code_exec',
      tool_database: 'database',
    }

    const toolType = toolTypeMap[step.type] || 'web_search'
    const toolConfig: ToolNodeConfig = {
      toolType,
      config: step.config,
      label: step.label,
    }

    const context = {
      currentInput: state.currentInput,
      initialInput: state.initialInput,
    }

    const result = await executeTool(toolConfig, context, this.deps.toolCredentials)

    if (result.success && result.outputText) {
      state.currentInput = result.outputText
    }
  }

  private async handleRouter(step: FlowStep, state: ExecutionState): Promise<void> {
    const conditions = step.config.conditions as
      | Array<{
          field?: string
          operator?: string
          value?: string
          targetNodeId?: string
        }>
      | undefined

    if (!conditions || conditions.length === 0) {
      return
    }

    // Try to parse currentInput as JSON for field extraction
    let inputData: unknown
    try {
      inputData = JSON.parse(state.currentInput)
    } catch {
      inputData = state.currentInput
    }

    // Evaluate each condition in order; first match wins
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i]
      if (!cond.targetNodeId) continue

      // Last condition without field/operator acts as default route
      if (!cond.field && !cond.operator) {
        if (i === conditions.length - 1) {
          state.nextNode = cond.targetNodeId
          return
        }
        // Non-last unconditional route — take it
        state.nextNode = cond.targetNodeId
        return
      }

      // Extract field value and build comparison expression
      const fieldValue = cond.field
        ? String(extractJsonPath(inputData, cond.field) ?? '')
        : state.currentInput

      const operator = cond.operator || '=='
      const expected = cond.value ?? ''
      const expr = `${fieldValue} ${operator} ${expected}`

      if (evaluateSimpleCondition(expr)) {
        state.nextNode = cond.targetNodeId
        return
      }
    }

    // No condition matched — use last route as fallback if it has a target
    const last = conditions[conditions.length - 1]
    if (last?.targetNodeId) {
      state.nextNode = last.targetNodeId
    }
  }

  private async handleL4Observer(_step: FlowStep, state: ExecutionState): Promise<void> {
    const l4Config = this.deps.layerConfigs.l4Config
    if (!l4Config?.enabled) return

    const provider = l4Config.provider || 'openai'
    const model = l4Config.model || 'gpt-4o-mini'
    const fallbackPolicy = l4Config.fallbackPolicy || 'ALLOW_IF_L2_PASSED'
    const maxRetries = l4Config.maxRetries ?? 2
    const retryDelayMs = l4Config.retryDelayMs ?? 1000

    // Build prompt for CLAW analysis
    const historySnippet = this.deps.history
      .slice(-6)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    const prompt = L4_OBSERVER_PROMPT.replace('{{initial_input}}', state.initialInput)
      .replace('{{current_output}}', state.currentInput)
      .replace('{{history}}', historySnippet || '(none)')

    // Retry loop
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await callL4Provider(provider, this.deps.openaiKey, model, prompt)
        const parsed = parseL4Response(response)

        if (!parsed.passed) {
          state.blocked = true
          state.blockInfo = {
            stage: 'output',
            gate: `L4:${parsed.gate || 'observer'}`,
            reason: parsed.reason || 'L4 Observer flagged unsafe output',
            violations: parsed.violations || [`l4:${parsed.gate || 'observer'}`],
          }
        }
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxRetries) {
          await sleep(retryDelayMs)
        }
      }
    }

    // All retries exhausted — apply fallback policy
    applyL4FallbackPolicy(state, fallbackPolicy, lastError)
  }

  // --- Memory handlers ---

  private ensureMemory(state: ExecutionState): NonNullable<ExecutionState['memory']> {
    if (!state.memory) {
      state.memory = { buffer: [], vectorStore: {} }
    }
    return state.memory
  }

  private async handleMemoryBuffer(step: FlowStep, state: ExecutionState): Promise<void> {
    const mem = this.ensureMemory(state)
    const operation = (step.config.operation as string) || 'add'
    const bufferSize = (step.config.buffer_size as number) || 10

    if (operation === 'add') {
      mem.buffer.push({
        human: state.initialInput,
        ai: state.currentInput,
        timestamp: Date.now(),
      })
      // Trim to buffer_size (keep most recent)
      if (mem.buffer.length > bufferSize) {
        mem.buffer = mem.buffer.slice(-bufferSize)
      }
    } else if (operation === 'get') {
      const formatted = mem.buffer.map((e) => `Human: ${e.human}\nAI: ${e.ai}`).join('\n---\n')
      state.currentInput = formatted || '(empty buffer)'
    } else if (operation === 'clear') {
      mem.buffer = []
    }
  }

  private async handleMemoryVector(step: FlowStep, state: ExecutionState): Promise<void> {
    const mem = this.ensureMemory(state)
    const operation = (step.config.operation as string) || 'store'
    const namespace = (step.config.namespace as string) || 'default'
    const topK = (step.config.top_k as number) || 3

    if (operation === 'store') {
      const embedding = await this.getEmbedding(state.currentInput)
      const docId = `${namespace}:${Date.now()}`
      mem.vectorStore[docId] = {
        content: state.currentInput,
        embedding,
        namespace,
      }
    } else if (operation === 'search') {
      const queryEmbedding = await this.getEmbedding(state.currentInput)
      const docs = Object.values(mem.vectorStore).filter((d) => d.namespace === namespace)

      if (docs.length === 0) {
        state.currentInput = '(no documents found)'
        return
      }

      // Cosine similarity search
      const scored = docs.map((doc) => ({
        content: doc.content,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      scored.sort((a, b) => b.score - a.score)
      const results = scored.slice(0, topK)
      state.currentInput = results.map((r) => r.content).join('\n---\n')
    } else if (operation === 'clear') {
      // Remove all docs in this namespace
      for (const [key, doc] of Object.entries(mem.vectorStore)) {
        if (doc.namespace === namespace) {
          delete mem.vectorStore[key]
        }
      }
    }
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.deps.openaiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      })

      if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`)

      const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
      const embedding = data.data?.[0]?.embedding
      if (embedding) return embedding
      throw new Error('No embedding returned')
    } catch {
      // Fallback: generate a deterministic pseudo-embedding from content hash
      return hashToVector(text)
    }
  }

  private async handleMemorySummary(step: FlowStep, state: ExecutionState): Promise<void> {
    const source = (step.config.source as string) || 'buffer'
    const maxTokens = (step.config.max_tokens as number) || 256

    let content: string
    if (source === 'buffer') {
      const mem = this.ensureMemory(state)
      if (mem.buffer.length === 0) return
      content = mem.buffer.map((e) => `Human: ${e.human}\nAI: ${e.ai}`).join('\n')
    } else {
      content = state.currentInput
    }

    if (!content.trim()) return

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.deps.openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize the following concisely, preserving key facts.' },
            { role: 'user', content },
          ],
          temperature: 0.3,
          max_tokens: maxTokens,
        }),
      })

      if (!res.ok) throw new Error(`Summary request failed: ${res.status}`)

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const summary = data.choices?.[0]?.message?.content
      if (summary) {
        state.currentInput = summary
        this.ensureMemory(state).summary = summary
      }
    } catch {
      // On failure, keep currentInput as-is
    }
  }

  // --- Process handlers ---

  private async handleCondition(step: FlowStep, state: ExecutionState): Promise<void> {
    const expression = (step.config.expression as string) || 'false'
    const trueValue = step.config.true_value ?? 'true'
    const falseValue = step.config.false_value ?? 'false'

    const resolved = resolveTemplateVars(expression, state)
    const result = evaluateSimpleCondition(resolved)

    state.conditionResult = result
    state.currentInput = String(result ? trueValue : falseValue)
  }

  // --- Flow handlers ---

  private async handleFlowMerge(_step: FlowStep, state: ExecutionState): Promise<void> {
    // Merge point: clear any active branch context
    state.activeBranch = undefined
  }

  private async handleFlowLoop(step: FlowStep, state: ExecutionState): Promise<void> {
    const loopOver = (step.config.loop_over as string) || 'items'
    const maxIterations = (step.config.max_iterations as number) || 100
    const rangeStart = (step.config.range_start as number) || 0
    const rangeEnd = (step.config.range_end as number) || 10
    const template = (step.config.template as string) || '{{loop.item}}'

    let items: unknown[]

    if (loopOver === 'range') {
      items = []
      const safeEnd = Math.min(rangeStart + maxIterations, rangeEnd)
      for (let i = rangeStart; i < safeEnd; i++) {
        items.push(i)
      }
    } else {
      items = tryParseArray(state.currentInput) || [state.currentInput]
      if (items.length > maxIterations) {
        items = items.slice(0, maxIterations)
      }
    }

    // Batch process: apply template to each item
    const results: string[] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item)

      // Replace loop-specific template vars
      let output = template
        .replace(/\{\{loop\.item\}\}/g, itemStr)
        .replace(/\{\{loop\.index\}\}/g, String(i))
        .replace(/\{\{loop\.length\}\}/g, String(items.length))

      // Also resolve standard template vars
      output = resolveTemplateVars(output, state)
      results.push(output)
    }

    state.items = items
    state.currentInput = JSON.stringify(results)
  }

  // --- Utility handlers ---

  private async handleUtilityDelay(step: FlowStep, _state: ExecutionState): Promise<void> {
    const seconds = (step.config.seconds as number) || 1
    const jitter = (step.config.random_jitter as number) || 0

    const totalMs = (seconds + Math.random() * jitter) * 1000
    // Cap at 30s (Cloudflare Worker limit)
    const capped = Math.min(totalMs, 30_000)
    await sleep(capped)
  }

  private async handleUtilityLog(step: FlowStep, state: ExecutionState): Promise<void> {
    const level = (step.config.level as string) || 'info'
    const messageTemplate = (step.config.message as string) || ''
    const includeData = (step.config.include_data as boolean) || false

    const message = resolveTemplateVars(messageTemplate, state)

    // Log to console
    const logFn =
      level === 'error'
        ? console.error
        : level === 'warning'
          ? console.warn
          : level === 'debug'
            ? console.debug
            : console.log
    logFn(`[${level.toUpperCase()}] ${message}`)

    // Accumulate in execution log
    if (!state.executionLog) state.executionLog = []
    state.executionLog.push({
      stepId: step.id,
      message,
      level,
      timestamp: Date.now(),
      data: includeData ? state.currentInput : undefined,
    })
    // Non-invasive: does not modify currentInput
  }

  // --- Main execution loop ---

  async execute(
    steps: FlowStep[],
    message: string,
    _history: ContextMessage[]
  ): Promise<ExecutionResult> {
    const state: ExecutionState = {
      currentInput: message,
      initialInput: message,
      blocked: false,
      finalOutput: null,
      traceSteps: [],
    }

    // Request-level timeout via AbortController
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.EXECUTION_TIMEOUT_MS)

    try {
      let stepIndex = 0
      let iterations = 0

      while (stepIndex < steps.length) {
        // Check abort signal before each step
        if (controller.signal.aborted) {
          state.blocked = true
          state.blockInfo = {
            stage: 'execution',
            gate: 'execution_timeout',
            reason: `Execution timed out after ${this.EXECUTION_TIMEOUT_MS}ms`,
            violations: ['execution:timeout'],
          }
          break
        }

        iterations++

        if (iterations > this.MAX_STEPS) {
          state.blocked = true
          state.blockInfo = {
            stage: 'execution',
            gate: 'runaway_loop',
            reason: `Execution exceeded ${this.MAX_STEPS} iterations — possible infinite loop`,
            violations: ['execution:runaway_loop'],
          }
          break
        }

        if (state.blocked) break

        const step = steps[stepIndex]
        const handler = this.handlers.get(step.type)

        const stepStart = Date.now()

        if (!handler) {
          // Unknown step type — skip with warning
          state.traceSteps.push({
            stepId: step.id,
            stepType: step.type,
            category: step.category,
            status: 'skipped',
            durationMs: 0,
            metadata: { reason: `No handler for step type: ${step.type}` },
          })
          stepIndex++
          continue
        }

        try {
          state.nextNode = undefined
          await handler(step, state)

          state.traceSteps.push({
            stepId: step.id,
            stepType: step.type,
            category: step.category,
            status: state.blocked ? 'error' : 'success',
            durationMs: Date.now() - stepStart,
            error: state.blockInfo?.reason,
          })
        } catch (error) {
          // Treat AbortError as timeout
          if (error instanceof DOMException && error.name === 'AbortError') {
            state.blocked = true
            state.blockInfo = {
              stage: 'execution',
              gate: 'execution_timeout',
              reason: `Execution timed out after ${this.EXECUTION_TIMEOUT_MS}ms`,
              violations: ['execution:timeout'],
            }
            state.traceSteps.push({
              stepId: step.id,
              stepType: step.type,
              category: step.category,
              status: 'error',
              durationMs: Date.now() - stepStart,
              error: 'Execution timeout',
            })
            break
          }

          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          state.traceSteps.push({
            stepId: step.id,
            stepType: step.type,
            category: step.category,
            status: 'error',
            durationMs: Date.now() - stepStart,
            error: errorMsg,
          })
          // Don't block on tool errors, let flow continue
          if (step.type.startsWith('tool_') || step.type.startsWith('utility_')) {
            stepIndex++
            continue
          }
          // Block on critical errors (LLM, validation)
          state.blocked = true
          state.blockInfo = {
            stage: step.category,
            gate: 'execution_error',
            reason: errorMsg,
            violations: [`${step.category}:execution_error`],
          }
          break
        }

        // Handle routing
        if (state.nextNode) {
          if (state.nextNode === step.id) {
            // Self-loop guard: skip to prevent infinite loop
            state.traceSteps.push({
              stepId: step.id,
              stepType: step.type,
              category: step.category,
              status: 'skipped',
              durationMs: 0,
              metadata: { reason: 'Self-loop detected in router, skipping' },
            })
            stepIndex++
          } else {
            const targetIndex = steps.findIndex((s) => s.id === state.nextNode)
            if (targetIndex >= 0) {
              stepIndex = targetIndex
            } else {
              // Target not found, continue linear
              stepIndex++
            }
          }
          state.nextNode = undefined
        } else {
          stepIndex++
        }
      }
    } finally {
      clearTimeout(timeout)
    }

    // Fallback output
    if (state.finalOutput === null && !state.blocked) {
      state.finalOutput = state.currentInput || '[Flow completed without output node]'
    }

    // Build result
    const trace: ExecutionTrace & { warnings?: string[] } = {
      steps: state.traceSteps.map((t) => ({
        step_id: t.stepId,
        step_name: t.stepType,
        step_type: t.stepType,
        category: t.category,
        status: t.status,
        duration_ms: t.durationMs,
        error: t.error,
        metadata: t.metadata,
      })),
      total_steps: steps.length,
      completed_steps: state.traceSteps.filter((t) => t.status === 'success').length,
      failed_step: state.blocked ? state.blockInfo?.stage : undefined,
    }

    if (state.blocked && state.blockInfo) {
      return {
        blocked: true,
        response: null,
        stage: state.blockInfo.stage,
        gate: state.blockInfo.gate,
        reason: state.blockInfo.reason,
        violations: state.blockInfo.violations,
        trace,
      }
    }

    return {
      blocked: false,
      response: state.finalOutput,
      trace,
    }
  }
}
