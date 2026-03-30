/**
 * API Key Migration Service Tests
 *
 * Tests: retry logic, monitoring, batch migration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  migrateApiKey,
  queueKeyMigration,
  batchMigrateLegacyKeys,
  needsMigration,
} from './api-key-migration'

// Mock api-key-hash module
vi.mock('./api-key-hash', () => ({
  hashNewApiKey: vi.fn(async (apiKey: string) => ({
    hash: 'new-pbkdf2-hash-' + apiKey.slice(-8),
    salt: 'new-salt-1234567890abcdef',
    prefix: apiKey.slice(0, 15),
  })),
  needsMigration: vi.fn((salt: string | null | undefined) => !salt),
}))

// Mock console methods for log verification
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
}

describe('API Key Migration Service', () => {
  let consoleLogs: string[] = []
  let consoleWarns: string[] = []
  let consoleErrors: string[] = []

  beforeEach(() => {
    consoleLogs = []
    consoleWarns = []
    consoleErrors = []

    console.log = vi.fn((msg: string) => consoleLogs.push(msg))
    console.warn = vi.fn((msg: string) => consoleWarns.push(msg))
    console.error = vi.fn((msg: string) => consoleErrors.push(msg))

    vi.clearAllMocks()
  })

  afterEach(() => {
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  describe('migrateApiKey', () => {
    it('successfully migrates a key on first attempt', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }

      const result = await migrateApiKey(
        mockSupabase,
        'sk_live_testapikey123456789012345678901234567890123456789012345678',
        'key-123',
        'agent-456'
      )

      expect(result.success).toBe(true)
      expect(result.keyId).toBe('key-123')
      expect(result.agentId).toBe('agent-456')
      expect(result.attempts).toBe(1)
      expect(result.duration_ms).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()

      // Verify logging
      expect(consoleLogs.length).toBeGreaterThan(0)
      const logEntry = JSON.parse(consoleLogs[0])
      expect(logEntry.category).toBe('api_key_migration')
      expect(logEntry.message).toBe('API key migrated to PBKDF2')
    })

    it('retries on database failure and eventually succeeds', async () => {
      let attempts = 0
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => {
              attempts++
              if (attempts < 3) {
                return Promise.resolve({ error: { message: 'Connection failed' } })
              }
              return Promise.resolve({ error: null })
            }),
          })),
        })),
      }

      const result = await migrateApiKey(
        mockSupabase,
        'sk_live_testapikey123456789012345678901234567890123456789012345678',
        'key-123',
        'agent-456',
        { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 } // Fast retries for testing
      )

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(3)

      // Verify retry warnings were logged
      expect(consoleWarns.length).toBe(2) // 2 retries before success
      const warnEntry = JSON.parse(consoleWarns[0])
      expect(warnEntry.message).toContain('retrying')
    })

    it('fails after max retries exhausted', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: { message: 'Persistent failure' } })),
          })),
        })),
      }

      const result = await migrateApiKey(
        mockSupabase,
        'sk_live_testapikey123456789012345678901234567890123456789012345678',
        'key-123',
        'agent-456',
        { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 }
      )

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3) // Initial + 2 retries
      expect(result.error).toBe('Persistent failure')

      // Verify error was logged
      expect(consoleErrors.length).toBe(1)
      const errorEntry = JSON.parse(consoleErrors[0])
      expect(errorEntry.message).toContain('failed after all retries')
    })

    it('logs correct migration category for monitoring', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }

      await migrateApiKey(mockSupabase, 'sk_live_test', 'key-1', 'agent-1')

      const logEntry = JSON.parse(consoleLogs[0])
      expect(logEntry.category).toBe('api_key_migration')
      expect(logEntry.level).toBe('info')
      expect(logEntry.key_id).toBe('key-1')
      expect(logEntry.agent_id).toBe('agent-1')
    })
  })

  describe('queueKeyMigration', () => {
    it('queues migration without blocking', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      }

      // Should return immediately (non-blocking)
      const startTime = Date.now()
      queueKeyMigration(mockSupabase, 'sk_live_test', 'key-1', 'agent-1')
      const elapsed = Date.now() - startTime

      // Queue call should be nearly instant
      expect(elapsed).toBeLessThan(50)

      // Verify initial log was emitted
      expect(consoleLogs.length).toBeGreaterThan(0)
      const logEntry = JSON.parse(consoleLogs[0])
      expect(logEntry.message).toBe('Legacy API key detected, queueing migration')

      // Wait for async migration to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify migration completed
      expect(consoleLogs.length).toBe(2)
    })
  })

  describe('batchMigrateLegacyKeys', () => {
    it('migrates all legacy keys in batch', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'api_keys') {
            return {
              select: vi.fn(() => ({
                is: vi.fn(() => ({
                  limit: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        { id: 'key-1', agent_id: 'agent-1' },
                        { id: 'key-2', agent_id: 'agent-2' },
                        { id: 'key-3', agent_id: 'agent-3' },
                      ],
                      error: null,
                    })
                  ),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            }
          }
          return {}
        }),
      }

      const getApiKeyById = vi.fn(async (keyId: string) => {
        return `sk_live_${keyId}_1234567890123456789012345678901234567890123456789012`
      })

      const summary = await batchMigrateLegacyKeys(
        mockSupabase as unknown as Parameters<typeof batchMigrateLegacyKeys>[0],
        getApiKeyById
      )

      expect(summary.total).toBe(3)
      expect(summary.successful).toBe(3)
      expect(summary.failed).toBe(0)
      expect(summary.errors).toHaveLength(0)
    })

    it('handles partial failures in batch', async () => {
      // Track which key is being updated
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'api_keys') {
            return {
              select: vi.fn(() => ({
                is: vi.fn(() => ({
                  limit: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        { id: 'key-1', agent_id: 'agent-1' },
                        { id: 'key-2', agent_id: 'agent-2' },
                      ],
                      error: null,
                    })
                  ),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn((field: string, value: string) => {
                  // Fail persistently for key-2 (even with retries)
                  if (value === 'key-2') {
                    return Promise.resolve({ error: { message: 'DB error' } })
                  }
                  return Promise.resolve({ error: null })
                }),
              })),
            }
          }
          return {}
        }),
      }

      const getApiKeyById = vi.fn(async (keyId: string) => {
        return `sk_live_${keyId}_1234567890123456789012345678901234567890123456789012`
      })

      const summary = await batchMigrateLegacyKeys(
        mockSupabase as unknown as Parameters<typeof batchMigrateLegacyKeys>[0],
        getApiKeyById,
        100
      )

      expect(summary.total).toBe(2)
      expect(summary.successful).toBe(1)
      expect(summary.failed).toBe(1)
      expect(summary.errors).toHaveLength(1)
      expect(summary.errors[0].keyId).toBe('key-2')
    })

    it('handles missing plaintext key', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'api_keys') {
            return {
              select: vi.fn(() => ({
                is: vi.fn(() => ({
                  limit: vi.fn(() =>
                    Promise.resolve({
                      data: [{ id: 'key-1', agent_id: 'agent-1' }],
                      error: null,
                    })
                  ),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            }
          }
          return {}
        }),
      }

      const getApiKeyById = vi.fn(async () => null) // Can't retrieve key

      const summary = await batchMigrateLegacyKeys(
        mockSupabase as unknown as Parameters<typeof batchMigrateLegacyKeys>[0],
        getApiKeyById
      )

      expect(summary.total).toBe(1)
      expect(summary.successful).toBe(0)
      expect(summary.failed).toBe(1)
      expect(summary.errors[0].error).toBe('Could not retrieve plaintext key')
    })

    it('returns empty summary when no legacy keys found', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            is: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      }

      const summary = await batchMigrateLegacyKeys(
        mockSupabase as unknown as Parameters<typeof batchMigrateLegacyKeys>[0],
        vi.fn()
      )

      expect(summary.total).toBe(0)
      expect(summary.successful).toBe(0)
      expect(summary.failed).toBe(0)
    })
  })

  describe('needsMigration', () => {
    it('returns true for null salt', () => {
      expect(needsMigration(null)).toBe(true)
    })

    it('returns true for undefined salt', () => {
      expect(needsMigration(undefined)).toBe(true)
    })

    it('returns false for valid salt', () => {
      expect(needsMigration('valid-salt-1234567890abcdef')).toBe(false)
    })
  })
})
