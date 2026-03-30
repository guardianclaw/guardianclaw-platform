/**
 * K6 Stress Test
 *
 * Pushes the system beyond normal load to find breaking points and
 * validate graceful degradation under stress.
 *
 * Usage:
 *   k6 run stress-test.js
 *   k6 run --env API_BASE_URL=https://api.guardianclaw.org stress-test.js
 *
 * Warning: This test generates high load. Use with caution in production.
 *
 * Metrics tracked:
 *   - Breaking point (VU count where errors spike)
 *   - Recovery time after stress
 *   - Error types under stress
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Rate, Trend, Counter, Gauge } from 'k6/metrics'
import { config, headers, testData } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const successRate = new Rate('success')
const rateLimitHits = new Counter('rate_limit_hits')
const timeoutErrors = new Counter('timeout_errors')
const serverErrors = new Counter('server_errors')
const responseTime = new Trend('response_time')
const activeVUs = new Gauge('active_vus')

// Test configuration - aggressive ramp up
export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      stages: [
        // Warm up
        { duration: '1m', target: 25 },

        // Normal load
        { duration: '2m', target: 25 },

        // First stress level
        { duration: '1m', target: 50 },
        { duration: '2m', target: 50 },

        // Second stress level
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },

        // Peak stress
        { duration: '1m', target: 150 },
        { duration: '2m', target: 150 },

        // Recovery
        { duration: '2m', target: 25 },
        { duration: '1m', target: 0 },
      ],
    },
  },

  thresholds: {
    // Relaxed thresholds for stress test
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'], // Allow up to 10% errors under stress
    errors: ['rate<0.15'],
    success: ['rate>0.80'], // At least 80% success
  },
}

// Track VU count for analysis
export function setup() {
  console.log('Starting stress test...')
  console.log(`Target: ${config.baseUrl}`)
  return { startTime: Date.now() }
}

export default function (data) {
  activeVUs.add(__VU)

  // Mix of requests to simulate real traffic
  const requestType = Math.random()

  if (requestType < 0.3) {
    // 30% health checks
    healthCheck()
  } else if (requestType < 0.7) {
    // 40% demo requests
    demoRequest()
  } else {
    // 30% other API calls
    miscApiCalls()
  }

  // Short think time under stress
  sleep(Math.random() * 0.5 + 0.1)
}

function healthCheck() {
  const start = Date.now()
  const response = http.get(`${config.baseUrl}/health`, {
    timeout: '10s',
  })

  responseTime.add(Date.now() - start)
  processResponse(response, 'health')
}

function demoRequest() {
  const payload = JSON.stringify({
    message: testData.randomMessage(),
    flow: testData.testFlow(),
    claw_config: testData.clawConfig(),
  })

  const start = Date.now()
  const response = http.post(
    `${config.baseUrl}/demo/test`,
    payload,
    {
      headers: headers.json,
      timeout: '30s',
    }
  )

  responseTime.add(Date.now() - start)
  processResponse(response, 'demo')
}

function miscApiCalls() {
  const endpoints = [
    { method: 'GET', url: '/' },
    { method: 'GET', url: '/metrics' },
    { method: 'GET', url: '/health' },
  ]

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]
  const start = Date.now()

  const response = http.request(
    endpoint.method,
    `${config.baseUrl}${endpoint.url}`,
    null,
    { timeout: '10s' }
  )

  responseTime.add(Date.now() - start)
  processResponse(response, endpoint.url)
}

function processResponse(response, endpoint) {
  const passed = check(response, {
    [`${endpoint}: status ok`]: (r) => r.status >= 200 && r.status < 400,
  })

  if (passed) {
    successRate.add(true)
    errorRate.add(false)
  } else {
    successRate.add(false)
    errorRate.add(true)

    // Categorize errors
    if (response.status === 429) {
      rateLimitHits.add(1)
    } else if (response.status === 0 || response.error) {
      timeoutErrors.add(1)
    } else if (response.status >= 500) {
      serverErrors.add(1)
    }
  }
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000
  console.log(`\nStress test completed in ${duration.toFixed(1)} seconds`)
}

export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs.values.count
  const successRateValue = (data.metrics.success?.values.rate || 0) * 100
  const errorRateValue = (data.metrics.errors?.values.rate || 0) * 100
  const p50 = data.metrics.http_req_duration.values['p(50)']
  const p95 = data.metrics.http_req_duration.values['p(95)']
  const p99 = data.metrics.http_req_duration.values['p(99)']

  // Calculate throughput
  const duration = 15 * 60 // 15 minutes total
  const throughput = totalRequests / duration

  console.log('\n' + '='.repeat(80))
  console.log('STRESS TEST SUMMARY')
  console.log('='.repeat(80))

  console.log('\n--- OVERALL METRICS ---')
  console.log(`Total Requests:       ${totalRequests}`)
  console.log(`Throughput:           ${throughput.toFixed(2)} req/s`)
  console.log(`Success Rate:         ${successRateValue.toFixed(2)}%`)
  console.log(`Error Rate:           ${errorRateValue.toFixed(2)}%`)

  console.log('\n--- LATENCY (milliseconds) ---')
  console.log(`P50:                  ${p50.toFixed(2)}ms`)
  console.log(`P95:                  ${p95.toFixed(2)}ms`)
  console.log(`P99:                  ${p99.toFixed(2)}ms`)
  console.log(`Max:                  ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`)

  console.log('\n--- ERROR BREAKDOWN ---')
  console.log(`Rate Limit (429):     ${data.metrics.rate_limit_hits?.values.count || 0}`)
  console.log(`Timeouts:             ${data.metrics.timeout_errors?.values.count || 0}`)
  console.log(`Server Errors (5xx):  ${data.metrics.server_errors?.values.count || 0}`)

  console.log('\n--- ANALYSIS ---')

  // Determine breaking point (this is an approximation based on error rate)
  if (errorRateValue < 1) {
    console.log('System Status:        STABLE - No breaking point reached')
  } else if (errorRateValue < 5) {
    console.log('System Status:        DEGRADED - Minor issues under stress')
  } else if (errorRateValue < 15) {
    console.log('System Status:        STRESSED - Significant degradation')
  } else {
    console.log('System Status:        BREAKING - System unable to handle load')
  }

  // P95 analysis
  if (p95 < 500) {
    console.log('Latency:              EXCELLENT - P95 under 500ms')
  } else if (p95 < 1000) {
    console.log('Latency:              GOOD - P95 under 1000ms')
  } else if (p95 < 2000) {
    console.log('Latency:              ACCEPTABLE - P95 under 2000ms')
  } else {
    console.log('Latency:              POOR - P95 exceeds 2000ms')
  }

  // Rate limiting effectiveness
  const rateLimitRatio = (data.metrics.rate_limit_hits?.values.count || 0) / totalRequests
  if (rateLimitRatio > 0.05) {
    console.log('Rate Limiting:        ACTIVE - Protecting system from overload')
  } else {
    console.log('Rate Limiting:        MINIMAL - System handling load directly')
  }

  console.log('\n' + '='.repeat(80))

  return {
    'stdout': '',
    'stress-test-results.json': JSON.stringify(data, null, 2),
  }
}
