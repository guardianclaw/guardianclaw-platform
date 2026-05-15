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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as jose from 'jose'
import { getServiceClient, getUserClient, getRefreshableUserClient } from './supabase-client'

const supabaseCreateClient = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => supabaseCreateClient(...args),
}))

const baseEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_JWT_SECRET: 'super-secret-key-with-enough-length-for-hs256!',
}

let mockClientCounter = 0

beforeEach(() => {
  supabaseCreateClient.mockReset()
  mockClientCounter = 0
  // Return a distinct identity per call so tests can detect re-mints.
  supabaseCreateClient.mockImplementation(() => ({ id: `mock-client-${++mockClientCounter}` }))
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
    await expect(getUserClient({ ...baseEnv, SUPABASE_ANON_KEY: '' }, wallet)).rejects.toThrow(
      /SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET/
    )
  })

  it('rejects when SUPABASE_JWT_SECRET is missing', async () => {
    await expect(getUserClient({ ...baseEnv, SUPABASE_JWT_SECRET: '' }, wallet)).rejects.toThrow(
      /SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET/
    )
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

describe('getRefreshableUserClient', () => {
  const wallet = 'WaLLeT1234567890abcdefghijklmnopqrstuvwxyz12'

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mints a client up front', async () => {
    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    expect(supabaseCreateClient).toHaveBeenCalledTimes(1)

    const first = await refreshable.get()
    // No time has passed; get() must return the already-minted client without
    // calling the factory again.
    expect(supabaseCreateClient).toHaveBeenCalledTimes(1)
    expect(first).toEqual({ id: 'mock-client-1' })
  })

  it('returns the same client across multiple calls within the JWT lifetime', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    const a = await refreshable.get()

    // 30s later — still well within the 60s JWT lifetime and the 10s buffer.
    vi.setSystemTime(new Date('2026-05-15T12:00:30Z'))
    const b = await refreshable.get()

    expect(a).toBe(b)
    expect(supabaseCreateClient).toHaveBeenCalledTimes(1)
  })

  it('mints a new client once the buffer window is reached', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    const a = await refreshable.get()
    expect(a).toEqual({ id: 'mock-client-1' })

    // JWT lifetime is 60s with a 10s refresh buffer → first re-mint at >=50s.
    vi.setSystemTime(new Date('2026-05-15T12:00:50Z'))
    const b = await refreshable.get()

    expect(supabaseCreateClient).toHaveBeenCalledTimes(2)
    expect(b).toEqual({ id: 'mock-client-2' })
    expect(b).not.toBe(a)
  })

  it('does not re-mint at exactly the buffer minus 1ms', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    await refreshable.get()

    // 49 999ms — one ms before the threshold; must not refresh.
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z').getTime() + 49_999)
    await refreshable.get()
    expect(supabaseCreateClient).toHaveBeenCalledTimes(1)
  })

  it('re-mints with a fresh JWT, not the original one', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    await refreshable.get()
    const firstJwt = supabaseCreateClient.mock.calls[0][2].global.headers.Authorization

    vi.setSystemTime(new Date('2026-05-15T12:00:50Z'))
    await refreshable.get()
    const secondJwt = supabaseCreateClient.mock.calls[1][2].global.headers.Authorization

    expect(firstJwt).toMatch(/^Bearer eyJ/)
    expect(secondJwt).toMatch(/^Bearer eyJ/)
    // The minted JWT carries `iat` — different mint time → different signature.
    expect(secondJwt).not.toBe(firstJwt)
  })

  it('survives multiple refresh cycles across a 5-minute stream', async () => {
    vi.useFakeTimers()
    const start = new Date('2026-05-15T12:00:00Z').getTime()
    vi.setSystemTime(start)

    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    await refreshable.get()

    // Simulate the SSE polling cadence: every 2s for 5 minutes.
    for (let t = 2_000; t <= 5 * 60_000; t += 2_000) {
      vi.setSystemTime(start + t)
      await refreshable.get()
    }

    // Initial mint + a refresh at each ~50s boundary across 300s → 1 + 6 = 7.
    // Allow ±1 to absorb buffer-edge rounding without making the test flaky.
    const callCount = supabaseCreateClient.mock.calls.length
    expect(callCount).toBeGreaterThanOrEqual(6)
    expect(callCount).toBeLessThanOrEqual(8)
  })

  it('propagates the same wallet into every minted JWT', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const refreshable = await getRefreshableUserClient(baseEnv, wallet)
    await refreshable.get()
    vi.setSystemTime(new Date('2026-05-15T12:00:50Z'))
    await refreshable.get()

    const secretKey = new TextEncoder().encode(baseEnv.SUPABASE_JWT_SECRET)
    for (const call of supabaseCreateClient.mock.calls) {
      const jwt = (call[2].global.headers.Authorization as string).slice('Bearer '.length)
      const { payload } = await jose.jwtVerify(jwt, secretKey)
      expect(payload.wallet_address).toBe(wallet)
      expect(payload.role).toBe('authenticated')
    }
  })
})
