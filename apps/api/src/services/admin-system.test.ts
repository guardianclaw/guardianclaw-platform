/**
 * Admin System Service Tests
 *
 * Comprehensive test coverage for admin system service functions:
 * - Platform configuration
 * - Feature flags
 * - Maintenance windows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getSystemConfig,
  updateConfig,
  listFeatureFlags,
  updateFeatureFlag,
  listMaintenanceWindows,
  createMaintenanceWindow,
  deleteMaintenanceWindow,
  toggleMaintenanceWindow,
  getConfigCategories,
  getAvailableServices,
  type ConfigItem,
  type FeatureFlag,
  type MaintenanceWindow,
} from './admin-system'

// ============================================
// MOCK SETUP
// ============================================

const createMockConfigItem = (overrides: Partial<ConfigItem> = {}): ConfigItem => ({
  key: 'rate_limits.default',
  value: { requests_per_minute: 100 },
  description: 'Default rate limit configuration',
  category: 'limits',
  is_sensitive: false,
  updated_at: '2026-01-20T10:00:00Z',
  updated_by: 'admin_hash_123',
  ...overrides,
})

const createMockFeatureFlag = (overrides: Partial<FeatureFlag> = {}): FeatureFlag => ({
  id: 'governance_v2',
  name: 'Governance V2',
  description: 'New governance UI with improved voting',
  is_enabled: true,
  rollout_percentage: 100,
  conditions: {},
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
  updated_by: 'admin_hash_123',
  ...overrides,
})

const createMockMaintenanceWindow = (
  overrides: Partial<MaintenanceWindow> = {}
): MaintenanceWindow => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Scheduled Maintenance',
  description: 'Database upgrade and optimization',
  starts_at: '2026-01-25T02:00:00Z',
  ends_at: '2026-01-25T04:00:00Z',
  is_active: false,
  show_banner: true,
  affects_services: ['api', 'database'],
  created_by: 'admin_hash_123',
  created_at: '2026-01-20T10:00:00Z',
  ...overrides,
})

const mockRpc = vi.fn()
const mockSupabase = {
  rpc: mockRpc,
}

describe('Admin System Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================
  // getConfigCategories
  // ============================================
  describe('getConfigCategories', () => {
    it('should return correct category list', () => {
      const categories = getConfigCategories()
      expect(categories).toContain('general')
      expect(categories).toContain('pricing')
      expect(categories).toContain('limits')
      expect(categories).toContain('security')
      expect(categories).toHaveLength(4)
    })
  })

  // ============================================
  // getAvailableServices
  // ============================================
  describe('getAvailableServices', () => {
    it('should return correct services list', () => {
      const services = getAvailableServices()
      expect(services).toContain('api')
      expect(services).toContain('web')
      expect(services).toContain('runtime')
      expect(services).toContain('database')
      expect(services).toContain('all')
      expect(services).toHaveLength(5)
    })
  })

  // ============================================
  // getSystemConfig
  // ============================================
  describe('getSystemConfig', () => {
    it('should return config items on success', async () => {
      const mockItems = [
        createMockConfigItem(),
        createMockConfigItem({
          key: 'pricing.cost_per_execution',
          value: { usd: 0.003 },
          category: 'pricing',
        }),
      ]
      mockRpc.mockResolvedValueOnce({ data: mockItems, error: null })

      const result = await getSystemConfig(mockSupabase as never)

      expect(mockRpc).toHaveBeenCalledWith('admin_get_system_config')
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('rate_limits.default')
      expect(result[1].key).toBe('pricing.cost_per_execution')
    })

    it('should return empty array when no data', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await getSystemConfig(mockSupabase as never)

      expect(result).toEqual([])
    })

    it('should return empty array when data is null', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: null })

      const result = await getSystemConfig(mockSupabase as never)

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      await expect(getSystemConfig(mockSupabase as never)).rejects.toThrow(
        'Failed to get system configuration'
      )
    })

    it('should map all fields correctly', async () => {
      const mockItem = createMockConfigItem({
        key: 'test.key',
        value: { nested: 'value' },
        description: 'Test description',
        category: 'general',
        is_sensitive: true,
        updated_at: '2026-01-21T12:00:00Z',
        updated_by: 'admin_456',
      })
      mockRpc.mockResolvedValueOnce({ data: [mockItem], error: null })

      const result = await getSystemConfig(mockSupabase as never)

      expect(result[0]).toEqual(mockItem)
    })
  })

  // ============================================
  // updateConfig
  // ============================================
  describe('updateConfig', () => {
    it('should update config successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: true,
            key: 'rate_limits.default',
            value: { requests_per_minute: 200 },
            updated_at: '2026-01-21T10:00:00Z',
            error: null,
          },
        ],
        error: null,
      })

      const result = await updateConfig(
        mockSupabase as never,
        'rate_limits.default',
        { requests_per_minute: 200 },
        'admin_hash_123'
      )

      expect(mockRpc).toHaveBeenCalledWith('admin_update_config', {
        p_key: 'rate_limits.default',
        p_value: { requests_per_minute: 200 },
        p_admin_hash: 'admin_hash_123',
      })
      expect(result.success).toBe(true)
      expect(result.key).toBe('rate_limits.default')
    })

    it('should return error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      const result = await updateConfig(mockSupabase as never, 'key', 'value', 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('DATABASE_ERROR')
    })

    it('should return error when no result returned', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await updateConfig(mockSupabase as never, 'key', 'value', 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_RESULT')
    })

    it('should return error when RPC indicates failure', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: false,
            key: null,
            value: null,
            updated_at: null,
            error: 'CONFIG_NOT_FOUND',
          },
        ],
        error: null,
      })

      const result = await updateConfig(mockSupabase as never, 'non_existent', 'value', 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('CONFIG_NOT_FOUND')
    })

    it('should handle unknown error from RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: false,
            key: null,
            value: null,
            updated_at: null,
            error: null,
          },
        ],
        error: null,
      })

      const result = await updateConfig(mockSupabase as never, 'key', 'value', 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('UNKNOWN_ERROR')
    })
  })

  // ============================================
  // listFeatureFlags
  // ============================================
  describe('listFeatureFlags', () => {
    it('should return feature flags on success', async () => {
      const mockFlags = [
        createMockFeatureFlag(),
        createMockFeatureFlag({
          id: 'analytics_v2',
          name: 'Analytics V2',
          is_enabled: false,
          rollout_percentage: 50,
        }),
      ]
      mockRpc.mockResolvedValueOnce({ data: mockFlags, error: null })

      const result = await listFeatureFlags(mockSupabase as never)

      expect(mockRpc).toHaveBeenCalledWith('admin_list_feature_flags')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('governance_v2')
      expect(result[1].id).toBe('analytics_v2')
    })

    it('should return empty array when no data', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await listFeatureFlags(mockSupabase as never)

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      await expect(listFeatureFlags(mockSupabase as never)).rejects.toThrow(
        'Failed to list feature flags'
      )
    })

    it('should handle missing conditions field', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            ...createMockFeatureFlag(),
            conditions: null,
          },
        ],
        error: null,
      })

      const result = await listFeatureFlags(mockSupabase as never)

      expect(result[0].conditions).toEqual({})
    })

    it('should convert rollout_percentage to number', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            ...createMockFeatureFlag(),
            rollout_percentage: '75', // String from DB
          },
        ],
        error: null,
      })

      const result = await listFeatureFlags(mockSupabase as never)

      expect(result[0].rollout_percentage).toBe(75)
      expect(typeof result[0].rollout_percentage).toBe('number')
    })
  })

  // ============================================
  // updateFeatureFlag
  // ============================================
  describe('updateFeatureFlag', () => {
    it('should update flag successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: true,
            id: 'governance_v2',
            is_enabled: false,
            rollout_percentage: 50,
            updated_at: '2026-01-21T10:00:00Z',
            error: null,
          },
        ],
        error: null,
      })

      const result = await updateFeatureFlag(
        mockSupabase as never,
        'governance_v2',
        false,
        50,
        { users: ['test'] },
        'admin_hash_123'
      )

      expect(mockRpc).toHaveBeenCalledWith('admin_update_feature_flag', {
        p_id: 'governance_v2',
        p_is_enabled: false,
        p_rollout_percentage: 50,
        p_conditions: { users: ['test'] },
        p_admin_hash: 'admin_hash_123',
      })
      expect(result.success).toBe(true)
      expect(result.id).toBe('governance_v2')
    })

    it('should return error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      const result = await updateFeatureFlag(mockSupabase as never, 'id', true, 100, null, 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('DATABASE_ERROR')
    })

    it('should return error when no result returned', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await updateFeatureFlag(mockSupabase as never, 'id', true, 100, null, 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_RESULT')
    })

    it('should return error when flag not found', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: false,
            id: null,
            is_enabled: null,
            rollout_percentage: null,
            updated_at: null,
            error: 'FLAG_NOT_FOUND',
          },
        ],
        error: null,
      })

      const result = await updateFeatureFlag(
        mockSupabase as never,
        'non_existent',
        true,
        100,
        null,
        'admin'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('FLAG_NOT_FOUND')
    })
  })

  // ============================================
  // listMaintenanceWindows
  // ============================================
  describe('listMaintenanceWindows', () => {
    it('should return maintenance windows on success', async () => {
      const mockWindows = [
        createMockMaintenanceWindow(),
        createMockMaintenanceWindow({
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'API Update',
        }),
      ]
      mockRpc.mockResolvedValueOnce({ data: mockWindows, error: null })

      const result = await listMaintenanceWindows(mockSupabase as never)

      expect(mockRpc).toHaveBeenCalledWith('admin_list_maintenance_windows')
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Scheduled Maintenance')
      expect(result[1].title).toBe('API Update')
    })

    it('should return empty array when no data', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await listMaintenanceWindows(mockSupabase as never)

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      await expect(listMaintenanceWindows(mockSupabase as never)).rejects.toThrow(
        'Failed to list maintenance windows'
      )
    })

    it('should handle missing affects_services field', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            ...createMockMaintenanceWindow(),
            affects_services: null,
          },
        ],
        error: null,
      })

      const result = await listMaintenanceWindows(mockSupabase as never)

      expect(result[0].affects_services).toEqual([])
    })
  })

  // ============================================
  // createMaintenanceWindow
  // ============================================
  describe('createMaintenanceWindow', () => {
    it('should create window successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: true,
            id: '550e8400-e29b-41d4-a716-446655440002',
            created_at: '2026-01-21T10:00:00Z',
            error: null,
          },
        ],
        error: null,
      })

      const result = await createMaintenanceWindow(
        mockSupabase as never,
        'New Maintenance',
        'System upgrade',
        '2026-01-30T02:00:00Z',
        '2026-01-30T04:00:00Z',
        true,
        ['api', 'database'],
        'admin_hash_123'
      )

      expect(mockRpc).toHaveBeenCalledWith('admin_create_maintenance_window', {
        p_title: 'New Maintenance',
        p_description: 'System upgrade',
        p_starts_at: '2026-01-30T02:00:00Z',
        p_ends_at: '2026-01-30T04:00:00Z',
        p_show_banner: true,
        p_affects_services: ['api', 'database'],
        p_admin_hash: 'admin_hash_123',
      })
      expect(result.success).toBe(true)
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440002')
    })

    it('should handle null description', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            success: true,
            id: '550e8400-e29b-41d4-a716-446655440002',
            created_at: '2026-01-21T10:00:00Z',
            error: null,
          },
        ],
        error: null,
      })

      await createMaintenanceWindow(
        mockSupabase as never,
        'Title',
        null,
        '2026-01-30T02:00:00Z',
        '2026-01-30T04:00:00Z',
        false,
        [],
        'admin'
      )

      expect(mockRpc).toHaveBeenCalledWith(
        'admin_create_maintenance_window',
        expect.objectContaining({
          p_description: null,
        })
      )
    })

    it('should return error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      const result = await createMaintenanceWindow(
        mockSupabase as never,
        'Title',
        null,
        '2026-01-30T02:00:00Z',
        '2026-01-30T04:00:00Z',
        true,
        [],
        'admin'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('DATABASE_ERROR')
    })

    it('should return error when no result returned', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const result = await createMaintenanceWindow(
        mockSupabase as never,
        'Title',
        null,
        '2026-01-30T02:00:00Z',
        '2026-01-30T04:00:00Z',
        true,
        [],
        'admin'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_RESULT')
    })
  })

  // ============================================
  // deleteMaintenanceWindow
  // ============================================
  describe('deleteMaintenanceWindow', () => {
    it('should delete window successfully', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ success: true, error: null }],
        error: null,
      })

      const result = await deleteMaintenanceWindow(
        mockSupabase as never,
        '550e8400-e29b-41d4-a716-446655440000',
        'admin_hash_123'
      )

      expect(mockRpc).toHaveBeenCalledWith('admin_delete_maintenance_window', {
        p_id: '550e8400-e29b-41d4-a716-446655440000',
        p_admin_hash: 'admin_hash_123',
      })
      expect(result.success).toBe(true)
    })

    it('should return error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      const result = await deleteMaintenanceWindow(mockSupabase as never, 'id', 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('DATABASE_ERROR')
    })

    it('should return error when window not found', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ success: false, error: 'WINDOW_NOT_FOUND' }],
        error: null,
      })

      const result = await deleteMaintenanceWindow(mockSupabase as never, 'non_existent', 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('WINDOW_NOT_FOUND')
    })
  })

  // ============================================
  // toggleMaintenanceWindow
  // ============================================
  describe('toggleMaintenanceWindow', () => {
    it('should toggle window to active', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ success: true, is_active: true, error: null }],
        error: null,
      })

      const result = await toggleMaintenanceWindow(
        mockSupabase as never,
        '550e8400-e29b-41d4-a716-446655440000',
        true,
        'admin_hash_123'
      )

      expect(mockRpc).toHaveBeenCalledWith('admin_toggle_maintenance_window', {
        p_id: '550e8400-e29b-41d4-a716-446655440000',
        p_is_active: true,
        p_admin_hash: 'admin_hash_123',
      })
      expect(result.success).toBe(true)
      expect(result.is_active).toBe(true)
    })

    it('should toggle window to inactive', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ success: true, is_active: false, error: null }],
        error: null,
      })

      const result = await toggleMaintenanceWindow(mockSupabase as never, 'id', false, 'admin')

      expect(result.success).toBe(true)
      expect(result.is_active).toBe(false)
    })

    it('should return error on database failure', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })

      const result = await toggleMaintenanceWindow(mockSupabase as never, 'id', true, 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('DATABASE_ERROR')
    })

    it('should return error when window not found', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{ success: false, is_active: null, error: 'WINDOW_NOT_FOUND' }],
        error: null,
      })

      const result = await toggleMaintenanceWindow(
        mockSupabase as never,
        'non_existent',
        true,
        'admin'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('WINDOW_NOT_FOUND')
    })
  })
})
