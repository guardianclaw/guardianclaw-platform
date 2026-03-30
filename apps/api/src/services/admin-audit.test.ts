/**
 * Admin Audit Service Tests
 *
 * Comprehensive test coverage for admin audit service functions:
 * - Audit statistics
 * - Audit log listing
 * - CSV/JSON export
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAuditStats,
  listAuditLogs,
  exportAuditLogsCSV,
  exportAuditLogsJSON,
  getAvailableActionTypes,
  getAvailableTargetTypes,
  getAvailableStatusCodes,
  type AuditStats,
  type AuditLogEntry,
  type AuditLogFilters,
} from './admin-audit'

// ============================================
// MOCK SETUP
// ============================================

const createMockAuditStats = (overrides: Partial<AuditStats> = {}): AuditStats => ({
  total_entries: 5000,
  entries_24h: 150,
  entries_7d: 800,
  entries_30d: 3500,
  unique_admins: 5,
  by_action_type: { GET: 3000, POST: 1200, PATCH: 500, DELETE: 300 },
  by_target_type: { user: 1500, agent: 2000, deployment: 1000, alert: 500 },
  by_status_code: {
    '200': 4500,
    '201': 200,
    '400': 150,
    '401': 50,
    '403': 30,
    '404': 50,
    '500': 20,
  },
  ...overrides,
})

const createMockAuditLogEntry = (overrides: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  admin_wallet_hash: 'hash_abc123',
  action: 'GET /admin/users/search',
  target_type: 'user',
  target_id: 'user_123',
  details: { query: 'test' },
  ip_hash: 'ip_hash_xyz',
  request_id: 'req_123',
  status_code: 200,
  created_at: '2026-01-21T10:30:00Z',
  ...overrides,
})

const mockRpc = vi.fn()
const mockSupabase = {
  rpc: mockRpc,
}

describe('Admin Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // getAvailableActionTypes
  // ============================================
  describe('getAvailableActionTypes', () => {
    it('should return HTTP method types', () => {
      const types = getAvailableActionTypes()
      expect(types).toContain('GET')
      expect(types).toContain('POST')
      expect(types).toContain('PATCH')
      expect(types).toContain('PUT')
      expect(types).toContain('DELETE')
      expect(types).toHaveLength(5)
    })
  })

  // ============================================
  // getAvailableTargetTypes
  // ============================================
  describe('getAvailableTargetTypes', () => {
    it('should return target entity types', () => {
      const types = getAvailableTargetTypes()
      expect(types).toContain('user')
      expect(types).toContain('agent')
      expect(types).toContain('deployment')
      expect(types).toContain('alert')
      expect(types).toContain('role')
      expect(types).toContain('proposal')
      expect(types).toContain('gdpr_request')
      expect(types).toHaveLength(8)
    })
  })

  // ============================================
  // getAvailableStatusCodes
  // ============================================
  describe('getAvailableStatusCodes', () => {
    it('should return common HTTP status codes', () => {
      const codes = getAvailableStatusCodes()
      expect(codes).toContain(200)
      expect(codes).toContain(201)
      expect(codes).toContain(400)
      expect(codes).toContain(401)
      expect(codes).toContain(403)
      expect(codes).toContain(404)
      expect(codes).toContain(500)
      expect(codes).toHaveLength(7)
    })
  })

  // ============================================
  // getAuditStats
  // ============================================
  describe('getAuditStats', () => {
    it('should return audit statistics', async () => {
      mockRpc.mockResolvedValueOnce({ data: [createMockAuditStats()], error: null })

      const result = await getAuditStats(mockSupabase as never)

      expect(mockRpc).toHaveBeenCalledWith('admin_get_audit_stats')
      expect(result.total_entries).toBe(5000)
      expect(result.entries_24h).toBe(150)
      expect(result.unique_admins).toBe(5)
    })

    it('should return empty stats when no data', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await getAuditStats(mockSupabase as never)

      expect(result.total_entries).toBe(0)
      expect(result.entries_24h).toBe(0)
      expect(result.by_action_type).toEqual({})
    })

    it('should return empty stats when data is null', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null })

      const result = await getAuditStats(mockSupabase as never)

      expect(result.total_entries).toBe(0)
    })

    it('should throw error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      await expect(getAuditStats(mockSupabase as never)).rejects.toThrow(
        'Failed to get audit statistics'
      )
    })

    it('should convert numeric fields correctly', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            total_entries: '5000', // String from DB
            entries_24h: '150',
            entries_7d: '800',
            entries_30d: '3500',
            unique_admins: '5',
            by_action_type: { GET: 3000 },
            by_target_type: {},
            by_status_code: {},
          },
        ],
        error: null,
      })

      const result = await getAuditStats(mockSupabase as never)

      expect(result.total_entries).toBe(5000)
      expect(typeof result.total_entries).toBe('number')
    })

    it('should handle missing breakdowns', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            total_entries: 100,
            entries_24h: 10,
            entries_7d: 50,
            entries_30d: 80,
            unique_admins: 2,
            by_action_type: null,
            by_target_type: null,
            by_status_code: null,
          },
        ],
        error: null,
      })

      const result = await getAuditStats(mockSupabase as never)

      expect(result.by_action_type).toEqual({})
      expect(result.by_target_type).toEqual({})
      expect(result.by_status_code).toEqual({})
    })
  })

  // ============================================
  // listAuditLogs
  // ============================================
  describe('listAuditLogs', () => {
    it('should return paginated logs with total', async () => {
      const mockLogs = [
        { ...createMockAuditLogEntry(), total_count: 100 },
        {
          ...createMockAuditLogEntry({ id: 'id-2', action: 'POST /admin/credits' }),
          total_count: 100,
        },
      ]
      mockRpc.mockResolvedValueOnce({ data: mockLogs, error: null })

      const result = await listAuditLogs(mockSupabase as never, 50, 0)

      expect(mockRpc).toHaveBeenCalledWith('admin_list_audit_logs', {
        p_limit: 50,
        p_offset: 0,
        p_admin_hash: null,
        p_action_prefix: null,
        p_target_type: null,
        p_status_code: null,
        p_start_date: null,
        p_end_date: null,
        p_order_by: 'created_at',
        p_order_dir: 'desc',
      })
      expect(result.logs).toHaveLength(2)
      expect(result.total).toBe(100)
    })

    it('should pass filter parameters correctly', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const filters: AuditLogFilters = {
        admin_hash: 'admin_123',
        action_prefix: 'GET',
        target_type: 'user',
        status_code: 200,
        start_date: '2026-01-01T00:00:00Z',
        end_date: '2026-01-31T23:59:59Z',
        orderBy: 'action',
        orderDir: 'asc',
      }

      await listAuditLogs(mockSupabase as never, 100, 50, filters)

      expect(mockRpc).toHaveBeenCalledWith('admin_list_audit_logs', {
        p_limit: 100,
        p_offset: 50,
        p_admin_hash: 'admin_123',
        p_action_prefix: 'GET',
        p_target_type: 'user',
        p_status_code: 200,
        p_start_date: '2026-01-01T00:00:00Z',
        p_end_date: '2026-01-31T23:59:59Z',
        p_order_by: 'action',
        p_order_dir: 'asc',
      })
    })

    it('should return empty array when no data', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await listAuditLogs(mockSupabase as never, 50, 0)

      expect(result.logs).toEqual([])
      expect(result.total).toBe(0)
    })

    it('should throw error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      await expect(listAuditLogs(mockSupabase as never, 50, 0)).rejects.toThrow(
        'Failed to list audit logs'
      )
    })

    it('should map log entry fields correctly', async () => {
      const mockLog = {
        id: 'test-id',
        admin_wallet_hash: 'wallet_hash',
        action: 'PATCH /admin/users',
        target_type: 'user',
        target_id: 'user_456',
        details: { reason: 'test' },
        ip_hash: 'ip_hash',
        request_id: 'req_456',
        status_code: '201', // String from DB
        created_at: '2026-01-20T15:00:00Z',
        total_count: 50,
      }
      mockRpc.mockResolvedValueOnce({ data: [mockLog], error: null })

      const result = await listAuditLogs(mockSupabase as never, 50, 0)

      expect(result.logs[0]).toEqual({
        id: 'test-id',
        admin_wallet_hash: 'wallet_hash',
        action: 'PATCH /admin/users',
        target_type: 'user',
        target_id: 'user_456',
        details: { reason: 'test' },
        ip_hash: 'ip_hash',
        request_id: 'req_456',
        status_code: 201,
        created_at: '2026-01-20T15:00:00Z',
      })
    })

    it('should handle null optional fields', async () => {
      const mockLog = {
        id: 'test-id',
        admin_wallet_hash: 'wallet_hash',
        action: 'GET /admin/health',
        target_type: null,
        target_id: null,
        details: null,
        ip_hash: null,
        request_id: null,
        status_code: 200,
        created_at: '2026-01-20T15:00:00Z',
        total_count: 1,
      }
      mockRpc.mockResolvedValueOnce({ data: [mockLog], error: null })

      const result = await listAuditLogs(mockSupabase as never, 50, 0)

      expect(result.logs[0].target_type).toBeNull()
      expect(result.logs[0].details).toEqual({})
    })
  })

  // ============================================
  // exportAuditLogsCSV
  // ============================================
  describe('exportAuditLogsCSV', () => {
    it('should export logs as CSV', async () => {
      const mockLog = { ...createMockAuditLogEntry(), total_count: 1 }
      mockRpc.mockResolvedValueOnce({ data: [mockLog], error: null })

      const csv = await exportAuditLogsCSV(mockSupabase as never)

      expect(csv).toContain(
        'id,admin_wallet_hash,action,target_type,target_id,status_code,ip_hash,request_id,created_at'
      )
      expect(csv).toContain('550e8400-e29b-41d4-a716-446655440000')
      expect(csv).toContain('hash_abc123')
      expect(csv).toContain('"GET /admin/users/search"')
    })

    it('should return header only when no logs', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const csv = await exportAuditLogsCSV(mockSupabase as never)

      expect(csv).toBe('id,admin_wallet_hash,action,target_type,target_id,status_code,created_at\n')
    })

    it('should escape quotes in action field', async () => {
      const mockLog = {
        ...createMockAuditLogEntry(),
        action: 'GET /admin/search?q="test"',
        total_count: 1,
      }
      mockRpc.mockResolvedValueOnce({ data: [mockLog], error: null })

      const csv = await exportAuditLogsCSV(mockSupabase as never)

      expect(csv).toContain('"GET /admin/search?q=""test"""')
    })

    it('should apply filters and maxRows', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const filters: AuditLogFilters = {
        action_prefix: 'GET',
        status_code: 200,
      }

      await exportAuditLogsCSV(mockSupabase as never, filters, 5000)

      expect(mockRpc).toHaveBeenCalledWith(
        'admin_list_audit_logs',
        expect.objectContaining({
          p_limit: 5000,
          p_action_prefix: 'GET',
          p_status_code: 200,
        })
      )
    })

    it('should use default maxRows of 10000', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      await exportAuditLogsCSV(mockSupabase as never)

      expect(mockRpc).toHaveBeenCalledWith(
        'admin_list_audit_logs',
        expect.objectContaining({
          p_limit: 10000,
        })
      )
    })

    it('should handle empty optional fields', async () => {
      const mockLog = {
        ...createMockAuditLogEntry(),
        target_type: null,
        target_id: null,
        ip_hash: null,
        request_id: null,
        total_count: 1,
      }
      mockRpc.mockResolvedValueOnce({ data: [mockLog], error: null })

      const csv = await exportAuditLogsCSV(mockSupabase as never)

      // Should have empty values for null fields
      const lines = csv.split('\n')
      expect(lines[1]).toContain(',,')
    })
  })

  // ============================================
  // exportAuditLogsJSON
  // ============================================
  describe('exportAuditLogsJSON', () => {
    it('should export logs as JSON with metadata', async () => {
      const mockLog = { ...createMockAuditLogEntry(), total_count: 50 }
      mockRpc.mockResolvedValueOnce({ data: [mockLog], error: null })

      const json = await exportAuditLogsJSON(mockSupabase as never)
      const parsed = JSON.parse(json)

      expect(parsed).toHaveProperty('exported_at')
      expect(parsed).toHaveProperty('total_entries', 50)
      expect(parsed).toHaveProperty('exported_count', 1)
      expect(parsed).toHaveProperty('filters')
      expect(parsed).toHaveProperty('logs')
      expect(parsed.logs).toHaveLength(1)
    })

    it('should include filter metadata', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const filters: AuditLogFilters = {
        admin_hash: 'admin_123',
        action_prefix: 'POST',
        target_type: 'agent',
        status_code: 201,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      }

      const json = await exportAuditLogsJSON(mockSupabase as never, filters)
      const parsed = JSON.parse(json)

      expect(parsed.filters).toEqual({
        admin_hash: 'admin_123',
        action_prefix: 'POST',
        target_type: 'agent',
        status_code: 201,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      })
    })

    it('should handle empty logs', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const json = await exportAuditLogsJSON(mockSupabase as never)
      const parsed = JSON.parse(json)

      expect(parsed.total_entries).toBe(0)
      expect(parsed.exported_count).toBe(0)
      expect(parsed.logs).toEqual([])
    })

    it('should apply maxRows parameter', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      await exportAuditLogsJSON(mockSupabase as never, {}, 5000)

      expect(mockRpc).toHaveBeenCalledWith(
        'admin_list_audit_logs',
        expect.objectContaining({
          p_limit: 5000,
        })
      )
    })

    it('should format JSON with indentation', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const json = await exportAuditLogsJSON(mockSupabase as never)

      // Pretty-printed JSON has newlines
      expect(json).toContain('\n')
      expect(json).toContain('  ')
    })

    it('should set null for undefined filters', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const json = await exportAuditLogsJSON(mockSupabase as never, {})
      const parsed = JSON.parse(json)

      expect(parsed.filters.admin_hash).toBeNull()
      expect(parsed.filters.action_prefix).toBeNull()
      expect(parsed.filters.target_type).toBeNull()
      expect(parsed.filters.status_code).toBeNull()
    })
  })
})
