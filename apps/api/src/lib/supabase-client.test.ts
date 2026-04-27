/**
 * Supabase client factory tests.
 *
 * Verifies the JWT-claims path used by Frente B.1: getUserClient mints a
 * short-lived HS256 JWT carrying the wallet as a custom claim and uses it
 * as the Bearer token. PostgREST validation of that JWT is the database-
 * side gate; here we assert only the construction, not RLS behavior (an
 * integration test against a real Supabase instance covers that and is
 * tracked under Frente H).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as jose from 'jose'
import { getServiceClient, getUserClient } from './supabase-client'

const supabaseCreateClient = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => supabaseCreateClient(...args),
}))

const baseEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_JWT_SECRET: 'super-secret-key-with-enough-length-for-hs256!',
}

beforeEach(() => {
  supabaseCreateClient.mockReset()
  supabaseCreateClient.mockReturnValue({ id: 'mock-client' })
})

describe('getServiceClient', () => {
  it('builds a client with the service role key and disables auto-auth', () => {
    getServiceClient({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'svc' })

    expect(supabaseCreateClient).toHaveBeenCalledTimes(1)
    const [url, key, options] = supabaseCreateClient.mock.calls[0]
    expect(url).toBe('https://x.supabase.co')
    expect(key).toBe('svc')
    expect(options.auth.persistSession).toBe(false)
    expect(options.auth.autoRefreshToken).toBe(false)
  })
})

describe('getUserClient', () => {
  const wallet = 'WaLLeT1234567890abcdefghijklmnopqrstuvwxyz12'

  it('rejects an empty wallet', async () => {
    await expect(getUserClient(baseEnv, '')).rejects.toThrow(/wallet address/i)
  })

  it('rejects when SUPABASE_ANON_KEY is missing', async () => {
    await expect(
      getUserClient({ ...baseEnv, SUPABASE_ANON_KEY: '' }, wallet)
    ).rejects.toThrow(/SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET/)
  })

  it('rejects when SUPABASE_JWT_SECRET is missing', async () => {
    await expect(
      getUserClient({ ...baseEnv, SUPABASE_JWT_SECRET: '' }, wallet)
    ).rejects.toThrow(/SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET/)
  })

  it('passes the anon key as the apikey and a minted JWT as Bearer', async () => {
    await getUserClient(baseEnv, wallet)

    expect(supabaseCreateClient).toHaveBeenCalledTimes(1)
    const [url, key, options] = supabaseCreateClient.mock.calls[0]
    expect(url).toBe(baseEnv.SUPABASE_URL)
    expect(key).toBe(baseEnv.SUPABASE_ANON_KEY)
    expect(options.global.headers.Authorization).toMatch(/^Bearer eyJ/)
  })

  it('mints a JWT carrying wallet_address, role=authenticated, and a short exp', async () => {
    await getUserClient(baseEnv, wallet)

    const [, , options] = supabaseCreateClient.mock.calls[0]
    const jwt = options.global.headers.Authorization.slice('Bearer '.length)

    const secretKey = new TextEncoder().encode(baseEnv.SUPABASE_JWT_SECRET)
    const { payload } = await jose.jwtVerify(jwt, secretKey)

    expect(payload.role).toBe('authenticated')
    expect(payload.sub).toBe(wallet)
    expect(payload.wallet_address).toBe(wallet)
    expect(payload.exp).toBeTypeOf('number')
    expect(payload.iat).toBeTypeOf('number')
    // Token is intentionally short-lived (mint-per-request).
    expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(120)
  })

  it('rejects a JWT signed with a different secret', async () => {
    await getUserClient(baseEnv, wallet)
    const [, , options] = supabaseCreateClient.mock.calls[0]
    const jwt = options.global.headers.Authorization.slice('Bearer '.length)

    const wrongKey = new TextEncoder().encode('a different secret entirely abc def 12345')
    await expect(jose.jwtVerify(jwt, wrongKey)).rejects.toThrow()
  })
})
