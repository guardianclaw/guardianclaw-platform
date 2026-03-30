/**
 * Test Data Fixtures for E2E Tests
 *
 * Provides consistent test data for E2E scenarios.
 * All IDs use UUID v4 format to match production.
 */

import { Page } from '@playwright/test'

// UUIDs for test entities
export const TEST_IDS = {
  agent: 'e2e00000-0000-0000-0000-000000000001',
  deployment: 'e2e00000-0000-0000-0000-000000000002',
  proposal: 'e2e00000-0000-0000-0000-000000000003',
  alertRule: 'e2e00000-0000-0000-0000-000000000004',
  webhook: 'e2e00000-0000-0000-0000-000000000005',
}

/**
 * Test agent data
 */
export const TEST_AGENT = {
  id: TEST_IDS.agent,
  name: 'E2E Test Agent',
  description: 'Agent created for E2E testing',
  status: 'active' as const,
  type: 'autonomous' as const,
  claw_enabled: true,
  claw_config: {
    credibility_gate: { enabled: true, threshold: 0.8 },
    avoidance_gate: { enabled: true, threshold: 0.9 },
    limits_gate: { enabled: true, threshold: 0.7 },
    worth_gate: { enabled: true, threshold: 0.85 },
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

/**
 * Test deployment data
 */
export const TEST_DEPLOYMENT = {
  id: TEST_IDS.deployment,
  agent_id: TEST_IDS.agent,
  environment: 'development' as const,
  status: 'active' as const,
  version: '1.0.0',
  api_key: 'sk-test-e2e-deployment-key-12345',
  endpoint: 'https://api.guardianclaw.org/v1/agents/e2e00000-0000-0000-0000-000000000001',
  created_at: new Date().toISOString(),
}

/**
 * Test governance proposal
 */
export const TEST_PROPOSAL = {
  id: TEST_IDS.proposal,
  title: 'E2E Test Proposal',
  description: 'This is a test proposal for E2E testing.',
  type: 'parameter_change' as const,
  status: 'active' as const,
  proposer: 'E2ETestWa11etAddress1111111111111111111111111',
  votes_for: 150,
  votes_against: 50,
  quorum_reached: true,
  voting_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
}

/**
 * Test alert rule
 */
export const TEST_ALERT_RULE = {
  id: TEST_IDS.alertRule,
  name: 'E2E High Error Rate Alert',
  description: 'Alert when error rate exceeds threshold',
  metric: 'error_rate',
  condition: 'greater_than',
  threshold: 5,
  window_minutes: 15,
  severity: 'high' as const,
  is_enabled: true,
  created_at: new Date().toISOString(),
}

/**
 * Mock API responses for common endpoints
 */
export function setupApiMocks(page: Page) {
  // Mock agents list
  page.route('**/api/agents', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [TEST_AGENT],
          total: 1,
          page: 1,
          limit: 20,
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Mock single agent
  page.route(`**/api/agents/${TEST_IDS.agent}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agent: TEST_AGENT }),
    })
  })

  // Mock deployments list
  page.route('**/api/deployments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        deployments: [TEST_DEPLOYMENT],
        total: 1,
      }),
    })
  })

  // Mock governance proposals
  page.route('**/governance/proposals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proposals: [TEST_PROPOSAL],
        total: 1,
      }),
    })
  })

  // Mock compliance frameworks
  page.route('**/compliance/frameworks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        frameworks: [
          { id: 'soc2', name: 'SOC 2', description: 'Service Organization Control 2' },
          { id: 'iso27001', name: 'ISO 27001', description: 'Information Security Management' },
          { id: 'gdpr', name: 'GDPR', description: 'General Data Protection Regulation' },
        ],
      }),
    })
  })
}

/**
 * Mock admin-specific endpoints
 */
export function setupAdminApiMocks(page: Page) {
  // Admin metrics
  page.route('**/admin/metrics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_users: 1250,
        active_users_24h: 342,
        total_agents: 856,
        active_agents: 623,
        total_deployments: 1432,
        active_deployments: 987,
        total_api_calls_24h: 2450000,
        avg_latency_ms: 45,
        error_rate: 0.12,
        revenue_24h: 12500.0,
      }),
    })
  })

  // Admin alerts
  page.route('**/admin/alerts**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        alerts: [
          {
            id: 'alert-001',
            title: 'High API Latency',
            severity: 'warning',
            status: 'active',
            created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          },
          {
            id: 'alert-002',
            title: 'Database Connection Pool',
            severity: 'info',
            status: 'acknowledged',
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
        ],
        total: 2,
      }),
    })
  })

  // Admin users
  page.route('**/admin/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          {
            wallet_address: 'User1Wa11etAddress11111111111111111111111',
            display_name: 'Test User 1',
            plan: 'pro',
            agents_count: 5,
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            wallet_address: 'User2Wa11etAddress22222222222222222222222',
            display_name: 'Test User 2',
            plan: 'starter',
            agents_count: 2,
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        total: 2,
      }),
    })
  })

  // Admin system config
  page.route('**/admin/system/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        config: [
          { key: 'max_agents_free', value: 3, category: 'limits' },
          { key: 'max_agents_starter', value: 10, category: 'limits' },
          { key: 'max_agents_pro', value: 50, category: 'limits' },
          { key: 'rate_limit_free', value: 100, category: 'limits' },
        ],
        categories: ['general', 'limits', 'pricing', 'security'],
      }),
    })
  })

  // Admin feature flags
  page.route('**/admin/system/flags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        flags: [
          { id: 'flag-1', name: 'new_dashboard', is_enabled: true, rollout_percentage: 100 },
          { id: 'flag-2', name: 'beta_features', is_enabled: true, rollout_percentage: 25 },
          { id: 'flag-3', name: 'experimental_ui', is_enabled: false, rollout_percentage: 0 },
        ],
        stats: { total: 3, enabled: 2, disabled: 1, partial_rollout: 1 },
      }),
    })
  })
}

/**
 * Wait for API call to complete
 */
export async function waitForApiCall(page: Page, urlPattern: string): Promise<void> {
  await page.waitForResponse((response) => response.url().includes(urlPattern) && response.ok())
}

/**
 * Generate a random test ID
 */
export function generateTestId(): string {
  return `e2e${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`
}
