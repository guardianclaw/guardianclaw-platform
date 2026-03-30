/**
 * Webhook Utilities
 *
 * Helper functions for webhook management UI.
 */

/**
 * Validate a URL for webhook endpoint configuration.
 *
 * Rules:
 * - Must be a valid URL
 * - Must use HTTP or HTTPS protocol
 * - HTTP only allowed for localhost/private IPs (development)
 * - Must have a hostname
 */
export function isValidWebhookUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'URL is required' }
  }

  try {
    const parsed = new URL(url)

    // Must be HTTP or HTTPS
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' }
    }

    // Warn about HTTP (but allow it for dev)
    if (parsed.protocol === 'http:') {
      // Allow localhost and private IPs for development
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(parsed.hostname)

      if (!isLocalhost && !isPrivateIP) {
        return { valid: false, error: 'HTTPS is required for public URLs' }
      }
    }

    // Must have a hostname
    if (!parsed.hostname) {
      return { valid: false, error: 'URL must have a valid hostname' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Copy text to clipboard with fallback for older browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern API first
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for older browsers
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    } catch {
      return false
    }
  }

  return false
}

/**
 * Format a delivery status for display.
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    case 'pending':
      return 'bg-yellow-500'
    case 'retrying':
      return 'bg-blue-500'
    default:
      return 'bg-gray-500'
  }
}

/**
 * Format a timestamp for display.
 */
export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'Never'
  try {
    const date = new Date(timestamp)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date'
    }
    return date.toLocaleString()
  } catch {
    return 'Invalid Date'
  }
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}
