/**
 * Social Deliveries Routes Tests
 *
 * Verifies that ownership enforcement happens inside the RPC (closes F-05 / P1.1):
 * - approve handler passes wallet to approve_social_delivery
 * - cross-tenant attempt does not trigger downstream delivery
 * - handler does not perform a post-hoc revert
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { socialDeliveriesRoutes } from './social-deliveries'
import { testWallets } from '../test/fixtures/index'

const mockExecuteSocialDelivery = vi.fn()

vi.mock('../services/social-connectors', () => ({
  executeSocialDelivery: (...args: unknown[]) => mockExecuteSocialDelivery(...args),
}))

const mockRpc = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}))

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as {
      req: { header: (name: string) => string | undefined }
      set: (key: string, value: string) => void
      json: (data: unknown, status: number) => Response
    }
    const authHeader = ctx.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.json({ error: 'Unauthorized' }, 401)
    }
    ctx.set('wallet', testWallets.alice)
    ctx.set('plan', 'pro')
    await next()
  }),
}))

vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  }),
}))

const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    SUPABASE_ANON_KEY: string
    SUPABASE_JWT_SECRET: string
    JWT_SECRET: string
  }
}>()

app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWT_SECRET: 'test-supabase-jwt-secret-with-minimum-32-chars!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/social-deliveries', socialDeliveriesRoutes)

const validDeliveryId = '11111111-1111-4111-8111-111111111111'
const token = 'test-token'

describe('POST /social-deliveries/:id/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteSocialDelivery.mockReset()
  })

  it('rejects invalid UUID format', async () => {
    const res = await app.request('/social-deliveries/not-a-uuid/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('passes wallet to RPC so ownership is enforced server-side', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        delivery_id: validDeliveryId,
        agent_id: '22222222-2222-4222-8222-222222222222',
        agent_name: 'Test Agent',
        credential_id: '33333333-3333-4333-8333-333333333333',
        platform: 'twitter',
        content: 'Hello world',
        delivery_config: {},
      },
      error: null,
    })
    mockExecuteSocialDelivery.mockResolvedValueOnce({
      success: true,
      result: { externalId: 'tweet-1', externalUrl: 'https://x.com/x/1' },
    })

    const res = await app.request(`/social-deliveries/${validDeliveryId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('approve_social_delivery', {
      p_delivery_id: validDeliveryId,
      p_wallet_address: testWallets.alice,
    })
    expect(mockExecuteSocialDelivery).toHaveBeenCalledTimes(1)
  })

  it('does not invoke delivery and does not revert when RPC denies (cross-tenant)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Delivery not found, not in draft, or not owned by caller',
      },
      error: null,
    })

    const res = await app.request(`/social-deliveries/${validDeliveryId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(404)
    expect(mockExecuteSocialDelivery).not.toHaveBeenCalled()
    // Handler must not perform a revert update — RPC already left the row untouched.
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 500 when the RPC itself errors', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection refused' },
    })

    const res = await app.request(`/social-deliveries/${validDeliveryId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(500)
    expect(mockExecuteSocialDelivery).not.toHaveBeenCalled()
  })

  it('forwards delivery error from executeSocialDelivery', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        delivery_id: validDeliveryId,
        agent_id: '22222222-2222-4222-8222-222222222222',
        agent_name: 'Test Agent',
        credential_id: '33333333-3333-4333-8333-333333333333',
        platform: 'discord',
        content: 'msg',
        delivery_config: { discordConfig: { channelId: 'c1' } },
      },
      error: null,
    })
    mockExecuteSocialDelivery.mockResolvedValueOnce({
      success: false,
      error: 'discord webhook failed',
    })

    const res = await app.request(`/social-deliveries/${validDeliveryId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; error?: string }
    expect(data.success).toBe(false)
    expect(data.error).toBe('discord webhook failed')
  })

  it('rejects unauthenticated requests', async () => {
    const res = await app.request(`/social-deliveries/${validDeliveryId}/approve`, {
      method: 'POST',
    })
    expect(res.status).toBe(401)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
