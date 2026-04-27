/**
 * Supabase client factory.
 *
 * Two flavors:
 *
 * - `getServiceClient(env)` — service_role key. Bypasses RLS. Reserved for
 *   admin / cron / system paths that legitimately need cross-tenant access.
 *   Every call site that uses this for user-scoped data is a security risk:
 *   a missed `.eq('wallet_address', ...)` would cross tenant boundaries
 *   silently. Audit findings F-01 / G-01 track this surface.
 *
 * - `getUserClient(env, wallet)` — anon key + a short-lived JWT signed with
 *   `SUPABASE_JWT_SECRET`. PostgREST validates the JWT and exposes its
 *   claims under `current_setting('request.jwt.claims', true)`. RLS policies
 *   in mig 20260427000000 read `wallet_address` from those claims and reject
 *   cross-tenant access — even if the handler-side predicate is missing.
 *   The wallet flows through the JWT only; the handler does not need to
 *   include `.eq('wallet_address', wallet)` in user-scoped queries.
 *
 * Migration is incremental: routes flip from service_role to user-client one
 * file at a time. The parallel RLS policies on each user-scoped table allow
 * both flows to coexist during the rollout window.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as jose from 'jose'

export interface ServiceEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

export interface UserEnv {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
}

/**
 * Service-role client. RLS is bypassed.
 *
 * Only call from admin / cron / system paths. For user-scoped reads or
 * writes, use `getUserClient` instead.
 */
export function getServiceClient(env: ServiceEnv): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Mint a Supabase-compatible JWT for the given wallet.
 *
 * The JWT carries:
 * - `role: 'authenticated'` — the Postgres role PostgREST switches into.
 *   This is what makes RLS policies fire (service_role would bypass them).
 * - `sub: wallet` — convenience for any policy that wants the wallet at the
 *   `auth.uid()` analog.
 * - `wallet_address: wallet` — the custom claim our parallel RLS policies
 *   read via `current_setting('request.jwt.claims', true)::json ->> 'wallet_address'`.
 *
 * Lifetime is intentionally short (60s). We mint per-request rather than
 * caching because a worker invocation is short-lived and the cost of jose
 * sign is negligible compared to the request itself.
 */
async function mintSupabaseUserJwt(wallet: string, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)
  return new jose.SignJWT({
    role: 'authenticated',
    wallet_address: wallet,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setSubject(wallet)
    .setExpirationTime('60s')
    .sign(secretKey)
}

/**
 * User-scoped client. RLS applies; cross-tenant reads/writes are rejected
 * by the database, not the handler.
 *
 * The `Authorization` header carries our minted JWT; the anon key remains
 * in the `apikey` header (supabase-js requirement). PostgREST sees the
 * Authorization JWT, validates it against `SUPABASE_JWT_SECRET`, switches
 * to the `authenticated` role, and exposes the claims to the query.
 */
export async function getUserClient(env: UserEnv, wallet: string): Promise<SupabaseClient> {
  if (!wallet) {
    throw new Error('getUserClient requires a wallet address')
  }
  if (!env.SUPABASE_ANON_KEY || !env.SUPABASE_JWT_SECRET) {
    throw new Error(
      'getUserClient requires SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET to be configured'
    )
  }

  const jwt = await mintSupabaseUserJwt(wallet, env.SUPABASE_JWT_SECRET)

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  })
}
