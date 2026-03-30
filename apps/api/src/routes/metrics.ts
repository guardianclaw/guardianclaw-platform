/**
 * Metrics endpoint for Prometheus scraping.
 *
 * Exposes application metrics in Prometheus text format.
 */

import { Hono } from 'hono'
import { getPrometheusMetrics, getMetricsJSON } from '../lib/metrics'

export const metricsRoutes = new Hono()

/**
 * GET /metrics
 * Returns metrics in Prometheus text format.
 *
 * Default format is Prometheus text, use ?format=json for JSON.
 */
metricsRoutes.get('/', (c) => {
  const format = c.req.query('format')

  if (format === 'json') {
    return c.json(getMetricsJSON())
  }

  // Prometheus text format
  const metrics = getPrometheusMetrics()

  return new Response(metrics, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
