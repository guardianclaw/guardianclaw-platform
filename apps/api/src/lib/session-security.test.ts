/**
 * Session Security Manager Tests
 *
 * Comprehensive tests for session security functionality.
 * Tests session limits, failed auth tracking, lockout, and suspicious activity detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SessionSecurityManager,
  createSessionSecurityManager,
  SESSION_LIMITS,
} from './session-security'

// Mock KV namespace
function createMockKV() {
  const store = new Map<string, { value: string; expirationTtl?: number }>()

  return {
    store,
    kv: {
      get: vi.fn(async (key: string, type?: string) => {
        const entry = store.get(key)
        if (!entry) return null
        if (type === 'json') {
          return JSON.parse(entry.value)
        }
        return entry.value
      }),
      put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
        store.set(key, { value, expirationTtl: options?.expirationTtl })
      }),
      delete: vi.fn(async (key: string) => {
        store.delete(key)
      }),
    } as unknown as KVNamespace,
    reset: () => {
      store.clear()
      vi.clearAllMocks()
    },
  }
}

describe('SESSION_LIMITS constants', () => {
  it('has correct max concurrent sessions', () => {
    expect(SESSION_LIMITS.MAX_CONCURRENT_SESSIONS).toBe(5)
  })

  it('has correct max failed attempts', () => {
    expect(SESSION_LIMITS.MAX_FAILED_ATTEMPTS).toBe(5)
  })

  it('has correct failed attempt window (15 minutes)', () => {
    expect(SESSION_LIMITS.FAILED_ATTEMPT_WINDOW_MS).toBe(15 * 60 * 1000)
  })

  it('has correct lockout duration (30 minutes)', () => {
    expect(SESSION_LIMITS.LOCKOUT_DURATION_MS).toBe(30 * 60 * 1000)
  })
})

describe('SessionSecurityManager', () => {
  let mockKV: ReturnType<typeof createMockKV>
  let manager: SessionSecurityManager

  beforeEach(() => {
    mockKV = createMockKV()
    manager = new SessionSecurityManager(mockKV.kv, 'test-secret')
  })

  describe('constructor and isEnabled', () => {
    it('returns true when KV is provided', () => {
      expect(manager.isEnabled()).toBe(true)
    })

    it('returns false when KV is null', () => {
      const nullManager = new SessionSecurityManager(null, 'secret')
      expect(nullManager.isEnabled()).toBe(false)
    })

    it('uses default secret when not provided', () => {
      const defaultManager = new SessionSecurityManager(mockKV.kv, '')
      expect(defaultManager.isEnabled()).toBe(true)
    })
  })

  describe('hasReachedSessionLimit', () => {
    it('returns false when under limit', () => {
      expect(manager.hasReachedSessionLimit(0)).toBe(false)
      expect(manager.hasReachedSessionLimit(4)).toBe(false)
    })

    it('returns true when at limit', () => {
      expect(manager.hasReachedSessionLimit(5)).toBe(true)
    })

    it('returns true when over limit', () => {
      expect(manager.hasReachedSessionLimit(10)).toBe(true)
    })
  })

  describe('recordFailedAttempt', () => {
    it('records first failed attempt', async () => {
      const result = await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      expect(result.attempts).toBe(1)
      expect(result.isLocked).toBe(false)
      expect(mockKV.kv.put).toHaveBeenCalled()
    })

    it('increments attempts on subsequent failures', async () => {
      // First attempt
      await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      // Second attempt
      const result = await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      expect(result.attempts).toBe(2)
      expect(result.isLocked).toBe(false)
    })

    it('locks out after max failed attempts', async () => {
      // Record 5 failed attempts
      for (let i = 0; i < 4; i++) {
        await manager.recordFailedAttempt('wallet-hash', 'ip-hash')
      }

      // 5th attempt should trigger lockout
      const result = await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      expect(result.attempts).toBe(5)
      expect(result.isLocked).toBe(true)

      // Verify lockout was created
      expect(mockKV.store.has('lockout:wallet-hash')).toBe(true)
    })

    it('tracks different IP addresses', async () => {
      await manager.recordFailedAttempt('wallet-hash', 'ip-1')
      await manager.recordFailedAttempt('wallet-hash', 'ip-2')
      await manager.recordFailedAttempt('wallet-hash', 'ip-1') // Duplicate

      const stored = mockKV.store.get('failed_auth:wallet-hash')
      const entry = JSON.parse(stored!.value)

      expect(entry.ipHashes).toContain('ip-1')
      expect(entry.ipHashes).toContain('ip-2')
      expect(entry.ipHashes.length).toBe(2) // No duplicates
    })

    it('resets after window expires', async () => {
      // Record first attempt
      await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      // Simulate expired window
      const stored = mockKV.store.get('failed_auth:wallet-hash')
      const entry = JSON.parse(stored!.value)
      entry.firstAttempt = Date.now() - SESSION_LIMITS.FAILED_ATTEMPT_WINDOW_MS - 1000
      mockKV.store.set('failed_auth:wallet-hash', { value: JSON.stringify(entry) })

      // New attempt should reset counter
      const result = await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      expect(result.attempts).toBe(1)
    })

    it('returns safe defaults when KV is unavailable', async () => {
      const nullManager = new SessionSecurityManager(null, 'secret')

      const result = await nullManager.recordFailedAttempt('wallet', 'ip')

      expect(result.attempts).toBe(1)
      expect(result.isLocked).toBe(false)
    })

    it('handles KV errors gracefully', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
        put: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace

      const errorManager = new SessionSecurityManager(errorKV, 'secret')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await errorManager.recordFailedAttempt('wallet', 'ip')

      expect(result.attempts).toBe(1)
      expect(result.isLocked).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('clearFailedAttempts', () => {
    it('deletes failed attempts record', async () => {
      // Record some attempts
      await manager.recordFailedAttempt('wallet-hash', 'ip-hash')

      // Clear them
      await manager.clearFailedAttempts('wallet-hash')

      expect(mockKV.kv.delete).toHaveBeenCalledWith('failed_auth:wallet-hash')
    })

    it('does nothing when KV is unavailable', async () => {
      const nullManager = new SessionSecurityManager(null, 'secret')

      // Should not throw
      await nullManager.clearFailedAttempts('wallet')
    })

    it('handles KV errors gracefully', async () => {
      const errorKV = {
        delete: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace

      const errorManager = new SessionSecurityManager(errorKV, 'secret')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Should not throw
      await errorManager.clearFailedAttempts('wallet')

      consoleSpy.mockRestore()
    })
  })

  describe('isLockedOut', () => {
    it('returns locked=false when not locked', async () => {
      const result = await manager.isLockedOut('wallet-hash')

      expect(result.locked).toBe(false)
      expect(result.remainingMs).toBeUndefined()
    })

    it('returns locked=true with remaining time when locked', async () => {
      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await manager.recordFailedAttempt('wallet-hash', 'ip-hash')
      }

      const result = await manager.isLockedOut('wallet-hash')

      expect(result.locked).toBe(true)
      expect(result.remainingMs).toBeGreaterThan(0)
      expect(result.remainingMs).toBeLessThanOrEqual(SESSION_LIMITS.LOCKOUT_DURATION_MS)
    })

    it('returns locked=false and cleans up when lockout expired', async () => {
      // Create an expired lockout entry
      const expiredEntry = {
        lockedAt: Date.now() - SESSION_LIMITS.LOCKOUT_DURATION_MS - 1000,
        expiresAt: Date.now() - 1000,
      }
      mockKV.store.set('lockout:wallet-hash', { value: JSON.stringify(expiredEntry) })

      const result = await manager.isLockedOut('wallet-hash')

      expect(result.locked).toBe(false)
      expect(mockKV.kv.delete).toHaveBeenCalledWith('lockout:wallet-hash')
    })

    it('returns locked=false when KV is unavailable', async () => {
      const nullManager = new SessionSecurityManager(null, 'secret')

      const result = await nullManager.isLockedOut('wallet')

      expect(result.locked).toBe(false)
    })

    it('handles KV errors gracefully', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace

      const errorManager = new SessionSecurityManager(errorKV, 'secret')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await errorManager.isLockedOut('wallet')

      expect(result.locked).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('recordIP', () => {
    it('records new IP', async () => {
      await manager.recordIP('wallet-hash', 'ip-hash-1')

      expect(mockKV.kv.put).toHaveBeenCalled()
      const stored = mockKV.store.get('ip_history:wallet-hash')
      const history = JSON.parse(stored!.value)

      expect(history).toHaveLength(1)
      expect(history[0].ipHash).toBe('ip-hash-1')
    })

    it('updates existing IP lastSeen', async () => {
      await manager.recordIP('wallet-hash', 'ip-hash-1')
      const firstSeen = JSON.parse(mockKV.store.get('ip_history:wallet-hash')!.value)[0].lastSeen

      // Wait a bit and record again
      await new Promise((r) => setTimeout(r, 10))
      await manager.recordIP('wallet-hash', 'ip-hash-1')

      const stored = mockKV.store.get('ip_history:wallet-hash')
      const history = JSON.parse(stored!.value)

      expect(history).toHaveLength(1)
      expect(history[0].lastSeen).toBeGreaterThan(firstSeen)
    })

    it('keeps only last 10 IPs', async () => {
      // Record 12 different IPs
      for (let i = 0; i < 12; i++) {
        await manager.recordIP('wallet-hash', `ip-hash-${i}`)
      }

      const stored = mockKV.store.get('ip_history:wallet-hash')
      const history = JSON.parse(stored!.value)

      expect(history).toHaveLength(10)
      // Should keep the last 10 (indices 2-11)
      expect(history[0].ipHash).toBe('ip-hash-2')
      expect(history[9].ipHash).toBe('ip-hash-11')
    })

    it('does nothing when KV is unavailable', async () => {
      const nullManager = new SessionSecurityManager(null, 'secret')

      // Should not throw
      await nullManager.recordIP('wallet', 'ip')
    })
  })

  describe('detectSuspiciousActivity', () => {
    it('returns not suspicious when no issues', async () => {
      const result = await manager.detectSuspiciousActivity('wallet-hash', 'ip-1', 'ip-1')

      expect(result.isSuspicious).toBe(false)
      expect(result.reasons).toHaveLength(0)
      expect(result.action).toBe('allow')
    })

    it('detects IP change during session', async () => {
      const result = await manager.detectSuspiciousActivity('wallet-hash', 'ip-2', 'ip-1')

      expect(result.isSuspicious).toBe(true)
      expect(result.reasons).toContain('ip_changed_during_session')
      expect(result.action).toBe('challenge')
    })

    it('detects multiple recent IPs with new unknown IP', async () => {
      // Record 3 different IPs in the last hour
      const now = Date.now()
      const ipHistory = [
        { ipHash: 'ip-1', lastSeen: now - 1000 },
        { ipHash: 'ip-2', lastSeen: now - 2000 },
        { ipHash: 'ip-3', lastSeen: now - 3000 },
      ]
      mockKV.store.set('ip_history:wallet-hash', { value: JSON.stringify(ipHistory) })

      const result = await manager.detectSuspiciousActivity('wallet-hash', 'ip-new', undefined)

      expect(result.isSuspicious).toBe(true)
      expect(result.reasons).toContain('multiple_recent_ips')
    })

    it('blocks when both IP change and multiple recent IPs', async () => {
      // Record 3 different IPs
      const now = Date.now()
      const ipHistory = [
        { ipHash: 'ip-1', lastSeen: now - 1000 },
        { ipHash: 'ip-2', lastSeen: now - 2000 },
        { ipHash: 'ip-3', lastSeen: now - 3000 },
      ]
      mockKV.store.set('ip_history:wallet-hash', { value: JSON.stringify(ipHistory) })

      // Request from new IP with session from ip-1
      const result = await manager.detectSuspiciousActivity('wallet-hash', 'ip-new', 'ip-1')

      expect(result.isSuspicious).toBe(true)
      expect(result.reasons).toContain('ip_changed_during_session')
      expect(result.reasons).toContain('multiple_recent_ips')
      expect(result.action).toBe('block')
    })

    it('allows when current IP is in recent history', async () => {
      // Record 3 IPs including the current one
      const now = Date.now()
      const ipHistory = [
        { ipHash: 'ip-1', lastSeen: now - 1000 },
        { ipHash: 'ip-2', lastSeen: now - 2000 },
        { ipHash: 'ip-current', lastSeen: now - 3000 },
      ]
      mockKV.store.set('ip_history:wallet-hash', { value: JSON.stringify(ipHistory) })

      const result = await manager.detectSuspiciousActivity(
        'wallet-hash',
        'ip-current',
        'ip-current'
      )

      expect(result.isSuspicious).toBe(false)
      expect(result.action).toBe('allow')
    })
  })

  describe('getRemainingAttempts', () => {
    it('returns max attempts when no failures recorded', async () => {
      const result = await manager.getRemainingAttempts('wallet-hash')

      expect(result).toBe(SESSION_LIMITS.MAX_FAILED_ATTEMPTS)
    })

    it('returns correct remaining attempts', async () => {
      // Record 3 failed attempts
      await manager.recordFailedAttempt('wallet-hash', 'ip')
      await manager.recordFailedAttempt('wallet-hash', 'ip')
      await manager.recordFailedAttempt('wallet-hash', 'ip')

      const result = await manager.getRemainingAttempts('wallet-hash')

      expect(result).toBe(2) // 5 - 3 = 2
    })

    it('returns 0 when at limit', async () => {
      // Record 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await manager.recordFailedAttempt('wallet-hash', 'ip')
      }

      const result = await manager.getRemainingAttempts('wallet-hash')

      expect(result).toBe(0)
    })

    it('returns max attempts when window expired', async () => {
      // Record some attempts
      await manager.recordFailedAttempt('wallet-hash', 'ip')

      // Expire the window
      const stored = mockKV.store.get('failed_auth:wallet-hash')
      const entry = JSON.parse(stored!.value)
      entry.firstAttempt = Date.now() - SESSION_LIMITS.FAILED_ATTEMPT_WINDOW_MS - 1000
      mockKV.store.set('failed_auth:wallet-hash', { value: JSON.stringify(entry) })

      const result = await manager.getRemainingAttempts('wallet-hash')

      expect(result).toBe(SESSION_LIMITS.MAX_FAILED_ATTEMPTS)
    })

    it('returns null when KV is unavailable', async () => {
      const nullManager = new SessionSecurityManager(null, 'secret')

      const result = await nullManager.getRemainingAttempts('wallet')

      expect(result).toBeNull()
    })
  })
})

describe('createSessionSecurityManager', () => {
  it('creates a SessionSecurityManager instance', () => {
    const mockKV = {} as KVNamespace
    const manager = createSessionSecurityManager(mockKV, 'secret')

    expect(manager).toBeInstanceOf(SessionSecurityManager)
    expect(manager.isEnabled()).toBe(true)
  })

  it('handles null KV', () => {
    const manager = createSessionSecurityManager(null, 'secret')

    expect(manager).toBeInstanceOf(SessionSecurityManager)
    expect(manager.isEnabled()).toBe(false)
  })
})

describe('Integration: Failed Auth to Lockout Flow', () => {
  let mockKV: ReturnType<typeof createMockKV>
  let manager: SessionSecurityManager

  beforeEach(() => {
    mockKV = createMockKV()
    manager = new SessionSecurityManager(mockKV.kv, 'test-secret')
  })

  it('full lockout flow works correctly', async () => {
    const walletHash = 'integration-wallet'

    // Initially not locked
    expect((await manager.isLockedOut(walletHash)).locked).toBe(false)
    expect(await manager.getRemainingAttempts(walletHash)).toBe(5)

    // Record 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const result = await manager.recordFailedAttempt(walletHash, 'ip')
      expect(result.isLocked).toBe(false)
    }

    expect(await manager.getRemainingAttempts(walletHash)).toBe(1)

    // 5th attempt triggers lockout
    const lockoutResult = await manager.recordFailedAttempt(walletHash, 'ip')
    expect(lockoutResult.isLocked).toBe(true)

    // Verify locked
    const lockStatus = await manager.isLockedOut(walletHash)
    expect(lockStatus.locked).toBe(true)
    expect(lockStatus.remainingMs).toBeGreaterThan(0)
  })

  it('successful auth clears failed attempts', async () => {
    const walletHash = 'clear-test-wallet'

    // Record some failed attempts
    await manager.recordFailedAttempt(walletHash, 'ip')
    await manager.recordFailedAttempt(walletHash, 'ip')

    expect(await manager.getRemainingAttempts(walletHash)).toBe(3)

    // Simulate successful auth
    await manager.clearFailedAttempts(walletHash)

    // Should be back to full attempts
    expect(await manager.getRemainingAttempts(walletHash)).toBe(5)
  })
})
