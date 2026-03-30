/**
 * Session Security Module
 *
 * Implements session security controls per SECURITY_SPEC Section 2.2.
 *
 * Features:
 * - Concurrent session limit (max 5 per wallet)
 * - Failed authentication tracking
 * - Suspicious activity detection
 * - IP change detection
 *
 * All data is stored in Cloudflare KV with appropriate TTLs.
 */

/**
 * Configuration constants per SECURITY_SPEC.
 */
export const SESSION_LIMITS = {
  MAX_CONCURRENT_SESSIONS: 5,
  MAX_FAILED_ATTEMPTS: 5,
  FAILED_ATTEMPT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  SUSPICIOUS_REQUEST_RATE: 100, // requests per minute
  IP_CHANGE_TRACKING_HOURS: 24,
} as const

/**
 * Key prefixes for KV storage.
 */
const PREFIXES = {
  SESSIONS: 'sessions:',
  FAILED_AUTH: 'failed_auth:',
  LOCKOUT: 'lockout:',
  IP_HISTORY: 'ip_history:',
  REQUEST_RATE: 'req_rate:',
} as const

/**
 * Session entry stored in database.
 */
export interface SessionEntry {
  sessionId: string
  tokenHash: string
  ipHash: string
  createdAt: number
  lastUsedAt: number
  userAgent?: string
}

/**
 * Failed authentication tracking.
 */
interface FailedAuthEntry {
  attempts: number
  firstAttempt: number
  lastAttempt: number
  ipHashes: string[]
}

/**
 * Suspicious activity detection result.
 */
export interface SuspiciousActivityResult {
  isSuspicious: boolean
  reasons: string[]
  action: 'allow' | 'challenge' | 'block'
}

/**
 * Session Security Manager.
 *
 * Manages session limits, failed auth tracking, and suspicious activity detection.
 */
export class SessionSecurityManager {
  private kv: KVNamespace | null
  private ipHashSecret: string

  constructor(kv: KVNamespace | null, ipHashSecret: string) {
    this.kv = kv
    this.ipHashSecret = ipHashSecret || 'default-dev-secret'
  }

  /**
   * Check if wallet has reached session limit.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @param currentSessionCount - Current number of active sessions
   * @returns true if limit reached
   */
  hasReachedSessionLimit(currentSessionCount: number): boolean {
    return currentSessionCount >= SESSION_LIMITS.MAX_CONCURRENT_SESSIONS
  }

  /**
   * Record a failed authentication attempt.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @param ipHash - Hashed IP address
   * @returns Updated attempt count
   */
  async recordFailedAttempt(
    walletHash: string,
    ipHash: string
  ): Promise<{ attempts: number; isLocked: boolean }> {
    if (!this.kv) {
      return { attempts: 1, isLocked: false }
    }

    const key = `${PREFIXES.FAILED_AUTH}${walletHash}`
    const now = Date.now()

    try {
      const stored = await this.kv.get(key, 'json')
      let entry: FailedAuthEntry

      if (stored) {
        entry = stored as FailedAuthEntry

        // Reset if window expired
        if (now - entry.firstAttempt > SESSION_LIMITS.FAILED_ATTEMPT_WINDOW_MS) {
          entry = {
            attempts: 1,
            firstAttempt: now,
            lastAttempt: now,
            ipHashes: [ipHash],
          }
        } else {
          entry.attempts++
          entry.lastAttempt = now
          if (!entry.ipHashes.includes(ipHash)) {
            entry.ipHashes.push(ipHash)
          }
        }
      } else {
        entry = {
          attempts: 1,
          firstAttempt: now,
          lastAttempt: now,
          ipHashes: [ipHash],
        }
      }

      // Store with TTL
      const ttlSeconds = Math.ceil(SESSION_LIMITS.FAILED_ATTEMPT_WINDOW_MS / 1000) + 60
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttlSeconds,
      })

      // Check if should be locked out
      const isLocked = entry.attempts >= SESSION_LIMITS.MAX_FAILED_ATTEMPTS

      if (isLocked) {
        await this.lockoutWallet(walletHash)
      }

      return { attempts: entry.attempts, isLocked }
    } catch (error) {
      console.error('[SessionSecurity] Failed to record failed attempt:', error)
      return { attempts: 1, isLocked: false }
    }
  }

  /**
   * Clear failed attempts after successful auth.
   *
   * @param walletHash - SHA-256 hash of wallet address
   */
  async clearFailedAttempts(walletHash: string): Promise<void> {
    if (!this.kv) return

    const key = `${PREFIXES.FAILED_AUTH}${walletHash}`

    try {
      await this.kv.delete(key)
    } catch (error) {
      console.error('[SessionSecurity] Failed to clear failed attempts:', error)
    }
  }

  /**
   * Lock out a wallet temporarily.
   *
   * @param walletHash - SHA-256 hash of wallet address
   */
  private async lockoutWallet(walletHash: string): Promise<void> {
    if (!this.kv) return

    const key = `${PREFIXES.LOCKOUT}${walletHash}`
    const entry = {
      lockedAt: Date.now(),
      expiresAt: Date.now() + SESSION_LIMITS.LOCKOUT_DURATION_MS,
    }

    try {
      const ttlSeconds = Math.ceil(SESSION_LIMITS.LOCKOUT_DURATION_MS / 1000) + 60
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttlSeconds,
      })
    } catch (error) {
      console.error('[SessionSecurity] Failed to lockout wallet:', error)
    }
  }

  /**
   * Check if wallet is locked out.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @returns Lockout info or null if not locked
   */
  async isLockedOut(walletHash: string): Promise<{ locked: boolean; remainingMs?: number }> {
    if (!this.kv) {
      return { locked: false }
    }

    const key = `${PREFIXES.LOCKOUT}${walletHash}`

    try {
      const stored = await this.kv.get(key, 'json')
      if (!stored) {
        return { locked: false }
      }

      const entry = stored as { lockedAt: number; expiresAt: number }
      const now = Date.now()

      if (now >= entry.expiresAt) {
        // Lockout expired, clean up
        await this.kv.delete(key)
        return { locked: false }
      }

      return {
        locked: true,
        remainingMs: entry.expiresAt - now,
      }
    } catch (error) {
      console.error('[SessionSecurity] Failed to check lockout:', error)
      return { locked: false }
    }
  }

  /**
   * Record IP for change detection.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @param ipHash - Hashed IP address
   */
  async recordIP(walletHash: string, ipHash: string): Promise<void> {
    if (!this.kv) return

    const key = `${PREFIXES.IP_HISTORY}${walletHash}`

    try {
      const stored = await this.kv.get(key, 'json')
      let ipHistory: { ipHash: string; lastSeen: number }[] = []

      if (stored) {
        ipHistory = stored as { ipHash: string; lastSeen: number }[]
      }

      // Update or add IP
      const existingIndex = ipHistory.findIndex((h) => h.ipHash === ipHash)
      if (existingIndex >= 0) {
        ipHistory[existingIndex].lastSeen = Date.now()
      } else {
        ipHistory.push({ ipHash, lastSeen: Date.now() })
      }

      // Keep only last 10 IPs
      ipHistory = ipHistory.slice(-10)

      const ttlSeconds = SESSION_LIMITS.IP_CHANGE_TRACKING_HOURS * 60 * 60
      await this.kv.put(key, JSON.stringify(ipHistory), {
        expirationTtl: ttlSeconds,
      })
    } catch (error) {
      console.error('[SessionSecurity] Failed to record IP:', error)
    }
  }

  /**
   * Detect suspicious activity patterns.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @param currentIpHash - Current request IP hash
   * @param sessionIpHash - Session's original IP hash (if known)
   * @returns Suspicious activity assessment
   */
  async detectSuspiciousActivity(
    walletHash: string,
    currentIpHash: string,
    sessionIpHash?: string
  ): Promise<SuspiciousActivityResult> {
    const reasons: string[] = []

    // Check for IP change during session
    if (sessionIpHash && sessionIpHash !== currentIpHash) {
      reasons.push('ip_changed_during_session')
    }

    // Check IP history for unusual patterns
    if (this.kv) {
      const key = `${PREFIXES.IP_HISTORY}${walletHash}`
      try {
        const stored = await this.kv.get(key, 'json')
        if (stored) {
          const history = stored as { ipHash: string; lastSeen: number }[]

          // Multiple different IPs in short time (potential session hijacking)
          const recentIPs = history.filter(
            (h) => Date.now() - h.lastSeen < 60 * 60 * 1000 // Last hour
          )

          if (recentIPs.length >= 3 && !recentIPs.some((h) => h.ipHash === currentIpHash)) {
            reasons.push('multiple_recent_ips')
          }
        }
      } catch (error) {
        console.error('[SessionSecurity] Failed to check IP history:', error)
      }
    }

    // Determine action based on severity
    let action: 'allow' | 'challenge' | 'block' = 'allow'

    if (reasons.length > 0) {
      if (
        reasons.includes('ip_changed_during_session') &&
        reasons.includes('multiple_recent_ips')
      ) {
        action = 'block'
      } else if (reasons.includes('ip_changed_during_session')) {
        action = 'challenge'
      }
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
      action,
    }
  }

  /**
   * Get remaining failed attempts before lockout.
   *
   * @param walletHash - SHA-256 hash of wallet address
   * @returns Remaining attempts, or null if not tracking
   */
  async getRemainingAttempts(walletHash: string): Promise<number | null> {
    if (!this.kv) {
      return null
    }

    const key = `${PREFIXES.FAILED_AUTH}${walletHash}`

    try {
      const stored = await this.kv.get(key, 'json')
      if (!stored) {
        return SESSION_LIMITS.MAX_FAILED_ATTEMPTS
      }

      const entry = stored as FailedAuthEntry
      const now = Date.now()

      // Check if window expired
      if (now - entry.firstAttempt > SESSION_LIMITS.FAILED_ATTEMPT_WINDOW_MS) {
        return SESSION_LIMITS.MAX_FAILED_ATTEMPTS
      }

      return Math.max(0, SESSION_LIMITS.MAX_FAILED_ATTEMPTS - entry.attempts)
    } catch (error) {
      console.error('[SessionSecurity] Failed to get remaining attempts:', error)
      return null
    }
  }

  /**
   * Check if KV storage is available.
   */
  isEnabled(): boolean {
    return this.kv !== null
  }
}

/**
 * Create a Session Security Manager instance.
 *
 * @param kv - Cloudflare KV namespace (can be null for testing)
 * @param ipHashSecret - Secret for IP hashing
 */
export function createSessionSecurityManager(
  kv: KVNamespace | null,
  ipHashSecret: string
): SessionSecurityManager {
  return new SessionSecurityManager(kv, ipHashSecret)
}
