/**
 * Admin Audit Middleware
 *
 * Logs all admin actions for compliance and security monitoring.
 * Implements GDPR-compliant logging (wallet hash, IP hash, no PII).
 *
 * Reference: ADMIN_SPEC Phase 8
 */

import { createMiddleware } from 'hono/factory'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

type Env = {
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    IP_HASH_SECRET?: string
  }
  Variables: {
    wallet: string
    walletHash: string
    adminRole: string
    requestId?: string
  }
}

/**
 * Hash IP address for GDPR compliance.
 * Uses daily salt rotation for privacy.
 */
async function hashIP(ip: string, secret: string): Promise<string> {
  const dailySalt = new Date().toISOString().split('T')[0]
  const data = `${ip}:${dailySalt}:${secret}`
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16)
}

/**
 * Get client IP from request headers.
 */
function getClientIP(req: { header: (name: string) => string | undefined }): string {
  return (
    req.header('cf-connecting-ip') ||
    req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.header('x-real-ip') ||
    'unknown'
  )
}

/**
 * Extract target info from request path and body.
 * Returns target_type and target_id for audit logging.
 */
function extractTarget(
  path: string,
  method: string,
  body?: Record<string, unknown>
): { targetType: string | null; targetId: string | null } {
  // Pattern: /admin/users/:wallet
  const userMatch = path.match(/\/admin\/users\/([^/]+)/)
  if (userMatch) {
    return { targetType: 'user', targetId: userMatch[1] }
  }

  // Pattern: /admin/alerts/:id
  const alertMatch = path.match(/\/admin\/alerts\/([^/]+)/)
  if (alertMatch) {
    return { targetType: 'alert', targetId: alertMatch[1] }
  }

  // Pattern: /admin/rules/:id
  const ruleMatch = path.match(/\/admin\/rules\/([^/]+)/)
  if (ruleMatch) {
    return { targetType: 'rule', targetId: ruleMatch[1] }
  }

  // Pattern: /admin/roles/:id
  const roleMatch = path.match(/\/admin\/roles\/([^/]+)/)
  if (roleMatch) {
    return { targetType: 'role', targetId: roleMatch[1] }
  }

  // For POST requests, check body for target
  if (method === 'POST' && body) {
    if (body.wallet_address) {
      return { targetType: 'user', targetId: String(body.wallet_address) }
    }
    if (body.alert_id) {
      return { targetType: 'alert', targetId: String(body.alert_id) }
    }
  }

  return { targetType: null, targetId: null }
}

/**
 * Scrub PII from request details for audit logging.
 * Returns a safe version of the request data.
 */
function scrubDetails(details: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}

  const sensitiveKeys = [
    'password',
    'secret',
    'key',
    'token',
    'api_key',
    'private_key',
    'authorization',
    'cookie',
  ]

  for (const [key, value] of Object.entries(details)) {
    // Skip sensitive keys
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      safe[key] = '[REDACTED]'
      continue
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 500) {
      safe[key] = value.substring(0, 500) + '...[truncated]'
      continue
    }

    // Skip large arrays/objects
    if (Array.isArray(value) && value.length > 10) {
      safe[key] = `[Array of ${value.length} items]`
      continue
    }

    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value)
      if (keys.length > 20) {
        safe[key] = `[Object with ${keys.length} keys]`
        continue
      }
    }

    safe[key] = value
  }

  return safe
}

/**
 * Log admin action to audit table.
 */
async function logAuditEntry(
  supabase: SupabaseClient,
  entry: {
    adminWalletHash: string
    action: string
    targetType: string | null
    targetId: string | null
    details: Record<string, unknown>
    ipHash: string | null
    requestId: string | null
    statusCode: number
  }
): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_wallet_hash: entry.adminWalletHash,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      details: entry.details,
      ip_hash: entry.ipHash,
      request_id: entry.requestId,
      status_code: entry.statusCode,
    })
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Admin audit log failed:', error)
  }
}

/**
 * Admin audit middleware.
 *
 * Logs all admin actions with GDPR-compliant hashing.
 * Must be used after adminAuthMiddleware.
 */
export const adminAuditMiddleware = createMiddleware<Env>(async (c, next) => {
  const startTime = Date.now()

  // Collect request info before processing
  const method = c.req.method
  const path = c.req.path
  const action = `${method} ${path}`

  // Get body for POST/PATCH/PUT requests
  let body: Record<string, unknown> | undefined
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    try {
      const clone = c.req.raw.clone()
      body = await clone.json()
    } catch {
      // Body might not be JSON
    }
  }

  // Extract target info
  const { targetType, targetId } = extractTarget(path, method, body)

  // Process the request
  await next()

  // After request: log the action
  const walletHash = c.get('walletHash')
  const requestId = c.get('requestId') || null

  // Hash IP
  let ipHash: string | null = null
  if (c.env.IP_HASH_SECRET) {
    const ip = getClientIP(c.req)
    ipHash = await hashIP(ip, c.env.IP_HASH_SECRET)
  }

  // Build safe details
  const details = scrubDetails({
    method,
    path,
    query: Object.fromEntries([...new URL(c.req.url).searchParams]),
    body: body ? scrubDetails(body) : undefined,
    duration_ms: Date.now() - startTime,
    admin_role: c.get('adminRole'),
  })

  // Get status code from response
  const statusCode = c.res?.status || 200

  // Log to database
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  await logAuditEntry(supabase, {
    adminWalletHash: walletHash,
    action,
    targetType,
    targetId,
    details,
    ipHash,
    requestId,
    statusCode,
  })
})

/**
 * Manual audit log helper for custom actions.
 *
 * @example
 * await logAdminAction(supabase, {
 *   adminWalletHash: walletHash,
 *   action: 'custom_action',
 *   targetType: 'user',
 *   targetId: 'ABC123...',
 *   details: { reason: 'suspicious activity' },
 * })
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  entry: {
    adminWalletHash: string
    action: string
    targetType?: string
    targetId?: string
    details?: Record<string, unknown>
    ipHash?: string
    requestId?: string
    statusCode?: number
  }
): Promise<void> {
  await logAuditEntry(supabase, {
    adminWalletHash: entry.adminWalletHash,
    action: entry.action,
    targetType: entry.targetType || null,
    targetId: entry.targetId || null,
    details: entry.details ? scrubDetails(entry.details) : {},
    ipHash: entry.ipHash || null,
    requestId: entry.requestId || null,
    statusCode: entry.statusCode || 200,
  })
}
