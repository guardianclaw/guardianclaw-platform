/**
 * Admin Audit Service
 * Administrative functions for audit log viewing and export
 *
 * Pattern: Uses RPC functions exclusively (consistent with admin-agents.ts)
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPE DEFINITIONS
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

export interface AuditLogFilters {
  admin_hash?: string
  action_prefix?: string
  target_type?: string
  status_code?: number
  start_date?: string
  end_date?: string
  orderBy?: 'created_at' | 'action'
  orderDir?: 'asc' | 'desc'
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get audit log statistics
 */
export async function getAuditStats(supabase: SupabaseClient): Promise<AuditStats> {
  const { data, error } = await supabase.rpc('admin_get_audit_stats')

  if (error) {
    console.error('Failed to get audit stats:', error)
    throw new Error('Failed to get audit statistics')
  }

  if (!data || data.length === 0) {
    return {
      total_entries: 0,
      entries_24h: 0,
      entries_7d: 0,
      entries_30d: 0,
      unique_admins: 0,
      by_action_type: {},
      by_target_type: {},
      by_status_code: {},
    }
  }

  const row = data[0]
  return {
    total_entries: Number(row.total_entries) || 0,
    entries_24h: Number(row.entries_24h) || 0,
    entries_7d: Number(row.entries_7d) || 0,
    entries_30d: Number(row.entries_30d) || 0,
    unique_admins: Number(row.unique_admins) || 0,
    by_action_type: row.by_action_type || {},
    by_target_type: row.by_target_type || {},
    by_status_code: row.by_status_code || {},
  }
}

/**
 * List audit logs with filtering and pagination
 */
export async function listAuditLogs(
  supabase: SupabaseClient,
  limit: number,
  offset: number,
  filters: AuditLogFilters = {}
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_audit_logs', {
    p_limit: limit,
    p_offset: offset,
    p_admin_hash: filters.admin_hash || null,
    p_action_prefix: filters.action_prefix || null,
    p_target_type: filters.target_type || null,
    p_status_code: filters.status_code ?? null,
    p_start_date: filters.start_date || null,
    p_end_date: filters.end_date || null,
    p_order_by: filters.orderBy || 'created_at',
    p_order_dir: filters.orderDir || 'desc',
  })

  if (error) {
    console.error('Failed to list audit logs:', error)
    throw new Error('Failed to list audit logs')
  }

  if (!data || data.length === 0) {
    return { logs: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const logs: AuditLogEntry[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    admin_wallet_hash: row.admin_wallet_hash as string,
    action: row.action as string,
    target_type: row.target_type as string | null,
    target_id: row.target_id as string | null,
    details: (row.details as Record<string, unknown>) || {},
    ip_hash: row.ip_hash as string | null,
    request_id: row.request_id as string | null,
    status_code: Number(row.status_code) || 0,
    created_at: row.created_at as string,
  }))

  return { logs, total }
}

/**
 * Export audit logs as CSV
 */
export async function exportAuditLogsCSV(
  supabase: SupabaseClient,
  filters: AuditLogFilters = {},
  maxRows: number = 10000
): Promise<string> {
  // Fetch all matching logs up to maxRows
  const { logs } = await listAuditLogs(supabase, maxRows, 0, filters)

  if (logs.length === 0) {
    return 'id,admin_wallet_hash,action,target_type,target_id,status_code,created_at\n'
  }

  // Build CSV
  const headers = [
    'id',
    'admin_wallet_hash',
    'action',
    'target_type',
    'target_id',
    'status_code',
    'ip_hash',
    'request_id',
    'created_at',
  ]

  const rows = logs.map((log) => [
    log.id,
    log.admin_wallet_hash,
    `"${log.action.replace(/"/g, '""')}"`,
    log.target_type || '',
    log.target_id || '',
    log.status_code.toString(),
    log.ip_hash || '',
    log.request_id || '',
    log.created_at,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/**
 * Export audit logs as JSON
 */
export async function exportAuditLogsJSON(
  supabase: SupabaseClient,
  filters: AuditLogFilters = {},
  maxRows: number = 10000
): Promise<string> {
  const { logs, total } = await listAuditLogs(supabase, maxRows, 0, filters)

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      total_entries: total,
      exported_count: logs.length,
      filters: {
        admin_hash: filters.admin_hash || null,
        action_prefix: filters.action_prefix || null,
        target_type: filters.target_type || null,
        status_code: filters.status_code ?? null,
        start_date: filters.start_date || null,
        end_date: filters.end_date || null,
      },
      logs,
    },
    null,
    2
  )
}

/**
 * Get available action types for filtering
 */
export function getAvailableActionTypes(): string[] {
  return ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
}

/**
 * Get available target types for filtering
 */
export function getAvailableTargetTypes(): string[] {
  return ['user', 'agent', 'deployment', 'alert', 'role', 'rule', 'proposal', 'gdpr_request']
}

/**
 * Get available status codes for filtering
 */
export function getAvailableStatusCodes(): number[] {
  return [200, 201, 400, 401, 403, 404, 500]
}
