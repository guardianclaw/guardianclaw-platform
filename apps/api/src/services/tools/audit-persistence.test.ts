/**
 * Audit Persistence Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditPersistence, createAuditPersistence } from './audit-persistence'
import type { ApiRequestLogEntry, ApiSecurityLogEntry } from './api-request-logger'

// Mock state
const mockState = {
  insertError: null as { message: string } | null,
  rpcResult: null as unknown,
  rpcError: null as { message: string } | null,
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'api_audit_logs' || table === 'api_security_events') {
      return {
        insert: vi.fn(async () => ({
          error: mockState.insertError,
        })),
      }
    }
    return {}
  }),
  rpc: vi.fn(async () => ({
    data: mockState.rpcResult,
    error: mockState.rpcError,
    single: vi.fn(async () => ({
      data: mockState.rpcResult,
      error: mockState.rpcError,
    })),
  })),
}

// Reset mock state
function resetMocks() {
  mockState.insertError = null
  mockState.rpcResult = null
  mockState.rpcError = null
  vi.clearAllMocks()
}

describe('AuditPersistence', () => {
  let persistence: AuditPersistence

  beforeEach(() => {
    resetMocks()
    persistence = new AuditPersistence(mockSupabase as never)
  })

  describe('flushAuditLogs', () => {
    it('returns success with 0 inserted for empty entries', async () => {
      const result = await persistence.flushAuditLogs([], 'wallet-1')

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(0)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('inserts audit log entries successfully', async () => {
      const entries: ApiRequestLogEntry[] = [
        {
          requestId: 'req-1',
          method: 'GET',
          url: 'https://api.example.com/data',
          host: 'api.example.com',
          hasBody: false,
          timestamp: Date.now(),
          latencyMs: 150,
          success: true,
          status: 200,
          statusText: 'OK',
        },
        {
          requestId: 'req-2',
          method: 'POST',
          url: 'https://api.example.com/submit',
          host: 'api.example.com',
          hasBody: true,
          bodySize: 1024,
          timestamp: Date.now(),
          latencyMs: 250,
          success: true,
          status: 201,
          statusText: 'Created',
        },
      ]

      const result = await persistence.flushAuditLogs(entries, 'wallet-1')

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(2)
      expect(mockSupabase.from).toHaveBeenCalledWith('api_audit_logs')
    })

    it('handles database errors gracefully', async () => {
      mockState.insertError = { message: 'Database connection failed' }

      const entries: ApiRequestLogEntry[] = [
        {
          requestId: 'req-1',
          method: 'GET',
          url: 'https://api.example.com/data',
          host: 'api.example.com',
          hasBody: false,
          timestamp: Date.now(),
          latencyMs: 150,
          success: true,
        },
      ]

      const result = await persistence.flushAuditLogs(entries, 'wallet-1')

      expect(result.success).toBe(false)
      expect(result.inserted).toBe(0)
      expect(result.error).toContain('Database connection failed')
    })

    it('includes all entry fields in database records', async () => {
      const entries: ApiRequestLogEntry[] = [
        {
          requestId: 'req-1',
          executionId: 'exec-1',
          method: 'POST',
          url: 'https://api.example.com/data',
          host: 'api.example.com',
          hasBody: true,
          bodySize: 512,
          timestamp: Date.now(),
          latencyMs: 100,
          success: false,
          status: 500,
          statusText: 'Internal Server Error',
          responseSize: 128,
          retryAttempt: 2,
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'Server error',
          credentialId: 'cred-1',
        },
      ]

      const result = await persistence.flushAuditLogs(entries, 'wallet-1')

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(1)
    })
  })

  describe('flushSecurityEvents', () => {
    it('returns success with 0 inserted for empty events', async () => {
      const result = await persistence.flushSecurityEvents([])

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(0)
      expect(mockSupabase.from).not.toHaveBeenCalled()
    })

    it('inserts security events successfully', async () => {
      const events: ApiSecurityLogEntry[] = [
        {
          requestId: 'req-1',
          event: 'ssrf_blocked',
          url: 'http://169.254.169.254/metadata',
          host: '169.254.169.254',
          timestamp: Date.now(),
          details: { reason: 'Internal IP blocked' },
        },
      ]

      const result = await persistence.flushSecurityEvents(events, 'wallet-1')

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(1)
      expect(mockSupabase.from).toHaveBeenCalledWith('api_security_events')
    })

    it('handles database errors gracefully', async () => {
      mockState.insertError = { message: 'Insert failed' }

      const events: ApiSecurityLogEntry[] = [
        {
          requestId: 'req-1',
          event: 'rate_limited',
          timestamp: Date.now(),
        },
      ]

      const result = await persistence.flushSecurityEvents(events)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Insert failed')
    })

    it('works without wallet address for system events', async () => {
      const events: ApiSecurityLogEntry[] = [
        {
          requestId: 'system-req',
          event: 'system_alert',
          timestamp: Date.now(),
        },
      ]

      const result = await persistence.flushSecurityEvents(events)

      expect(result.success).toBe(true)
      expect(result.inserted).toBe(1)
    })
  })

  describe('flush', () => {
    it('flushes both audit logs and security events', async () => {
      const auditEntries: ApiRequestLogEntry[] = [
        {
          requestId: 'req-1',
          method: 'GET',
          url: 'https://api.example.com',
          host: 'api.example.com',
          hasBody: false,
          timestamp: Date.now(),
          latencyMs: 100,
          success: true,
        },
      ]

      const securityEvents: ApiSecurityLogEntry[] = [
        {
          requestId: 'req-2',
          event: 'access_denied',
          timestamp: Date.now(),
        },
      ]

      const result = await persistence.flush(auditEntries, securityEvents, 'wallet-1')

      expect(result.success).toBe(true)
      expect(result.auditLogsInserted).toBe(1)
      expect(result.securityEventsInserted).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('collects errors from both flushes', async () => {
      mockState.insertError = { message: 'DB error' }

      const auditEntries: ApiRequestLogEntry[] = [
        {
          requestId: 'req-1',
          method: 'GET',
          url: 'https://api.example.com',
          host: 'api.example.com',
          hasBody: false,
          timestamp: Date.now(),
          latencyMs: 100,
          success: true,
        },
      ]

      const securityEvents: ApiSecurityLogEntry[] = [
        {
          requestId: 'req-2',
          event: 'test',
          timestamp: Date.now(),
        },
      ]

      const result = await persistence.flush(auditEntries, securityEvents, 'wallet-1')

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('handles empty arrays for both', async () => {
      const result = await persistence.flush([], [], 'wallet-1')

      expect(result.success).toBe(true)
      expect(result.auditLogsInserted).toBe(0)
      expect(result.securityEventsInserted).toBe(0)
    })
  })

  describe('getStats', () => {
    it('returns stats from RPC call', async () => {
      // Create a more specific mock for this test
      const rpcMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            total_requests: 100,
            successful_requests: 95,
            failed_requests: 5,
            avg_latency_ms: 150.5,
            unique_hosts: 10,
          },
          error: null,
        }),
      })

      const testSupabase = {
        ...mockSupabase,
        rpc: rpcMock,
      }

      const testPersistence = new AuditPersistence(testSupabase as never)
      const result = await testPersistence.getStats('wallet-1', 7)

      expect(result).not.toBeNull()
      expect(result?.totalRequests).toBe(100)
      expect(result?.successfulRequests).toBe(95)
      expect(result?.failedRequests).toBe(5)
      expect(result?.avgLatencyMs).toBe(150.5)
      expect(result?.uniqueHosts).toBe(10)
    })

    it('returns null on RPC error', async () => {
      const rpcMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'RPC failed' },
        }),
      })

      const testSupabase = {
        ...mockSupabase,
        rpc: rpcMock,
      }

      const testPersistence = new AuditPersistence(testSupabase as never)
      const result = await testPersistence.getStats('wallet-1')

      expect(result).toBeNull()
    })

    it('returns null on exception', async () => {
      const rpcMock = vi.fn().mockReturnValue({
        single: vi.fn().mockRejectedValue(new Error('Network error')),
      })

      const testSupabase = {
        ...mockSupabase,
        rpc: rpcMock,
      }

      const testPersistence = new AuditPersistence(testSupabase as never)
      const result = await testPersistence.getStats('wallet-1')

      expect(result).toBeNull()
    })

    it('uses default days parameter', async () => {
      const rpcMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { total_requests: 0 },
          error: null,
        }),
      })

      const testSupabase = {
        ...mockSupabase,
        rpc: rpcMock,
      }

      const testPersistence = new AuditPersistence(testSupabase as never)
      await testPersistence.getStats('wallet-1')

      expect(rpcMock).toHaveBeenCalledWith('get_audit_stats', {
        p_wallet_address: 'wallet-1',
        p_days: 7,
      })
    })
  })
})

describe('createAuditPersistence', () => {
  it('creates AuditPersistence instance', () => {
    const persistence = createAuditPersistence(mockSupabase as never)

    expect(persistence).toBeInstanceOf(AuditPersistence)
  })
})
