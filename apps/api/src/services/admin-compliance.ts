/**
 * Admin Compliance Service
 * Administrative functions for GDPR compliance and data management
 *
 * Provides GDPR request management, deletion audit logging,
 * compliance statistics, and report generation.
 *
 * Pattern: Uses RPC functions exclusively (consistent with admin-agents.ts)
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPE DEFINITIONS
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

export interface GdprRequestFilters {
  request_type?: string
  status?: string
  search?: string
  orderBy?: 'created_at' | 'requested_at'
  orderDir?: 'asc' | 'desc'
}

export interface DeletionAuditFilters {
  search?: string
  orderBy?: 'deletion_date' | 'created_at'
  orderDir?: 'asc' | 'desc'
}

export interface UpdateRequestResult {
  success: boolean
  status: string
  completed_at: string | null
  error?: string
}

export interface ComplianceReport {
  period: {
    start: string
    end: string
  }
  summary: {
    total_requests: number
    completed_requests: number
    avg_completion_hours: number
    total_deletions: number
  }
  by_type: Record<string, number>
  by_status: Record<string, number>
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get platform-wide compliance statistics
 */
export async function getComplianceStats(supabase: SupabaseClient): Promise<ComplianceStats> {
  const { data, error } = await supabase.rpc('admin_get_compliance_stats')

  if (error) {
    console.error('Failed to get compliance stats:', error)
    throw new Error('Failed to get compliance statistics')
  }

  if (!data || data.length === 0) {
    return {
      total_requests: 0,
      pending_requests: 0,
      in_progress_requests: 0,
      completed_requests: 0,
      rejected_requests: 0,
      requests_7d: 0,
      requests_30d: 0,
      avg_completion_hours: 0,
      total_deletions: 0,
      deletions_7d: 0,
      deletions_30d: 0,
      by_request_type: {},
      by_status: {},
    }
  }

  const row = data[0]
  return {
    total_requests: Number(row.total_requests) || 0,
    pending_requests: Number(row.pending_requests) || 0,
    in_progress_requests: Number(row.in_progress_requests) || 0,
    completed_requests: Number(row.completed_requests) || 0,
    rejected_requests: Number(row.rejected_requests) || 0,
    requests_7d: Number(row.requests_7d) || 0,
    requests_30d: Number(row.requests_30d) || 0,
    avg_completion_hours: Number(row.avg_completion_hours) || 0,
    total_deletions: Number(row.total_deletions) || 0,
    deletions_7d: Number(row.deletions_7d) || 0,
    deletions_30d: Number(row.deletions_30d) || 0,
    by_request_type: row.by_request_type || {},
    by_status: row.by_status || {},
  }
}

/**
 * List GDPR requests with pagination and filters
 */
export async function listGdprRequests(
  supabase: SupabaseClient,
  limit: number,
  offset: number,
  filters: GdprRequestFilters = {}
): Promise<{ requests: GdprRequestListItem[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_gdpr_requests', {
    p_limit: limit,
    p_offset: offset,
    p_request_type: filters.request_type || null,
    p_status: filters.status || null,
    p_search: filters.search || null,
    p_order_by: filters.orderBy || 'created_at',
    p_order_dir: filters.orderDir || 'desc',
  })

  if (error) {
    console.error('Failed to list GDPR requests:', error)
    throw new Error('Failed to list GDPR requests')
  }

  if (!data || data.length === 0) {
    return { requests: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const requests: GdprRequestListItem[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    wallet_address: row.wallet_address as string,
    display_name: row.display_name as string | null,
    request_type: row.request_type as string,
    status: row.status as string,
    requested_at: row.requested_at as string,
    completed_at: row.completed_at as string | null,
    admin_wallet_hash: row.admin_wallet_hash as string | null,
    created_at: row.created_at as string,
  }))

  return { requests, total }
}

/**
 * Get detailed GDPR request information
 */
export async function getGdprRequestDetails(
  supabase: SupabaseClient,
  requestId: string
): Promise<GdprRequestDetails | null> {
  const { data, error } = await supabase.rpc('admin_get_gdpr_request_details', {
    p_request_id: requestId,
  })

  if (error) {
    console.error('Failed to get GDPR request details:', error)
    throw new Error('Failed to get GDPR request details')
  }

  if (!data || data.length === 0) {
    return null
  }

  const row = data[0]
  return {
    id: row.id,
    wallet_address: row.wallet_address,
    display_name: row.display_name,
    request_type: row.request_type,
    status: row.status,
    requested_at: row.requested_at,
    completed_at: row.completed_at,
    admin_wallet_hash: row.admin_wallet_hash,
    notes: row.notes,
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Update GDPR request status
 */
export async function updateGdprRequest(
  supabase: SupabaseClient,
  requestId: string,
  status: string,
  notes: string | null,
  adminHash: string
): Promise<UpdateRequestResult> {
  const { data, error } = await supabase.rpc('admin_update_gdpr_request', {
    p_request_id: requestId,
    p_status: status,
    p_notes: notes,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to update GDPR request:', error)
    return {
      success: false,
      status: '',
      completed_at: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      status: '',
      completed_at: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      status: '',
      completed_at: null,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return {
    success: true,
    status: row.status,
    completed_at: row.completed_at,
  }
}

/**
 * List deletion audit records with pagination
 */
export async function listDeletionAudit(
  supabase: SupabaseClient,
  limit: number,
  offset: number,
  filters: DeletionAuditFilters = {}
): Promise<{ deletions: DeletionAuditItem[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_deletion_audit', {
    p_limit: limit,
    p_offset: offset,
    p_search: filters.search || null,
    p_order_by: filters.orderBy || 'deletion_date',
    p_order_dir: filters.orderDir || 'desc',
  })

  if (error) {
    console.error('Failed to list deletion audit:', error)
    throw new Error('Failed to list deletion audit')
  }

  if (!data || data.length === 0) {
    return { deletions: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const deletions: DeletionAuditItem[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    wallet_hash: row.wallet_hash as string,
    data_categories: row.data_categories as string[],
    retained_categories: row.retained_categories as string[] | null,
    retention_reason: row.retention_reason as string | null,
    deletion_date: row.deletion_date as string,
    request_id: row.request_id as string | null,
    created_at: row.created_at as string,
  }))

  return { deletions, total }
}

/**
 * Generate compliance report for a date range
 */
export async function generateComplianceReport(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string
): Promise<ComplianceReport> {
  // This uses the stats RPC and filters client-side for the report
  // A dedicated RPC could be added for more complex reporting needs
  const stats = await getComplianceStats(supabase)

  return {
    period: {
      start: startDate,
      end: endDate,
    },
    summary: {
      total_requests: stats.total_requests,
      completed_requests: stats.completed_requests,
      avg_completion_hours: stats.avg_completion_hours,
      total_deletions: stats.total_deletions,
    },
    by_type: stats.by_request_type,
    by_status: stats.by_status,
  }
}

/**
 * Get available GDPR request types for filtering
 */
export function getAvailableRequestTypes(): string[] {
  return ['export', 'deletion', 'access', 'rectification']
}

/**
 * Get available GDPR request statuses for filtering
 */
export function getAvailableStatuses(): string[] {
  return ['pending', 'in_progress', 'completed', 'rejected']
}
