import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getUserClient } from '../lib/supabase-client'
import {
  execute,
  extractAnalyticsFields,
  extractLLMConfig,
  type ExecutionOptions,
  type ExecutionResult,
} from '../services/execution'
import { logExecution } from '../services/execution-logger'
import {
  deductCredits,
  refundCredits,
  COST_PER_EXECUTION,
  COST_PER_EXECUTION_BYOK,
} from '../services/credits'
import { buildCharacterPrompt, type CharacterConfig } from './character'
import { Errors } from '../lib/errors'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
  MODAL_RUNTIME_URL?: string // Optional - if not set, uses OpenAI or simulation
  OPENAI_API_KEY?: string // Optional - for direct OpenAI calls
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const agentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes, then wallet-based rate limiting (100/min per wallet)
agentsRoutes.use('*', authMiddleware)
agentsRoutes.use('*', walletRateLimitMiddleware())

// Validation schemas
// Size limit helpers for DoS prevention
const MAX_FLOW_SIZE = 2_000_000 // 2MB
const MAX_CONFIG_SIZE = 500_000 // 500KB

function jsonSizeWithinLimit(data: unknown, limit: number): boolean {
  try {
    return JSON.stringify(data).length <= limit
  } catch {
    return false
  }
}

const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  framework: z
    .enum([
      'anthropic_sdk',
      'openai_agents',
      'coinbase_agentkit',
      'solana_agent_kit',
      'google_adk',
      'virtuals_protocol',
      'elizaos',
      'voltagent',
      'openclaw',
      'custom',
    ])
    .default('openai_agents'),
  icon: z.string().max(50).default('bot'),
  flow: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
    })
    .refine((f) => jsonSizeWithinLimit(f, MAX_FLOW_SIZE), {
      message: `Flow data exceeds ${MAX_FLOW_SIZE / 1_000_000}MB limit`,
    })
    .optional(),
  config: z
    .record(z.any())
    .refine((c) => jsonSizeWithinLimit(c, MAX_CONFIG_SIZE), {
      message: `Config data exceeds ${MAX_CONFIG_SIZE / 1_000}KB limit`,
    })
    .optional(),
  claw_config: z
    .object({
      protection_level: z.enum(['minimal', 'standard', 'maximum']).optional(),
      modules: z
        .record(
          z.object({
            enabled: z.boolean(),
          })
        )
        .optional(),
      gates: z
        .object({
          credibility: z.boolean(),
          avoidance: z.boolean(),
          limits: z.boolean(),
          worth: z.boolean(),
        })
        .optional(),
    })
    .optional(),
  integration_config: z
    .record(z.any())
    .refine((c) => jsonSizeWithinLimit(c, MAX_CONFIG_SIZE), {
      message: `Integration config data exceeds ${MAX_CONFIG_SIZE / 1_000}KB limit`,
    })
    .optional(),
})

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional(),
  flow: z
    .object({
      nodes: z.array(z.any()),
      edges: z.array(z.any()),
    })
    .refine((f) => jsonSizeWithinLimit(f, MAX_FLOW_SIZE), {
      message: `Flow data exceeds ${MAX_FLOW_SIZE / 1_000_000}MB limit`,
    })
    .optional(),
  config: z
    .record(z.any())
    .refine((c) => jsonSizeWithinLimit(c, MAX_CONFIG_SIZE), {
      message: `Config data exceeds ${MAX_CONFIG_SIZE / 1_000}KB limit`,
    })
    .optional(),
  claw_config: z
    .object({
      protection_level: z.enum(['minimal', 'standard', 'maximum']).optional(),
      gates: z
        .object({
          credibility: z.boolean(),
          avoidance: z.boolean(),
          limits: z.boolean(),
          worth: z.boolean(),
        })
        .optional(),
      sdk_version: z.string().optional(),
    })
    .optional(),
  integration_config: z
    .record(z.any())
    .refine((c) => jsonSizeWithinLimit(c, MAX_CONFIG_SIZE), {
      message: `Integration config data exceeds ${MAX_CONFIG_SIZE / 1_000}KB limit`,
    })
    .optional(),
  status: z.enum(['draft', 'testing', 'deployed', 'archived']).optional(),
})

// Flow protection validation
// Checks for the PRESENCE of claw nodes in a flow.
// Position-based classification (input vs output) is handled by the
// Python executor's flow_parser via topological sorting — the backend
// only counts nodes and emits proportional warnings.
interface FlowProtectionStatus {
  clawNodeCount: number
  hasAnyProtection: boolean
  warnings: string[]
}

export function validateFlowProtection(flow: {
  nodes?: Record<string, unknown>[]
  edges?: Record<string, unknown>[]
}): FlowProtectionStatus {
  const nodes = flow.nodes || []

  const clawNodeCount = nodes.filter((n: Record<string, unknown>) => {
    const type = String(n.type || '').toLowerCase()
    return type === 'claw'
  }).length

  const hasAnyProtection = clawNodeCount > 0
  const warnings: string[] = []

  if (!hasAnyProtection) {
    warnings.push(
      'Flow has no GuardianClaw protection nodes. Runtime auto-protection will be applied.'
    )
  } else if (clawNodeCount === 1) {
    warnings.push(
      'Flow has only one GuardianClaw node. Consider adding both input and output validation. Missing coverage will use auto-protection.'
    )
  }

  return { clawNodeCount, hasAnyProtection, warnings }
}

// GET /agents - List user's agents
agentsRoutes.get('/', async (c) => {
  const wallet = c.get('wallet')

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('wallet_address', wallet)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('List agents error:', error)
    throw Errors.database('Failed to list agents')
  }

  return c.json(data)
})

// Analytics query schema
const analyticsQuerySchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.string().regex(/^\d+$/).optional().default('7'),
})

// Analytics response types
interface DailyStats {
  date: string
  requests: number
  blocked: number
  avg_latency_ms: number
}

interface GateStats {
  gate: string
  blocked: number
}

interface RecentBlock {
  id: string
  gate: string
  created_at: string
}

interface AnalyticsResponse {
  summary: {
    total_requests: number
    total_blocked: number
    block_rate: number
    avg_latency_ms: number
  }
  daily: DailyStats[]
  gates: GateStats[]
  recent_blocks: RecentBlock[]
}

// GET /agents/:id/analytics - Get agent analytics
agentsRoutes.get('/:id/analytics', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')

  const query = c.req.query()
  const parsed = analyticsQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Verify ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Calculate date range
  const days = parseInt(parsed.data.days || '7', 10)
  const endDate = parsed.data.end_date || new Date().toISOString().split('T')[0]
  const startDate =
    parsed.data.start_date ||
    (() => {
      const d = new Date(endDate)
      d.setDate(d.getDate() - days + 1)
      return d.toISOString().split('T')[0]
    })()

  // Query agent_events
  const { data: events, error: eventsError } = await supabase
    .from('agent_events')
    .select('id, created_at, claw_blocked, claw_gate, latency_ms')
    .eq('agent_id', agentId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)

  if (eventsError) {
    console.error('Analytics query error:', eventsError)
    throw Errors.database('Failed to fetch analytics')
  }

  // Process daily stats
  const dailyMap = new Map<string, { requests: number; blocked: number; totalLatency: number }>()

  // Initialize all dates in range
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dailyMap.set(current.toISOString().split('T')[0], {
      requests: 0,
      blocked: 0,
      totalLatency: 0,
    })
    current.setDate(current.getDate() + 1)
  }

  // Aggregate events by date
  const gateMap = new Map<string, number>()
  const recentBlocks: RecentBlock[] = []

  for (const event of events || []) {
    const date = event.created_at.split('T')[0]
    const stats = dailyMap.get(date)
    if (stats) {
      stats.requests++
      if (event.claw_blocked) {
        stats.blocked++
        // Track gate stats
        if (event.claw_gate) {
          const gateName = event.claw_gate.split(':')[0]
          gateMap.set(gateName, (gateMap.get(gateName) || 0) + 1)
        }
      }
      stats.totalLatency += event.latency_ms || 0
    }
  }

  // Get recent blocks (last 10)
  const blockedEvents = (events || [])
    .filter((e) => e.claw_blocked)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  for (const event of blockedEvents) {
    recentBlocks.push({
      id: event.id,
      gate: event.claw_gate?.split(':')[0] || 'unknown',
      created_at: event.created_at,
    })
  }

  // Build daily array
  const daily: DailyStats[] = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      requests: stats.requests,
      blocked: stats.blocked,
      avg_latency_ms: stats.requests > 0 ? Math.round(stats.totalLatency / stats.requests) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Build gates array
  const gates: GateStats[] = Array.from(gateMap.entries())
    .map(([gate, blocked]) => ({ gate, blocked }))
    .sort((a, b) => b.blocked - a.blocked)

  // Calculate summary
  const totalRequests = daily.reduce((sum, d) => sum + d.requests, 0)
  const totalBlocked = daily.reduce((sum, d) => sum + d.blocked, 0)
  const totalLatency = daily.reduce((sum, d) => sum + d.avg_latency_ms * d.requests, 0)

  const response: AnalyticsResponse = {
    summary: {
      total_requests: totalRequests,
      total_blocked: totalBlocked,
      block_rate:
        totalRequests > 0 ? parseFloat(((totalBlocked / totalRequests) * 100).toFixed(2)) : 0,
      avg_latency_ms: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
    },
    daily,
    gates,
    recent_blocks: recentBlocks,
  }

  return c.json(response)
})

// ============================================
// ANALYTICS V2 - Adaptive Analytics
// ============================================

// V2 Response types
interface LayerStats {
  layer: string
  total_checks: number
  blocked_count: number
}

interface ToolStats {
  tool_type: string
  total_calls: number
  success_count: number
  avg_latency_ms: number
}

interface SocialStats {
  platform: string
  total_deliveries: number
  success_count: number
  failure_count: number
}

interface DeFiStats {
  operation: string
  total_transactions: number
  blocked_count: number
  total_value_usd: number
}

interface MemoryStats {
  reads: number
  writes: number
  shield_blocks: number
}

interface TokenStats {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

// Phase 4: Enhanced Analytics Types
interface GateBreakdown {
  gate: string
  count: number
  percentage: number
}

interface LatencyPercentiles {
  p50: number
  p75: number
  p95: number
  p99: number
  max: number
  distribution: Array<{ bucket: string; count: number }>
}

interface AgentCapabilities {
  templateId: string
  framework: string
  hasSocialOutputs: boolean
  hasDeFiOperations: boolean
  hasMultiAgent: boolean
  hasMemory: boolean
  hasTools: boolean
  hasCodeExecution: boolean
  hasL4Observer: boolean
}

interface AnalyticsResponseV2 {
  summary: {
    total_requests: number
    total_blocked: number
    block_rate: number
    avg_latency_ms: number
  }
  daily: DailyStats[]
  layers: LayerStats[]
  recent_blocks: Array<{
    id: string
    layer: string
    gate: string
    created_at: string
  }>
  tokens: TokenStats
  capabilities: AgentCapabilities
  // Phase 4: Enhanced Analytics
  gate_breakdown: GateBreakdown[]
  latency_percentiles: LatencyPercentiles
  // Conditional sections
  tools?: ToolStats[]
  social?: SocialStats[]
  defi?: DeFiStats[]
  memory?: MemoryStats
}

// Detect agent capabilities from framework and flow
// Export for testing
export function detectCapabilities(agent: {
  framework: string
  config?: { template_id?: string }
  flow?: { nodes?: Array<{ type?: string; data?: Record<string, unknown> }> }
}): AgentCapabilities {
  const nodes = (agent.flow?.nodes || []) as Array<{
    type?: string
    data?: { outputType?: string; toolType?: string; memoryType?: string; layerType?: string }
  }>
  const framework = agent.framework || 'custom'

  // Template-based defaults
  const isDeFi = ['coinbase_agentkit', 'solana_agent_kit', 'virtuals_protocol'].includes(framework)
  const isSocial = framework === 'elizaos'
  const isMultiAgent = ['openai_agents', 'google_adk'].includes(framework)

  // Flow-based detection (overrides)
  const hasSocialOutputs =
    isSocial ||
    nodes.some((n) =>
      ['twitter_post', 'discord_message', 'telegram_message'].includes(n.data?.outputType || '')
    )

  const hasTools = nodes.some((n) => n.type === 'tool')

  const hasCodeExecution = nodes.some(
    (n) => n.type === 'tool' && n.data?.toolType === 'code_execution'
  )

  const hasMemory =
    nodes.some((n) => n.data?.memoryType) || ['elizaos', 'virtuals_protocol'].includes(framework)

  const hasL4Observer = nodes.some((n) => n.data?.layerType === 'observer')

  return {
    templateId: agent.config?.template_id || framework,
    framework,
    hasSocialOutputs,
    hasDeFiOperations: isDeFi,
    hasMultiAgent: isMultiAgent,
    hasMemory,
    hasTools,
    hasCodeExecution,
    hasL4Observer,
  }
}

// GET /agents/:id/analytics/v2 - Adaptive analytics
agentsRoutes.get('/:id/analytics/v2', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')

  const query = c.req.query()
  const parsed = analyticsQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Get agent with full metadata
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, framework, config, flow, claw_config')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Detect capabilities
  const capabilities = detectCapabilities(
    agent as {
      framework: string
      config?: { template_id?: string }
      flow?: { nodes?: Array<{ type?: string; data?: Record<string, unknown> }> }
    }
  )

  // Calculate date range
  const days = parseInt(parsed.data.days || '7', 10)
  const endDate = parsed.data.end_date || new Date().toISOString().split('T')[0]
  const startDate =
    parsed.data.start_date ||
    (() => {
      const d = new Date(endDate)
      d.setDate(d.getDate() - days + 1)
      return d.toISOString().split('T')[0]
    })()

  // Get base analytics from agent_events
  const { data: events, error: eventsError } = await supabase
    .from('agent_events')
    .select(
      'id, created_at, claw_blocked, claw_gate, claw_layer, latency_ms, input_tokens, output_tokens'
    )
    .eq('agent_id', agentId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)

  if (eventsError) {
    console.error('Analytics v2 query error:', eventsError)
    throw Errors.database('Failed to fetch analytics')
  }

  // Process daily stats
  const dailyMap = new Map<string, { requests: number; blocked: number; totalLatency: number }>()
  const current = new Date(startDate)
  const end = new Date(endDate)
  while (current <= end) {
    dailyMap.set(current.toISOString().split('T')[0], { requests: 0, blocked: 0, totalLatency: 0 })
    current.setDate(current.getDate() + 1)
  }

  // Aggregate
  const layerMap = new Map<string, { total: number; blocked: number }>()
  const recentBlocks: Array<{ id: string; layer: string; gate: string; created_at: string }> = []
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Phase 4: Gate breakdown and latency tracking
  const gateCountMap = new Map<string, number>()
  const latencyValues: number[] = []

  for (const event of events || []) {
    const date = event.created_at.split('T')[0]
    const stats = dailyMap.get(date)
    if (stats) {
      stats.requests++
      if (event.claw_blocked) {
        stats.blocked++
      }
      stats.totalLatency += event.latency_ms || 0
    }

    // Layer stats
    const layer = event.claw_layer || (event.claw_blocked ? 'L1_input' : null)
    if (layer) {
      const layerStats = layerMap.get(layer) || { total: 0, blocked: 0 }
      layerStats.total++
      if (event.claw_blocked) {
        layerStats.blocked++
      }
      layerMap.set(layer, layerStats)
    }

    // Phase 4: Gate breakdown - track CLAW gates
    if (event.claw_blocked && event.claw_gate) {
      const gateName = event.claw_gate.split(':')[0].toLowerCase()
      // Normalize to CLAW gates
      const normalizedGate = ['credibility', 'avoidance', 'limits', 'worth'].includes(gateName)
        ? gateName
        : 'other'
      gateCountMap.set(normalizedGate, (gateCountMap.get(normalizedGate) || 0) + 1)
    }

    // Phase 4: Collect latency values for percentile calculation
    if (event.latency_ms && event.latency_ms > 0) {
      latencyValues.push(event.latency_ms)
    }

    // Token stats
    totalInputTokens += event.input_tokens || 0
    totalOutputTokens += event.output_tokens || 0
  }

  // Recent blocks
  const blockedEvents = (events || [])
    .filter((e) => e.claw_blocked)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  for (const event of blockedEvents) {
    recentBlocks.push({
      id: event.id,
      layer: event.claw_layer || 'L1_input',
      gate: event.claw_gate?.split(':')[0] || 'unknown',
      created_at: event.created_at,
    })
  }

  // Build daily array
  const daily: DailyStats[] = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      requests: stats.requests,
      blocked: stats.blocked,
      avg_latency_ms: stats.requests > 0 ? Math.round(stats.totalLatency / stats.requests) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Build layers array
  const layers: LayerStats[] = Array.from(layerMap.entries())
    .map(([layer, stats]) => ({
      layer,
      total_checks: stats.total,
      blocked_count: stats.blocked,
    }))
    .sort((a, b) => b.blocked_count - a.blocked_count)

  // Phase 4: Build gate breakdown
  const totalGateBlocks = Array.from(gateCountMap.values()).reduce((sum, count) => sum + count, 0)
  const gateBreakdown: GateBreakdown[] = Array.from(gateCountMap.entries())
    .map(([gate, count]) => ({
      gate,
      count,
      percentage:
        totalGateBlocks > 0 ? parseFloat(((count / totalGateBlocks) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Phase 4: Calculate latency percentiles
  const calculatePercentile = (sortedArr: number[], percentile: number): number => {
    if (sortedArr.length === 0) return 0
    const index = Math.ceil((percentile / 100) * sortedArr.length) - 1
    return sortedArr[Math.max(0, index)]
  }

  // Sort latency values for percentile calculation
  const sortedLatencies = [...latencyValues].sort((a, b) => a - b)

  // Create distribution buckets (0-100, 100-250, 250-500, 500-1000, 1000-2500, 2500+)
  const latencyBuckets = [
    { min: 0, max: 100, label: '0-100ms' },
    { min: 100, max: 250, label: '100-250ms' },
    { min: 250, max: 500, label: '250-500ms' },
    { min: 500, max: 1000, label: '500ms-1s' },
    { min: 1000, max: 2500, label: '1-2.5s' },
    { min: 2500, max: Infinity, label: '2.5s+' },
  ]

  const latencyDistribution = latencyBuckets.map((bucket) => ({
    bucket: bucket.label,
    count: latencyValues.filter((v) => v >= bucket.min && v < bucket.max).length,
  }))

  const latencyPercentiles: LatencyPercentiles = {
    p50: calculatePercentile(sortedLatencies, 50),
    p75: calculatePercentile(sortedLatencies, 75),
    p95: calculatePercentile(sortedLatencies, 95),
    p99: calculatePercentile(sortedLatencies, 99),
    max: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0,
    distribution: latencyDistribution,
  }

  // Calculate summary
  const totalRequests = daily.reduce((sum, d) => sum + d.requests, 0)
  const totalBlocked = daily.reduce((sum, d) => sum + d.blocked, 0)
  const totalLatency = daily.reduce((sum, d) => sum + d.avg_latency_ms * d.requests, 0)

  // Token stats
  const tokens: TokenStats = {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    total_tokens: totalInputTokens + totalOutputTokens,
  }

  // Conditional: Tool stats
  let tools: ToolStats[] | undefined
  if (capabilities.hasTools) {
    const { data: toolData } = await supabase.rpc('get_tool_usage_stats', {
      p_agent_id: agentId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (toolData && toolData.length > 0) {
      tools = toolData.map(
        (t: {
          tool_type: string
          total_calls: number
          success_count: number
          avg_latency_ms: number
        }) => ({
          tool_type: t.tool_type,
          total_calls: Number(t.total_calls),
          success_count: Number(t.success_count),
          avg_latency_ms: Number(t.avg_latency_ms) || 0,
        })
      )
    }
  }

  // Conditional: Social stats
  let social: SocialStats[] | undefined
  if (capabilities.hasSocialOutputs) {
    const { data: socialData } = await supabase.rpc('get_social_stats', {
      p_agent_id: agentId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (socialData && socialData.length > 0) {
      social = socialData.map(
        (s: {
          platform: string
          total_deliveries: number
          success_count: number
          failure_count: number
        }) => ({
          platform: s.platform,
          total_deliveries: Number(s.total_deliveries),
          success_count: Number(s.success_count),
          failure_count: Number(s.failure_count),
        })
      )
    }
  }

  // Conditional: DeFi stats
  let defi: DeFiStats[] | undefined
  if (capabilities.hasDeFiOperations) {
    const { data: defiData } = await supabase.rpc('get_defi_stats', {
      p_agent_id: agentId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (defiData && defiData.length > 0) {
      defi = defiData.map(
        (d: {
          operation: string
          total_transactions: number
          blocked_count: number
          total_value_usd: number
        }) => ({
          operation: d.operation,
          total_transactions: Number(d.total_transactions),
          blocked_count: Number(d.blocked_count),
          total_value_usd: Number(d.total_value_usd) || 0,
        })
      )
    }
  }

  // Conditional: Memory stats
  let memory: MemoryStats | undefined
  if (capabilities.hasMemory) {
    const { data: memoryData } = await supabase.rpc('get_memory_stats', {
      p_agent_id: agentId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (memoryData && memoryData.length > 0) {
      memory = {
        reads: 0,
        writes: 0,
        shield_blocks: 0,
      }
      for (const m of memoryData as Array<{ operation: string; total_count: number }>) {
        if (m.operation === 'read') memory.reads = Number(m.total_count)
        else if (m.operation === 'write') memory.writes = Number(m.total_count)
        else if (m.operation === 'shield_block') memory.shield_blocks = Number(m.total_count)
      }
    }
  }

  const response: AnalyticsResponseV2 = {
    summary: {
      total_requests: totalRequests,
      total_blocked: totalBlocked,
      block_rate:
        totalRequests > 0 ? parseFloat(((totalBlocked / totalRequests) * 100).toFixed(2)) : 0,
      avg_latency_ms: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
    },
    daily,
    layers,
    recent_blocks: recentBlocks,
    tokens,
    capabilities,
    // Phase 4: Enhanced Analytics
    gate_breakdown: gateBreakdown,
    latency_percentiles: latencyPercentiles,
    // Conditional sections
    tools,
    social,
    defi,
    memory,
  }

  return c.json(response)
})

// GET /agents/:id - Get single agent
agentsRoutes.get('/:id', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')

  const supabase = await getUserClient(c.env, wallet)

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !data) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  return c.json(data)
})

// POST /agents - Create new agent
agentsRoutes.post('/', async (c) => {
  const wallet = c.get('wallet')
  const plan = c.get('plan')

  const body = await c.req.json()
  const parsed = createAgentSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Check for duplicate name
  const { data: existingAgent } = await supabase
    .from('agents')
    .select('id')
    .eq('wallet_address', wallet)
    .eq('name', parsed.data.name)
    .neq('status', 'archived')
    .maybeSingle()

  if (existingAgent) {
    return c.json(
      {
        error: `An agent with the name "${parsed.data.name}" already exists. Please choose a different name.`,
      },
      409
    )
  }

  // Check agent limit based on plan
  const { count } = await supabase
    .from('agents')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .neq('status', 'archived')

  const limits = { free: 3, starter: 10, pro: 50 }
  const limit = limits[plan as keyof typeof limits] || 3

  if ((count || 0) >= limit) {
    return c.json(
      {
        error: `Agent limit reached. Upgrade to create more agents. (${count}/${limit})`,
      },
      403
    )
  }

  // Build claw config with modules
  const clawConfig = {
    protection_level: parsed.data.claw_config?.protection_level || 'standard',
    gates: parsed.data.claw_config?.gates || {
      credibility: true,
      avoidance: true,
      limits: true,
      worth: true,
    },
    modules: parsed.data.claw_config?.modules || {
      input_validator: { enabled: true },
      output_validator: { enabled: true },
    },
    sdk_version: 'auto',
  }

  const { data, error } = await supabase
    .from('agents')
    .insert({
      wallet_address: wallet,
      name: parsed.data.name,
      description: parsed.data.description || null,
      framework: parsed.data.framework,
      icon: parsed.data.icon,
      flow: parsed.data.flow || { nodes: [], edges: [] },
      config: parsed.data.config || {},
      claw_config: clawConfig,
      integration_config: parsed.data.integration_config || {},
    })
    .select()
    .single()

  if (error) {
    console.error('Create agent error:', error)
    throw Errors.database('Failed to create agent')
  }

  // Check flow protection status for warnings
  const protection = parsed.data.flow ? validateFlowProtection(parsed.data.flow) : null

  return c.json(
    {
      ...data,
      ...(protection?.warnings?.length ? { warnings: protection.warnings } : {}),
    },
    201
  )
})

// PATCH /agents/:id - Update agent
agentsRoutes.patch('/:id', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')

  const body = await c.req.json()
  const parsed = updateAgentSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Check for duplicate name if name is being updated
  if (parsed.data.name !== undefined) {
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('wallet_address', wallet)
      .eq('name', parsed.data.name)
      .neq('id', agentId)
      .neq('status', 'archived')
      .maybeSingle()

    if (existingAgent) {
      return c.json(
        {
          error: `An agent with the name "${parsed.data.name}" already exists. Please choose a different name.`,
        },
        409
      )
    }
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description
  if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon
  if (parsed.data.flow !== undefined) updateData.flow = parsed.data.flow
  if (parsed.data.config !== undefined) updateData.config = parsed.data.config
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status
  if (parsed.data.integration_config !== undefined)
    updateData.integration_config = parsed.data.integration_config

  // Handle claw_config partial update
  if (parsed.data.claw_config) {
    const { data: existing } = await supabase
      .from('agents')
      .select('claw_config')
      .eq('id', agentId)
      .eq('wallet_address', wallet)
      .single()

    if (existing) {
      updateData.claw_config = {
        ...existing.claw_config,
        ...parsed.data.claw_config,
        gates: {
          ...existing.claw_config.gates,
          ...(parsed.data.claw_config.gates || {}),
        },
      }
    }
  }

  const { data, error } = await supabase
    .from('agents')
    .update(updateData)
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .select()
    .single()

  if (error) {
    console.error('Update agent error:', error)
    throw Errors.database('Failed to update agent')
  }

  if (!data) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Check flow protection status for warnings (only when flow is updated)
  const protection = parsed.data.flow ? validateFlowProtection(parsed.data.flow) : null

  return c.json({
    ...data,
    ...(protection?.warnings?.length ? { warnings: protection.warnings } : {}),
  })
})

// DELETE /agents/:id - Delete agent (soft delete by archiving)
agentsRoutes.delete('/:id', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')

  const supabase = await getUserClient(c.env, wallet)

  // Soft delete by setting status to archived
  const { error } = await supabase
    .from('agents')
    .update({ status: 'archived' })
    .eq('id', agentId)
    .eq('wallet_address', wallet)

  if (error) {
    console.error('Delete agent error:', error)
    throw Errors.database('Failed to delete agent')
  }

  return c.json({ success: true })
})

// POST /agents/:id/export-code - Export agent as downloadable code project
agentsRoutes.post('/:id/export-code', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')

  const supabase = await getUserClient(c.env, wallet)

  // Fetch the agent
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Import code generator dynamically
  const { hasExportSupport, exportAgentAsZip, getSupportedFrameworks } =
    await import('../services/code-generator')

  // Check if framework is supported
  if (!hasExportSupport(agent.framework)) {
    return c.json(
      {
        error: `Export not supported for framework: ${agent.framework}`,
        supported_frameworks: getSupportedFrameworks(),
      },
      400
    )
  }

  try {
    // Generate the ZIP file
    const { buffer, filename } = await exportAgentAsZip(agent, {
      includeFlow: true,
    })

    // Return ZIP file (Uint8Array is directly supported by Response)
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('Export code error:', err)
    return c.json({ error: err instanceof Error ? err.message : 'Failed to export code' }, 500)
  }
})

// Test message schema
const testMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  flow: z
    .object({
      nodes: z.array(z.any()).optional(),
      edges: z.array(z.any()).optional(),
    })
    .optional(),
})

// POST /agents/:id/test - Test agent with a message
// Optional X-LLM-Key header for BYOK (user's own LLM key)
agentsRoutes.post('/:id/test', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('id')
  const userLlmKey = c.req.header('X-LLM-Key') // BYOK support

  const body = await c.req.json()
  const parsed = testMessageSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Get agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  const { message, flow } = parsed.data
  const agentFlow = flow || agent.flow
  const clawConfig = agent.claw_config

  // Check and deduct credits before execution
  const cost = userLlmKey ? COST_PER_EXECUTION_BYOK : COST_PER_EXECUTION
  const creditResult = await deductCredits(supabase, wallet, cost)

  if (!creditResult.success) {
    const errorCode = creditResult.error || 'INSUFFICIENT_CREDITS'
    const errorMessage =
      errorCode === 'NO_CREDITS_ACCOUNT'
        ? 'No credits account found. Please deposit credits to continue.'
        : 'Insufficient credits. Please deposit more credits to continue.'

    return c.json(
      {
        error: errorMessage,
        code: errorCode,
        balance_usd: creditResult.new_balance,
        required_usd: cost,
        hint: 'Deposit credits at /credits/deposit',
        pricing: {
          cost_per_execution: cost,
          minimum_deposit: 3.0,
        },
      },
      402
    )
  }

  const balanceBefore = creditResult.balance_before
  let balanceAfter = creditResult.new_balance

  // Build character prompt if agent has character config
  const characterConfig = agent.config?.character as CharacterConfig | undefined
  const characterPrompt = characterConfig ? buildCharacterPrompt(characterConfig) : undefined

  // Use centralized execute() function
  // Priority: Modal (with user key) > User key direct > Server key > Simulation
  const executionOptions: ExecutionOptions = {
    modalEndpoint: c.env.MODAL_RUNTIME_URL,
    openaiKey: c.env.OPENAI_API_KEY,
    userLlmKey,
    flow: agentFlow,
    message,
    clawConfig,
    llmConfig: extractLLMConfig(agentFlow),
    characterPrompt,
    // Tool credentials for test endpoint (using agent's wallet)
    toolCredentials: {
      supabase,
      walletAddress: agent.wallet_address,
      serverSecret: c.env.JWT_SECRET,
    },
    // Social context for test endpoint
    socialContext: {
      supabase,
      agentId,
      agentName: agent.name,
      serverSecret: c.env.JWT_SECRET,
    },
  }

  let result: ExecutionResult
  let refunded = false
  let refundAmount = 0

  try {
    result = await execute(executionOptions)
  } catch (execError) {
    // Execution threw — refund credits (system failure, not GuardianClaw block)
    const refundResult = await refundCredits(
      supabase,
      wallet,
      cost,
      `Execution error: ${execError instanceof Error ? execError.message : 'unknown'}`
    )

    return c.json(
      {
        blocked: false,
        response: null,
        error: 'Execution failed — credits have been refunded',
        refunded: true,
        refund_amount: cost,
        credits: {
          cost: 0,
          balance_after: refundResult.new_balance || balanceBefore,
        },
      },
      500
    )
  }

  // Refund on internal execution errors (not GuardianClaw blocks — those are expected behavior)
  const isGuardianClawBlock =
    result.blocked &&
    (result.gate === 'credibility' ||
      result.gate === 'avoidance' ||
      result.gate === 'limits' ||
      result.gate === 'worth' ||
      result.gate?.startsWith('claw_'))

  if (result.blocked && !isGuardianClawBlock && result.gate === 'execution_error') {
    const refundResult = await refundCredits(
      supabase,
      wallet,
      cost,
      `Blocked by ${result.gate}: ${result.reason || 'execution error'}`
    )
    if (refundResult.success) {
      refunded = true
      refundAmount = cost
      // Update balance after refund
      balanceAfter = refundResult.new_balance
    }
  }

  // Determine runtime for response (informational only)
  let runtime = 'simulation'
  if (c.env.MODAL_RUNTIME_URL) {
    runtime = userLlmKey ? 'modal+byok' : 'modal'
  } else if (userLlmKey) {
    runtime = 'openai+byok'
  } else if (c.env.OPENAI_API_KEY) {
    runtime = 'openai'
  }

  // Log the test event with v2 analytics fields + credit tracking
  // Provide token estimates when actual counts are unavailable (sandbox/simulation mode)
  const analyticsFields = extractAnalyticsFields(agentId, 'test', result, {
    inputTokensEstimate: Math.ceil(message.length / 4),
    outputTokensEstimate: result.response ? Math.ceil(result.response.length / 4) : 0,
  })
  await supabase.from('agent_events').insert({
    ...analyticsFields,
    cost_usd: refunded ? 0 : cost,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
  })

  // Log execution with trace for debugging (non-blocking)
  logExecution({
    supabase,
    agentId,
    eventSource: 'test',
    inputText: message,
    result,
  }).catch((err) => console.error('Failed to log execution:', err))

  // Check flow protection status
  const protection = validateFlowProtection(agentFlow)

  return c.json({
    blocked: result.blocked,
    response: result.blocked
      ? `Request blocked by GuardianClaw (${result.reason || 'validation failed'})`
      : result.response,
    reason: result.reason,
    gate: result.gate,
    violations: result.violations,
    claw: result.claw,
    latency_ms: result.latency_ms,
    runtime,
    trace: result.trace,
    toolResults: result.toolResults,
    socialDeliveries: result.socialDeliveries,
    credits: {
      cost: refunded ? 0 : cost,
      balance_after: balanceAfter,
    },
    ...(refunded ? { refunded: true, refund_amount: refundAmount } : {}),
    ...(protection.warnings.length > 0 ? { protection_warnings: protection.warnings } : {}),
  })
})
