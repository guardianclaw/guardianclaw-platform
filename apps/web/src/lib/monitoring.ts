/**
 * Error monitoring and reporting utilities
 * Ready for Sentry integration when configured
 */

interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  extra?: Record<string, unknown>
}

interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 's' | 'count' | 'bytes'
  tags?: Record<string, string>
}

// Check if Sentry is configured via environment
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const IS_SENTRY_ENABLED = Boolean(SENTRY_DSN)

/**
 * Initialize monitoring (call once at app startup)
 */
export function initMonitoring() {
  if (typeof window === 'undefined') return

  // Set up global error handler
  window.onerror = (message, source, lineno, colno, error) => {
    captureError(error || new Error(String(message)), {
      extra: { source, lineno, colno },
    })
  }

  // Set up unhandled promise rejection handler
  window.onunhandledrejection = (event) => {
    captureError(event.reason, {
      action: 'unhandled_promise_rejection',
    })
  }

  if (!IS_PRODUCTION) {
    console.log('[Monitoring] Initialized in development mode')
  }
}

/**
 * Capture and report an error
 */
export function captureError(error: Error | unknown, context?: ErrorContext) {
  const errorObj = error instanceof Error ? error : new Error(String(error))

  // Always log to console in development
  if (!IS_PRODUCTION) {
    console.error('[Error captured]', errorObj, context)
  }

  // If Sentry is configured, it would be reported here
  // Example Sentry integration:
  // if (IS_SENTRY_ENABLED) {
  //   Sentry.captureException(errorObj, {
  //     contexts: { custom: context },
  //   })
  // }

  // Send to custom error endpoint if configured
  if (IS_PRODUCTION && process.env.NEXT_PUBLIC_ERROR_ENDPOINT) {
    fetch(process.env.NEXT_PUBLIC_ERROR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
        context,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => {
      // Silent fail - don't create error loop
    })
  }
}

/**
 * Capture a message (info level)
 */
export function captureMessage(message: string, context?: ErrorContext) {
  if (!IS_PRODUCTION) {
    console.info('[Message]', message, context)
  }

  // Sentry integration would go here
}

/**
 * Record a performance metric
 */
export function recordMetric(metric: PerformanceMetric) {
  if (!IS_PRODUCTION) {
    console.log(`[Metric] ${metric.name}: ${metric.value}${metric.unit}`, metric.tags)
  }

  // Send to analytics endpoint if configured
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Use Performance API for browser metrics
    performance.mark(`metric:${metric.name}`)
  }
}

/**
 * Start a performance span/transaction
 */
export function startSpan(name: string): () => number {
  const start = performance.now()

  return () => {
    const duration = performance.now() - start
    recordMetric({
      name,
      value: Math.round(duration),
      unit: 'ms',
    })
    return duration
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; wallet?: string }) {
  // Store user context for error reports
  if (typeof window !== 'undefined') {
    ;(window as unknown as Record<string, unknown>).__MONITORING_USER__ = user
  }

  // Sentry integration:
  // Sentry.setUser(user)
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  if (typeof window !== 'undefined') {
    delete (window as unknown as Record<string, unknown>).__MONITORING_USER__
  }

  // Sentry integration:
  // Sentry.setUser(null)
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  if (!IS_PRODUCTION) {
    console.log(`[Breadcrumb:${category}]`, message, data)
  }

  // Sentry integration:
  // Sentry.addBreadcrumb({ category, message, data })
}

// Export configuration for checking status
export const monitoringConfig = {
  isSentryEnabled: IS_SENTRY_ENABLED,
  isProduction: IS_PRODUCTION,
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
}
