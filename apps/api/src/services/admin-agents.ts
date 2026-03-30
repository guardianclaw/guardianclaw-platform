/**
 * Admin Agents Service
 * Administrative functions for agent management
 *
 * Provides platform-wide agent statistics, listing with filters,
 * agent details, suspension management, and analytics.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPE DEFINITIONS
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

export interface AgentListFilters {
  framework?: string
  status?: string
  suspended?: boolean
  search?: string
  orderBy?: 'name' | 'created_at' | 'updated_at'
  orderDir?: 'asc' | 'desc'
}

export interface SetAgentStatusResult {
  success: boolean
  previous_status: boolean
  new_status: boolean
  error?: string
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get platform-wide agent statistics
 */
export async function getAgentsStats(supabase: SupabaseClient): Promise<AgentStats> {
  const { data, error } = await supabase.rpc('admin_get_agents_stats')

  if (error) {
    console.error('Failed to get agents stats:', error)
    throw new Error('Failed to get agent statistics')
  }

  if (!data || data.length === 0) {
    return {
      total_agents: 0,
      active_agents: 0,
      suspended_agents: 0,
      by_framework: {},
      by_status: {},
      created_7d: 0,
      created_30d: 0,
    }
  }

  const row = data[0]
  return {
    total_agents: Number(row.total_agents) || 0,
    active_agents: Number(row.active_agents) || 0,
    suspended_agents: Number(row.suspended_agents) || 0,
    by_framework: row.by_framework || {},
    by_status: row.by_status || {},
    created_7d: Number(row.created_7d) || 0,
    created_30d: Number(row.created_30d) || 0,
  }
}

/**
 * List agents with pagination and filters
 */
export async function listAgents(
  supabase: SupabaseClient,
  limit: number,
  offset: number,
  filters: AgentListFilters = {}
): Promise<{ agents: AgentListItem[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_agents', {
    p_limit: limit,
    p_offset: offset,
    p_framework: filters.framework || null,
    p_status: filters.status || null,
    p_suspended: filters.suspended ?? null,
    p_search: filters.search || null,
    p_order_by: filters.orderBy || 'created_at',
    p_order_dir: filters.orderDir || 'desc',
  })

  if (error) {
    console.error('Failed to list agents:', error)
    throw new Error('Failed to list agents')
  }

  if (!data || data.length === 0) {
    return { agents: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const agents: AgentListItem[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    framework: row.framework as string,
    status: row.status as string,
    wallet_address: row.wallet_address as string,
    owner_name: row.owner_name as string | null,
    is_suspended: row.is_suspended as boolean,
    suspended_at: row.suspended_at as string | null,
    claw_config: row.claw_config as Record<string, unknown> | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    total_requests: Number(row.total_requests) || 0,
    total_blocks: Number(row.total_blocks) || 0,
    is_deployed: row.is_deployed as boolean,
  }))

  return { agents, total }
}

/**
 * Get full agent details
 */
export async function getAgentDetails(
  supabase: SupabaseClient,
  agentId: string
): Promise<AgentDetails | null> {
  const { data, error } = await supabase.rpc('admin_get_agent_details', {
    p_agent_id: agentId,
  })

  if (error) {
    console.error('Failed to get agent details:', error)
    throw new Error('Failed to get agent details')
  }

  if (!data || data.length === 0) {
    return null
  }

  const row = data[0]
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    framework: row.framework,
    status: row.status,
    wallet_address: row.wallet_address,
    owner_name: row.owner_name,
    is_suspended: row.is_suspended,
    suspended_at: row.suspended_at,
    suspended_by: row.suspended_by,
    suspension_reason: row.suspension_reason,
    flow: row.flow,
    config: row.config,
    claw_config: row.claw_config,
    integration_config: row.integration_config,
    version: Number(row.version) || 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total_requests_30d: Number(row.total_requests_30d) || 0,
    total_blocks_30d: Number(row.total_blocks_30d) || 0,
    block_rate_30d: Number(row.block_rate_30d) || 0,
    avg_latency_ms: Number(row.avg_latency_ms) || 0,
    deployments_count: Number(row.deployments_count) || 0,
    active_deployment_id: row.active_deployment_id,
  }
}

/**
 * Suspend or unsuspend an agent
 */
export async function setAgentStatus(
  supabase: SupabaseClient,
  agentId: string,
  suspended: boolean,
  adminHash: string,
  reason?: string
): Promise<SetAgentStatusResult> {
  const { data, error } = await supabase.rpc('admin_set_agent_status', {
    p_agent_id: agentId,
    p_suspended: suspended,
    p_admin_hash: adminHash,
    p_reason: reason || null,
  })

  if (error) {
    console.error('Failed to set agent status:', error)
    return {
      success: false,
      previous_status: false,
      new_status: false,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      previous_status: false,
      new_status: false,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]
  return {
    success: row.success,
    previous_status: row.previous_status,
    new_status: row.new_status,
    error: row.error || undefined,
  }
}

/**
 * Get agent analytics for the specified number of days
 */
export async function getAgentAnalytics(
  supabase: SupabaseClient,
  agentId: string,
  days: number = 30
): Promise<AgentAnalyticsDay[]> {
  const { data, error } = await supabase.rpc('admin_get_agent_analytics', {
    p_agent_id: agentId,
    p_days: days,
  })

  if (error) {
    console.error('Failed to get agent analytics:', error)
    throw new Error('Failed to get agent analytics')
  }

  if (!data) {
    return []
  }

  return data.map((row: Record<string, unknown>) => ({
    date: row.date as string,
    requests: Number(row.requests) || 0,
    blocks: Number(row.blocks) || 0,
    block_rate: Number(row.block_rate) || 0,
    avg_latency_ms: Number(row.avg_latency_ms) || 0,
    gate_truth_blocks: Number(row.gate_truth_blocks) || 0,
    gate_harm_blocks: Number(row.gate_harm_blocks) || 0,
    gate_scope_blocks: Number(row.gate_scope_blocks) || 0,
    gate_purpose_blocks: Number(row.gate_purpose_blocks) || 0,
  }))
}

/**
 * Get available frameworks for filtering
 */
export function getAvailableFrameworks(): string[] {
  return [
    'anthropic_sdk',
    'openai_agents',
    'coinbase_agentkit',
    'solana_agent_kit',
    'google_adk',
    'virtuals_protocol',
    'elizaos',
    'voltagent',
    'moltbot',
    'custom',
  ]
}

/**
 * Get available agent statuses for filtering
 */
export function getAvailableStatuses(): string[] {
  return ['draft', 'testing', 'deployed', 'archived']
}
