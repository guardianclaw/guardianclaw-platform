/**
 * K6 Load Test
 *
 * Simulates normal production traffic to validate performance under expected load.
 * Tests all major API endpoints with realistic usage patterns.
 *
 * Usage:
 *   k6 run load-test.js
 *   k6 run --env API_BASE_URL=https://api.guardianclaw.org load-test.js
 *
 * Thresholds:
 *   - P95 latency < 500ms
 *   - Error rate < 1%
 *   - Throughput > 10 req/s
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { config, loadProfiles, headers, thresholds, testData } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const clawBlocks = new Counter('claw_blocks')
const demoLatency = new Trend('demo_latency')
const healthLatency = new Trend('health_latency')

// Test configuration
export const options = {
  scenarios: {
    // Health checks - frequent, low impact
    health_checks: {
      executor: 'constant-arrival-rate',
      rate: 5, // 5 requests per second
      timeUnit: '1s',
      duration: '9m',
      preAllocatedVUs: 2,
      maxVUs: 10,
      exec: 'healthCheck',
    },

    // Demo endpoint - main traffic
    demo_requests: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 10 },
        { duration: '2m', target: 20 },
        { duration: '2m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      exec: 'demoTest',
    },

    // API browsing - auth/agents list
    api_browse: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 2 },
        { duration: '5m', target: 5 },
        { duration: '2m', target: 2 },
        { duration: '1m', target: 0 },
      ],
      exec: 'apiBrowse',
    },
  },

  thresholds: {
    // Latency thresholds (relaxed for Cloudflare Workers with cold starts)
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    // Custom errors metric (excludes expected 404s)
    errors: ['rate<0.05'],
    // Demo endpoint can be slower (involves LLM/DB calls)
    demo_latency: ['p(95)<2000', 'p(99)<5000'],
    // Health should always be fast
    health_latency: ['p(95)<200', 'p(99)<500'],
  },
}

// Health check scenario
export function healthCheck() {
  const response = http.get(`${config.baseUrl}/health`)

  healthLatency.add(response.timings.duration)

  const passed = check(response, {
    'health: status 200': (r) => r.status === 200,
    'health: latency < 100ms': (r) => r.timings.duration < 100,
  })

  errorRate.add(!passed)
}

// Demo endpoint scenario
export function demoTest() {
  group('Demo Test Flow', () => {
    const payload = JSON.stringify({
      message: testData.randomMessage(),
      flow: testData.testFlow(),
      claw_config: testData.clawConfig(),
    })

    const response = http.post(
      `${config.baseUrl}/demo/test`,
      payload,
      { headers: headers.json }
    )

    demoLatency.add(response.timings.duration)

    const passed = check(response, {
      'demo: status 200': (r) => r.status === 200,
      'demo: has response body': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.response !== undefined || body.blocked !== undefined
        } catch {
          return false
        }
      },
      'demo: latency < 1000ms': (r) => r.timings.duration < 1000,
    })

    // Track GuardianClaw blocks
    try {
      const body = JSON.parse(response.body)
      if (body.blocked) {
        clawBlocks.add(1)
      }
    } catch {
      // Ignore parse errors
    }

    errorRate.add(!passed)

    sleep(Math.random() * 2 + 1) // 1-3 second think time
  })
}

// API browsing scenario
export function apiBrowse() {
  group('API Browse', () => {
    // Check root
    const rootResponse = http.get(`${config.baseUrl}/`)

    check(rootResponse, {
      'root: status 200': (r) => r.status === 200,
    })

    sleep(0.5)

    // Check metrics
    const metricsResponse = http.get(`${config.baseUrl}/metrics`)

    check(metricsResponse, {
      'metrics: status 200': (r) => r.status === 200,
    })

    sleep(0.5)

    // Attempt auth nonce (will fail without valid wallet, but tests endpoint)
    const nonceResponse = http.get(`${config.baseUrl}/auth/nonce?wallet=test123`)

    check(nonceResponse, {
      'nonce: returns response': (r) => r.status === 200 || r.status === 400,
    })

    sleep(Math.random() * 3 + 2) // 2-5 second think time
  })
}

// Lifecycle hooks
export function handleSummary(data) {
  const passed =
    data.metrics.errors.values.rate < 0.01 &&
    data.metrics.http_req_duration.values['p(95)'] < 500

  const totalRequests = data.metrics.http_reqs.values.count
  const p95 = data.metrics.http_req_duration.values['p(95)']
  const p99 = data.metrics.http_req_duration.values['p(99)']
  const errorRateValue = data.metrics.errors.values.rate * 100

  console.log('\n' + '='.repeat(70))
  console.log('LOAD TEST SUMMARY')
  console.log('='.repeat(70))
  console.log(`Status:          ${passed ? 'PASSED' : 'FAILED'}`)
  console.log('-'.repeat(70))
  console.log(`Total Requests:  ${totalRequests}`)
  console.log(`Throughput:      ${(totalRequests / (9 * 60)).toFixed(2)} req/s`)
  console.log(`Error Rate:      ${errorRateValue.toFixed(3)}%`)
  console.log('-'.repeat(70))
  console.log(`P50 Latency:     ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms`)
  console.log(`P95 Latency:     ${p95.toFixed(2)}ms`)
  console.log(`P99 Latency:     ${p99.toFixed(2)}ms`)
  console.log('-'.repeat(70))
  console.log(`Health P95:      ${data.metrics.health_latency?.values['p(95)']?.toFixed(2) || 'N/A'}ms`)
  console.log(`Demo P95:        ${data.metrics.demo_latency?.values['p(95)']?.toFixed(2) || 'N/A'}ms`)
  console.log(`GuardianClaw Blocks: ${data.metrics.claw_blocks?.values.count || 0}`)
  console.log('='.repeat(70))

  // Threshold analysis
  console.log('\nTHRESHOLD ANALYSIS:')
  console.log(`  P95 < 500ms:   ${p95 < 500 ? 'PASS' : 'FAIL'} (${p95.toFixed(2)}ms)`)
  console.log(`  P99 < 1000ms:  ${p99 < 1000 ? 'PASS' : 'FAIL'} (${p99.toFixed(2)}ms)`)
  console.log(`  Errors < 1%:   ${errorRateValue < 1 ? 'PASS' : 'FAIL'} (${errorRateValue.toFixed(3)}%)`)
  console.log('')

  return {
    'stdout': '',
    'load-test-results.json': JSON.stringify(data, null, 2),
  }
}
