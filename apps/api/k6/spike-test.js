/**
 * K6 Spike Test
 *
 * Simulates sudden traffic spikes to validate system behavior
 * under unexpected load bursts.
 *
 * Usage:
 *   k6 run spike-test.js
 *   k6 run --env API_BASE_URL=https://api.guardianclaw.org spike-test.js
 *
 * Scenarios tested:
 *   1. Normal load baseline
 *   2. Sudden 10x spike
 *   3. Recovery to normal
 *   4. Second spike (testing repeat resilience)
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { config, headers, testData } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const spikeLatency = new Trend('spike_latency')
const normalLatency = new Trend('normal_latency')
const recoveryErrors = new Counter('recovery_errors')

// Test configuration
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      stages: [
        // Phase 1: Establish baseline
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },

        // Phase 2: First spike (10x)
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },

        // Phase 3: Recovery
        { duration: '10s', target: 10 },
        { duration: '1m', target: 10 },

        // Phase 4: Second spike (validation)
        { duration: '10s', target: 100 },
        { duration: '1m', target: 100 },

        // Phase 5: Final recovery
        { duration: '10s', target: 10 },
        { duration: '30s', target: 10 },

        // Ramp down
        { duration: '10s', target: 0 },
      ],
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
}

// Track which phase we're in
let currentPhase = 'baseline'
let phaseStartTime = Date.now()

export function setup() {
  return { startTime: Date.now() }
}

export default function () {
  // Determine current phase based on elapsed time
  const elapsed = (Date.now() - phaseStartTime) / 1000

  if (elapsed < 90) currentPhase = 'baseline'
  else if (elapsed < 160) currentPhase = 'spike1'
  else if (elapsed < 230) currentPhase = 'recovery1'
  else if (elapsed < 300) currentPhase = 'spike2'
  else currentPhase = 'recovery2'

  // Send request
  const payload = JSON.stringify({
    message: testData.randomMessage(),
    flow: testData.testFlow(),
    claw_config: testData.clawConfig(),
  })

  const response = http.post(
    `${config.baseUrl}/demo/test`,
    payload,
    { headers: headers.json, timeout: '30s' }
  )

  // Track latency by phase
  if (currentPhase.includes('spike')) {
    spikeLatency.add(response.timings.duration)
  } else {
    normalLatency.add(response.timings.duration)
  }

  // Check response
  const passed = check(response, {
    'status is 200': (r) => r.status === 200,
    'has response': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.response !== undefined || body.blocked !== undefined
      } catch {
        return false
      }
    },
  })

  errorRate.add(!passed)

  // Track recovery phase errors specifically
  if (!passed && currentPhase.includes('recovery')) {
    recoveryErrors.add(1)
  }

  // Think time varies by phase
  if (currentPhase.includes('spike')) {
    sleep(Math.random() * 0.3 + 0.1) // Fast during spike
  } else {
    sleep(Math.random() * 1 + 0.5) // Normal think time
  }
}

export function handleSummary(data) {
  const totalRequests = data.metrics.http_reqs.values.count
  const errorRateValue = (data.metrics.errors?.values.rate || 0) * 100
  const normalP95 = data.metrics.normal_latency?.values['p(95)'] || 0
  const spikeP95 = data.metrics.spike_latency?.values['p(95)'] || 0

  console.log('\n' + '='.repeat(70))
  console.log('SPIKE TEST SUMMARY')
  console.log('='.repeat(70))

  console.log('\n--- OVERALL ---')
  console.log(`Total Requests:      ${totalRequests}`)
  console.log(`Error Rate:          ${errorRateValue.toFixed(2)}%`)

  console.log('\n--- LATENCY COMPARISON ---')
  console.log(`Normal Load P95:     ${normalP95.toFixed(2)}ms`)
  console.log(`Spike Load P95:      ${spikeP95.toFixed(2)}ms`)
  console.log(`Degradation:         ${((spikeP95 / normalP95 - 1) * 100).toFixed(1)}%`)

  console.log('\n--- RECOVERY ---')
  console.log(`Recovery Errors:     ${data.metrics.recovery_errors?.values.count || 0}`)

  // Analysis
  console.log('\n--- ANALYSIS ---')

  const degradation = spikeP95 / normalP95
  if (degradation < 2) {
    console.log('Spike Handling:      EXCELLENT - Less than 2x latency increase')
  } else if (degradation < 5) {
    console.log('Spike Handling:      GOOD - Less than 5x latency increase')
  } else if (degradation < 10) {
    console.log('Spike Handling:      ACCEPTABLE - Less than 10x latency increase')
  } else {
    console.log('Spike Handling:      POOR - Significant degradation under spike')
  }

  const recoveryErrorCount = data.metrics.recovery_errors?.values.count || 0
  if (recoveryErrorCount === 0) {
    console.log('Recovery:            CLEAN - No errors during recovery')
  } else if (recoveryErrorCount < 10) {
    console.log('Recovery:            MINOR ISSUES - Few errors during recovery')
  } else {
    console.log('Recovery:            PROBLEMATIC - Many errors during recovery')
  }

  console.log('\n' + '='.repeat(70))

  return {
    'stdout': '',
    'spike-test-results.json': JSON.stringify(data, null, 2),
  }
}
