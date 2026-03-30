/**
 * Metrics tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  incrementCounter,
  recordHistogram,
  recordRequest,
  recordGuardianClawValidation,
  recordAgentInvocation,
  recordExternalCall,
  recordRateLimitHit,
  getPrometheusMetrics,
  getMetricsJSON,
  resetMetrics,
  MetricNames,
} from './metrics'

describe('Metrics', () => {
  beforeEach(() => {
    resetMetrics()
  })

  describe('incrementCounter', () => {
    it('increments counter by 1', () => {
      incrementCounter('test_counter')
      incrementCounter('test_counter')

      const json = getMetricsJSON()
      const counter = json.counters['test_counter']
      expect(counter).toBeDefined()
      expect(counter[0].value).toBe(2)
    })

    it('increments by specified value', () => {
      incrementCounter('test_counter', {}, 5)

      const json = getMetricsJSON()
      expect(json.counters['test_counter'][0].value).toBe(5)
    })

    it('tracks labels separately', () => {
      incrementCounter('http_requests', { method: 'GET' })
      incrementCounter('http_requests', { method: 'GET' })
      incrementCounter('http_requests', { method: 'POST' })

      const json = getMetricsJSON()
      const counters = json.counters['http_requests']

      expect(counters.length).toBe(2)

      const getCounter = counters.find((c) => c.labels.method === 'GET')
      const postCounter = counters.find((c) => c.labels.method === 'POST')

      expect(getCounter?.value).toBe(2)
      expect(postCounter?.value).toBe(1)
    })
  })

  describe('recordHistogram', () => {
    it('records value in correct bucket', () => {
      recordHistogram('latency', 50) // Should go in 50ms bucket
      recordHistogram('latency', 150) // Should go in 250ms bucket

      const json = getMetricsJSON()
      const histogram = json.histograms['latency'][0]

      expect(histogram.count).toBe(2)
      expect(histogram.sum).toBe(200)
    })

    it('tracks labels separately', () => {
      recordHistogram('latency', 100, { path: '/api' })
      recordHistogram('latency', 200, { path: '/health' })

      const json = getMetricsJSON()
      expect(json.histograms['latency'].length).toBe(2)
    })
  })

  describe('recordRequest', () => {
    it('records http request', () => {
      recordRequest('GET', '/api/agents', 200, 50)

      const json = getMetricsJSON()

      expect(json.counters[MetricNames.HTTP_REQUESTS_TOTAL]).toBeDefined()
      expect(json.histograms[MetricNames.HTTP_REQUEST_DURATION_MS]).toBeDefined()
    })

    it('normalizes paths with UUIDs', () => {
      recordRequest('GET', '/agents/123e4567-e89b-12d3-a456-426614174000', 200, 50)

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.HTTP_REQUESTS_TOTAL][0]

      expect(counter.labels.path).toBe('/agents/:id')
    })

    it('normalizes paths with numeric IDs', () => {
      recordRequest('GET', '/users/123/posts/456', 200, 50)

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.HTTP_REQUESTS_TOTAL][0]

      expect(counter.labels.path).toBe('/users/:id/posts/:id')
    })

    it('removes query strings', () => {
      recordRequest('GET', '/api/agents?page=1&limit=10', 200, 50)

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.HTTP_REQUESTS_TOTAL][0]

      expect(counter.labels.path).toBe('/api/agents')
    })

    it('includes status class', () => {
      recordRequest('GET', '/api', 404, 25)

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.HTTP_REQUESTS_TOTAL][0]

      expect(counter.labels.status).toBe('404')
      expect(counter.labels.status_class).toBe('4xx')
    })
  })

  describe('recordGuardianClawValidation', () => {
    it('records passed validation', () => {
      recordGuardianClawValidation('input', true, 'avoidance')

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.GCLAW_VALIDATIONS_TOTAL][0]

      expect(counter.labels.stage).toBe('input')
      expect(counter.labels.passed).toBe('true')
      expect(counter.labels.gate).toBe('avoidance')
    })

    it('records blocked validation and increments blocks', () => {
      recordGuardianClawValidation('output', false, 'limits')

      const json = getMetricsJSON()

      expect(json.counters[MetricNames.GCLAW_VALIDATIONS_TOTAL]).toBeDefined()
      expect(json.counters[MetricNames.GCLAW_BLOCKS_TOTAL]).toBeDefined()

      const blockCounter = json.counters[MetricNames.GCLAW_BLOCKS_TOTAL][0]
      expect(blockCounter.labels.stage).toBe('output')
      expect(blockCounter.labels.gate).toBe('limits')
    })
  })

  describe('recordAgentInvocation', () => {
    it('records agent invocation', () => {
      recordAgentInvocation('agent-uuid-123', false, 'modal')

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.AGENT_INVOCATIONS_TOTAL][0]

      expect(counter.labels.agent_id).toBe('agent-uu') // Truncated
      expect(counter.labels.blocked).toBe('false')
      expect(counter.labels.runtime).toBe('modal')
    })
  })

  describe('recordExternalCall', () => {
    it('records successful call', () => {
      recordExternalCall('Modal', true, 150)

      const json = getMetricsJSON()

      expect(json.counters[MetricNames.EXTERNAL_CALLS_TOTAL]).toBeDefined()
      expect(json.histograms[MetricNames.EXTERNAL_CALL_DURATION_MS]).toBeDefined()

      const counter = json.counters[MetricNames.EXTERNAL_CALLS_TOTAL][0]
      expect(counter.labels.service).toBe('Modal')
      expect(counter.labels.success).toBe('true')
    })

    it('records failed call', () => {
      recordExternalCall('OpenAI', false, 5000)

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.EXTERNAL_CALLS_TOTAL][0]

      expect(counter.labels.success).toBe('false')
    })
  })

  describe('recordRateLimitHit', () => {
    it('records rate limit hit', () => {
      recordRateLimitHit('/api/invoke')

      const json = getMetricsJSON()
      const counter = json.counters[MetricNames.RATE_LIMIT_HITS_TOTAL][0]

      expect(counter.labels.endpoint).toBe('/api/invoke')
      expect(counter.value).toBe(1)
    })
  })

  describe('getPrometheusMetrics', () => {
    it('returns uptime', () => {
      const metrics = getPrometheusMetrics()

      expect(metrics).toContain('claw_uptime_seconds')
      expect(metrics).toContain('# TYPE claw_uptime_seconds gauge')
    })

    it('formats counters correctly', () => {
      incrementCounter('test_counter', { method: 'GET', status: '200' })

      const metrics = getPrometheusMetrics()

      expect(metrics).toContain('# TYPE test_counter counter')
      expect(metrics).toContain('test_counter{method="GET",status="200"} 1')
    })

    it('formats histograms with buckets', () => {
      recordHistogram('test_latency', 50)
      recordHistogram('test_latency', 150)

      const metrics = getPrometheusMetrics()

      expect(metrics).toContain('# TYPE test_latency histogram')
      expect(metrics).toContain('test_latency_bucket')
      expect(metrics).toContain('le="+Inf"')
      expect(metrics).toContain('test_latency_sum')
      expect(metrics).toContain('test_latency_count')
    })

    it('escapes label values', () => {
      incrementCounter('test', { path: '/api"test\\path' })

      const metrics = getPrometheusMetrics()

      expect(metrics).toContain('\\"') // Escaped quote
      expect(metrics).toContain('\\\\') // Escaped backslash
    })
  })

  describe('getMetricsJSON', () => {
    it('returns structured metrics', () => {
      incrementCounter('requests', { method: 'GET' })
      recordHistogram('latency', 100)

      const json = getMetricsJSON()

      expect(json.uptime_ms).toBeGreaterThanOrEqual(0)
      expect(json.counters).toBeDefined()
      expect(json.histograms).toBeDefined()
    })
  })

  describe('resetMetrics', () => {
    it('clears all metrics', () => {
      incrementCounter('test')
      recordHistogram('test_hist', 100)

      resetMetrics()

      const json = getMetricsJSON()
      expect(Object.keys(json.counters).length).toBe(0)
      expect(Object.keys(json.histograms).length).toBe(0)
    })
  })
})
