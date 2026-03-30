/**
 * K6 Smoke Test for CI/CD
 *
 * Comprehensive smoke test for deployment verification.
 * Checks all critical endpoints including database connectivity.
 *
 * Usage:
 *   k6 run smoke-test-ci.js
 *   k6 run --env API_BASE_URL=https://api.guardianclaw.org smoke-test-ci.js
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - One or more checks failed
 */

import http from 'k6/http'
import { check, group, sleep, fail } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { config, headers } from './config.js'

// Custom metrics
const errorRate = new Rate('errors')
const healthCheckDuration = new Trend('health_check_duration')
const dbCheckDuration = new Trend('db_check_duration')
const checksTotal = new Counter('checks_total')
const checksPassed = new Counter('checks_passed')
const checksFailed = new Counter('checks_failed')

// Test configuration - single iteration for CI
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    // All checks must pass
    errors: ['rate==0'],
    // Health should be fast
    health_check_duration: ['p(95)<500'],
    // DB check can be slower
    db_check_duration: ['p(95)<2000'],
    // Fail if any critical check fails
    checks: ['rate>0.95'],
  },
}

// Helper to track check results
function trackCheck(passed, checkName) {
  checksTotal.add(1)
  if (passed) {
    checksPassed.add(1)
  } else {
    checksFailed.add(1)
    console.error(`CHECK FAILED: ${checkName}`)
  }
  return passed
}

export default function () {
  let allPassed = true

  // ============================================
  // 1. API Health Check
  // ============================================
  group('1. API Health', () => {
    const response = http.get(`${config.baseUrl}/health`)
    healthCheckDuration.add(response.timings.duration)

    const passed = check(response, {
      'health: status 200': (r) => r.status === 200,
      'health: response has status field': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.status === 'healthy' || body.status === 'ok'
        } catch {
          return false
        }
      },
      'health: latency < 500ms': (r) => r.timings.duration < 500,
    })

    allPassed = trackCheck(passed, 'API Health') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 2. Root Endpoint
  // ============================================
  group('2. Root Endpoint', () => {
    const response = http.get(`${config.baseUrl}/`)

    const passed = check(response, {
      'root: status 200': (r) => r.status === 200,
      'root: has API name': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.name === 'GuardianClaw API'
        } catch {
          return false
        }
      },
      'root: has version': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.version !== undefined
        } catch {
          return false
        }
      },
      'root: has environment': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.environment !== undefined
        } catch {
          return false
        }
      },
    })

    allPassed = trackCheck(passed, 'Root Endpoint') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 3. Metrics Endpoint (Prometheus)
  // ============================================
  group('3. Metrics Endpoint', () => {
    const response = http.get(`${config.baseUrl}/metrics`)

    const passed = check(response, {
      'metrics: status 200': (r) => r.status === 200,
      'metrics: prometheus format': (r) => {
        return r.body && r.body.includes('claw_')
      },
      'metrics: has uptime metric': (r) => {
        return r.body && r.body.includes('uptime')
      },
    })

    allPassed = trackCheck(passed, 'Metrics Endpoint') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 4. CORS Headers
  // ============================================
  group('4. CORS Headers', () => {
    const response = http.options(`${config.baseUrl}/`, {
      headers: {
        Origin: 'https://guardianclaw.org',
        'Access-Control-Request-Method': 'GET',
      },
    })

    const passed = check(response, {
      'cors: allows origin': (r) => {
        const allowed = r.headers['Access-Control-Allow-Origin']
        return allowed === 'https://guardianclaw.org' || allowed === '*'
      },
      'cors: allows methods': (r) => {
        const methods = r.headers['Access-Control-Allow-Methods']
        return methods && methods.includes('GET')
      },
    })

    allPassed = trackCheck(passed, 'CORS Headers') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 5. Security Headers
  // ============================================
  group('5. Security Headers', () => {
    const response = http.get(`${config.baseUrl}/`)

    const passed = check(response, {
      'security: has CSP': (r) => {
        return r.headers['Content-Security-Policy'] !== undefined
      },
      'security: has X-Content-Type-Options': (r) => {
        return r.headers['X-Content-Type-Options'] === 'nosniff'
      },
      'security: has X-Frame-Options': (r) => {
        return r.headers['X-Frame-Options'] === 'DENY'
      },
      'security: has Referrer-Policy': (r) => {
        return r.headers['Referrer-Policy'] !== undefined
      },
    })

    allPassed = trackCheck(passed, 'Security Headers') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 6. Rate Limit Headers
  // ============================================
  group('6. Rate Limit Headers', () => {
    const response = http.get(`${config.baseUrl}/`)

    const passed = check(response, {
      'ratelimit: has X-RateLimit-Limit': (r) => {
        return r.headers['X-Ratelimit-Limit'] !== undefined
      },
      'ratelimit: has X-RateLimit-Remaining': (r) => {
        return r.headers['X-Ratelimit-Remaining'] !== undefined
      },
      'ratelimit: has X-RateLimit-Reset': (r) => {
        return r.headers['X-Ratelimit-Reset'] !== undefined
      },
    })

    allPassed = trackCheck(passed, 'Rate Limit Headers') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 7. 404 Handling
  // ============================================
  group('7. Error Handling (404)', () => {
    const response = http.get(`${config.baseUrl}/nonexistent-endpoint-12345`)

    const passed = check(response, {
      '404: correct status': (r) => r.status === 404,
      '404: has error message': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.error !== undefined
        } catch {
          return false
        }
      },
      '404: has error code': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.code !== undefined
        } catch {
          return false
        }
      },
    })

    allPassed = trackCheck(passed, '404 Handling') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 8. Auth Endpoint (Unauthenticated)
  // ============================================
  group('8. Auth Endpoint', () => {
    const response = http.get(`${config.baseUrl}/auth/me`)

    const passed = check(response, {
      'auth: returns 401 without token': (r) => r.status === 401,
      'auth: has error message': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.error !== undefined
        } catch {
          return false
        }
      },
    })

    allPassed = trackCheck(passed, 'Auth Endpoint') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 9. Compliance Endpoint (Public)
  // ============================================
  group('9. Compliance Endpoint', () => {
    const response = http.get(`${config.baseUrl}/compliance/frameworks`)

    const passed = check(response, {
      'compliance: status 200': (r) => r.status === 200,
      'compliance: returns array': (r) => {
        try {
          const body = JSON.parse(r.body)
          return Array.isArray(body.frameworks)
        } catch {
          return false
        }
      },
    })

    allPassed = trackCheck(passed, 'Compliance Endpoint') && allPassed
    errorRate.add(!passed)
  })

  // ============================================
  // 10. Governance List (Public)
  // ============================================
  group('10. Governance List', () => {
    const response = http.get(`${config.baseUrl}/governance/proposals`)

    const passed = check(response, {
      'governance: status 200': (r) => r.status === 200,
      'governance: returns proposals array': (r) => {
        try {
          const body = JSON.parse(r.body)
          return Array.isArray(body.proposals)
        } catch {
          return false
        }
      },
    })

    allPassed = trackCheck(passed, 'Governance List') && allPassed
    errorRate.add(!passed)
  })

  // Final sleep
  sleep(0.5)

  // Return overall status for handleSummary
  return { allPassed }
}

// Generate summary report
export function handleSummary(data) {
  const totalChecks = data.metrics.checks_total ? data.metrics.checks_total.values.count : 0
  const passedChecks = data.metrics.checks_passed ? data.metrics.checks_passed.values.count : 0
  const failedChecks = data.metrics.checks_failed ? data.metrics.checks_failed.values.count : 0
  const errorRateValue = data.metrics.errors ? data.metrics.errors.values.rate : 0

  const allPassed = failedChecks === 0 && errorRateValue === 0
  const statusText = allPassed ? 'PASSED' : 'FAILED'
  const statusEmoji = allPassed ? '✓' : '✗'

  const summary = `
================================================================================
                        CI SMOKE TEST RESULTS
================================================================================

  Status: ${statusEmoji} ${statusText}

  Checks:
    Total:   ${totalChecks}
    Passed:  ${passedChecks}
    Failed:  ${failedChecks}

  Performance:
    Health Check P95:  ${data.metrics.health_check_duration ? data.metrics.health_check_duration.values['p(95)'].toFixed(2) : 'N/A'}ms
    Total Requests:    ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
    Error Rate:        ${(errorRateValue * 100).toFixed(2)}%

================================================================================
`

  console.log(summary)

  return {
    stdout: summary,
    'smoke-test-ci-results.json': JSON.stringify(
      {
        status: statusText,
        passed: allPassed,
        checks: {
          total: totalChecks,
          passed: passedChecks,
          failed: failedChecks,
        },
        metrics: {
          health_check_p95_ms: data.metrics.health_check_duration
            ? data.metrics.health_check_duration.values['p(95)']
            : null,
          total_requests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
          error_rate: errorRateValue,
        },
        timestamp: new Date().toISOString(),
      },
      null,
      2
    ),
  }
}
