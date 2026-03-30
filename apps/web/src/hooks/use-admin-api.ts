'use client'

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr'
import { useAuth } from './use-auth'
import { useCallback } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

// Custom error class for API errors
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Fetcher with authentication
async function fetcher<T>(url: string, token: string | null): Promise<T> {
  if (!token) {
    throw new ApiError('Not authenticated', 401)
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(
      errorData.error || `Request failed with status ${response.status}`,
      response.status
    )
  }

  return response.json()
}

// Default SWR configuration for admin API
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  dedupingInterval: 2000,
}

// Generic hook for fetching admin API data
export function useAdminApi<T>(endpoint: string | null, config?: SWRConfiguration<T>) {
  const { token } = useAuth()

  const url = endpoint ? `${API_URL}${endpoint}` : null
  const swrKey = url && token ? [url, token] : null

  const { data, error, isLoading, isValidating, mutate } = useSWR<T, ApiError>(
    swrKey,
    ([url, token]) => fetcher<T>(url, token),
    {
      ...defaultConfig,
      ...config,
    }
  )

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    isError: !!error,
  }
}

// Hook for admin API mutations (POST, PATCH, DELETE)
export function useAdminMutation<TData = unknown, TResponse = unknown>() {
  const { token } = useAuth()

  const mutateAsync = useCallback(
    async (
      endpoint: string,
      options: {
        method: 'POST' | 'PATCH' | 'DELETE'
        data?: TData
      }
    ): Promise<TResponse> => {
      if (!token) {
        throw new ApiError('Not authenticated', 401)
      }

      const url = `${API_URL}${endpoint}`

      const response = await fetch(url, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: options.data ? JSON.stringify(options.data) : undefined,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiError(
          errorData.error || `Request failed with status ${response.status}`,
          response.status
        )
      }

      return response.json()
    },
    [token]
  )

  return { mutateAsync }
}

// Helper to invalidate cache for specific endpoints
export function invalidateAdminCache(endpoint: string) {
  // Invalidate all cached data that matches the endpoint pattern
  globalMutate((key) => Array.isArray(key) && key[0]?.includes(endpoint), undefined, {
    revalidate: true,
  })
}

// Specific hooks for each admin endpoint with proper typing

// Overview metrics
export interface OverviewMetrics {
  users: {
    total: number
    active: number
    new_today: number
    by_plan: {
      free: number
      starter: number
      pro: number
    }
  }
  agents: {
    total: number
    deployed: number
    new_today: number
  }
  requests: {
    today: number
    blocked_today: number
    block_rate: number
  }
  alerts: {
    active: number
    critical: number
  }
  revenue: {
    mtd_usd: number
    mrr_estimated: number
  }
}

export function useOverviewMetrics(config?: SWRConfiguration<OverviewMetrics>) {
  return useAdminApi<OverviewMetrics>('/admin/metrics/overview', config)
}

// Operations metrics
export interface OperationsMetrics {
  health: {
    status: 'healthy' | 'degraded' | 'down'
    uptime_percent: number | null
    last_incident: string | null
  }
  latency: {
    current_avg_ms: number
    current_p95_ms: number
    trend: 'improving' | 'stable' | 'degrading'
  }
  errors: {
    rate_percent: number
    count_today: number
    by_type: Record<string, number>
  }
  throughput: {
    requests_per_minute: number
    peak_rpm_today: number
  }
  hourly: Array<{
    hour: string
    requests: number
    errors: number
    avg_latency_ms: number
    blocked: number
  }>
}

export function useOperationsMetrics(config?: SWRConfiguration<OperationsMetrics>) {
  return useAdminApi<OperationsMetrics>('/admin/metrics/operations', {
    refreshInterval: 60000, // Refresh every minute
    ...config,
  })
}

// Business metrics
export interface BusinessMetrics {
  growth: {
    users_total: number
    users_new_7d: number
    users_new_30d: number
    growth_rate_7d: number
    agents_total: number
    agents_new_7d: number
  }
  retention: {
    day_1: number | null
    day_7: number | null
    day_30: number | null
    note: string
  }
  engagement: {
    dau: number
    wau: number
    mau: number
    dau_mau_ratio: number
  }
  daily: Array<{
    date: string
    new_users: number
    active_users: number
    requests: number
  }>
}

export function useBusinessMetrics(config?: SWRConfiguration<BusinessMetrics>) {
  return useAdminApi<BusinessMetrics>('/admin/metrics/business', config)
}

// Financial metrics
export interface FinancialMetrics {
  revenue: {
    mtd_usd: number
    last_month_usd: number
    growth_percent: number
  }
  subscriptions: {
    active: number
    mrr: number
    arr_estimated: number
    arpu: number | null
    churn_rate: number | null
    churn_note: string
  }
  by_plan: Record<string, { count: number; revenue_usd: number }>
  by_token: Record<string, { count: number; revenue_usd: number }>
  daily: Array<{
    date: string
    revenue_usd: number
    new_subs: number
  }>
}

export function useFinancialMetrics(config?: SWRConfiguration<FinancialMetrics>) {
  return useAdminApi<FinancialMetrics>('/admin/metrics/financial', config)
}

// Security metrics
export interface SecurityMetrics {
  summary: {
    blocked_requests_24h: number
    rate_limit_hits_24h: number
    auth_failures_24h: number
    active_alerts: number
    critical_alerts: number
  }
  claw: {
    blocks_by_gate: {
      credibility: number
      avoidance: number
      limits: number
      worth: number
    }
    total_blocks: number
    block_rate_percent: number
  }
  threats: {
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    top_blocked_ips: Array<{ ip_hash: string; count: number }>
    note: string
  }
  alerts: Array<{
    id: string
    severity: string
    title: string
    created_at: string
  }>
  hourly: Array<{
    hour: string
    blocks: number
    rate_limits: number
    auth_failures: number
  }>
}

export function useSecurityMetrics(config?: SWRConfiguration<SecurityMetrics>) {
  return useAdminApi<SecurityMetrics>('/admin/metrics/security', {
    refreshInterval: 60000,
    ...config,
  })
}

// Analytics metrics
export interface AnalyticsMetrics {
  capacity: {
    avg_daily_requests: number
    peak_daily_requests: number
    growth_rate_percent: number
    note: string
  }
  usage: {
    total_requests_30d: number
    total_blocked_30d: number
    block_rate_percent: number
  }
  claw_stats: {
    agents_with_claw: number
    total_agents: number
    adoption_percent: number
    blocks_per_agent_avg: number
  }
  top_agents: Array<{
    id: string
    name: string
    framework: string | null
    requests: number
    blocked: number
  }>
  by_framework: Record<string, { count: number; requests: number }>
  daily: Array<{
    date: string
    requests: number
    blocked: number
  }>
}

export function useAnalyticsMetrics(config?: SWRConfiguration<AnalyticsMetrics>) {
  return useAdminApi<AnalyticsMetrics>('/admin/metrics/analytics', config)
}

// Alerts
export interface Alert {
  id: string
  rule_id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  metric_value: number
  threshold_value: number
  status: 'active' | 'acknowledged' | 'resolved'
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface AlertsResponse {
  alerts: Alert[]
  total: number
  page: number
  limit: number
}

export function useAlerts(
  status?: 'active' | 'acknowledged' | 'resolved',
  page = 1,
  limit = 20,
  config?: SWRConfiguration<AlertsResponse>
) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  params.set('page', String(page))
  params.set('limit', String(limit))

  return useAdminApi<AlertsResponse>(`/admin/alerts?${params.toString()}`, {
    refreshInterval: 30000,
    ...config,
  })
}

// Alert rules
export interface AlertRule {
  id: string
  name: string
  description: string | null
  metric_name: string
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'spike'
  threshold_value: number
  severity: 'info' | 'warning' | 'critical'
  is_enabled: boolean
  cooldown_minutes: number
  created_at: string
}

export interface AlertRulesResponse {
  rules: AlertRule[]
}

export function useAlertRules(config?: SWRConfiguration<AlertRulesResponse>) {
  return useAdminApi<AlertRulesResponse>('/admin/rules', config)
}

// Admin roles
export interface AdminRole {
  id: string
  wallet_address: string
  role: 'super_admin' | 'admin' | 'support' | 'viewer'
  granted_by: string
  is_active: boolean
  created_at: string
}

export interface AdminRolesResponse {
  roles: AdminRole[]
}

export function useAdminRoles(config?: SWRConfiguration<AdminRolesResponse>) {
  return useAdminApi<AdminRolesResponse>('/admin/roles', config)
}

// User search
export interface UserSearchResult {
  wallet_address: string
  display_name: string | null
  plan: string
  plan_expires_at: string | null
  created_at: string
}

export interface UserSearchResponse {
  users: UserSearchResult[]
}

export function useUserSearch(query: string, config?: SWRConfiguration<UserSearchResponse>) {
  const endpoint = query.trim()
    ? `/admin/users/search?query=${encodeURIComponent(query.trim())}`
    : null
  return useAdminApi<UserSearchResponse>(endpoint, config)
}

// User details
export interface UserProfile {
  wallet_address: string
  display_name: string | null
  plan: string
  plan_expires_at: string | null
  api_calls_remaining: number
  created_at: string
  updated_at: string
}

export interface UserAgent {
  id: string
  name: string
  status: string
  framework: string | null
  created_at: string
}

export interface UserSubscription {
  id: string
  plan: string
  status: string
  started_at: string
  expires_at: string | null
}

export interface UserUsage {
  period: string
  api_calls: number
  requests_blocked: number
}

export interface UserDetails {
  profile: UserProfile
  agents: UserAgent[]
  subscriptions: UserSubscription[]
  usage: UserUsage[]
}

export function useUserDetails(wallet: string | null, config?: SWRConfiguration<UserDetails>) {
  const endpoint = wallet ? `/admin/users/${wallet}` : null
  return useAdminApi<UserDetails>(endpoint, config)
}

// ============================================
// CREDITS ADMIN TYPES AND HOOKS
// ============================================

// Platform credits statistics
export interface PlatformCreditsStats {
  total_balance: number
  total_deposited: number
  total_spent: number
  total_adjustments: number
  active_accounts: number
  zero_balance_accounts: number
  low_balance_accounts: number
  avg_balance: number
  deposits_24h: number
  deposits_7d: number
  deposits_30d: number
  revenue_24h: number
  revenue_7d: number
  revenue_30d: number
}

export interface CreditsStatsResponse {
  stats: PlatformCreditsStats
  config: {
    cost_per_execution: number
    min_deposit_usd: number
  }
  generated_at: string
}

export function useCreditsStats(config?: SWRConfiguration<CreditsStatsResponse>) {
  return useAdminApi<CreditsStatsResponse>('/admin/credits/stats', {
    refreshInterval: 60000, // Refresh every minute
    ...config,
  })
}

// User credit details
export interface UserCreditsDetails {
  balance_usd: number
  total_deposited: number
  total_spent: number
  executions_remaining: number
  deposits_count: number
  adjustments_count: number
  first_deposit_at: string | null
  last_deposit_at: string | null
  last_usage_at: string | null
  created_at: string | null
}

export interface UserCreditsResponse {
  wallet_address: string
  display_name: string | null
  status: string
  plan: string
  member_since: string | null
  credits: UserCreditsDetails
  config: {
    cost_per_execution: number
  }
}

export function useUserCredits(
  wallet: string | null,
  config?: SWRConfiguration<UserCreditsResponse>
) {
  const endpoint = wallet ? `/admin/credits/user/${wallet}` : null
  return useAdminApi<UserCreditsResponse>(endpoint, config)
}

// Deposit record
export interface DepositRecord {
  id: string
  wallet_address: string
  display_name: string | null
  token: string
  amount: number
  price_usd: number | null
  credits_usd: number
  bonus_applied: number
  tx_signature: string
  status: string
  created_at: string
}

export interface DepositsResponse {
  deposits: DepositRecord[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    status: string | null
    token: string | null
    start_date: string | null
    end_date: string | null
  }
}

export function useAllDeposits(
  params?: {
    limit?: number
    offset?: number
    status?: string
    token?: string
    start_date?: string
    end_date?: string
  },
  config?: SWRConfiguration<DepositsResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.status) searchParams.set('status', params.status)
  if (params?.token) searchParams.set('token', params.token)
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)

  const query = searchParams.toString()
  return useAdminApi<DepositsResponse>(`/admin/credits/deposits${query ? `?${query}` : ''}`, config)
}

// Credit adjustment
export interface CreditAdjustment {
  id: string
  wallet_address: string
  display_name: string | null
  amount: number
  type: 'refund' | 'courtesy' | 'correction' | 'bonus' | 'penalty'
  reason: string
  admin_wallet_hash: string
  reference_id: string | null
  reference_type: string | null
  balance_before: number
  balance_after: number
  created_at: string
}

export interface AdjustmentsResponse {
  adjustments: CreditAdjustment[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    type: string | null
    start_date: string | null
    end_date: string | null
  }
}

export function useAllAdjustments(
  params?: {
    limit?: number
    offset?: number
    type?: string
    start_date?: string
    end_date?: string
  },
  config?: SWRConfiguration<AdjustmentsResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.type) searchParams.set('type', params.type)
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)

  const query = searchParams.toString()
  return useAdminApi<AdjustmentsResponse>(
    `/admin/credits/adjustments${query ? `?${query}` : ''}`,
    config
  )
}

// Low balance users
export interface LowBalanceUser {
  wallet_address: string
  display_name: string | null
  balance_usd: number
  executions_remaining: number
  last_deposit_at: string | null
  total_spent: number
}

export interface LowBalanceResponse {
  users: LowBalanceUser[]
  threshold_usd: number
  threshold_executions: number
  pagination: {
    limit: number
    offset: number
    count: number
  }
}

export function useLowBalanceUsers(
  params?: {
    threshold?: number
    limit?: number
    offset?: number
  },
  config?: SWRConfiguration<LowBalanceResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.threshold) searchParams.set('threshold', String(params.threshold))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))

  const query = searchParams.toString()
  return useAdminApi<LowBalanceResponse>(
    `/admin/credits/low-balance${query ? `?${query}` : ''}`,
    config
  )
}

// User notes
export interface UserNote {
  id: string
  wallet_address: string
  note: string
  category: 'general' | 'support' | 'billing' | 'security' | 'compliance'
  admin_wallet_hash: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface UserNotesResponse {
  notes: UserNote[]
  pagination: {
    limit: number
    offset: number
    count: number
  }
}

export function useUserNotes(wallet: string | null, config?: SWRConfiguration<UserNotesResponse>) {
  const endpoint = wallet ? `/admin/credits/user/${wallet}/notes` : null
  return useAdminApi<UserNotesResponse>(endpoint, config)
}

// User deposits (for a specific user)
export function useUserDeposits(
  wallet: string | null,
  params?: { limit?: number; offset?: number },
  config?: SWRConfiguration<{
    deposits: DepositRecord[]
    pagination: { limit: number; offset: number; count: number }
  }>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  const query = searchParams.toString()

  const endpoint = wallet
    ? `/admin/credits/user/${wallet}/deposits${query ? `?${query}` : ''}`
    : null

  return useAdminApi<{
    deposits: DepositRecord[]
    pagination: { limit: number; offset: number; count: number }
  }>(endpoint, config)
}

// User adjustments (for a specific user)
export function useUserAdjustments(
  wallet: string | null,
  params?: { limit?: number; offset?: number },
  config?: SWRConfiguration<{
    adjustments: CreditAdjustment[]
    pagination: { limit: number; offset: number; count: number }
  }>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  const query = searchParams.toString()

  const endpoint = wallet
    ? `/admin/credits/user/${wallet}/adjustments${query ? `?${query}` : ''}`
    : null

  return useAdminApi<{
    adjustments: CreditAdjustment[]
    pagination: { limit: number; offset: number; count: number }
  }>(endpoint, config)
}

// ============================================
// AGENTS ADMIN HOOKS
// ============================================

export interface AgentStats {
  total_agents: number
  active_agents: number
  suspended_agents: number
  by_framework: Record<string, number>
  by_status: Record<string, number>
  created_7d: number
  created_30d: number
}

export interface AgentListItem {
  id: string
  name: string
  description: string | null
  framework: string
  status: string
  wallet_address: string
  owner_name: string | null
  is_suspended: boolean
  suspended_at: string | null
  claw_config: Record<string, unknown> | null
  created_at: string
  updated_at: string
  total_requests: number
  total_blocks: number
  is_deployed: boolean
}

export interface AgentDetails {
  id: string
  name: string
  description: string | null
  icon: string | null
  framework: string
  status: string
  wallet_address: string
  owner_name: string | null
  is_suspended: boolean
  suspended_at: string | null
  suspended_by: string | null
  suspension_reason: string | null
  flow: Record<string, unknown> | null
  config: Record<string, unknown> | null
  claw_config: Record<string, unknown> | null
  integration_config: Record<string, unknown> | null
  version: number
  created_at: string
  updated_at: string
  total_requests_30d: number
  total_blocks_30d: number
  block_rate_30d: number
  avg_latency_ms: number
  deployments_count: number
  active_deployment_id: string | null
}

export interface AgentAnalyticsDay {
  date: string
  requests: number
  blocks: number
  block_rate: number
  avg_latency_ms: number
  gate_truth_blocks: number
  gate_harm_blocks: number
  gate_scope_blocks: number
  gate_purpose_blocks: number
}

export interface AgentStatsResponse {
  stats: AgentStats
  frameworks: string[]
  statuses: string[]
  generated_at: string
}

export interface AgentListResponse {
  agents: AgentListItem[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    framework: string | null
    status: string | null
    suspended: boolean | null
    search: string | null
  }
}

export interface AgentAnalyticsResponse {
  agent_id: string
  days: number
  analytics: AgentAnalyticsDay[]
  summary: {
    total_requests: number
    total_blocks: number
    block_rate: number
    gate_truth_blocks: number
    gate_harm_blocks: number
    gate_scope_blocks: number
    gate_purpose_blocks: number
  }
}

// Agent stats
export function useAgentsStats(config?: SWRConfiguration<AgentStatsResponse>) {
  return useAdminApi<AgentStatsResponse>('/admin/agents/stats', {
    refreshInterval: 60000, // Refresh every minute
    ...config,
  })
}

// Agent list with filters
export function useAgentsList(
  params?: {
    limit?: number
    offset?: number
    framework?: string
    status?: string
    suspended?: boolean
    search?: string
    order_by?: 'name' | 'created_at' | 'updated_at'
    order_dir?: 'asc' | 'desc'
  },
  config?: SWRConfiguration<AgentListResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.framework) searchParams.set('framework', params.framework)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.suspended !== undefined) searchParams.set('suspended', String(params.suspended))
  if (params?.search) searchParams.set('search', params.search)
  if (params?.order_by) searchParams.set('order_by', params.order_by)
  if (params?.order_dir) searchParams.set('order_dir', params.order_dir)
  const query = searchParams.toString()

  return useAdminApi<AgentListResponse>(`/admin/agents${query ? `?${query}` : ''}`, config)
}

// Agent details
export function useAgentDetails(
  agentId: string | null,
  config?: SWRConfiguration<{ agent: AgentDetails }>
) {
  return useAdminApi<{ agent: AgentDetails }>(agentId ? `/admin/agents/${agentId}` : null, config)
}

// Agent analytics
export function useAgentAnalytics(
  agentId: string | null,
  days?: number,
  config?: SWRConfiguration<AgentAnalyticsResponse>
) {
  const query = days ? `?days=${days}` : ''
  return useAdminApi<AgentAnalyticsResponse>(
    agentId ? `/admin/agents/${agentId}/analytics${query}` : null,
    config
  )
}

// ============================================
// DEPLOYMENTS ADMIN HOOKS
// ============================================

export interface DeploymentStats {
  total_deployments: number
  active_deployments: number
  suspended_deployments: number
  by_environment: Record<string, number>
  by_status: Record<string, number>
  created_7d: number
  created_30d: number
}

export interface DeploymentListItem {
  id: string
  agent_id: string
  agent_name: string
  owner_wallet: string
  owner_name: string | null
  version: number
  status: string
  environment: string
  endpoint_url: string | null
  is_active: boolean
  is_suspended: boolean
  suspended_at: string | null
  rate_limit_override: number | null
  created_at: string
  stopped_at: string | null
  requests_24h: number
}

export interface DeploymentDetails {
  id: string
  agent_id: string
  agent_name: string
  agent_framework: string
  owner_wallet: string
  owner_name: string | null
  version: number
  status: string
  environment: string
  endpoint_url: string | null
  is_active: boolean
  is_suspended: boolean
  suspended_at: string | null
  suspended_by: string | null
  suspension_reason: string | null
  rate_limit_override: number | null
  config_snapshot: Record<string, unknown> | null
  flow_snapshot: Record<string, unknown> | null
  claw_snapshot: Record<string, unknown> | null
  notes: string | null
  deployed_by: string | null
  created_at: string
  stopped_at: string | null
  requests_24h: number
  requests_7d: number
  blocks_24h: number
  api_keys_count: number
}

export interface DeploymentLog {
  id: string
  input_preview: string | null
  output_preview: string | null
  claw_blocked: boolean
  blocked_gate: string | null
  execution_time_ms: number | null
  cost_usd: number | null
  created_at: string
}

export interface DeploymentApiKey {
  id: string
  key_prefix: string
  name: string | null
  environment: string
  is_revoked: boolean
  rate_limit: number | null
  created_at: string
  last_used_at: string | null
  requests_24h: number
  requests_total: number
}

export interface DeploymentStatsResponse {
  stats: DeploymentStats
  environments: string[]
  statuses: string[]
  generated_at: string
}

export interface DeploymentListResponse {
  deployments: DeploymentListItem[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    environment: string | null
    status: string | null
    suspended: boolean | null
    active_only: boolean | null
  }
}

export interface DeploymentLogsResponse {
  logs: DeploymentLog[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    blocked_only: boolean | null
  }
}

// Deployment stats
export function useDeploymentsStats(config?: SWRConfiguration<DeploymentStatsResponse>) {
  return useAdminApi<DeploymentStatsResponse>('/admin/deployments/stats', {
    refreshInterval: 60000,
    ...config,
  })
}

// Deployment list with filters
export function useDeploymentsList(
  params?: {
    limit?: number
    offset?: number
    environment?: string
    status?: string
    suspended?: boolean
    active_only?: boolean
  },
  config?: SWRConfiguration<DeploymentListResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.environment) searchParams.set('environment', params.environment)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.suspended !== undefined) searchParams.set('suspended', String(params.suspended))
  if (params?.active_only !== undefined) searchParams.set('active_only', String(params.active_only))
  const query = searchParams.toString()

  return useAdminApi<DeploymentListResponse>(
    `/admin/deployments${query ? `?${query}` : ''}`,
    config
  )
}

// Deployment details
export function useDeploymentDetails(
  deploymentId: string | null,
  config?: SWRConfiguration<{ deployment: DeploymentDetails }>
) {
  return useAdminApi<{ deployment: DeploymentDetails }>(
    deploymentId ? `/admin/deployments/${deploymentId}` : null,
    config
  )
}

// Deployment logs
export function useDeploymentLogs(
  deploymentId: string | null,
  params?: { limit?: number; offset?: number; blocked_only?: boolean },
  config?: SWRConfiguration<DeploymentLogsResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.blocked_only !== undefined)
    searchParams.set('blocked_only', String(params.blocked_only))
  const query = searchParams.toString()

  return useAdminApi<DeploymentLogsResponse>(
    deploymentId ? `/admin/deployments/${deploymentId}/logs${query ? `?${query}` : ''}` : null,
    config
  )
}

// Deployment API keys
export function useDeploymentApiKeys(
  deploymentId: string | null,
  config?: SWRConfiguration<{ keys: DeploymentApiKey[]; count: number }>
) {
  return useAdminApi<{ keys: DeploymentApiKey[]; count: number }>(
    deploymentId ? `/admin/deployments/${deploymentId}/keys` : null,
    config
  )
}

// ============================================
// GOVERNANCE ADMIN HOOKS
// ============================================

export interface GovernanceStats {
  total_proposals: number
  active_proposals: number
  hidden_proposals: number
  passed_proposals: number
  rejected_proposals: number
  unique_voters: number
  total_votes: number
  total_comments: number
  proposals_7d: number
  proposals_30d: number
  votes_7d: number
  participation_rate: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

export interface ProposalListItem {
  id: string
  number: number
  title: string
  type: string
  status: string
  author_wallet: string
  author_name: string | null
  is_hidden: boolean
  hidden_at: string | null
  hidden_reason: string | null
  votes_for: number
  votes_against: number
  comments_count: number
  created_at: string
  voting_end_at: string | null
}

export interface ProposalDetails {
  id: string
  number: number
  title: string
  body: string
  type: string
  status: string
  author_wallet: string
  author_name: string | null
  is_hidden: boolean
  hidden_at: string | null
  hidden_by: string | null
  hidden_reason: string | null
  votes_for: number
  votes_against: number
  quorum_required: number
  majority_required: number
  comments_count: number
  discussion_end_at: string | null
  voting_start_at: string | null
  voting_end_at: string | null
  created_at: string
  updated_at: string | null
}

export interface VoteSummary {
  wallet_address: string
  display_name: string | null
  vote_direction: string
  voting_power: number
  created_at: string
}

export interface GovernanceStatsResponse {
  stats: GovernanceStats
  statuses: string[]
  types: string[]
  generated_at: string
}

export interface ProposalListResponse {
  proposals: ProposalListItem[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    status: string | null
    type: string | null
    hidden: boolean | null
    search: string | null
  }
}

export interface ProposalVotesResponse {
  votes: VoteSummary[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
}

// Governance stats
export function useGovernanceStats(config?: SWRConfiguration<GovernanceStatsResponse>) {
  return useAdminApi<GovernanceStatsResponse>('/admin/governance/stats', {
    refreshInterval: 60000,
    ...config,
  })
}

// Proposal list with filters
export function useProposalsList(
  params?: {
    limit?: number
    offset?: number
    status?: string
    type?: string
    hidden?: boolean
    search?: string
    order_by?: 'number' | 'created_at' | 'voting_end_at'
    order_dir?: 'asc' | 'desc'
  },
  config?: SWRConfiguration<ProposalListResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.status) searchParams.set('status', params.status)
  if (params?.type) searchParams.set('type', params.type)
  if (params?.hidden !== undefined) searchParams.set('hidden', String(params.hidden))
  if (params?.search) searchParams.set('search', params.search)
  if (params?.order_by) searchParams.set('order_by', params.order_by)
  if (params?.order_dir) searchParams.set('order_dir', params.order_dir)
  const query = searchParams.toString()

  return useAdminApi<ProposalListResponse>(
    `/admin/governance/proposals${query ? `?${query}` : ''}`,
    config
  )
}

// Proposal details
export function useProposalDetails(
  proposalId: string | null,
  config?: SWRConfiguration<{ proposal: ProposalDetails }>
) {
  return useAdminApi<{ proposal: ProposalDetails }>(
    proposalId ? `/admin/governance/proposals/${proposalId}` : null,
    config
  )
}

// Proposal votes
export function useProposalVotes(
  proposalId: string | null,
  params?: { limit?: number; offset?: number },
  config?: SWRConfiguration<ProposalVotesResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  const query = searchParams.toString()

  return useAdminApi<ProposalVotesResponse>(
    proposalId
      ? `/admin/governance/proposals/${proposalId}/votes${query ? `?${query}` : ''}`
      : null,
    config
  )
}

// ============================================
// COMPLIANCE ADMIN HOOKS
// ============================================

export interface ComplianceStats {
  total_requests: number
  pending_requests: number
  in_progress_requests: number
  completed_requests: number
  rejected_requests: number
  requests_7d: number
  requests_30d: number
  avg_completion_hours: number
  total_deletions: number
  deletions_7d: number
  deletions_30d: number
  by_request_type: Record<string, number>
  by_status: Record<string, number>
}

export interface GdprRequestListItem {
  id: string
  wallet_address: string
  display_name: string | null
  request_type: string
  status: string
  requested_at: string
  completed_at: string | null
  admin_wallet_hash: string | null
  created_at: string
}

export interface GdprRequestDetails {
  id: string
  wallet_address: string
  display_name: string | null
  request_type: string
  status: string
  requested_at: string
  completed_at: string | null
  admin_wallet_hash: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string | null
}

export interface DeletionAuditItem {
  id: string
  wallet_hash: string
  data_categories: string[]
  retained_categories: string[] | null
  retention_reason: string | null
  deletion_date: string
  request_id: string | null
  created_at: string
}

export interface ComplianceReport {
  period_start: string
  period_end: string
  total_requests: number
  completed_requests: number
  avg_completion_hours: number
  total_deletions: number
  by_request_type: Record<string, number>
  by_status: Record<string, number>
  generated_at: string
}

export interface ComplianceStatsResponse {
  stats: ComplianceStats
  request_types: string[]
  statuses: string[]
  generated_at: string
}

export interface GdprRequestListResponse {
  requests: GdprRequestListItem[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    request_type: string | null
    status: string | null
    search: string | null
  }
}

export interface DeletionAuditResponse {
  deletions: DeletionAuditItem[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    search: string | null
  }
}

// Compliance stats
export function useComplianceStats(config?: SWRConfiguration<ComplianceStatsResponse>) {
  return useAdminApi<ComplianceStatsResponse>('/admin/compliance/stats', {
    refreshInterval: 60000,
    ...config,
  })
}

// GDPR requests list with filters
export function useGdprRequestsList(
  params?: {
    limit?: number
    offset?: number
    request_type?: string
    status?: string
    search?: string
    order_by?: 'requested_at' | 'created_at' | 'completed_at'
    order_dir?: 'asc' | 'desc'
  },
  config?: SWRConfiguration<GdprRequestListResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.request_type) searchParams.set('request_type', params.request_type)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.order_by) searchParams.set('order_by', params.order_by)
  if (params?.order_dir) searchParams.set('order_dir', params.order_dir)
  const query = searchParams.toString()

  return useAdminApi<GdprRequestListResponse>(
    `/admin/compliance/requests${query ? `?${query}` : ''}`,
    config
  )
}

// GDPR request details
export function useGdprRequestDetails(
  requestId: string | null,
  config?: SWRConfiguration<{ request: GdprRequestDetails }>
) {
  return useAdminApi<{ request: GdprRequestDetails }>(
    requestId ? `/admin/compliance/requests/${requestId}` : null,
    config
  )
}

// Deletion audit list
export function useDeletionAuditList(
  params?: {
    limit?: number
    offset?: number
    search?: string
    order_by?: 'deletion_date' | 'created_at'
    order_dir?: 'asc' | 'desc'
  },
  config?: SWRConfiguration<DeletionAuditResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.search) searchParams.set('search', params.search)
  if (params?.order_by) searchParams.set('order_by', params.order_by)
  if (params?.order_dir) searchParams.set('order_dir', params.order_dir)
  const query = searchParams.toString()

  return useAdminApi<DeletionAuditResponse>(
    `/admin/compliance/deletions${query ? `?${query}` : ''}`,
    config
  )
}

// Compliance report
export function useComplianceReport(
  startDate: string | null,
  endDate: string | null,
  config?: SWRConfiguration<{ report: ComplianceReport }>
) {
  const endpoint =
    startDate && endDate
      ? `/admin/compliance/report?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
      : null

  return useAdminApi<{ report: ComplianceReport }>(endpoint, config)
}

// ============================================
// SYSTEM CONFIG ADMIN HOOKS
// ============================================

export interface ConfigItem {
  key: string
  value: unknown
  description: string | null
  category: string
  is_sensitive: boolean
  updated_at: string
  updated_by: string | null
}

export interface SystemConfigResponse {
  config: ConfigItem[]
  by_category: Record<string, ConfigItem[]>
  categories: string[]
  generated_at: string
}

export interface FeatureFlag {
  id: string
  name: string
  description: string | null
  is_enabled: boolean
  rollout_percentage: number
  conditions: Record<string, unknown>
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface FeatureFlagsResponse {
  flags: FeatureFlag[]
  stats: {
    total: number
    enabled: number
    disabled: number
    partial_rollout: number
  }
  generated_at: string
}

export interface MaintenanceWindow {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string
  is_active: boolean
  show_banner: boolean
  affects_services: string[]
  created_by: string
  created_at: string
}

export interface MaintenanceWindowsResponse {
  windows: MaintenanceWindow[]
  stats: {
    total: number
    active: number
    upcoming: number
    past: number
  }
  services: string[]
  generated_at: string
}

// System config
export function useSystemConfig(config?: SWRConfiguration<SystemConfigResponse>) {
  return useAdminApi<SystemConfigResponse>('/admin/system/config', config)
}

// Feature flags
export function useFeatureFlags(config?: SWRConfiguration<FeatureFlagsResponse>) {
  return useAdminApi<FeatureFlagsResponse>('/admin/system/flags', config)
}

// Maintenance windows
export function useMaintenanceWindows(config?: SWRConfiguration<MaintenanceWindowsResponse>) {
  return useAdminApi<MaintenanceWindowsResponse>('/admin/system/maintenance', config)
}

// ============================================
// AUDIT LOG ADMIN HOOKS
// ============================================

export interface AuditStats {
  total_entries: number
  entries_24h: number
  entries_7d: number
  entries_30d: number
  unique_admins: number
  by_action_type: Record<string, number>
  by_target_type: Record<string, number>
  by_status_code: Record<string, number>
}

export interface AuditStatsResponse {
  stats: AuditStats
  action_types: string[]
  target_types: string[]
  status_codes: number[]
  generated_at: string
}

export interface AuditLogEntry {
  id: string
  admin_wallet_hash: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  ip_hash: string | null
  request_id: string | null
  status_code: number
  created_at: string
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[]
  pagination: {
    limit: number
    offset: number
    count: number
    total: number
  }
  filters: {
    admin_hash: string | null
    action_prefix: string | null
    target_type: string | null
    status_code: number | null
    start_date: string | null
    end_date: string | null
  }
}

// Audit stats
export function useAuditStats(config?: SWRConfiguration<AuditStatsResponse>) {
  return useAdminApi<AuditStatsResponse>('/admin/audit/stats', {
    refreshInterval: 60000,
    ...config,
  })
}

// Audit logs list with filters
export function useAuditLogs(
  params?: {
    limit?: number
    offset?: number
    admin_hash?: string
    action_prefix?: string
    target_type?: string
    status_code?: number
    start_date?: string
    end_date?: string
    order_by?: 'created_at' | 'action'
    order_dir?: 'asc' | 'desc'
  },
  config?: SWRConfiguration<AuditLogsResponse>
) {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))
  if (params?.admin_hash) searchParams.set('admin_hash', params.admin_hash)
  if (params?.action_prefix) searchParams.set('action_prefix', params.action_prefix)
  if (params?.target_type) searchParams.set('target_type', params.target_type)
  if (params?.status_code !== undefined) searchParams.set('status_code', String(params.status_code))
  if (params?.start_date) searchParams.set('start_date', params.start_date)
  if (params?.end_date) searchParams.set('end_date', params.end_date)
  if (params?.order_by) searchParams.set('order_by', params.order_by)
  if (params?.order_dir) searchParams.set('order_dir', params.order_dir)
  const query = searchParams.toString()

  return useAdminApi<AuditLogsResponse>(`/admin/audit/logs${query ? `?${query}` : ''}`, config)
}
