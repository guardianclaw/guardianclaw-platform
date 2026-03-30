/**
 * Admin Deployments Service
 * Administrative functions for deployment management
 *
 * Provides platform-wide deployment statistics, listing with filters,
 * deployment details, suspension management, rate limiting, and logs.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPE DEFINITIONS
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

export interface DeploymentListFilters {
  environment?: string
  status?: string
  suspended?: boolean
  activeOnly?: boolean
}

export interface SetDeploymentStatusResult {
  success: boolean
  previous_status: boolean
  new_status: boolean
  error?: string
}

export interface SetRateLimitResult {
  success: boolean
  previous_limit: number | null
  new_limit: number | null
  error?: string
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get platform-wide deployment statistics
 */
export async function getDeploymentsStats(supabase: SupabaseClient): Promise<DeploymentStats> {
  const { data, error } = await supabase.rpc('admin_get_deployments_stats')

  if (error) {
    console.error('Failed to get deployments stats:', error)
    throw new Error('Failed to get deployment statistics')
  }

  if (!data || data.length === 0) {
    return {
      total_deployments: 0,
      active_deployments: 0,
      suspended_deployments: 0,
      by_environment: {},
      by_status: {},
      created_7d: 0,
      created_30d: 0,
    }
  }

  const row = data[0]
  return {
    total_deployments: Number(row.total_deployments) || 0,
    active_deployments: Number(row.active_deployments) || 0,
    suspended_deployments: Number(row.suspended_deployments) || 0,
    by_environment: row.by_environment || {},
    by_status: row.by_status || {},
    created_7d: Number(row.created_7d) || 0,
    created_30d: Number(row.created_30d) || 0,
  }
}

/**
 * List deployments with pagination and filters
 */
export async function listDeployments(
  supabase: SupabaseClient,
  limit: number,
  offset: number,
  filters: DeploymentListFilters = {}
): Promise<{ deployments: DeploymentListItem[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_deployments', {
    p_limit: limit,
    p_offset: offset,
    p_environment: filters.environment || null,
    p_status: filters.status || null,
    p_suspended: filters.suspended ?? null,
    p_active_only: filters.activeOnly ?? null,
  })

  if (error) {
    console.error('Failed to list deployments:', error)
    throw new Error('Failed to list deployments')
  }

  if (!data || data.length === 0) {
    return { deployments: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const deployments: DeploymentListItem[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    agent_id: row.agent_id as string,
    agent_name: row.agent_name as string,
    owner_wallet: row.owner_wallet as string,
    owner_name: row.owner_name as string | null,
    version: Number(row.version) || 1,
    status: row.status as string,
    environment: row.environment as string,
    endpoint_url: row.endpoint_url as string | null,
    is_active: row.is_active as boolean,
    is_suspended: row.is_suspended as boolean,
    suspended_at: row.suspended_at as string | null,
    rate_limit_override: row.rate_limit_override as number | null,
    created_at: row.created_at as string,
    stopped_at: row.stopped_at as string | null,
    requests_24h: Number(row.requests_24h) || 0,
  }))

  return { deployments, total }
}

/**
 * Get full deployment details
 */
export async function getDeploymentDetails(
  supabase: SupabaseClient,
  deploymentId: string
): Promise<DeploymentDetails | null> {
  const { data, error } = await supabase.rpc('admin_get_deployment_details', {
    p_deployment_id: deploymentId,
  })

  if (error) {
    console.error('Failed to get deployment details:', error)
    throw new Error('Failed to get deployment details')
  }

  if (!data || data.length === 0) {
    return null
  }

  const row = data[0]
  return {
    id: row.id,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    agent_framework: row.agent_framework,
    owner_wallet: row.owner_wallet,
    owner_name: row.owner_name,
    version: Number(row.version) || 1,
    status: row.status,
    environment: row.environment,
    endpoint_url: row.endpoint_url,
    is_active: row.is_active,
    is_suspended: row.is_suspended,
    suspended_at: row.suspended_at,
    suspended_by: row.suspended_by,
    suspension_reason: row.suspension_reason,
    rate_limit_override: row.rate_limit_override,
    config_snapshot: row.config_snapshot,
    flow_snapshot: row.flow_snapshot,
    claw_snapshot: row.claw_snapshot,
    notes: row.notes,
    deployed_by: row.deployed_by,
    created_at: row.created_at,
    stopped_at: row.stopped_at,
    requests_24h: Number(row.requests_24h) || 0,
    requests_7d: Number(row.requests_7d) || 0,
    blocks_24h: Number(row.blocks_24h) || 0,
    api_keys_count: Number(row.api_keys_count) || 0,
  }
}

/**
 * Suspend or unsuspend a deployment
 */
export async function setDeploymentStatus(
  supabase: SupabaseClient,
  deploymentId: string,
  suspended: boolean,
  adminHash: string,
  reason?: string
): Promise<SetDeploymentStatusResult> {
  const { data, error } = await supabase.rpc('admin_set_deployment_status', {
    p_deployment_id: deploymentId,
    p_suspended: suspended,
    p_admin_hash: adminHash,
    p_reason: reason || null,
  })

  if (error) {
    console.error('Failed to set deployment status:', error)
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
 * Set deployment rate limit override
 */
export async function setDeploymentRateLimit(
  supabase: SupabaseClient,
  deploymentId: string,
  rateLimit: number | null,
  adminHash: string
): Promise<SetRateLimitResult> {
  const { data, error } = await supabase.rpc('admin_set_deployment_rate_limit', {
    p_deployment_id: deploymentId,
    p_rate_limit: rateLimit,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to set deployment rate limit:', error)
    return {
      success: false,
      previous_limit: null,
      new_limit: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      previous_limit: null,
      new_limit: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]
  return {
    success: row.success,
    previous_limit: row.previous_limit,
    new_limit: row.new_limit,
    error: row.error || undefined,
  }
}

/**
 * Get deployment execution logs
 */
export async function getDeploymentLogs(
  supabase: SupabaseClient,
  deploymentId: string,
  limit: number,
  offset: number,
  blockedOnly?: boolean
): Promise<{ logs: DeploymentLog[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_deployment_logs', {
    p_deployment_id: deploymentId,
    p_limit: limit,
    p_offset: offset,
    p_blocked_only: blockedOnly ?? null,
  })

  if (error) {
    console.error('Failed to get deployment logs:', error)
    throw new Error('Failed to get deployment logs')
  }

  if (!data || data.length === 0) {
    return { logs: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const logs: DeploymentLog[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    input_preview: row.input_preview as string | null,
    output_preview: row.output_preview as string | null,
    claw_blocked: row.claw_blocked as boolean,
    blocked_gate: row.blocked_gate as string | null,
    execution_time_ms: row.execution_time_ms as number | null,
    cost_usd: row.cost_usd as number | null,
    created_at: row.created_at as string,
  }))

  return { logs, total }
}

/**
 * Get deployment API keys with usage stats
 */
export async function getDeploymentApiKeys(
  supabase: SupabaseClient,
  deploymentId: string
): Promise<DeploymentApiKey[]> {
  const { data, error } = await supabase.rpc('admin_get_deployment_api_keys', {
    p_deployment_id: deploymentId,
  })

  if (error) {
    console.error('Failed to get deployment API keys:', error)
    throw new Error('Failed to get deployment API keys')
  }

  if (!data) {
    return []
  }

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    key_prefix: row.key_prefix as string,
    name: row.name as string | null,
    environment: row.environment as string,
    is_revoked: row.is_revoked as boolean,
    rate_limit: row.rate_limit as number | null,
    created_at: row.created_at as string,
    last_used_at: row.last_used_at as string | null,
    requests_24h: Number(row.requests_24h) || 0,
    requests_total: Number(row.requests_total) || 0,
  }))
}

/**
 * Get available environments for filtering
 */
export function getAvailableEnvironments(): string[] {
  return ['development', 'staging', 'production']
}

/**
 * Get available deployment statuses for filtering
 */
export function getAvailableDeploymentStatuses(): string[] {
  return ['pending', 'deployed', 'stopped', 'failed']
}
