/**
 * Metrics collection for Prometheus-compatible monitoring.
 *
 * Collects request counts, latency histograms, and GuardianClaw events.
 * Designed for Cloudflare Workers with in-memory aggregation.
 *
 * Note: Metrics are per-isolate and reset on worker restart.
 * For persistent metrics, use external services like Cloudflare Analytics.
 */

/**
 * Histogram bucket boundaries (in ms).
 */
const LATENCY_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

/**
 * Counter metric.
 */
interface Counter {
  value: number
  labels: Record<string, string>
}

/**
 * Histogram metric.
 */
interface Histogram {
  buckets: number[] // counts per bucket
  sum: number
  count: number
  labels: Record<string, string>
}

/**
 * Metrics storage.
 */
interface MetricsStore {
  counters: Map<string, Counter[]>
  histograms: Map<string, Histogram[]>
  startTime: number
}

/**
 * Global metrics store.
 */
const store: MetricsStore = {
  counters: new Map(),
  histograms: new Map(),
  startTime: Date.now(),
}

/**
 * Generate a key for label-based lookup.
 */
function labelsToKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',')
}

/**
 * Find or create a counter with specific labels.
 */
function getCounter(name: string, labels: Record<string, string>): Counter {
  if (!store.counters.has(name)) {
    store.counters.set(name, [])
  }

  const counters = store.counters.get(name)!
  const key = labelsToKey(labels)
  let counter = counters.find((c) => labelsToKey(c.labels) === key)

  if (!counter) {
    counter = { value: 0, labels }
    counters.push(counter)
  }

  return counter
}

/**
 * Find or create a histogram with specific labels.
 */
function getHistogram(name: string, labels: Record<string, string>): Histogram {
  if (!store.histograms.has(name)) {
    store.histograms.set(name, [])
  }

  const histograms = store.histograms.get(name)!
  const key = labelsToKey(labels)
  let histogram = histograms.find((h) => labelsToKey(h.labels) === key)

  if (!histogram) {
    histogram = {
      buckets: new Array(LATENCY_BUCKETS.length + 1).fill(0),
      sum: 0,
      count: 0,
      labels,
    }
    histograms.push(histogram)
  }

  return histogram
}

/**
 * Increment a counter.
 */
export function incrementCounter(
  name: string,
  labels: Record<string, string> = {},
  value = 1
): void {
  const counter = getCounter(name, labels)
  counter.value += value
}

/**
 * Record a value in a histogram.
 */
export function recordHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {}
): void {
  const histogram = getHistogram(name, labels)
  histogram.sum += value
  histogram.count += 1

  // Find bucket and increment
  for (let i = 0; i < LATENCY_BUCKETS.length; i++) {
    if (value <= LATENCY_BUCKETS[i]) {
      histogram.buckets[i]++
      return
    }
  }
  // +Inf bucket
  histogram.buckets[LATENCY_BUCKETS.length]++
}

/**
 * Metric names used in the application.
 */
export const MetricNames = {
  // HTTP requests
  HTTP_REQUESTS_TOTAL: 'claw_http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'claw_http_request_duration_ms',

  // GuardianClaw validation
  GCLAW_VALIDATIONS_TOTAL: 'claw_validations_total',
  GCLAW_BLOCKS_TOTAL: 'claw_blocks_total',

  // Agent invocations
  AGENT_INVOCATIONS_TOTAL: 'claw_agent_invocations_total',

  // External service calls
  EXTERNAL_CALLS_TOTAL: 'claw_external_calls_total',
  EXTERNAL_CALL_DURATION_MS: 'claw_external_call_duration_ms',

  // Rate limiting
  RATE_LIMIT_HITS_TOTAL: 'claw_rate_limit_hits_total',
}

/**
 * Record an HTTP request.
 */
export function recordRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = {
    method,
    path: normalizePath(path),
    status: statusCode.toString(),
    status_class: `${Math.floor(statusCode / 100)}xx`,
  }

  incrementCounter(MetricNames.HTTP_REQUESTS_TOTAL, labels)
  recordHistogram(MetricNames.HTTP_REQUEST_DURATION_MS, durationMs, {
    method,
    path: normalizePath(path),
  })
}

/**
 * Record a GuardianClaw validation event.
 */
export function recordGuardianClawValidation(
  stage: 'input' | 'output',
  passed: boolean,
  gate?: string
): void {
  incrementCounter(MetricNames.GCLAW_VALIDATIONS_TOTAL, {
    stage,
    passed: passed.toString(),
    gate: gate || 'unknown',
  })

  if (!passed) {
    incrementCounter(MetricNames.GCLAW_BLOCKS_TOTAL, {
      stage,
      gate: gate || 'unknown',
    })
  }
}

/**
 * Record an agent invocation.
 */
export function recordAgentInvocation(agentId: string, blocked: boolean, runtime: string): void {
  incrementCounter(MetricNames.AGENT_INVOCATIONS_TOTAL, {
    agent_id: agentId.slice(0, 8), // Truncate for cardinality
    blocked: blocked.toString(),
    runtime,
  })
}

/**
 * Record an external service call.
 */
export function recordExternalCall(service: string, success: boolean, durationMs: number): void {
  incrementCounter(MetricNames.EXTERNAL_CALLS_TOTAL, {
    service,
    success: success.toString(),
  })

  recordHistogram(MetricNames.EXTERNAL_CALL_DURATION_MS, durationMs, {
    service,
  })
}

/**
 * Record a rate limit hit.
 */
export function recordRateLimitHit(endpoint: string): void {
  incrementCounter(MetricNames.RATE_LIMIT_HITS_TOTAL, { endpoint })
}

/**
 * Normalize path for metrics (replace IDs with placeholders).
 */
function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\?.*$/, '') // Remove query string
}

/**
 * Format labels for Prometheus output.
 */
function formatLabels(labels: Record<string, string>): string {
  const pairs = Object.entries(labels)
    .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
    .join(',')
  return pairs ? `{${pairs}}` : ''
}

/**
 * Escape label value for Prometheus.
 */
function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/**
 * Generate Prometheus-compatible metrics output.
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = []
  const uptimeMs = Date.now() - store.startTime

  // Uptime
  lines.push('# HELP claw_uptime_seconds Time since worker started')
  lines.push('# TYPE claw_uptime_seconds gauge')
  lines.push(`claw_uptime_seconds ${(uptimeMs / 1000).toFixed(3)}`)
  lines.push('')

  // Counters
  for (const [name, counters] of store.counters) {
    lines.push(`# HELP ${name} Counter metric`)
    lines.push(`# TYPE ${name} counter`)
    for (const counter of counters) {
      lines.push(`${name}${formatLabels(counter.labels)} ${counter.value}`)
    }
    lines.push('')
  }

  // Histograms
  for (const [name, histograms] of store.histograms) {
    lines.push(`# HELP ${name} Histogram metric`)
    lines.push(`# TYPE ${name} histogram`)
    for (const histogram of histograms) {
      const labelStr = formatLabels(histogram.labels)
      let cumulative = 0
      for (let i = 0; i < LATENCY_BUCKETS.length; i++) {
        cumulative += histogram.buckets[i]
        const bucket = LATENCY_BUCKETS[i]
        const bucketLabels = histogram.labels
          ? { ...histogram.labels, le: bucket.toString() }
          : { le: bucket.toString() }
        lines.push(`${name}_bucket${formatLabels(bucketLabels)} ${cumulative}`)
      }
      // +Inf bucket
      cumulative += histogram.buckets[LATENCY_BUCKETS.length]
      const infLabels = histogram.labels ? { ...histogram.labels, le: '+Inf' } : { le: '+Inf' }
      lines.push(`${name}_bucket${formatLabels(infLabels)} ${cumulative}`)
      lines.push(`${name}_sum${labelStr} ${histogram.sum.toFixed(3)}`)
      lines.push(`${name}_count${labelStr} ${histogram.count}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Get metrics as JSON (for debugging).
 */
export function getMetricsJSON(): {
  uptime_ms: number
  counters: Record<string, { labels: Record<string, string>; value: number }[]>
  histograms: Record<string, { labels: Record<string, string>; count: number; sum: number }[]>
} {
  const counters: Record<string, { labels: Record<string, string>; value: number }[]> = {}
  const histograms: Record<
    string,
    { labels: Record<string, string>; count: number; sum: number }[]
  > = {}

  for (const [name, c] of store.counters) {
    counters[name] = c.map((counter) => ({
      labels: counter.labels,
      value: counter.value,
    }))
  }

  for (const [name, h] of store.histograms) {
    histograms[name] = h.map((histogram) => ({
      labels: histogram.labels,
      count: histogram.count,
      sum: histogram.sum,
    }))
  }

  return {
    uptime_ms: Date.now() - store.startTime,
    counters,
    histograms,
  }
}

/**
 * Reset all metrics (for testing).
 */
export function resetMetrics(): void {
  store.counters.clear()
  store.histograms.clear()
  store.startTime = Date.now()
}
