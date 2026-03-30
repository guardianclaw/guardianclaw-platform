/**
 * Metrics route tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { metricsRoutes } from './metrics'
import { incrementCounter, recordHistogram, resetMetrics } from '../lib/metrics'

describe('Metrics Routes', () => {
  beforeEach(() => {
    resetMetrics()
  })

  describe('GET /metrics', () => {
    it('returns Prometheus format by default', async () => {
      incrementCounter('test_counter', { label: 'value' })

      const res = await metricsRoutes.request('/')
      const text = await res.text()

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/plain')
      expect(text).toContain('claw_uptime_seconds')
      expect(text).toContain('test_counter')
    })

    it('returns JSON when format=json', async () => {
      incrementCounter('test_counter')
      recordHistogram('test_histogram', 100)

      const res = await metricsRoutes.request('/?format=json')
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.uptime_ms).toBeDefined()
      expect(data.counters).toBeDefined()
      expect(data.histograms).toBeDefined()
    })

    it('includes cache control headers', async () => {
      const res = await metricsRoutes.request('/')

      expect(res.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
    })

    it('formats counter with labels', async () => {
      incrementCounter('http_requests', { method: 'GET', status: '200' })

      const res = await metricsRoutes.request('/')
      const text = await res.text()

      expect(text).toContain('http_requests{method="GET",status="200"} 1')
    })

    it('formats histogram with buckets', async () => {
      recordHistogram('latency_ms', 50)
      recordHistogram('latency_ms', 150)

      const res = await metricsRoutes.request('/')
      const text = await res.text()

      expect(text).toContain('latency_ms_bucket')
      expect(text).toContain('latency_ms_sum')
      expect(text).toContain('latency_ms_count')
      expect(text).toContain('le="+Inf"')
    })

    it('includes uptime metric', async () => {
      const res = await metricsRoutes.request('/')
      const text = await res.text()

      expect(text).toContain('# HELP claw_uptime_seconds')
      expect(text).toContain('# TYPE claw_uptime_seconds gauge')
      expect(text).toMatch(/claw_uptime_seconds \d+/)
    })
  })
})
