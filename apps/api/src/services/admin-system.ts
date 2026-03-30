/**
 * Admin System Service
 * Administrative functions for platform configuration, feature flags, and maintenance windows
 *
 * Pattern: Uses RPC functions exclusively (consistent with admin-agents.ts)
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPE DEFINITIONS
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

export interface UpdateConfigResult {
  success: boolean
  key: string | null
  value: unknown
  updated_at: string | null
  error?: string
}

export interface UpdateFlagResult {
  success: boolean
  id: string | null
  is_enabled: boolean | null
  rollout_percentage: number | null
  updated_at: string | null
  error?: string
}

export interface CreateWindowResult {
  success: boolean
  id: string | null
  created_at: string | null
  error?: string
}

export interface DeleteWindowResult {
  success: boolean
  error?: string
}

export interface ToggleWindowResult {
  success: boolean
  is_active: boolean | null
  error?: string
}

// ============================================
// CONFIG SERVICE FUNCTIONS
// ============================================

/**
 * Get all platform configuration
 */
export async function getSystemConfig(supabase: SupabaseClient): Promise<ConfigItem[]> {
  const { data, error } = await supabase.rpc('admin_get_system_config')

  if (error) {
    console.error('Failed to get system config:', error)
    throw new Error('Failed to get system configuration')
  }

  if (!data || data.length === 0) {
    return []
  }

  return data.map((row: Record<string, unknown>) => ({
    key: row.key as string,
    value: row.value,
    description: row.description as string | null,
    category: row.category as string,
    is_sensitive: row.is_sensitive as boolean,
    updated_at: row.updated_at as string,
    updated_by: row.updated_by as string | null,
  }))
}

/**
 * Update a configuration value
 */
export async function updateConfig(
  supabase: SupabaseClient,
  key: string,
  value: unknown,
  adminHash: string
): Promise<UpdateConfigResult> {
  const { data, error } = await supabase.rpc('admin_update_config', {
    p_key: key,
    p_value: value,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to update config:', error)
    return {
      success: false,
      key: null,
      value: null,
      updated_at: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      key: null,
      value: null,
      updated_at: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      key: null,
      value: null,
      updated_at: null,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return {
    success: true,
    key: row.key,
    value: row.value,
    updated_at: row.updated_at,
  }
}

// ============================================
// FEATURE FLAGS SERVICE FUNCTIONS
// ============================================

/**
 * Get all feature flags
 */
export async function listFeatureFlags(supabase: SupabaseClient): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.rpc('admin_list_feature_flags')

  if (error) {
    console.error('Failed to list feature flags:', error)
    throw new Error('Failed to list feature flags')
  }

  if (!data || data.length === 0) {
    return []
  }

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    is_enabled: row.is_enabled as boolean,
    rollout_percentage: Number(row.rollout_percentage) || 0,
    conditions: (row.conditions as Record<string, unknown>) || {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    updated_by: row.updated_by as string | null,
  }))
}

/**
 * Update a feature flag
 */
export async function updateFeatureFlag(
  supabase: SupabaseClient,
  id: string,
  isEnabled: boolean,
  rolloutPercentage: number,
  conditions: Record<string, unknown> | null,
  adminHash: string
): Promise<UpdateFlagResult> {
  const { data, error } = await supabase.rpc('admin_update_feature_flag', {
    p_id: id,
    p_is_enabled: isEnabled,
    p_rollout_percentage: rolloutPercentage,
    p_conditions: conditions,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to update feature flag:', error)
    return {
      success: false,
      id: null,
      is_enabled: null,
      rollout_percentage: null,
      updated_at: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      id: null,
      is_enabled: null,
      rollout_percentage: null,
      updated_at: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      id: null,
      is_enabled: null,
      rollout_percentage: null,
      updated_at: null,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return {
    success: true,
    id: row.id,
    is_enabled: row.is_enabled,
    rollout_percentage: row.rollout_percentage,
    updated_at: row.updated_at,
  }
}

// ============================================
// MAINTENANCE WINDOWS SERVICE FUNCTIONS
// ============================================

/**
 * List all maintenance windows
 */
export async function listMaintenanceWindows(
  supabase: SupabaseClient
): Promise<MaintenanceWindow[]> {
  const { data, error } = await supabase.rpc('admin_list_maintenance_windows')

  if (error) {
    console.error('Failed to list maintenance windows:', error)
    throw new Error('Failed to list maintenance windows')
  }

  if (!data || data.length === 0) {
    return []
  }

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | null,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    is_active: row.is_active as boolean,
    show_banner: row.show_banner as boolean,
    affects_services: (row.affects_services as string[]) || [],
    created_by: row.created_by as string,
    created_at: row.created_at as string,
  }))
}

/**
 * Create a new maintenance window
 */
export async function createMaintenanceWindow(
  supabase: SupabaseClient,
  title: string,
  description: string | null,
  startsAt: string,
  endsAt: string,
  showBanner: boolean,
  affectsServices: string[],
  adminHash: string
): Promise<CreateWindowResult> {
  const { data, error } = await supabase.rpc('admin_create_maintenance_window', {
    p_title: title,
    p_description: description,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_show_banner: showBanner,
    p_affects_services: affectsServices,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to create maintenance window:', error)
    return {
      success: false,
      id: null,
      created_at: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      id: null,
      created_at: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      id: null,
      created_at: null,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return {
    success: true,
    id: row.id,
    created_at: row.created_at,
  }
}

/**
 * Delete a maintenance window
 */
export async function deleteMaintenanceWindow(
  supabase: SupabaseClient,
  id: string,
  adminHash: string
): Promise<DeleteWindowResult> {
  const { data, error } = await supabase.rpc('admin_delete_maintenance_window', {
    p_id: id,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to delete maintenance window:', error)
    return {
      success: false,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return { success: true }
}

/**
 * Toggle maintenance window active status
 */
export async function toggleMaintenanceWindow(
  supabase: SupabaseClient,
  id: string,
  isActive: boolean,
  adminHash: string
): Promise<ToggleWindowResult> {
  const { data, error } = await supabase.rpc('admin_toggle_maintenance_window', {
    p_id: id,
    p_is_active: isActive,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to toggle maintenance window:', error)
    return {
      success: false,
      is_active: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      is_active: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      is_active: null,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return {
    success: true,
    is_active: row.is_active,
  }
}

/**
 * Get available config categories
 */
export function getConfigCategories(): string[] {
  return ['general', 'pricing', 'limits', 'security']
}

/**
 * Get available services for maintenance windows
 */
export function getAvailableServices(): string[] {
  return ['api', 'web', 'runtime', 'database', 'all']
}

// ============================================
// CRON JOB HEALTH SERVICE FUNCTIONS
// ============================================

export interface JobHealthStatus {
  job_name: string
  last_run: string | null
  last_status: string
  last_duration_ms: number | null
  last_error: string | null
  runs_24h: number
  failures_24h: number
}

export interface CronHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  jobs: JobHealthStatus[]
  summary: {
    total_jobs: number
    healthy_jobs: number
    failed_jobs: number
    stale_jobs: number
  }
  generated_at: string
}

export interface RecordJobStartResult {
  success: boolean
  execution_id: string | null
  error?: string
}

export interface RecordJobFinishResult {
  success: boolean
  error?: string
}

/**
 * Get cron job health status
 */
export async function getCronHealthStatus(supabase: SupabaseClient): Promise<CronHealthResponse> {
  const { data, error } = await supabase.rpc('get_job_health_status')

  if (error) {
    console.error('Failed to get cron health status:', error)
    // Return degraded status if we can't get job data
    return {
      status: 'degraded',
      jobs: [],
      summary: {
        total_jobs: 0,
        healthy_jobs: 0,
        failed_jobs: 0,
        stale_jobs: 0,
      },
      generated_at: new Date().toISOString(),
    }
  }

  const jobs: JobHealthStatus[] = (data || []).map((row: Record<string, unknown>) => ({
    job_name: row.job_name as string,
    last_run: row.last_run as string | null,
    last_status: row.last_status as string,
    last_duration_ms: row.last_duration_ms as number | null,
    last_error: row.last_error as string | null,
    runs_24h: row.runs_24h as number,
    failures_24h: row.failures_24h as number,
  }))

  // Calculate health metrics
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  let healthyJobs = 0
  let failedJobs = 0
  let staleJobs = 0

  for (const job of jobs) {
    if (job.last_status === 'failed') {
      failedJobs++
    } else if (job.last_run && new Date(job.last_run) < oneHourAgo) {
      // Job hasn't run in over an hour - may be stale
      staleJobs++
    } else if (job.last_status === 'success') {
      healthyJobs++
    }
  }

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (failedJobs > 0 || staleJobs > jobs.length / 2) {
    status = 'unhealthy'
  } else if (staleJobs > 0) {
    status = 'degraded'
  }

  return {
    status,
    jobs,
    summary: {
      total_jobs: jobs.length,
      healthy_jobs: healthyJobs,
      failed_jobs: failedJobs,
      stale_jobs: staleJobs,
    },
    generated_at: new Date().toISOString(),
  }
}

/**
 * Record job execution start
 */
export async function recordJobStart(
  supabase: SupabaseClient,
  jobName: string,
  cronPattern: string,
  environment?: string,
  workerId?: string
): Promise<RecordJobStartResult> {
  const { data, error } = await supabase.rpc('record_job_start', {
    p_job_name: jobName,
    p_cron_pattern: cronPattern,
    p_environment: environment || null,
    p_worker_id: workerId || null,
  })

  if (error) {
    console.error('Failed to record job start:', error)
    return {
      success: false,
      execution_id: null,
      error: error.message,
    }
  }

  return {
    success: true,
    execution_id: data as string,
  }
}

/**
 * Record job execution completion
 */
export async function recordJobFinish(
  supabase: SupabaseClient,
  executionId: string,
  status: 'success' | 'failed' | 'timeout',
  details?: Record<string, unknown>,
  errorMessage?: string,
  errorStack?: string
): Promise<RecordJobFinishResult> {
  const { error } = await supabase.rpc('record_job_finish', {
    p_execution_id: executionId,
    p_status: status,
    p_details: details || {},
    p_error_message: errorMessage || null,
    p_error_stack: errorStack || null,
  })

  if (error) {
    console.error('Failed to record job finish:', error)
    return {
      success: false,
      error: error.message,
    }
  }

  return { success: true }
}

/**
 * Get list of expected cron jobs for validation
 */
export function getExpectedCronJobs(): string[] {
  return [
    'aggregate_hourly_metrics',
    'aggregate_daily_metrics',
    'refresh_platform_summary',
    'cleanup_old_hourly_metrics',
    'check_alert_rules',
    'check_agent_alert_rules',
    'process_webhook_deliveries',
    'cleanup_old_deliveries',
    'aggregate_daily_revenue',
  ]
}
