/**
 * K6 Performance Testing Configuration
 *
 * Shared configuration for all performance tests.
 * Environment variables:
 *   - API_BASE_URL: Base URL for API (default: http://localhost:8787)
 *   - API_KEY: Valid API key for authenticated tests
 *   - AGENT_ID: Agent ID for invoke tests
 */

// Environment configuration
export const config = {
  baseUrl: __ENV.API_BASE_URL || 'http://localhost:8787',
  apiKey: __ENV.API_KEY || 'sk_live_test_key_placeholder_64chars_needed_here_12345678',
  agentId: __ENV.AGENT_ID || 'test-agent-id',
}

// Thresholds for different test types
export const thresholds = {
  // Standard thresholds
  standard: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>10'],
  },

  // Strict thresholds for critical endpoints
  strict: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.001'],
    http_reqs: ['rate>50'],
  },

  // Relaxed thresholds for heavy operations
  relaxed: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
  },
}

// Load profiles
export const loadProfiles = {
  // Smoke test - minimal load
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
  },

  // Load test - normal traffic
  load: {
    executor: 'ramping-vus',
    stages: [
      { duration: '1m', target: 10 },   // Ramp up
      { duration: '3m', target: 10 },   // Hold
      { duration: '1m', target: 25 },   // Ramp up more
      { duration: '3m', target: 25 },   // Hold
      { duration: '1m', target: 0 },    // Ramp down
    ],
  },

  // Stress test - find breaking point
  stress: {
    executor: 'ramping-vus',
    stages: [
      { duration: '1m', target: 25 },   // Ramp up
      { duration: '2m', target: 25 },   // Hold
      { duration: '1m', target: 50 },   // Increase
      { duration: '2m', target: 50 },   // Hold
      { duration: '1m', target: 100 },  // Push harder
      { duration: '2m', target: 100 },  // Hold
      { duration: '2m', target: 0 },    // Ramp down
    ],
  },

  // Spike test - sudden traffic spike
  spike: {
    executor: 'ramping-vus',
    stages: [
      { duration: '30s', target: 10 },  // Normal load
      { duration: '10s', target: 100 }, // Spike!
      { duration: '1m', target: 100 },  // Hold spike
      { duration: '10s', target: 10 },  // Back to normal
      { duration: '30s', target: 10 },  // Hold
      { duration: '10s', target: 0 },   // Ramp down
    ],
  },

  // Soak test - sustained load
  soak: {
    executor: 'constant-vus',
    vus: 25,
    duration: '30m',
  },
}

// Common headers
export const headers = {
  json: {
    'Content-Type': 'application/json',
  },

  authenticated: (apiKey) => ({
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  }),

  withAuth: (token) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }),
}

// Test data generators
export const testData = {
  // Generate random message
  randomMessage: () => {
    const topics = [
      'What is the capital of France?',
      'Explain quantum computing in simple terms.',
      'How does photosynthesis work?',
      'What are the best practices for API design?',
      'Describe the water cycle.',
    ]
    return topics[Math.floor(Math.random() * topics.length)]
  },

  // Generate test agent flow
  testFlow: () => ({
    nodes: [
      { id: '1', type: 'input', data: { label: 'Input' } },
      { id: '2', type: 'process', data: { processType: 'llm_call', config: { model: 'gpt-4o-mini' } } },
      { id: '3', type: 'claw', data: { gateType: 'avoidance' } },
      { id: '4', type: 'output', data: { label: 'Output' } },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' },
    ],
  }),

  // Generate claw config
  clawConfig: () => ({
    gates: {
      credibility: true,
      avoidance: true,
      limits: true,
      worth: true,
    },
  }),
}
