/**
 * Memory Integrity Service tests
 *
 * Tests HMAC signing, verification, trust scoring, and batch verification.
 */

import { describe, it, expect } from 'vitest'
import {
  signMessage,
  verifyMessage,
  computeTrustScore,
  verifyMessageBatch,
  constantTimeCompare,
  deriveAgentSecret,
  DEFAULT_MEMORY_INTEGRITY,
} from './memory-integrity'

const TEST_SECRET = 'test-server-secret-for-integrity'
const TEST_AGENT_ID = 'agent-abc-123'

describe('memory-integrity', () => {
  // ==========================================
  // signMessage
  // ==========================================
  describe('signMessage', () => {
    it('produces a signature with msig_ prefix', async () => {
      const result = await signMessage('hello world', TEST_SECRET, TEST_AGENT_ID)
      expect(result.hmac).toMatch(/^msig_[0-9a-f]{64}$/)
      expect(result.timestamp).toBeGreaterThan(0)
    })

    it('produces deterministic signatures for same inputs', async () => {
      const ts = 1700000000
      const a = await signMessage('same content', TEST_SECRET, TEST_AGENT_ID, ts)
      const b = await signMessage('same content', TEST_SECRET, TEST_AGENT_ID, ts)
      expect(a.hmac).toBe(b.hmac)
    })

    it('produces different signatures for different content', async () => {
      const ts = 1700000000
      const a = await signMessage('content A', TEST_SECRET, TEST_AGENT_ID, ts)
      const b = await signMessage('content B', TEST_SECRET, TEST_AGENT_ID, ts)
      expect(a.hmac).not.toBe(b.hmac)
    })

    it('produces different signatures for different agents', async () => {
      const ts = 1700000000
      const a = await signMessage('same', TEST_SECRET, 'agent-1', ts)
      const b = await signMessage('same', TEST_SECRET, 'agent-2', ts)
      expect(a.hmac).not.toBe(b.hmac)
    })

    it('produces different signatures for different timestamps', async () => {
      const a = await signMessage('same', TEST_SECRET, TEST_AGENT_ID, 1700000000)
      const b = await signMessage('same', TEST_SECRET, TEST_AGENT_ID, 1700000001)
      expect(a.hmac).not.toBe(b.hmac)
    })

    it('handles empty content', async () => {
      const result = await signMessage('', TEST_SECRET, TEST_AGENT_ID)
      expect(result.hmac).toMatch(/^msig_[0-9a-f]{64}$/)
    })

    it('handles unicode content', async () => {
      const result = await signMessage('こんにちは 🌍 مرحبا', TEST_SECRET, TEST_AGENT_ID)
      expect(result.hmac).toMatch(/^msig_[0-9a-f]{64}$/)
    })
  })

  // ==========================================
  // verifyMessage
  // ==========================================
  describe('verifyMessage', () => {
    it('verifies a valid signature', async () => {
      const ts = 1700000000
      const signed = await signMessage('test message', TEST_SECRET, TEST_AGENT_ID, ts)
      const valid = await verifyMessage('test message', signed.hmac, TEST_SECRET, TEST_AGENT_ID, ts)
      expect(valid).toBe(true)
    })

    it('detects tampered content', async () => {
      const ts = 1700000000
      const signed = await signMessage('original', TEST_SECRET, TEST_AGENT_ID, ts)
      const valid = await verifyMessage('tampered', signed.hmac, TEST_SECRET, TEST_AGENT_ID, ts)
      expect(valid).toBe(false)
    })

    it('detects wrong agent', async () => {
      const ts = 1700000000
      const signed = await signMessage('msg', TEST_SECRET, 'agent-1', ts)
      const valid = await verifyMessage('msg', signed.hmac, TEST_SECRET, 'agent-2', ts)
      expect(valid).toBe(false)
    })

    it('detects wrong timestamp', async () => {
      const signed = await signMessage('msg', TEST_SECRET, TEST_AGENT_ID, 1700000000)
      const valid = await verifyMessage('msg', signed.hmac, TEST_SECRET, TEST_AGENT_ID, 1700000001)
      expect(valid).toBe(false)
    })

    it('rejects missing HMAC', async () => {
      const valid = await verifyMessage('msg', '', TEST_SECRET, TEST_AGENT_ID, 1700000000)
      expect(valid).toBe(false)
    })

    it('rejects invalid prefix', async () => {
      const valid = await verifyMessage(
        'msg',
        'invalid_abc123',
        TEST_SECRET,
        TEST_AGENT_ID,
        1700000000
      )
      expect(valid).toBe(false)
    })
  })

  // ==========================================
  // constantTimeCompare
  // ==========================================
  describe('constantTimeCompare', () => {
    it('returns true for identical strings', () => {
      expect(constantTimeCompare('abc', 'abc')).toBe(true)
    })

    it('returns false for different strings of same length', () => {
      expect(constantTimeCompare('abc', 'abd')).toBe(false)
    })

    it('returns false for different lengths', () => {
      expect(constantTimeCompare('abc', 'abcd')).toBe(false)
    })

    it('returns true for empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true)
    })

    it('returns false for empty vs non-empty', () => {
      expect(constantTimeCompare('', 'a')).toBe(false)
    })
  })

  // ==========================================
  // deriveAgentSecret
  // ==========================================
  describe('deriveAgentSecret', () => {
    it('derives a CryptoKey', async () => {
      const key = await deriveAgentSecret(TEST_SECRET, TEST_AGENT_ID)
      expect(key).toBeDefined()
      expect(key.type).toBe('secret')
    })

    it('derives different keys for different agents', async () => {
      // We can verify this indirectly via different signatures
      const ts = 1700000000
      const a = await signMessage('x', TEST_SECRET, 'agent-a', ts)
      const b = await signMessage('x', TEST_SECRET, 'agent-b', ts)
      expect(a.hmac).not.toBe(b.hmac)
    })
  })

  // ==========================================
  // computeTrustScore
  // ==========================================
  describe('computeTrustScore', () => {
    it('gives high score for verified assistant message', () => {
      const result = computeTrustScore(true, 'assistant', new Date().toISOString())
      expect(result.trust_score).toBeGreaterThanOrEqual(0.9)
      expect(result.hmac_valid).toBe(true)
      expect(result.reasons).toContain('hmac_verified')
      expect(result.reasons).toContain('trusted_source')
    })

    it('gives high score for verified user message', () => {
      const result = computeTrustScore(true, 'user', new Date().toISOString())
      expect(result.trust_score).toBeGreaterThanOrEqual(0.8)
      expect(result.hmac_valid).toBe(true)
    })

    it('gives zero HMAC component for failed verification', () => {
      const result = computeTrustScore(false, 'user', new Date().toISOString())
      // 0 (hmac) + 0.1 (user) + 0.2 (recent) = 0.3
      expect(result.trust_score).toBeLessThanOrEqual(0.35)
      expect(result.hmac_valid).toBe(false)
      expect(result.reasons).toContain('hmac_failed')
    })

    it('gives base score for legacy messages without HMAC', () => {
      const result = computeTrustScore(null, 'user', new Date().toISOString())
      // 0.3 (legacy) + 0.1 (user) + 0.2 (recent) = 0.6
      expect(result.trust_score).toBeGreaterThanOrEqual(0.5)
      expect(result.hmac_valid).toBeNull()
      expect(result.reasons).toContain('no_hmac_legacy')
    })

    it('penalizes old messages', () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      const result = computeTrustScore(null, 'user', oldDate)
      expect(result.reasons).toContain('old')
    })

    it('handles missing timestamp', () => {
      const result = computeTrustScore(null, 'user')
      expect(result.trust_score).toBeGreaterThan(0)
      expect(result.reasons).toContain('no_timestamp')
    })

    it('never exceeds 1.0', () => {
      const result = computeTrustScore(true, 'assistant', new Date().toISOString())
      expect(result.trust_score).toBeLessThanOrEqual(1.0)
    })

    it('handles system role as trusted source', () => {
      const result = computeTrustScore(true, 'system', new Date().toISOString())
      expect(result.reasons).toContain('trusted_source')
    })
  })

  // ==========================================
  // verifyMessageBatch
  // ==========================================
  describe('verifyMessageBatch', () => {
    it('passes all messages when integrity is not set', async () => {
      const messages = [
        { id: '1', role: 'user', content: 'hello', created_at: new Date().toISOString() },
        { id: '2', role: 'assistant', content: 'hi', created_at: new Date().toISOString() },
      ]

      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.5)

      expect(result.messages).toHaveLength(2)
      expect(result.excluded_count).toBe(0)
      expect(result.total_count).toBe(2)
    })

    it('passes signed messages above threshold', async () => {
      const ts = Math.floor(Date.now() / 1000)
      const signed = await signMessage('hello', TEST_SECRET, TEST_AGENT_ID, ts)

      const messages = [
        {
          id: '1',
          role: 'user',
          content: 'hello',
          message_hmac: signed.hmac,
          hmac_timestamp: ts,
          created_at: new Date().toISOString(),
        },
      ]

      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.5)

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].trust.hmac_valid).toBe(true)
      expect(result.messages[0].trust.trust_score).toBeGreaterThanOrEqual(0.8)
    })

    it('excludes tampered messages', async () => {
      const ts = Math.floor(Date.now() / 1000)
      const signed = await signMessage('original', TEST_SECRET, TEST_AGENT_ID, ts)

      const messages = [
        {
          id: '1',
          role: 'user',
          content: 'tampered content',
          message_hmac: signed.hmac,
          hmac_timestamp: ts,
          created_at: new Date().toISOString(),
        },
      ]

      // With high threshold, tampered messages get excluded
      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.5)

      expect(result.excluded_count).toBe(1)
      expect(result.messages).toHaveLength(0)
    })

    it('keeps legacy messages with low threshold', async () => {
      const messages = [
        { id: '1', role: 'assistant', content: 'legacy msg', created_at: new Date().toISOString() },
      ]

      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.3)

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].trust.hmac_valid).toBeNull()
    })

    it('filters legacy messages with high threshold', async () => {
      const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const messages = [{ id: '1', role: 'user', content: 'old msg', created_at: oldDate }]

      // Legacy user message from 90 days ago: 0.3 + 0.1 + 0.05 = 0.45
      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.5)

      expect(result.excluded_count).toBe(1)
    })

    it('handles mixed signed and unsigned messages', async () => {
      const ts = Math.floor(Date.now() / 1000)
      const signed = await signMessage('signed msg', TEST_SECRET, TEST_AGENT_ID, ts)

      const messages = [
        {
          id: '1',
          role: 'user',
          content: 'signed msg',
          message_hmac: signed.hmac,
          hmac_timestamp: ts,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'unsigned legacy',
          created_at: new Date().toISOString(),
        },
      ]

      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.5)

      // Both should pass: signed (0.9+) and legacy assistant (0.3+0.2+0.2 = 0.7)
      expect(result.messages).toHaveLength(2)
    })

    it('returns correct counts', async () => {
      const ts = Math.floor(Date.now() / 1000)
      const signed = await signMessage('ok', TEST_SECRET, TEST_AGENT_ID, ts)
      const signedTamper = await signMessage('original', TEST_SECRET, TEST_AGENT_ID, ts)

      const messages = [
        {
          id: '1',
          role: 'user',
          content: 'ok',
          message_hmac: signed.hmac,
          hmac_timestamp: ts,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'user',
          content: 'tampered',
          message_hmac: signedTamper.hmac,
          hmac_timestamp: ts,
          created_at: new Date().toISOString(),
        },
        { id: '3', role: 'assistant', content: 'legacy', created_at: new Date().toISOString() },
      ]

      const result = await verifyMessageBatch(messages, TEST_SECRET, TEST_AGENT_ID, 0.5)

      expect(result.total_count).toBe(3)
      // msg1: valid signed (pass), msg2: tampered (fail), msg3: legacy assistant (pass)
      expect(result.messages).toHaveLength(2)
      expect(result.excluded_count).toBe(1)
    })
  })

  // ==========================================
  // DEFAULT_MEMORY_INTEGRITY
  // ==========================================
  describe('defaults', () => {
    it('has sensible default config', () => {
      expect(DEFAULT_MEMORY_INTEGRITY.enabled).toBe(true)
      expect(DEFAULT_MEMORY_INTEGRITY.verify_on_read).toBe(true)
      expect(DEFAULT_MEMORY_INTEGRITY.sign_on_write).toBe(true)
      expect(DEFAULT_MEMORY_INTEGRITY.min_trust_score).toBe(0.5)
    })
  })
})
