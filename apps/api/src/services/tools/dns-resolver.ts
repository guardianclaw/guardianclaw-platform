/**
 * Secure DNS Resolver
 *
 * Provides DNS resolution with IP validation to prevent DNS rebinding attacks.
 * Uses DNS-over-HTTPS (DoH) for resolution, which works in Cloudflare Workers.
 *
 * DNS Rebinding Attack:
 * 1. Attacker controls evil.com with TTL=0
 * 2. First DNS query returns attacker's public IP (passes validation)
 * 3. Request is made to evil.com
 * 4. Second DNS query (during connection) returns 127.0.0.1 or internal IP
 * 5. Request actually goes to internal service
 *
 * Protection:
 * 1. Resolve DNS ourselves via DoH before making request
 * 2. Validate resolved IP is not private/internal
 * 3. Make request to the resolved IP directly (with Host header)
 *
 * @example
 * const result = await resolveAndValidate('api.example.com')
 * if (!result.safe) {
 *   // Block request - resolved to private IP
 * }
 */

// ============================================
// TYPES
// ============================================

/**
 * DNS resolution result.
 */
export interface DnsResolutionResult {
  /** Whether the hostname resolved to a safe (public) IP */
  safe: boolean
  /** Resolved IP address (if successful) */
  ip?: string
  /** Error message (if failed or unsafe) */
  error?: string
  /** Error code for categorization */
  errorCode?: 'DNS_RESOLUTION_FAILED' | 'PRIVATE_IP_RESOLVED' | 'INVALID_HOSTNAME'
  /** Resolution latency in ms */
  latencyMs: number
}

/**
 * DoH response structure (Cloudflare/Google format).
 */
interface DohResponse {
  Status: number // 0 = NOERROR
  Answer?: Array<{
    type: number // 1 = A record, 28 = AAAA record
    data: string // IP address
  }>
}

// ============================================
// CONFIGURATION
// ============================================

// DNS-over-HTTPS endpoints
const DOH_ENDPOINTS = [
  'https://cloudflare-dns.com/dns-query', // Cloudflare
  'https://dns.google/resolve', // Google (fallback)
]

// Timeout for DNS resolution
const DNS_TIMEOUT_MS = 5000

// Private IP patterns (same as in api-request.ts for consistency)
const PRIVATE_IP_PATTERNS = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
  /^0\./, // Current network
  /^224\./, // Multicast
  /^240\./, // Reserved
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 private
  /^fd00:/i, // IPv6 private (ULA)
  /^fe80:/i, // IPv6 link-local
  /^::ffff:127\./, // IPv4-mapped loopback
  /^::ffff:10\./, // IPv4-mapped Class A
  /^::ffff:172\.(1[6-9]|2[0-9]|3[0-1])\./, // IPv4-mapped Class B
  /^::ffff:192\.168\./, // IPv4-mapped Class C
]

// ============================================
// IP VALIDATION
// ============================================

/**
 * Check if an IP address is private/internal.
 */
export function isPrivateIp(ip: string): boolean {
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(ip)) {
      return true
    }
  }
  return false
}

/**
 * Validate that an IP is safe to connect to.
 */
export function validateResolvedIp(ip: string): { safe: boolean; error?: string } {
  if (!ip || ip.trim().length === 0) {
    return { safe: false, error: 'Empty IP address' }
  }

  if (isPrivateIp(ip)) {
    return { safe: false, error: `Resolved to private IP: ${ip}` }
  }

  return { safe: true }
}

// ============================================
// DNS RESOLUTION
// ============================================

/**
 * Resolve a hostname using DNS-over-HTTPS.
 *
 * @param hostname - The hostname to resolve (without protocol)
 * @returns The resolved IP address or null if failed
 */
async function resolveDnsOverHttps(hostname: string): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS)

  try {
    // Try Cloudflare first, then Google
    for (const endpoint of DOH_ENDPOINTS) {
      try {
        const url = `${endpoint}?name=${encodeURIComponent(hostname)}&type=A`

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/dns-json',
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          continue // Try next endpoint
        }

        const data = (await response.json()) as DohResponse

        // Check for successful resolution
        if (data.Status !== 0 || !data.Answer || data.Answer.length === 0) {
          continue // Try next endpoint
        }

        // Find A record (IPv4)
        const aRecord = data.Answer.find((a) => a.type === 1)
        if (aRecord) {
          return aRecord.data
        }

        // Fallback to AAAA record (IPv6)
        const aaaaRecord = data.Answer.find((a) => a.type === 28)
        if (aaaaRecord) {
          return aaaaRecord.data
        }
      } catch {
        // Try next endpoint
        continue
      }
    }

    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Resolve and validate a hostname.
 *
 * This function:
 * 1. Resolves the hostname to an IP using DoH
 * 2. Validates the IP is not private/internal
 * 3. Returns the result with safety status
 *
 * @param hostname - The hostname to resolve
 * @returns Resolution result with safety status
 */
export async function resolveAndValidate(hostname: string): Promise<DnsResolutionResult> {
  const startTime = Date.now()

  // Validate hostname format
  if (!hostname || hostname.trim().length === 0) {
    return {
      safe: false,
      error: 'Invalid hostname',
      errorCode: 'INVALID_HOSTNAME',
      latencyMs: Date.now() - startTime,
    }
  }

  // Skip resolution for IP addresses (validate directly)
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Pattern = /^([0-9a-fA-F:]+)$/

  if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
    const validation = validateResolvedIp(hostname)
    return {
      safe: validation.safe,
      ip: hostname,
      error: validation.error,
      errorCode: validation.safe ? undefined : 'PRIVATE_IP_RESOLVED',
      latencyMs: Date.now() - startTime,
    }
  }

  // Resolve hostname via DoH
  const resolvedIp = await resolveDnsOverHttps(hostname)

  if (!resolvedIp) {
    return {
      safe: false,
      error: `DNS resolution failed for ${hostname}`,
      errorCode: 'DNS_RESOLUTION_FAILED',
      latencyMs: Date.now() - startTime,
    }
  }

  // Validate resolved IP
  const validation = validateResolvedIp(resolvedIp)

  return {
    safe: validation.safe,
    ip: resolvedIp,
    error: validation.error,
    errorCode: validation.safe ? undefined : 'PRIVATE_IP_RESOLVED',
    latencyMs: Date.now() - startTime,
  }
}

/**
 * Extract hostname from URL.
 */
export function extractHostname(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    return url.hostname
  } catch {
    return null
  }
}

/**
 * Resolve and validate a URL's hostname.
 *
 * Convenience function that extracts the hostname from a URL
 * and performs DNS resolution with validation.
 *
 * @param urlString - The URL to validate
 * @returns Resolution result with safety status
 */
export async function resolveAndValidateUrl(urlString: string): Promise<DnsResolutionResult> {
  const hostname = extractHostname(urlString)

  if (!hostname) {
    return {
      safe: false,
      error: 'Invalid URL - cannot extract hostname',
      errorCode: 'INVALID_HOSTNAME',
      latencyMs: 0,
    }
  }

  return resolveAndValidate(hostname)
}
