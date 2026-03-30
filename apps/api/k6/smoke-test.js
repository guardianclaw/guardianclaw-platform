/**
 * K6 Smoke Test
 *
 * Quick sanity check to verify the API is functional.
 * Run this before deploying or after infrastructure changes.
 *
 * Usage:
 *   k6 run smoke-test.js
 *   k6 run --env API_BASE_URL=https://api.guardianclaw.org smoke-test.js
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { config, loadProfiles, headers, thresholds } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const healthCheckDuration = new Trend('health_check_duration')

// Test configuration
export const options = {
  ...loadProfiles.smoke,
  thresholds: {
    // Latency thresholds (relaxed for production with cold starts)
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    // Error threshold (note: 404 tests are expected, so we track our own errors metric)
    errors: ['rate<0.05'],
    // Health endpoint should be fast
    health_check_duration: ['p(95)<200'],
  },
}

// Test scenarios
export default function () {
  group('Health Check', () => {
    const response = http.get(`${config.baseUrl}/health`)

    healthCheckDuration.add(response.timings.duration)

    const passed = check(response, {
      'health status is 200': (r) => r.status === 200,
      'health response has status': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.status === 'healthy' || body.status === 'ok'
        } catch {
          return false
        }
      },
      'health response time < 100ms': (r) => r.timings.duration < 100,
    })

    errorRate.add(!passed)
  })

  group('Root Endpoint', () => {
    const response = http.get(`${config.baseUrl}/`)

    const passed = check(response, {
      'root status is 200': (r) => r.status === 200,
      'root has API name': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.name === 'GuardianClaw API'
        } catch {
          return false
        }
      },
      'root has version': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.version !== undefined
        } catch {
          return false
        }
      },
    })

    errorRate.add(!passed)
  })

  group('Metrics Endpoint', () => {
    const response = http.get(`${config.baseUrl}/metrics`)

    const passed = check(response, {
      'metrics status is 200': (r) => r.status === 200,
      'metrics has prometheus format': (r) => {
        return r.body.includes('claw_uptime_seconds')
      },
    })

    errorRate.add(!passed)
  })

  group('404 Handling', () => {
    const response = http.get(`${config.baseUrl}/nonexistent-endpoint`)

    const passed = check(response, {
      '404 status returned': (r) => r.status === 404,
      '404 has error message': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.error !== undefined
        } catch {
          return false
        }
      },
    })

    errorRate.add(!passed)
  })

  sleep(1)
}

// Lifecycle hooks
export function handleSummary(data) {
  const passed = data.metrics.errors.values.rate < 0.01
  const p95 = data.metrics.http_req_duration.values['p(95)']

  console.log('\n' + '='.repeat(60))
  console.log('SMOKE TEST SUMMARY')
  console.log('='.repeat(60))
  console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`)
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`)
  console.log(`Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%`)
  console.log(`P95 Latency: ${p95.toFixed(2)}ms`)
  console.log(`Health Check P95: ${data.metrics.health_check_duration.values['p(95)'].toFixed(2)}ms`)
  console.log('='.repeat(60))

  return {
    'stdout': '',
    'smoke-test-results.json': JSON.stringify(data, null, 2),
  }
}
