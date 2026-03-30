const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

interface ApiOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Status codes that are safe to retry (transient server errors)
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504])

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const token = typeof window !== 'undefined' ? localStorage.getItem('claw_token') : null

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }

  let lastError: unknown

  // Try up to 2 times (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, config)

      // Retry on transient server errors (but not on 4xx)
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt === 0) {
        lastError = new ApiError(response.status, `Server error (${response.status}), retrying...`)
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }

      if (!response.ok) {
        // Clear expired/invalid token on 401 to prevent stale auth state
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('claw_token')
            window.dispatchEvent(new Event('claw:token-expired'))
          }
        }
        const errorData = await response.json().catch(() => ({}))
        throw new ApiError(
          response.status,
          errorData.error || `Request failed with status ${response.status}`,
          errorData.details
        )
      }

      return response.json()
    } catch (err) {
      // Retry on network errors (TypeError from fetch), but not ApiErrors
      if (err instanceof TypeError && attempt === 0) {
        lastError = err
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      throw err
    }
  }

  // If we exhausted retries, throw the last error
  throw lastError
}

// Agent types
export interface Agent {
  id: string
  wallet_address: string
  name: string
  description: string | null
  icon: string
  framework: string
  flow: {
    nodes: unknown[]
    edges: unknown[]
  }
  config: Record<string, unknown>
  claw_config: {
    protection_level: 'minimal' | 'standard' | 'maximum'
    gates: {
      credibility: boolean
      avoidance: boolean
      limits: boolean
      worth: boolean
    }
    modules?: Record<string, { enabled: boolean }>
    sdk_version: string
  }
  integration_config?: Record<string, unknown>
  status: 'draft' | 'testing' | 'deployed' | 'archived'
  version: number
  created_at: string
  updated_at: string
}

export interface CreateAgentInput {
  name: string
  description?: string
  framework?: string
  icon?: string
  flow?: { nodes: unknown[]; edges: unknown[] }
  config?: Record<string, unknown>
  claw_config?: {
    protection_level: string
    gates?: {
      credibility: boolean
      avoidance: boolean
      limits: boolean
      worth: boolean
    }
    modules?: Record<string, { enabled: boolean }>
  }
  integration_config?: Record<string, unknown>
}

export interface UpdateAgentInput {
  name?: string
  description?: string
  icon?: string
  flow?: { nodes: unknown[]; edges: unknown[] }
  config?: Record<string, unknown>
  claw_config?: Partial<Agent['claw_config']>
  integration_config?: Record<string, unknown>
  status?: Agent['status']
}

// Execution trace types
export interface ExecutionStepTrace {
  step_id: string
  step_name: string
  step_type: string
  category: string
  status: 'success' | 'error' | 'skipped'
  duration_ms: number
  error?: string
  metadata?: Record<string, unknown>
}

export interface ExecutionTrace {
  steps: ExecutionStepTrace[]
  total_steps: number
  completed_steps: number
  failed_step?: string
}

// Test result type
export interface TestResult {
  response: string | null
  blocked: boolean
  reason?: string
  gate?: string
  violations?: string[]
  claw?: {
    input?: { passed: boolean; violations: string[] }
    output?: { passed: boolean; violations: string[] }
    stats?: Record<string, number>
  }
  latency_ms?: number
  runtime?: string
  trace?: ExecutionTrace
}

// Analytics types
export interface DailyStats {
  date: string
  requests: number
  blocked: number
  avg_latency_ms: number
}

export interface GateStats {
  gate: string
  blocked: number
}

export interface RecentBlock {
  id: string
  gate: string
  created_at: string
}

export interface AnalyticsResponse {
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

export interface AnalyticsQuery {
  start_date?: string
  end_date?: string
  days?: number
}

// Analytics V2 types (adaptive analytics with layer tracking)
export interface LayerStats {
  layer: string
  total_checks: number
  blocked_count: number
}

export interface ToolStats {
  tool_type: string
  total_calls: number
  success_count: number
  avg_latency_ms: number
}

export interface SocialStats {
  platform: string
  total_deliveries: number
  success_count: number
  failure_count: number
}

export interface DeFiStats {
  operation: string
  total_transactions: number
  blocked_count: number
  total_value_usd: number
}

export interface MemoryStats {
  reads: number
  writes: number
  shield_blocks: number
}

// Phase 4: Enhanced Analytics Types
export interface GateBreakdown {
  gate: string
  count: number
  percentage: number
}

export interface LatencyPercentiles {
  p50: number
  p75: number
  p95: number
  p99: number
  max: number
  distribution: Array<{ bucket: string; count: number }>
}

export interface TokenStats {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface AgentCapabilities {
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

export interface RecentBlockV2 {
  id: string
  layer: string
  gate: string
  created_at: string
}

export interface AnalyticsResponseV2 {
  summary: {
    total_requests: number
    total_blocked: number
    block_rate: number
    avg_latency_ms: number
  }
  daily: DailyStats[]
  layers: LayerStats[]
  recent_blocks: RecentBlockV2[]
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

// Conversation types
export type MemoryStrategy = 'sliding_window' | 'summary' | 'full' | 'none'
export type ConversationStatus = 'active' | 'archived' | 'deleted'

export interface Conversation {
  id: string
  agent_id: string
  title: string | null
  status: ConversationStatus
  memory_strategy: MemoryStrategy
  context_window: number
  message_count: number
  total_tokens: number
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  position: number
  input_tokens: number | null
  output_tokens: number | null
  blocked: boolean
  blocked_reason: string | null
  blocked_gate: string | null
  latency_ms: number | null
  model_used: string | null
  created_at: string
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[]
}

export interface CreateConversationInput {
  title?: string
  memory_strategy?: MemoryStrategy
  context_window?: number
}

export interface UpdateConversationInput {
  title?: string
  status?: 'active' | 'archived'
  memory_strategy?: MemoryStrategy
  context_window?: number
}

export interface SendMessageInput {
  content: string
  flow?: { nodes: unknown[]; edges: unknown[] }
  llmApiKey?: string // User's decrypted LLM API key for BYOK
}

export interface ConversationMessageResponse {
  user_message: ConversationMessage
  assistant_message: ConversationMessage | null
  blocked: boolean
  response: string | null
  reason?: string
  gate?: string
  claw?: {
    input?: { passed: boolean; violations: string[] }
    output?: { passed: boolean; violations: string[] }
  }
  latency_ms: number
  trace?: ExecutionTrace
}

export interface ConversationsListResponse {
  conversations: Conversation[]
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface ListConversationsQuery {
  status?: 'active' | 'archived' | 'all'
  limit?: number
  offset?: number
}

// Test options for BYOK support
export interface TestOptions {
  flow?: { nodes: unknown[]; edges: unknown[] }
  llmApiKey?: string // User's decrypted LLM API key for BYOK
}

// Execution logs types
export interface ExecutionLogEntry {
  id: string
  event_source: 'invoke' | 'conversation' | 'webhook' | 'test'
  conversation_id: string | null
  status: 'success' | 'blocked' | 'error'
  input_preview: string | null
  output_preview: string | null
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  blocked_by_layer: 'L1' | 'L3' | 'L4' | null
  blocked_gate: string | null
  blocked_reason: string | null
  trace: ExecutionStepTrace[]
  tools_executed: number
  tools_succeeded: number
  social_deliveries: number
  social_succeeded: number
  model: string | null
  request_id: string | null
  created_at: string
}

export interface ExecutionLogsResponse {
  logs: ExecutionLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface ExecutionLogsQuery {
  limit?: number
  offset?: number
  status?: 'success' | 'blocked' | 'error'
  event_source?: 'invoke' | 'conversation' | 'webhook' | 'test'
  start_date?: string
  end_date?: string
}

export interface HealthStats {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  agent_status: string
  stats: {
    total_executions: number
    successful_executions: number
    blocked_executions: number
    error_executions: number
    success_rate: number
    avg_latency_ms: number | null
    last_execution_at: string | null
    last_success_at: string | null
    last_error_at: string | null
  }
}

// Agent API functions
export const agentsApi = {
  list: () => api<Agent[]>('/agents'),

  get: (id: string) => api<Agent>(`/agents/${id}`),

  create: (data: CreateAgentInput) => api<Agent>('/agents', { method: 'POST', body: data }),

  update: (id: string, data: UpdateAgentInput) =>
    api<Agent>(`/agents/${id}`, { method: 'PATCH', body: data }),

  delete: (id: string) => api<{ success: boolean }>(`/agents/${id}`, { method: 'DELETE' }),

  test: (id: string, message: string, options?: TestOptions) => {
    const headers: Record<string, string> = {}
    if (options?.llmApiKey) {
      headers['X-LLM-Key'] = options.llmApiKey
    }
    return api<TestResult>(`/agents/${id}/test`, {
      method: 'POST',
      body: { message, flow: options?.flow },
      headers,
    })
  },

  analytics: (id: string, query?: AnalyticsQuery) => {
    const params = new URLSearchParams()
    if (query?.start_date) params.set('start_date', query.start_date)
    if (query?.end_date) params.set('end_date', query.end_date)
    if (query?.days) params.set('days', query.days.toString())

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${id}/analytics?${queryString}`
      : `/agents/${id}/analytics`

    return api<AnalyticsResponse>(endpoint)
  },

  analyticsV2: (id: string, query?: AnalyticsQuery) => {
    const params = new URLSearchParams()
    if (query?.start_date) params.set('start_date', query.start_date)
    if (query?.end_date) params.set('end_date', query.end_date)
    if (query?.days) params.set('days', query.days.toString())

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${id}/analytics/v2?${queryString}`
      : `/agents/${id}/analytics/v2`

    return api<AnalyticsResponseV2>(endpoint)
  },

  exportCode: async (id: string): Promise<{ blob: Blob; filename: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('claw_token') : null

    const response = await fetch(`${API_URL}/agents/${id}/export-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        errorData.error || `Export failed with status ${response.status}`,
        errorData.details
      )
    }

    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'agent-export.zip'
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/)
      if (match) {
        filename = match[1]
      }
    }

    const blob = await response.blob()
    return { blob, filename }
  },
}

// Conversations API functions
export const conversationsApi = {
  /** List conversations for an agent */
  list: (agentId: string, query?: ListConversationsQuery) => {
    const params = new URLSearchParams()
    if (query?.status) params.set('status', query.status)
    if (query?.limit) params.set('limit', query.limit.toString())
    if (query?.offset) params.set('offset', query.offset.toString())

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/conversations?${queryString}`
      : `/agents/${agentId}/conversations`

    return api<ConversationsListResponse>(endpoint)
  },

  /** Get a specific conversation with messages */
  get: (agentId: string, conversationId: string) =>
    api<ConversationDetail>(`/agents/${agentId}/conversations/${conversationId}`),

  /** Create a new conversation */
  create: (agentId: string, data?: CreateConversationInput) =>
    api<Conversation>(`/agents/${agentId}/conversations`, {
      method: 'POST',
      body: data || {},
    }),

  /** Update a conversation */
  update: (agentId: string, conversationId: string, data: UpdateConversationInput) =>
    api<Conversation>(`/agents/${agentId}/conversations/${conversationId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** Archive/delete a conversation */
  delete: (agentId: string, conversationId: string) =>
    api<{ success: boolean }>(`/agents/${agentId}/conversations/${conversationId}`, {
      method: 'DELETE',
    }),

  /** Send a message in a conversation */
  sendMessage: (agentId: string, conversationId: string, data: SendMessageInput) => {
    const headers: Record<string, string> = {}
    if (data.llmApiKey) {
      headers['X-LLM-Key'] = data.llmApiKey
    }
    // Don't send llmApiKey in body - only via header
    const { llmApiKey, ...bodyData } = data
    return api<ConversationMessageResponse>(
      `/agents/${agentId}/conversations/${conversationId}/messages`,
      { method: 'POST', body: bodyData, headers }
    )
  },
}

// Demo API functions (no auth required)
export const demoApi = {
  test: (
    message: string,
    flow: { nodes: unknown[]; edges: unknown[] },
    clawConfig?: {
      gates: { credibility: boolean; avoidance: boolean; limits: boolean; worth: boolean }
    }
  ) =>
    api<TestResult>('/demo/test', {
      method: 'POST',
      body: { message, flow, claw_config: clawConfig },
    }),
}

// Deploy types
export type Environment = 'dev' | 'staging' | 'prod'

export interface DeploymentInfo {
  id: string
  version: number
  status: 'running' | 'stopped' | 'failed'
  environment: Environment
  endpoint_url: string
  deployed_by?: string
  notes?: string | null
  rollback_from?: string | null
  promoted_from?: string | null
  created_at: string
}

export interface DeploymentHistoryEntry extends DeploymentInfo {
  config_snapshot?: Record<string, unknown>
  flow_snapshot?: Record<string, unknown>
  claw_snapshot?: Record<string, unknown>
  is_active?: boolean
  stopped_at?: string | null
}

export interface ApiKeyInfo {
  id: string
  name: string
  key_prefix: string
  rate_limit: number
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export interface EnvironmentDeployment {
  id: string
  version: number
  status: 'running' | 'stopped' | 'failed'
  endpoint_url: string
  deployed_by?: string
  notes?: string | null
  created_at: string
}

export interface DeployStatusResponse {
  deployed: boolean
  deployment: DeploymentInfo | null
  environments: {
    dev: EnvironmentDeployment | null
    staging: EnvironmentDeployment | null
    prod: EnvironmentDeployment | null
  }
  api_keys: ApiKeyInfo[]
}

export interface DeployResponse {
  success: boolean
  deployment_id: string
  endpoint_url: string
  environment: Environment
  api_key: string | null
  message: string
}

export interface CreateKeyResponse {
  success: boolean
  key_id: string
  api_key: string
  message: string
}

export interface DeployHistoryResponse {
  deployments: DeploymentHistoryEntry[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface EnvironmentStats {
  total_deployments: number
  active_deployment_id: string | null
  active_version: number | null
  last_deployment_at: string | null
  rollback_count: number
  promote_count: number
}

export interface DeployStatsResponse {
  agent_id: string
  stats: {
    dev: EnvironmentStats
    staging: EnvironmentStats
    prod: EnvironmentStats
  }
}

export interface RollbackResponse {
  success: boolean
  deployment_id: string
  rolled_back_from: string
  environment: Environment
  version: number
  message: string
}

export interface PromoteResponse {
  success: boolean
  deployment_id: string
  promoted_from: string
  source_environment: Environment
  target_environment: Environment
  version: number
  message: string
}

// Deploy API functions
export const deployApi = {
  /** Deploy an agent to an environment - returns API key (only shown once on first deploy) */
  deploy: (agentId: string, environment: Environment = 'prod', notes?: string) =>
    api<DeployResponse>(`/deploy/${agentId}`, {
      method: 'POST',
      body: { environment, notes },
    }),

  /** Stop a deployment in a specific environment */
  stop: (agentId: string, environment: Environment = 'prod') =>
    api<{ success: boolean; message: string; environment: Environment }>(
      `/deploy/${agentId}?environment=${environment}`,
      { method: 'DELETE' }
    ),

  /** Get deployment status and API keys */
  getStatus: (agentId: string) => api<DeployStatusResponse>(`/deploy/${agentId}`),

  /** Get deployment history with pagination */
  getHistory: (
    agentId: string,
    options?: { environment?: Environment; limit?: number; offset?: number }
  ) => {
    const params = new URLSearchParams()
    if (options?.environment) params.set('environment', options.environment)
    if (options?.limit) params.set('limit', options.limit.toString())
    if (options?.offset) params.set('offset', options.offset.toString())
    const query = params.toString()
    return api<DeployHistoryResponse>(`/deploy/${agentId}/history${query ? `?${query}` : ''}`)
  },

  /** Get deployment history detail */
  getHistoryDetail: (agentId: string, deploymentId: string) =>
    api<{ deployment: DeploymentHistoryEntry }>(`/deploy/${agentId}/history/${deploymentId}`),

  /** Get deployment statistics per environment */
  getStats: (agentId: string) => api<DeployStatsResponse>(`/deploy/${agentId}/stats`),

  /** Rollback to a previous deployment */
  rollback: (agentId: string, deploymentId: string, notes?: string) =>
    api<RollbackResponse>(`/deploy/${agentId}/rollback/${deploymentId}`, {
      method: 'POST',
      body: notes ? { notes } : undefined,
    }),

  /** Promote a deployment to another environment */
  promote: (
    agentId: string,
    sourceDeploymentId: string,
    targetEnvironment: 'staging' | 'prod',
    notes?: string
  ) =>
    api<PromoteResponse>(`/deploy/${agentId}/promote`, {
      method: 'POST',
      body: {
        source_deployment_id: sourceDeploymentId,
        target_environment: targetEnvironment,
        notes,
      },
    }),

  /** Generate additional API key */
  createKey: (agentId: string, name?: string) =>
    api<CreateKeyResponse>(`/deploy/${agentId}/keys`, {
      method: 'POST',
      body: { name },
    }),

  /** Revoke an API key */
  revokeKey: (agentId: string, keyId: string) =>
    api<{ success: boolean; message: string }>(`/deploy/${agentId}/keys/${keyId}`, {
      method: 'DELETE',
    }),
}

// Execution Logs API functions
export const executionLogsApi = {
  /** Get paginated execution logs for an agent */
  list: (agentId: string, query?: ExecutionLogsQuery) => {
    const params = new URLSearchParams()
    if (query?.limit) params.set('limit', query.limit.toString())
    if (query?.offset) params.set('offset', query.offset.toString())
    if (query?.status) params.set('status', query.status)
    if (query?.event_source) params.set('event_source', query.event_source)
    if (query?.start_date) params.set('start_date', query.start_date)
    if (query?.end_date) params.set('end_date', query.end_date)

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/executions?${queryString}`
      : `/agents/${agentId}/executions`

    return api<ExecutionLogsResponse>(endpoint)
  },

  /** Get a single execution log entry */
  get: (agentId: string, logId: string) =>
    api<ExecutionLogEntry>(`/agents/${agentId}/executions/${logId}`),

  /** Get health statistics for an agent (last 24 hours) */
  getHealth: (agentId: string) => api<HealthStats>(`/agents/${agentId}/health`),

  /** Delete execution logs */
  delete: (agentId: string, before?: string) => {
    const params = before ? `?before=${before}` : ''
    return api<{ deleted: number }>(`/agents/${agentId}/executions${params}`, {
      method: 'DELETE',
    })
  },

  /** Export execution logs as JSON */
  export: (agentId: string, days?: number) => {
    const params = days ? `?days=${days}` : ''
    return api<{
      agent_id: string
      agent_name: string
      exported_at: string
      date_range: { start: string; end: string }
      total_logs: number
      logs: ExecutionLogEntry[]
    }>(`/agents/${agentId}/executions/export${params}`)
  },
}

// Governance types
export type ProposalType = 'feature' | 'governance' | 'seed' | 'docs' | 'partnership' | 'meta'
export type ProposalStatus =
  | 'draft'
  | 'discussion'
  | 'voting'
  | 'passed'
  | 'rejected'
  | 'executed'
  | 'cancelled'
  | 'no_quorum'
export type VoteChoice = 'for' | 'against'

export interface Proposal {
  id: string
  number: number // Corresponds to sip_number
  title: string
  body: string
  author_wallet: string
  type: ProposalType
  status: ProposalStatus
  votes_for: number
  votes_against: number
  snapshot_slot: number | null
  discussion_end_at: string | null
  voting_start_at: string | null
  voting_end_at: string | null
  quorum_required: number
  majority_required: number
  created_at: string
  updated_at: string | null
  comment_count?: number
  unique_voters?: number
}

export interface GovernanceStats {
  total_proposals: number
  unique_voters: number
  proposals_by_status: {
    voting: number
  }
}

export interface UserProfile {
  wallet_address: string
  voting_power: number
  can_propose: boolean
}

export interface Comment {
  id: string
  proposal_id: string
  author_wallet: string
  parent_comment_id: string | null
  content: string
  created_at: string
  updated_at: string | null
}

export interface CreateProposalInput {
  title: string
  body: string
  type: string
}

export interface VoteInput {
  vote_direction: VoteChoice
  signature: string
  message: string
}

export interface AddCommentInput {
  content: string
  parent_comment_id?: string
  signature: string
  message: string
}

export interface GovernanceConfigResponse {
  min_tokens_to_propose: number
  min_tokens_to_vote: number
  tokens_per_vote: number
  voting_period_days: number
  discussion_period_days: number
  quorum_percentage: number
  token_decimals: number
}

export interface VoteCheckResponse {
  voted: boolean
  vote_direction?: VoteChoice
  vote_power?: number
}

// Governance API functions
export const governanceApi = {
  listProposals: (params: { status?: string; page?: number; limit?: number }) =>
    api<{ proposals: Proposal[]; pagination: unknown }>(
      `/governance/proposals?${new URLSearchParams(params as any)}`
    ),

  getProposal: (id: string) => api<Proposal>(`/governance/proposals/${id}`),

  createProposal: (data: CreateProposalInput) =>
    api<Proposal>('/governance/proposals', { method: 'POST', body: data }),

  vote: (proposalId: string, data: VoteInput) =>
    api<any>(`/governance/proposals/${proposalId}/votes`, { method: 'POST', body: data }),

  getStats: () => api<GovernanceStats>('/governance/stats'),

  getProfile: () => api<UserProfile>('/governance/profile'),

  getComments: (proposalId: string) =>
    api<Comment[]>(`/governance/proposals/${proposalId}/comments`),

  addComment: (proposalId: string, data: AddCommentInput) =>
    api<Comment>(`/governance/proposals/${proposalId}/comments`, { method: 'POST', body: data }),

  getGovernanceConfig: () => api<GovernanceConfigResponse>('/governance/config'),

  getGovernanceHealth: () => api<{ governance: boolean }>('/governance/health'),

  submitProposal: (
    proposalId: string,
    data: { signature: string; message: string; voting_period_days?: number }
  ) => api<Proposal>(`/governance/proposals/${proposalId}/submit`, { method: 'PATCH', body: data }),

  finalizeProposal: (proposalId: string) =>
    api<Proposal>(`/governance/proposals/${proposalId}/finalize`, { method: 'PATCH' }),

  cancelProposal: (
    proposalId: string,
    data: { signature: string; message: string; reason?: string }
  ) => api<Proposal>(`/governance/proposals/${proposalId}/cancel`, { method: 'PATCH', body: data }),

  checkVote: (proposalId: string) =>
    api<VoteCheckResponse>(`/governance/proposals/${proposalId}/votes/check`),

  executeProposal: (proposalId: string, data: { execution_notes?: string }) =>
    api<Proposal>(`/governance/proposals/${proposalId}/execute`, { method: 'PATCH', body: data }),
}

// User types for GDPR compliance
export interface UserDataExport {
  exported_at: string
  format: string
  wallet_address: string
  data: {
    profile: {
      wallet_address: string
      display_name: string | null
      avatar_url: string | null
      plan: string
      plan_expires_at: string | null
      created_at: string
      updated_at: string
    } | null
    agents: Array<{
      id: string
      name: string
      description: string | null
      icon: string
      framework: string
      flow: { nodes: unknown[]; edges: unknown[] }
      config: Record<string, unknown>
      claw_config: Record<string, unknown>
      status: string
      version: number
      created_at: string
      updated_at: string
    }>
    subscriptions: Array<{
      id: string
      plan: string
      payment_token: string
      amount_lamports: number
      tx_signature: string
      period_start: string
      period_end: string
      status: string
      created_at: string
    }>
    llm_keys: Array<{
      id: string
      provider: string
      name: string
      key_preview: string
      created_at: string
    }>
  }
  notes: {
    llm_keys: string
    retention: string
  }
}

export interface UserDeletionResponse {
  success: boolean
  message: string
  deleted: string[]
  retained: string[]
  retention_policy: {
    subscriptions: string
    deletion_audit: string
  }
  completion_date: string
  warnings?: string[]
}

export interface UserProfileResponse {
  profile: {
    wallet_address: string
    display_name: string | null
    avatar_url: string | null
    plan: string
    plan_expires_at: string | null
    status: string
    created_at: string
  }
}

// User API functions (GDPR compliance)
export const userApi = {
  /** Get user profile */
  getProfile: () => api<UserProfileResponse>('/user/profile'),

  /** Export all user data (GDPR Article 20 - Right to Data Portability) */
  exportData: () => api<UserDataExport>('/user/export'),

  /** Delete user data (GDPR Article 17 - Right to Erasure) */
  deleteData: () => api<UserDeletionResponse>('/user/data', { method: 'DELETE' }),
}

// ============================================
// LLM KEYS API
// ============================================

export interface LLMKeyInfo {
  id: string
  provider: string
  name: string
  key_preview: string
  created_at: string
  updated_at?: string
}

export interface LLMKeyWithEncryption extends LLMKeyInfo {
  ciphertext: string
  iv: string
  salt: string
}

export interface CreateLLMKeyInput {
  provider: string
  name: string
  ciphertext: string
  iv: string
  salt: string
  key_preview: string
}

export interface UpdateLLMKeyInput {
  name?: string
}

export const llmKeysApi = {
  list: () => api<{ keys: LLMKeyInfo[] }>('/llm-keys'),
  get: (id: string) => api<{ key: LLMKeyWithEncryption }>(`/llm-keys/${id}`),
  getByProvider: (provider: string) =>
    api<{ keys: LLMKeyInfo[] }>(`/llm-keys/provider/${provider}`),
  create: (data: CreateLLMKeyInput) =>
    api<{ key: LLMKeyInfo }>('/llm-keys', { method: 'POST', body: data }),
  update: (id: string, data: UpdateLLMKeyInput) =>
    api<{ success: boolean; key: LLMKeyInfo }>(`/llm-keys/${id}`, { method: 'PATCH', body: data }),
  delete: (id: string) =>
    api<{ success: boolean; deleted_id: string }>(`/llm-keys/${id}`, { method: 'DELETE' }),
}

// ============================================
// PAYMENTS API
// ============================================

export interface PaymentPlan {
  name: string
  price_sol: number
  price_usdc: number
  duration_days: number
  features: Record<string, unknown>
}

export interface PaymentPlansResponse {
  plans: Record<string, PaymentPlan>
  payment_methods: { token: string; symbol: string; decimals: number }[]
}

export interface SubscriptionStatus {
  plan: string
  plan_expires_at: string | null
  is_active: boolean
  subscription: Record<string, unknown> | null
  features: Record<string, unknown>
}

export interface VerifyPaymentInput {
  tx_signature: string
  plan: string
  payment_token?: string
}

export interface VerifyPaymentResponse {
  success: boolean
  plan: string
  message: string
}

export interface PaymentHistory {
  id: string
  plan: string
  payment_token: string
  amount_lamports: number
  tx_signature: string
  period_start: string
  period_end: string
  status: string
  created_at: string
}

export interface PaymentHistoryResponse {
  subscriptions: PaymentHistory[]
}

export const paymentsApi = {
  getPlans: () => api<PaymentPlansResponse>('/payments/plans'),
  getStatus: () => api<SubscriptionStatus>('/payments/status'),
  verify: (data: VerifyPaymentInput) =>
    api<VerifyPaymentResponse>('/payments/verify', { method: 'POST', body: data }),
  getHistory: () => api<PaymentHistoryResponse>('/payments/history'),
}

// ============================================
// CREDITS API (Pay-per-Use)
// ============================================

export type WarningLevel = 'normal' | 'low' | 'critical'

export interface CreditBalance {
  balance_usd: number
  total_deposited: number
  total_spent: number
  executions_remaining: number
  cost_per_execution: number
  warning_level: WarningLevel
  alerts: {
    low_balance: boolean
    message: string | null
  }
}

export interface CreditPricing {
  cost_per_execution: number
  minimum_deposit: number
  payment_tokens: Array<{
    token: string
    bonus: number
    note: string | null
  }>
  treasury: string
  examples: Record<string, number>
}

export interface DepositInput {
  tx_signature: string
  token: 'SOL' | 'USDC' | 'GCLAW'
  expected_amount?: number
}

export interface DepositResult {
  success: boolean
  deposit: {
    token: string
    amount: number
    price_usd: number | null
    credits_usd: number
    bonus_applied: string | null
  }
  balance: {
    new_balance_usd: number
    executions_available: number
  }
  tx_signature: string
}

export interface DepositRecord {
  id: string
  wallet_address: string
  token: 'SOL' | 'USDC' | 'GCLAW'
  amount: number
  price_usd: number | null
  credits_usd: number
  bonus_applied: number
  tx_signature: string
  status: 'pending' | 'confirmed' | 'failed'
  created_at: string
}

export interface DepositHistoryResponse {
  deposits: DepositRecord[]
  pagination: {
    limit: number
    offset: number
    count: number
  }
}

export interface UsageHistoryEntry {
  id: string
  agent_id: string
  cost_usd: number
  balance_after: number
  event_type: string
  created_at: string
}

export interface UsageHistoryResponse {
  usage: UsageHistoryEntry[]
  summary: {
    total_spent: number
    execution_count: number
    cost_per_execution: number
  }
  pagination: {
    limit: number
    offset: number
    count: number
  }
}

export const creditsApi = {
  /** Get pricing information (public) */
  getPricing: () => api<CreditPricing>('/credits/pricing'),

  /** Get current balance (requires auth) */
  getBalance: () => api<CreditBalance>('/credits/balance'),

  /** Deposit credits via Solana transaction */
  deposit: (data: DepositInput) =>
    api<DepositResult>('/credits/deposit', { method: 'POST', body: data }),

  /** Get deposit history */
  getHistory: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    const queryString = query.toString()
    return api<DepositHistoryResponse>(`/credits/history${queryString ? `?${queryString}` : ''}`)
  },

  /** Get usage/spending history */
  getUsage: (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.offset) query.set('offset', params.offset.toString())
    const queryString = query.toString()
    return api<UsageHistoryResponse>(`/credits/usage${queryString ? `?${queryString}` : ''}`)
  },
}

// ============================================
// PRICES API (Token Prices)
// ============================================

export interface TokenPrice {
  symbol: 'SOL' | 'USDC' | 'GCLAW'
  priceUsd: number
  source: string
  timestamp: number
}

export interface PricesResponse {
  success: boolean
  data: {
    prices: Record<'SOL' | 'USDC' | 'GCLAW', TokenPrice>
    cached: boolean
    cacheAge: number
    fetchedAt: string
  }
}

export interface ConvertResponse {
  success: boolean
  data: {
    from: string
    to: string
    input_amount: number
    output_amount: number
    rate: number
  }
}

export const pricesApi = {
  /** Get all token prices */
  getAll: (forceRefresh = false) => {
    const params = forceRefresh ? '?refresh=true' : ''
    return api<PricesResponse>(`/prices${params}`)
  },

  /** Get price for a specific token */
  get: (symbol: 'SOL' | 'USDC' | 'GCLAW') =>
    api<{ success: boolean; data: TokenPrice }>(`/prices/${symbol}`),

  /** Convert between tokens and USD */
  convert: (from: string, to: string, amount: number) =>
    api<ConvertResponse>(`/prices/convert?from=${from}&to=${to}&amount=${amount}`),

  /** Get token mint addresses */
  getAddresses: () => api<{ success: boolean; data: Record<string, string> }>('/prices/addresses'),
}

// ============================================
// TOOL CREDENTIALS API
// ============================================

export interface ToolCredential {
  id: string
  wallet_address: string
  tool_type: string
  name: string
  credential_preview: string
  config: Record<string, unknown>
  is_active: boolean
  last_used_at: string | null
  usage_count: number
  created_at: string
  updated_at: string
}

export interface CreateToolCredentialInput {
  tool_type: string
  name: string
  credential: string
  config?: Record<string, unknown>
}

export interface UpdateToolCredentialInput {
  name?: string
  credential?: string
  config?: Record<string, unknown>
  is_active?: boolean
}

export interface TestCredentialResponse {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

export const toolCredentialsApi = {
  list: (params?: { tool_type?: string }) => {
    const query = params?.tool_type ? `?tool_type=${encodeURIComponent(params.tool_type)}` : ''
    return api<{ credentials: ToolCredential[] }>(`/tool-credentials${query}`)
  },
  get: (id: string) => api<{ credential: ToolCredential }>(`/tool-credentials/${id}`),
  create: (data: CreateToolCredentialInput) =>
    api<{ success: boolean; credential: ToolCredential }>('/tool-credentials', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: UpdateToolCredentialInput) =>
    api<{ success: boolean; credential: ToolCredential }>(`/tool-credentials/${id}`, {
      method: 'PATCH',
      body: data,
    }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/tool-credentials/${id}`, { method: 'DELETE' }),
  test: (id: string) =>
    api<TestCredentialResponse>(`/tool-credentials/${id}/test`, { method: 'POST' }),
}

// ============================================
// WEBHOOK TYPES (Inbound Triggers)
// ============================================

/**
 * Webhook for receiving inbound triggers from external systems.
 */
export interface Webhook {
  id: string
  agent_id?: string
  name: string
  secret_prefix: string // First 8 chars of secret (for display)
  trigger_url: string
  is_active: boolean
  rate_limit: number
  allowed_ips: string[]
  pass_metadata: boolean
  trigger_count: number
  last_triggered_at: string | null
  last_error_at?: string | null
  created_at: string
  updated_at: string
}

/**
 * Response from webhook list endpoint.
 */
export interface WebhooksListResponse {
  webhooks: Webhook[]
  count: number
}

export interface CreateWebhookInput {
  name?: string
  rate_limit?: number
  allowed_ips?: string[]
  pass_metadata?: boolean
}

export interface UpdateWebhookInput {
  name?: string
  is_active?: boolean
  rate_limit?: number
  allowed_ips?: string[]
  pass_metadata?: boolean
}

export interface WebhookWithSecret extends Webhook {
  secret: string // Full secret (only returned on create/regenerate)
}

// ============================================
// ENDPOINT TYPES (Outbound Deliveries)
// ============================================

/**
 * Event types that can be delivered to endpoints.
 */
export type DeliveryEventType =
  | 'agent.response'
  | 'agent.blocked'
  | 'agent.error'
  | 'execution.started'
  | 'execution.completed'

/**
 * Endpoint for outbound webhook deliveries.
 */
export interface WebhookEndpoint {
  id: string
  agent_id?: string
  name: string
  url: string
  headers: Record<string, string>
  secret_prefix: string // First 8 chars (matches backend)
  is_active: boolean
  retry_count: number
  timeout_ms: number
  event_types: DeliveryEventType[]
  delivery_count: number
  success_count: number
  failure_count: number
  last_delivery_at: string | null
  last_success_at?: string | null
  last_failure_at?: string | null
  created_at: string
  updated_at: string
}

/**
 * Response from endpoint list API.
 */
export interface EndpointsListResponse {
  endpoints: WebhookEndpoint[]
  count: number
}

export interface CreateEndpointInput {
  name?: string
  url: string
  headers?: Record<string, string>
  retry_count?: number
  timeout_ms?: number
  event_types?: DeliveryEventType[]
}

export interface UpdateEndpointInput {
  name?: string
  url?: string
  headers?: Record<string, string>
  is_active?: boolean
  retry_count?: number
  timeout_ms?: number
  event_types?: DeliveryEventType[]
}

export interface EndpointWithSecret extends WebhookEndpoint {
  secret: string // Full secret (only returned on create/regenerate)
}

// ============================================
// DELIVERY TYPES
// ============================================

export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying'

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  agent_id: string
  event_type: DeliveryEventType
  status: DeliveryStatus
  attempts: number
  max_attempts: number
  response_status: number | null
  response_time_ms: number | null
  error_code: string | null
  error_message: string | null
  next_attempt_at: string | null
  completed_at: string | null
  created_at: string
}

export interface DeliveriesListResponse {
  deliveries: WebhookDelivery[]
  pagination: {
    limit: number
    offset: number
    total: number
    hasMore: boolean
  }
}

export interface ListDeliveriesQuery {
  endpoint_id?: string
  status?: DeliveryStatus | 'all'
  limit?: number
  offset?: number
}

export interface TestDeliveryResponse {
  success: boolean
  deliveryId?: string
  status?: number
  responseTimeMs?: number
  errorCode?: string
  errorMessage?: string
}

// ============================================
// WEBHOOK API FUNCTIONS (Inbound Triggers)
// ============================================

export const webhooksApi = {
  /** List webhooks for an agent */
  list: async (agentId: string): Promise<Webhook[]> => {
    const response = await api<WebhooksListResponse>(`/agents/${agentId}/webhooks`)
    return response.webhooks
  },

  /** Get webhook details */
  get: (agentId: string, webhookId: string) =>
    api<Webhook>(`/agents/${agentId}/webhooks/${webhookId}`),

  /** Create a new webhook */
  create: (agentId: string, data?: CreateWebhookInput) =>
    api<WebhookWithSecret>(`/agents/${agentId}/webhooks`, {
      method: 'POST',
      body: data || {},
    }),

  /** Update a webhook */
  update: (agentId: string, webhookId: string, data: UpdateWebhookInput) =>
    api<Webhook>(`/agents/${agentId}/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** Delete a webhook */
  delete: (agentId: string, webhookId: string) =>
    api<{ success: boolean }>(`/agents/${agentId}/webhooks/${webhookId}`, {
      method: 'DELETE',
    }),

  /** Regenerate webhook secret */
  regenerate: (agentId: string, webhookId: string) =>
    api<WebhookWithSecret>(`/agents/${agentId}/webhooks/${webhookId}/regenerate`, {
      method: 'POST',
    }),
}

// ============================================
// ENDPOINT API FUNCTIONS (Outbound Deliveries)
// ============================================

export const endpointsApi = {
  /** List endpoints for an agent */
  list: async (agentId: string): Promise<WebhookEndpoint[]> => {
    const response = await api<EndpointsListResponse>(`/agents/${agentId}/endpoints`)
    return response.endpoints
  },

  /** Get endpoint details */
  get: (agentId: string, endpointId: string) =>
    api<WebhookEndpoint>(`/agents/${agentId}/endpoints/${endpointId}`),

  /** Create a new endpoint */
  create: (agentId: string, data: CreateEndpointInput) =>
    api<EndpointWithSecret>(`/agents/${agentId}/endpoints`, {
      method: 'POST',
      body: data,
    }),

  /** Update an endpoint */
  update: (agentId: string, endpointId: string, data: UpdateEndpointInput) =>
    api<WebhookEndpoint>(`/agents/${agentId}/endpoints/${endpointId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** Delete an endpoint */
  delete: (agentId: string, endpointId: string) =>
    api<{ success: boolean }>(`/agents/${agentId}/endpoints/${endpointId}`, {
      method: 'DELETE',
    }),

  /** Test endpoint delivery */
  test: (agentId: string, endpointId: string) =>
    api<TestDeliveryResponse>(`/agents/${agentId}/endpoints/${endpointId}/test`, {
      method: 'POST',
    }),

  /** Regenerate endpoint secret */
  regenerate: (agentId: string, endpointId: string) =>
    api<EndpointWithSecret>(`/agents/${agentId}/endpoints/${endpointId}/regenerate`, {
      method: 'POST',
    }),

  /** List delivery history */
  listDeliveries: (agentId: string, query?: ListDeliveriesQuery) => {
    const params = new URLSearchParams()
    if (query?.endpoint_id) params.set('endpoint_id', query.endpoint_id)
    if (query?.status && query.status !== 'all') params.set('status', query.status)
    if (query?.limit) params.set('limit', query.limit.toString())
    if (query?.offset) params.set('offset', query.offset.toString())

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/deliveries?${queryString}`
      : `/agents/${agentId}/deliveries`

    return api<DeliveriesListResponse>(endpoint)
  },
}

// ============================================
// Alert Rules Types
// ============================================

export type AlertRuleType =
  | 'error_rate'
  | 'latency_p95'
  | 'latency_p99'
  | 'block_rate'
  | 'success_rate'
  | 'request_volume'

export type AlertComparison = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type AlertNotificationChannel = 'webhook' | 'slack'

export interface AlertRule {
  id: string
  agent_id: string
  wallet_address: string
  name: string
  description: string | null
  rule_type: AlertRuleType
  threshold: number
  window_minutes: number
  comparison: AlertComparison
  notification_channel: AlertNotificationChannel
  notification_target: string
  cooldown_minutes: number
  consecutive_threshold: number
  severity: AlertSeverity
  is_active: boolean
  last_triggered_at: string | null
  last_value: number | null
  consecutive_triggers: number
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface AlertHistory {
  id: string
  alert_rule_id: string
  triggered_at: string
  metric_value: number
  threshold: number
  comparison: AlertComparison
  window_minutes: number
  notification_sent: boolean
  notification_sent_at: string | null
  notification_error: string | null
  resolved_at: string | null
  resolved_by: string | null
  metadata: Record<string, unknown>
}

export interface CreateAlertRuleInput {
  name: string
  description?: string
  rule_type: AlertRuleType
  threshold: number
  window_minutes?: number
  comparison?: AlertComparison
  notification_channel: AlertNotificationChannel
  notification_target: string
  cooldown_minutes?: number
  consecutive_threshold?: number
  severity?: AlertSeverity
}

export interface UpdateAlertRuleInput {
  name?: string
  description?: string | null
  threshold?: number
  window_minutes?: number
  comparison?: AlertComparison
  notification_channel?: AlertNotificationChannel
  notification_target?: string
  cooldown_minutes?: number
  consecutive_threshold?: number
  severity?: AlertSeverity
  is_active?: boolean
}

export interface AlertHistoryQuery {
  limit?: number
  offset?: number
}

export interface AlertHistoryResponse {
  history: AlertHistory[]
  total: number
  limit: number
  offset: number
}

export interface AlertTestResponse {
  success: boolean
  error: string | null
  notification_channel: AlertNotificationChannel
  notification_target: string
}

// Alert Rules API functions
export const alertsApi = {
  /** List all alert rules for an agent */
  list: (agentId: string) => api<{ rules: AlertRule[] }>(`/agents/${agentId}/alerts`),

  /** Create a new alert rule */
  create: (agentId: string, data: CreateAlertRuleInput) =>
    api<{ rule: AlertRule }>(`/agents/${agentId}/alerts`, {
      method: 'POST',
      body: data,
    }),

  /** Get a single alert rule */
  get: (agentId: string, alertId: string) =>
    api<{ rule: AlertRule }>(`/agents/${agentId}/alerts/${alertId}`),

  /** Update an alert rule */
  update: (agentId: string, alertId: string, data: UpdateAlertRuleInput) =>
    api<{ rule: AlertRule }>(`/agents/${agentId}/alerts/${alertId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** Delete an alert rule */
  delete: (agentId: string, alertId: string) =>
    api<{ success: boolean }>(`/agents/${agentId}/alerts/${alertId}`, {
      method: 'DELETE',
    }),

  /** Get alert trigger history */
  history: (agentId: string, alertId: string, query?: AlertHistoryQuery) => {
    const params = new URLSearchParams()
    if (query?.limit) params.set('limit', query.limit.toString())
    if (query?.offset) params.set('offset', query.offset.toString())

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/alerts/${alertId}/history?${queryString}`
      : `/agents/${agentId}/alerts/${alertId}/history`

    return api<AlertHistoryResponse>(endpoint)
  },

  /** Test an alert rule notification */
  test: (agentId: string, alertId: string) =>
    api<AlertTestResponse>(`/agents/${agentId}/alerts/${alertId}/test`, {
      method: 'POST',
    }),
}

// ============================================
// CHARACTER API
// ============================================

export interface CharacterExample {
  user: string
  assistant: string
}

export interface CharacterConfig {
  name: string
  personality: string
  bio?: string
  topics?: string[]
  forbidden_topics?: string[]
  adjectives?: string[]
  knowledge?: string[]
  examples?: CharacterExample[]
}

export interface MemoryIntegrityConfig {
  enabled: boolean
  verify_on_read: boolean
  sign_on_write: boolean
  min_trust_score: number
}

export interface CharacterResponse {
  character: CharacterConfig
  memory_integrity: MemoryIntegrityConfig
  framework: string
  is_elizaos: boolean
}

export interface CharacterPreviewResponse {
  preview_available: boolean
  response?: string
  character_prompt: string
  test_message: string
  tokens_used?: { prompt_tokens: number; completion_tokens: number }
  message?: string
}

export const characterApi = {
  /** Get character configuration */
  get: (agentId: string) => api<CharacterResponse>(`/agents/${agentId}/character`),

  /** Update character configuration (partial) */
  update: (
    agentId: string,
    data: {
      character?: Partial<CharacterConfig>
      memory_integrity?: Partial<MemoryIntegrityConfig>
    }
  ) =>
    api<{ character: CharacterConfig; memory_integrity: MemoryIntegrityConfig }>(
      `/agents/${agentId}/character`,
      {
        method: 'PATCH',
        body: data,
      }
    ),

  /** Replace entire character configuration */
  replace: (agentId: string, character: CharacterConfig) =>
    api<{ character: CharacterConfig }>(`/agents/${agentId}/character`, {
      method: 'PUT',
      body: { character },
    }),

  /** Reset character to defaults */
  reset: (agentId: string) =>
    api<{ success: boolean; character: CharacterConfig; memory_integrity: MemoryIntegrityConfig }>(
      `/agents/${agentId}/character`,
      {
        method: 'DELETE',
      }
    ),

  /** Preview character response */
  preview: (agentId: string, message: string) =>
    api<CharacterPreviewResponse>(`/agents/${agentId}/character/preview`, {
      method: 'POST',
      body: { message },
    }),
}

// ============================================
// MEMORY API
// ============================================

export interface MemorySession {
  id: string
  title: string | null
  status: 'active' | 'archived' | 'deleted'
  memory_strategy: 'sliding_window' | 'summary' | 'full' | 'none'
  context_window: number
  message_count: number
  total_tokens: number
  created_at: string
  updated_at: string
  last_message_at: string
}

export interface MemoryMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  position: number
  input_tokens: number | null
  output_tokens: number | null
  blocked: boolean
  blocked_reason: string | null
  blocked_gate: string | null
  latency_ms: number | null
  model_used: string | null
  created_at: string
}

export interface MemoryContext {
  context_key: string
  context_value: Record<string, unknown>
  updated_at: string
}

export interface MemorySessionDetail extends MemorySession {
  messages: MemoryMessage[]
  context: MemoryContext[]
}

export interface ConversationMemoryStats {
  stats: {
    total_conversations: number
    active_conversations: number
    archived_conversations: number
    total_messages: number
    total_tokens: number
    avg_messages_per_conversation: number
  }
  strategy_breakdown: Record<string, number>
}

export interface MemorySearchResult {
  message_id: string
  conversation_id: string
  conversation_title: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  position: number
  created_at: string
  snippet: string
}

export interface MemoryListQuery {
  limit?: number
  offset?: number
  status?: 'active' | 'archived' | 'all'
  search?: string
}

export const memoriesApi = {
  /** List memory sessions */
  list: (agentId: string, query?: MemoryListQuery) => {
    const params = new URLSearchParams()
    if (query?.limit) params.set('limit', query.limit.toString())
    if (query?.offset) params.set('offset', query.offset.toString())
    if (query?.status) params.set('status', query.status)
    if (query?.search) params.set('search', query.search)

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/memories?${queryString}`
      : `/agents/${agentId}/memories`

    return api<{
      memories: MemorySession[]
      pagination: { total: number; limit: number; offset: number; has_more: boolean }
    }>(endpoint)
  },

  /** Get memory statistics */
  stats: (agentId: string) => api<ConversationMemoryStats>(`/agents/${agentId}/memories/stats`),

  /** Get a specific memory session */
  get: (agentId: string, conversationId: string) =>
    api<MemorySessionDetail>(`/agents/${agentId}/memories/${conversationId}`),

  /** Delete a memory session */
  delete: (agentId: string, conversationId: string, permanent: boolean = false) =>
    api<{ success: boolean; deleted?: boolean; archived?: boolean }>(
      `/agents/${agentId}/memories/${conversationId}?permanent=${permanent}`,
      {
        method: 'DELETE',
      }
    ),

  /** Clear all memories */
  clearAll: (agentId: string, permanent: boolean = false) =>
    api<{ success: boolean; deleted?: boolean; archived?: boolean; count: number }>(
      `/agents/${agentId}/memories?permanent=${permanent}`,
      {
        method: 'DELETE',
      }
    ),

  /** Search memories */
  search: (agentId: string, query: string, limit: number = 10) =>
    api<{ query: string; results: MemorySearchResult[]; count: number }>(
      `/agents/${agentId}/memories/search`,
      {
        method: 'POST',
        body: { query, limit },
      }
    ),

  /** Restore an archived memory session */
  restore: (agentId: string, conversationId: string) =>
    api<{ success: boolean; restored: boolean }>(
      `/agents/${agentId}/memories/${conversationId}/restore`,
      {
        method: 'POST',
      }
    ),
}

// ============================================
// EXPORT/IMPORT API
// ============================================

export interface GuardianClawExport {
  version: string
  format: 'claw'
  exported_at: string
  agent: {
    name: string
    description: string | null
    framework: string
    icon: string
  }
  character: CharacterConfig | null
  memory_integrity: MemoryIntegrityConfig | null
  flow?: { nodes: unknown[]; edges: unknown[] }
  claw_config?: Record<string, unknown>
  integration_config: Record<string, unknown> | null
}

export interface ElizaOSCharacter {
  name: string
  clients?: string[]
  modelProvider?: string
  settings?: {
    secrets?: Record<string, string>
    voice?: { model?: string }
  }
  system?: string
  bio?: string | string[]
  lore?: string[]
  messageExamples?: Array<Array<{ user: string; content: { text: string } }>>
  postExamples?: string[]
  topics?: string[]
  adjectives?: string[]
  knowledge?: string[]
  style?: {
    all?: string[]
    chat?: string[]
    post?: string[]
  }
}

export interface ImportPreview {
  valid: boolean
  format: 'claw' | 'elizaos'
  preview: Record<string, unknown>
  error?: string
  details?: Record<string, unknown>
}

export interface ImportResult {
  success: boolean
  format: 'claw' | 'elizaos'
  merged?: boolean
  agent: { id: string; name: string; framework: string }
  imported?: { character: boolean; flow: boolean; claw_config: boolean }
}

export const agentExportApi = {
  /** Export agent configuration */
  export: (
    agentId: string,
    options?: { format?: 'claw' | 'elizaos'; include_flow?: boolean; include_claw?: boolean }
  ) => {
    const params = new URLSearchParams()
    if (options?.format) params.set('format', options.format)
    if (options?.include_flow === false) params.set('include_flow', 'false')
    if (options?.include_claw === false) params.set('include_claw', 'false')

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/export?${queryString}`
      : `/agents/${agentId}/export`

    return api<GuardianClawExport | ElizaOSCharacter>(endpoint)
  },

  /** Import configuration into existing agent */
  import: (
    agentId: string,
    data: GuardianClawExport | ElizaOSCharacter,
    options?: { merge?: boolean; include_flow?: boolean; include_claw?: boolean }
  ) => {
    const params = new URLSearchParams()
    if (options?.merge) params.set('merge', 'true')
    if (options?.include_flow === false) params.set('include_flow', 'false')
    if (options?.include_claw === false) params.set('include_claw', 'false')

    const queryString = params.toString()
    const endpoint = queryString
      ? `/agents/${agentId}/import?${queryString}`
      : `/agents/${agentId}/import`

    return api<ImportResult>(endpoint, {
      method: 'POST',
      body: data,
    })
  },

  /** Preview import without applying */
  previewImport: (agentId: string, data: GuardianClawExport | ElizaOSCharacter) =>
    api<ImportPreview>(`/agents/${agentId}/import/preview`, {
      method: 'POST',
      body: data,
    }),

  /** Create new agent from import */
  createFromImport: (data: GuardianClawExport | ElizaOSCharacter) =>
    api<ImportResult>('/agents/import', {
      method: 'POST',
      body: data,
    }),
}

export { api, ApiError, API_URL }
