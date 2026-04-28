/**
 * Deploy routes unit tests
 * Tests: agent deployment, API key management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { deployRoutes } from './deploy'
import { testWallets, createAgent, createDeployment, createApiKey } from '../test/fixtures'
import { generateTestToken } from '../test/helpers'

// Mock state
const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  deploymentResult: { data: null as unknown, error: null as unknown },
  deploymentListResult: { data: [] as unknown[], error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  countResult: { count: 0 as number | null, error: null as unknown },
  keysResult: { data: [] as unknown[], error: null as unknown },
}

// Build chainable query mock with flexible result handling
function createQueryChain(getResult: () => { data?: unknown; error?: unknown }, isArray = false) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'range', 'gte', 'lte', 'in']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(getResult()))
  chain.then = (resolve: (v: unknown) => void) => {
    if (isArray) {
      const result = getResult()
      resolve({ data: result.data || [], error: result.error })
    } else {
      resolve(getResult())
    }
  }
  return chain
}

// Helper to create deep chainable mock (supports n levels of .eq())
// singleResult is optional - if provided, .single() returns it instead of finalResult
function createDeepChain(finalResult: () => unknown, depth = 5, singleResult?: () => unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['eq', 'neq', 'order', 'range', 'gte', 'lte', 'in', 'select', 'limit']
  for (const method of methods) {
    if (depth > 0) {
      chain[method] = vi.fn(() => createDeepChain(finalResult, depth - 1, singleResult))
    } else {
      chain[method] = vi.fn(() => chain)
    }
  }
  // If singleResult is provided, use it; otherwise use finalResult
  chain.single = vi.fn(() => Promise.resolve((singleResult || finalResult)()))
  chain.then = (resolve: (v: unknown) => void) => resolve(finalResult())
  return chain
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'agents') {
      return {
        select: vi.fn(() => createQueryChain(() => mockState.agentResult)),
        update: vi.fn(() => createDeepChain(() => ({ error: null }))),
      }
    }
    if (table === 'deployments') {
      return {
        select: vi.fn((_cols?: string) => {
          // For list queries, return array; for .single() calls, return single result
          return createDeepChain(
            () => ({
              data: mockState.deploymentListResult.data,
              error: mockState.deploymentListResult.error,
            }),
            6,
            () => ({
              data: mockState.deploymentResult.data,
              error: mockState.deploymentResult.error,
            })
          )
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
        update: vi.fn(() =>
          createDeepChain(
            () => ({ data: mockState.updateResult.data, error: mockState.updateResult.error }),
            6
          )
        ),
        delete: vi.fn(() => createDeepChain(() => ({ error: null }))),
      }
    }
    if (table === 'api_keys') {
      return {
        select: vi.fn((cols?: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return createDeepChain(() => mockState.countResult, 4)
          }
          return createDeepChain(
            () => ({ data: mockState.keysResult.data, error: mockState.keysResult.error }),
            4
          )
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
          then: (resolve: (v: unknown) => void) => resolve(mockState.insertResult),
        })),
        update: vi.fn(() => createDeepChain(() => ({ error: null }), 4)),
      }
    }
    return { select: vi.fn(() => createQueryChain(() => ({ data: null, error: null }))) }
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Create test app
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    SUPABASE_ANON_KEY: string
    SUPABASE_JWT_SECRET: string
    JWT_SECRET: string
    API_BASE_URL?: string
  }
}>()

app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars-padding!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
    API_BASE_URL: 'https://api.test.com',
  }
  await next()
})

app.route('/deploy', deployRoutes)

// Reset mock state
function resetMocks() {
  mockState.agentResult = { data: null, error: null }
  mockState.deploymentResult = { data: null, error: null }
  mockState.deploymentListResult = { data: null, error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
  mockState.countResult = { count: 0, error: null }
  mockState.keysResult = { data: [], error: null }
  vi.clearAllMocks()
}

describe('Deploy Routes', () => {
  let token: string

  beforeEach(async () => {
    resetMocks()
    token = await generateTestToken(testWallets.alice)
  })

  describe('POST /deploy/:id', () => {
    it('deploys agent with valid flow', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: null } // No existing deployment

      const deployment = createDeployment({ id: 'deploy-1', agent_id: 'agent-1' })
      mockState.insertResult = { data: deployment, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.deployment_id).toBeDefined()
      expect(body.endpoint_url).toContain('agent-1')
      expect(body.api_key).toMatch(/^sk_live_/)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/deploy/non-existent', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toBe('Agent not found')
    })

    it('returns 400 for agent without flow nodes', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: { nodes: [], edges: [] },
      })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('without flow nodes')
    })

    it('returns 400 for flow without input node', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: { nodes: [{ id: '1', type: 'output' }], edges: [] },
      })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('input')
    })

    it('returns 400 for flow without output node', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: { nodes: [{ id: '1', type: 'input' }], edges: [] },
      })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('output')
    })

    it('returns warning for process node without model config (not blocking)', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'process', data: {} },
            { id: '3', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      const deployment = createDeployment({ id: 'deploy-1', agent_id: 'agent-1' })
      mockState.insertResult = { data: deployment, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.warnings).toBeDefined()
      expect(body.warnings.some((w: string) => w.includes('process node'))).toBe(true)
      expect(body.warnings.some((w: string) => w.includes('model'))).toBe(true)
    })

    it('returns warnings when deploying without claw nodes', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: null }
      const deployment = createDeployment({ id: 'deploy-1', agent_id: 'agent-1' })
      mockState.insertResult = { data: deployment, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.warnings).toBeDefined()
      expect(body.warnings.some((w: string) => w.includes('GuardianClaw'))).toBe(true)
    })

    it('returns 409 if agent already deployed', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: { id: 'existing-deploy' }, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(409)

      const body = await res.json()
      expect(body.error).toContain('already has an active deployment')
    })

    it('returns 401 without authorization', async () => {
      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
      })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /deploy/:id', () => {
    it('stops active deployment', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployment = createDeployment({ id: 'deploy-1', status: 'stopped' })
      mockState.updateResult = { data: deployment, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('stopped')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns 404 if no active deployment', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }
      mockState.updateResult = { data: null, error: { message: 'No rows' } }

      const res = await app.request('/deploy/agent-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toContain('No active deployment')
    })
  })

  describe('GET /deploy/:id', () => {
    it('returns deployment status', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployment = createDeployment({
        id: 'deploy-1',
        environment: 'prod',
        endpoint_url: 'https://api.test.com/invoke/agent-1',
      })
      // GET /deploy/:id expects an array from deployments query
      mockState.deploymentListResult = { data: [deployment], error: null }
      mockState.keysResult = { data: [createApiKey({ id: 'key-1' })], error: null }

      const res = await app.request('/deploy/agent-1', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.deployed).toBe(true)
      expect(body.deployment.id).toBe('deploy-1')
      expect(body.api_keys).toHaveLength(1)
    })

    it('returns not deployed status', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }
      // Empty array = no deployments
      mockState.deploymentListResult = { data: [], error: null }
      mockState.keysResult = { data: [], error: null }

      const res = await app.request('/deploy/agent-1', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.deployed).toBe(false)
      expect(body.deployment).toBeNull()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /deploy/:id/keys', () => {
    it('generates new API key', async () => {
      const agent = createAgent({ id: 'agent-1', status: 'deployed' })
      mockState.agentResult = { data: agent, error: null }
      mockState.countResult = { count: 2, error: null }

      const newKey = createApiKey({ id: 'new-key' })
      mockState.insertResult = { data: newKey, error: null }

      const res = await app.request('/deploy/agent-1/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'My Key' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.api_key).toMatch(/^sk_live_/)
    })

    it('returns 400 if agent not deployed', async () => {
      const agent = createAgent({ id: 'agent-1', status: 'draft' })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('must be deployed')
    })

    it('enforces 5-key limit', async () => {
      const agent = createAgent({ id: 'agent-1', status: 'deployed' })
      mockState.agentResult = { data: agent, error: null }
      mockState.countResult = { count: 5, error: null }

      const res = await app.request('/deploy/agent-1/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toContain('Maximum 5')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/agent-1/keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /deploy/:id/keys/:keyId', () => {
    it('revokes API key', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1/keys/key-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('revoked')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent/keys/key-1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  // ============================================
  // MULTI-ENVIRONMENT TESTS
  // ============================================

  describe('POST /deploy/:id (with environment)', () => {
    it('deploys to staging environment', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: null }

      const deployment = createDeployment({
        id: 'deploy-1',
        agent_id: 'agent-1',
        environment: 'staging',
      })
      mockState.insertResult = { data: deployment, error: null }
      mockState.countResult = { count: 0, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment: 'staging' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.environment).toBe('staging')
    })

    it('deploys to dev environment', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: null }

      const deployment = createDeployment({
        id: 'deploy-1',
        agent_id: 'agent-1',
        environment: 'dev',
      })
      mockState.insertResult = { data: deployment, error: null }
      mockState.countResult = { count: 0, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment: 'dev' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.environment).toBe('dev')
    })

    it('includes notes in deployment', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: null }

      const deployment = createDeployment({
        id: 'deploy-1',
        agent_id: 'agent-1',
        notes: 'Test deployment',
      })
      mockState.insertResult = { data: deployment, error: null }
      mockState.countResult = { count: 0, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment: 'staging', notes: 'Test deployment' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('rejects invalid environment', async () => {
      const agent = createAgent({
        id: 'agent-1',
        flow: {
          nodes: [
            { id: '1', type: 'input' },
            { id: '2', type: 'output' },
          ],
          edges: [],
        },
      })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environment: 'invalid' }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('Invalid')
    })
  })

  describe('DELETE /deploy/:id (with environment)', () => {
    it('stops deployment in staging', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployment = createDeployment({
        id: 'deploy-1',
        status: 'stopped',
        environment: 'staging',
      })
      mockState.updateResult = { data: deployment, error: null }
      mockState.deploymentListResult = { data: [], error: null }

      const res = await app.request('/deploy/agent-1?environment=staging', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.environment).toBe('staging')
    })

    it('rejects invalid environment query param', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1?environment=invalid', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('Invalid environment')
    })
  })

  describe('GET /deploy/:id/history', () => {
    it('returns deployment history', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployments = [
        createDeployment({ id: 'deploy-2', version: 2, environment: 'prod' }),
        createDeployment({ id: 'deploy-1', version: 1, environment: 'staging' }),
      ]
      mockState.deploymentListResult = { data: deployments, error: null }

      const res = await app.request('/deploy/agent-1/history', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.deployments).toBeDefined()
      expect(body.pagination).toBeDefined()
      expect(body.deployments).toHaveLength(2)
    })

    it('filters history by environment', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployments = [createDeployment({ id: 'deploy-1', version: 1, environment: 'staging' })]
      mockState.deploymentListResult = { data: deployments, error: null }

      const res = await app.request('/deploy/agent-1/history?environment=staging', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.deployments).toBeDefined()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent/history', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /deploy/:id/stats', () => {
    it('returns deployment statistics', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployments = [
        {
          environment: 'prod',
          status: 'running',
          is_active: true,
          rollback_from: null,
          promoted_from: null,
          created_at: '2026-01-15T10:00:00Z',
        },
        {
          environment: 'staging',
          status: 'stopped',
          is_active: false,
          rollback_from: null,
          promoted_from: 'dep-1',
          created_at: '2026-01-14T10:00:00Z',
        },
      ]
      mockState.deploymentListResult = { data: deployments, error: null }

      const res = await app.request('/deploy/agent-1/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.agent_id).toBe('agent-1')
      expect(body.stats).toBeDefined()
      expect(body.stats.prod).toBeDefined()
      expect(body.stats.staging).toBeDefined()
      expect(body.stats.dev).toBeDefined()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /deploy/:id/rollback/:deploymentId', () => {
    it('rolls back to a previous deployment', async () => {
      const agent = createAgent({ id: 'agent-1', version: 3 })
      mockState.agentResult = { data: agent, error: null }

      const sourceDeployment = createDeployment({
        id: 'deploy-1',
        version: 1,
        environment: 'prod',
        config_snapshot: { flow: {}, config: {}, claw_config: {} },
      })
      mockState.deploymentResult = { data: sourceDeployment, error: null }

      const newDeployment = createDeployment({
        id: 'deploy-new',
        version: 4,
        environment: 'prod',
        rollback_from: 'deploy-1',
      })
      mockState.insertResult = { data: newDeployment, error: null }

      const res = await app.request('/deploy/agent-1/rollback/deploy-1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: 'Rolling back due to bug' }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.rolled_back_from).toBe('deploy-1')
      expect(body.environment).toBe('prod')
    })

    it('returns 404 for non-existent deployment', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/deploy/agent-1/rollback/non-existent', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toContain('not found')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent/rollback/deploy-1', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /deploy/:id/promote', () => {
    it('promotes from staging to prod', async () => {
      const stagingDeployId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
      const prodDeployId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
      const agent = createAgent({ id: 'agent-1', version: 2 })
      mockState.agentResult = { data: agent, error: null }

      const sourceDeployment = createDeployment({
        id: stagingDeployId,
        version: 2,
        environment: 'staging',
        config_snapshot: { flow: {}, config: {}, claw_config: {} },
      })
      mockState.deploymentResult = { data: sourceDeployment, error: null }

      const newDeployment = createDeployment({
        id: prodDeployId,
        version: 3,
        environment: 'prod',
        promoted_from: stagingDeployId,
      })
      mockState.insertResult = { data: newDeployment, error: null }

      const res = await app.request('/deploy/agent-1/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_deployment_id: stagingDeployId,
          target_environment: 'prod',
          notes: 'Promoted after testing',
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.source_environment).toBe('staging')
      expect(body.target_environment).toBe('prod')
      expect(body.promoted_from).toBe(stagingDeployId)
    })

    it('promotes from dev to staging', async () => {
      const deployId = '11111111-1111-1111-1111-111111111111'
      const agent = createAgent({ id: 'agent-1', version: 1 })
      mockState.agentResult = { data: agent, error: null }

      const sourceDeployment = createDeployment({
        id: deployId,
        version: 1,
        environment: 'dev',
        config_snapshot: { flow: {}, config: {}, claw_config: {} },
      })
      mockState.deploymentResult = { data: sourceDeployment, error: null }

      const newDeployment = createDeployment({
        id: '22222222-2222-2222-2222-222222222222',
        version: 2,
        environment: 'staging',
        promoted_from: deployId,
      })
      mockState.insertResult = { data: newDeployment, error: null }

      const res = await app.request('/deploy/agent-1/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_deployment_id: deployId,
          target_environment: 'staging',
        }),
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.source_environment).toBe('dev')
      expect(body.target_environment).toBe('staging')
    })

    it('rejects promotion from prod', async () => {
      const deployId = '33333333-3333-3333-3333-333333333333'
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const sourceDeployment = createDeployment({
        id: deployId,
        version: 1,
        environment: 'prod',
        config_snapshot: {},
      })
      mockState.deploymentResult = { data: sourceDeployment, error: null }

      const res = await app.request('/deploy/agent-1/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_deployment_id: deployId,
          target_environment: 'staging',
        }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('Cannot promote from prod')
    })

    it('rejects promotion to dev (via schema validation)', async () => {
      // Note: Zod schema only allows 'staging' or 'prod' as target_environment
      // This test verifies the schema validation catches invalid targets
      const deployId = '44444444-4444-4444-4444-444444444444'
      const res = await app.request('/deploy/agent-1/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_deployment_id: deployId,
          target_environment: 'dev', // Invalid: Zod only accepts 'staging' | 'prod'
        }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('Invalid')
    })

    it('rejects invalid request body', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const res = await app.request('/deploy/agent-1/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invalid: 'body' }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('Invalid')
    })

    it('returns 404 for non-existent source deployment', async () => {
      const nonExistentId = '99999999-9999-4999-9999-999999999999'
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/deploy/agent-1/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_deployment_id: nonExistentId,
          target_environment: 'prod',
        }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 404 for non-existent agent', async () => {
      const someDeployId = '88888888-8888-4888-8888-888888888888'
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent/promote', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_deployment_id: someDeployId,
          target_environment: 'prod',
        }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /deploy/:id/history/:deploymentId', () => {
    it('returns specific deployment details', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }

      const deployment = createDeployment({
        id: 'deploy-1',
        version: 1,
        environment: 'prod',
        config_snapshot: { flow: {}, config: {}, claw_config: {} },
        deployed_by: testWallets.alice,
        notes: 'Initial deployment',
      })
      mockState.deploymentResult = { data: deployment, error: null }

      const res = await app.request('/deploy/agent-1/history/deploy-1', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.deployment).toBeDefined()
      expect(body.deployment.id).toBe('deploy-1')
      expect(body.deployment.environment).toBe('prod')
    })

    it('returns 404 for non-existent deployment', async () => {
      const agent = createAgent({ id: 'agent-1' })
      mockState.agentResult = { data: agent, error: null }
      mockState.deploymentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/deploy/agent-1/history/non-existent', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toContain('not found')
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: null }

      const res = await app.request('/deploy/non-existent/history/deploy-1', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })
  })
})
