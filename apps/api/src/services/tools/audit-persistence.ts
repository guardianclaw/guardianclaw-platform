/**
 * Audit Persistence Service
 *
 * Persists audit logs and security events to the database.
 * Provides batch inserts for efficiency and handles errors gracefully.
 *
 * Usage:
 * 1. Buffer entries during request processing
 * 2. Flush to database at end of request or periodically
 * 3. Use flushAuditLogs() in request handlers
 * 4. Use scheduleFlush() for background periodic flushing
 *
 * @example
 * // In request handler
 * const persistence = new AuditPersistence(supabase)
 * await persistence.flushAuditLogs(getBufferedAuditEntries(true), walletAddress)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApiRequestLogEntry, ApiSecurityLogEntry } from './api-request-logger'

// ============================================
// TYPES
// ============================================

/**
 * Database audit log record.
 */
interface AuditLogRecord {
  wallet_address: string
  execution_id?: string
  request_id: string
  method: string
  url: string
  host: string
  has_body: boolean
  body_size?: number
  status_code?: number
  status_text?: string
  response_size?: number
  latency_ms: number
  retry_attempt?: number
  success: boolean
  error_code?: string
  error_message?: string
  credential_id?: string
}

/**
 * Database security event record.
 */
interface SecurityEventRecord {
  wallet_address?: string
  request_id: string
  execution_id?: string
  credential_id?: string
  event_type: string
  url?: string
  host?: string
  details?: Record<string, unknown>
}

/**
 * Flush result.
 */
export interface FlushResult {
  success: boolean
  auditLogsInserted: number
  securityEventsInserted: number
  errors: string[]
}

// ============================================
// AUDIT PERSISTENCE CLASS
// ============================================

/**
 * Audit persistence service.
 */
export class AuditPersistence {
  private supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Flush audit log entries to database.
   *
   * @param entries - Audit log entries to persist
   * @param walletAddress - Wallet address for all entries
   * @returns Flush result
   */
  async flushAuditLogs(
    entries: ApiRequestLogEntry[],
    walletAddress: string
  ): Promise<{ success: boolean; inserted: number; error?: string }> {
    if (entries.length === 0) {
      return { success: true, inserted: 0 }
    }

    // Transform entries to database records
    const records: AuditLogRecord[] = entries.map((entry) => ({
      wallet_address: walletAddress,
      execution_id: entry.executionId,
      request_id: entry.requestId,
      method: entry.method,
      url: entry.url,
      host: entry.host,
      has_body: entry.hasBody,
      body_size: entry.bodySize,
      status_code: entry.status,
      status_text: entry.statusText,
      response_size: entry.responseSize,
      latency_ms: entry.latencyMs,
      retry_attempt: entry.retryAttempt,
      success: entry.success,
      error_code: entry.errorCode,
      error_message: entry.errorMessage,
      credential_id: entry.credentialId,
    }))

    try {
      const { error } = await this.supabase.from('api_audit_logs').insert(records)

      if (error) {
        return {
          success: false,
          inserted: 0,
          error: `Failed to insert audit logs: ${error.message}`,
        }
      }

      return { success: true, inserted: records.length }
    } catch (err) {
      return {
        success: false,
        inserted: 0,
        error: `Exception inserting audit logs: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Flush security events to database.
   *
   * @param events - Security events to persist
   * @param walletAddress - Optional wallet address (may be null for system events)
   * @returns Flush result
   */
  async flushSecurityEvents(
    events: ApiSecurityLogEntry[],
    walletAddress?: string
  ): Promise<{ success: boolean; inserted: number; error?: string }> {
    if (events.length === 0) {
      return { success: true, inserted: 0 }
    }

    // Transform events to database records
    const records: SecurityEventRecord[] = events.map((event) => ({
      wallet_address: walletAddress,
      request_id: event.requestId,
      execution_id: event.executionId,
      credential_id: event.credentialId,
      event_type: event.event,
      url: event.url,
      host: event.host,
      details: event.details,
    }))

    try {
      const { error } = await this.supabase.from('api_security_events').insert(records)

      if (error) {
        return {
          success: false,
          inserted: 0,
          error: `Failed to insert security events: ${error.message}`,
        }
      }

      return { success: true, inserted: records.length }
    } catch (err) {
      return {
        success: false,
        inserted: 0,
        error: `Exception inserting security events: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Flush both audit logs and security events.
   *
   * @param auditEntries - Audit log entries
   * @param securityEvents - Security events
   * @param walletAddress - Wallet address
   * @returns Combined flush result
   */
  async flush(
    auditEntries: ApiRequestLogEntry[],
    securityEvents: ApiSecurityLogEntry[],
    walletAddress: string
  ): Promise<FlushResult> {
    const errors: string[] = []

    const auditResult = await this.flushAuditLogs(auditEntries, walletAddress)
    if (!auditResult.success && auditResult.error) {
      errors.push(auditResult.error)
    }

    const securityResult = await this.flushSecurityEvents(securityEvents, walletAddress)
    if (!securityResult.success && securityResult.error) {
      errors.push(securityResult.error)
    }

    return {
      success: errors.length === 0,
      auditLogsInserted: auditResult.inserted,
      securityEventsInserted: securityResult.inserted,
      errors,
    }
  }

  /**
   * Get audit statistics for a wallet.
   */
  async getStats(
    walletAddress: string,
    days = 7
  ): Promise<{
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    avgLatencyMs: number
    uniqueHosts: number
  } | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_audit_stats', {
          p_wallet_address: walletAddress,
          p_days: days,
        } as never)
        .single()

      if (error || !data) {
        return null
      }

      const stats = data as {
        total_requests?: number
        successful_requests?: number
        failed_requests?: number
        avg_latency_ms?: number
        unique_hosts?: number
      }

      return {
        totalRequests: stats.total_requests || 0,
        successfulRequests: stats.successful_requests || 0,
        failedRequests: stats.failed_requests || 0,
        avgLatencyMs: stats.avg_latency_ms || 0,
        uniqueHosts: stats.unique_hosts || 0,
      }
    } catch {
      return null
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create audit persistence instance.
 */
export function createAuditPersistence(supabase: SupabaseClient): AuditPersistence {
  return new AuditPersistence(supabase)
}
