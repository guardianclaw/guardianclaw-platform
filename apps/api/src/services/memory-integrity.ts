/**
 * Memory Integrity Service
 *
 * HMAC-SHA256 signing and verification for conversation messages.
 * Protects against context injection attacks by ensuring message
 * authenticity before including them in LLM context.
 *
 * Uses Web Crypto API (native in Cloudflare Workers).
 */

// ============================================
// TYPES
// ============================================

export interface MemoryIntegrityConfig {
  enabled: boolean
  verify_on_read: boolean
  sign_on_write: boolean
  min_trust_score: number
}

export interface SignedMessage {
  hmac: string
  timestamp: number
}

export interface TrustAssessment {
  trust_score: number
  hmac_valid: boolean | null // null if no HMAC present
  reasons: string[]
}

export interface IntegrityVerificationResult {
  messages: Array<{
    id: string
    role: string
    content: string
    trust: TrustAssessment
  }>
  excluded_count: number
  total_count: number
}

// ============================================
// DEFAULTS
// ============================================

export const DEFAULT_MEMORY_INTEGRITY: MemoryIntegrityConfig = {
  enabled: true,
  verify_on_read: true,
  sign_on_write: true,
  min_trust_score: 0.5,
}

const HMAC_ALGORITHM = 'SHA-256'
const SIGNATURE_PREFIX = 'msig_' // memory signature prefix

// ============================================
// UTILITY FUNCTIONS
// ============================================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Same approach as webhook-signature.ts for consistency.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let _result = 1
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      _result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0)
    }
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================
// KEY DERIVATION
// ============================================

/**
 * Derive a per-agent signing key from server secret + agent ID.
 * This ensures each agent has a unique key, so compromising one
 * agent's messages doesn't affect others.
 */
export async function deriveAgentSecret(serverSecret: string, agentId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = encoder.encode(`${serverSecret}:memory:${agentId}`)

  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'HMAC', hash: HMAC_ALGORITHM },
    false,
    ['sign', 'verify']
  )
}

// ============================================
// SIGNING
// ============================================

/**
 * Sign a message content with HMAC-SHA256.
 *
 * The signed payload includes the timestamp to bind the signature
 * to a specific point in time, preventing replay-style manipulation.
 *
 * @returns Signature string in format: msig_<hex>
 */
export async function signMessage(
  content: string,
  serverSecret: string,
  agentId: string,
  timestamp?: number
): Promise<SignedMessage> {
  const ts = timestamp || Math.floor(Date.now() / 1000)
  const key = await deriveAgentSecret(serverSecret, agentId)

  const encoder = new TextEncoder()
  const signedPayload = `${ts}.${content}`

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))

  const signatureHex = bytesToHex(new Uint8Array(signatureBuffer))
  return {
    hmac: `${SIGNATURE_PREFIX}${signatureHex}`,
    timestamp: ts,
  }
}

// ============================================
// VERIFICATION
// ============================================

/**
 * Verify a message HMAC signature.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyMessage(
  content: string,
  hmac: string,
  serverSecret: string,
  agentId: string,
  timestamp: number
): Promise<boolean> {
  if (!hmac || !hmac.startsWith(SIGNATURE_PREFIX)) {
    return false
  }

  const expected = await signMessage(content, serverSecret, agentId, timestamp)
  return constantTimeCompare(hmac, expected.hmac)
}

// ============================================
// TRUST SCORING
// ============================================

/**
 * Compute trust score for a message.
 *
 * Scoring breakdown:
 * - HMAC valid:     0.6 (strongest signal — message is authentic)
 * - Known source:   0.2 (role is 'assistant' or 'system' from our pipeline)
 * - Recency:        0.2 (newer messages are more trustworthy)
 *
 * Messages without HMAC (pre-integrity or legacy) get a base score
 * of 0.3 to avoid breaking existing conversations.
 */
export function computeTrustScore(
  hmacValid: boolean | null,
  role: string,
  createdAt?: string
): TrustAssessment {
  const reasons: string[] = []
  let score = 0

  // HMAC component (0.6)
  if (hmacValid === true) {
    score += 0.6
    reasons.push('hmac_verified')
  } else if (hmacValid === false) {
    // Tampered message — zero HMAC trust
    score += 0
    reasons.push('hmac_failed')
  } else {
    // No HMAC present (legacy message)
    score += 0.3
    reasons.push('no_hmac_legacy')
  }

  // Source component (0.2)
  if (role === 'assistant' || role === 'system') {
    score += 0.2
    reasons.push('trusted_source')
  } else if (role === 'user') {
    score += 0.1
    reasons.push('user_source')
  }

  // Recency component (0.2)
  if (createdAt) {
    const ageMs = Date.now() - new Date(createdAt).getTime()
    const oneDay = 24 * 60 * 60 * 1000
    if (ageMs < oneDay) {
      score += 0.2
      reasons.push('recent')
    } else if (ageMs < 7 * oneDay) {
      score += 0.15
      reasons.push('within_week')
    } else if (ageMs < 30 * oneDay) {
      score += 0.1
      reasons.push('within_month')
    } else {
      score += 0.05
      reasons.push('old')
    }
  } else {
    score += 0.1
    reasons.push('no_timestamp')
  }

  return {
    trust_score: Math.min(1, Math.round(score * 100) / 100),
    hmac_valid: hmacValid,
    reasons,
  }
}

// ============================================
// BATCH VERIFICATION
// ============================================

/**
 * Verify integrity of a batch of messages and filter by trust score.
 *
 * Used in buildConversationContext() to ensure only trustworthy
 * messages are included in LLM context.
 */
export async function verifyMessageBatch(
  messages: Array<{
    id: string
    role: string
    content: string
    message_hmac?: string | null
    hmac_timestamp?: number | null
    created_at?: string
  }>,
  serverSecret: string,
  agentId: string,
  minTrustScore: number
): Promise<IntegrityVerificationResult> {
  const verified: IntegrityVerificationResult['messages'] = []
  let excludedCount = 0

  for (const msg of messages) {
    let hmacValid: boolean | null = null

    if (msg.message_hmac && msg.hmac_timestamp) {
      hmacValid = await verifyMessage(
        msg.content,
        msg.message_hmac,
        serverSecret,
        agentId,
        msg.hmac_timestamp
      )
    }

    const trust = computeTrustScore(hmacValid, msg.role, msg.created_at)

    if (trust.trust_score >= minTrustScore) {
      verified.push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        trust,
      })
    } else {
      excludedCount++
    }
  }

  return {
    messages: verified,
    excluded_count: excludedCount,
    total_count: messages.length,
  }
}
