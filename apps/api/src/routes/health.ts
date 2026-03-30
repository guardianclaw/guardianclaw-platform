import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { validateRequiredEnv } from '../lib/env-validation'
import { CircuitBreaker } from '../lib/circuit-breaker'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  MODAL_RUNTIME_URL?: string
  RATE_LIMIT_KV?: KVNamespace
}

export const healthRoutes = new Hono<{ Bindings: Bindings }>()

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
  })
})

healthRoutes.get('/ready', async (c) => {
  const envResult = validateRequiredEnv(c.env)

  // If env is not valid, we're definitely not ready
  if (!envResult.valid) {
    return c.json(
      {
        status: 'unavailable',
        checks: {
          api: 'ok',
          env: 'fail',
          database: 'unknown',
        },
        missing_env: envResult.missing,
      },
      503
    )
  }

  const checks: Record<string, 'ok' | 'fail' | 'unavailable'> = {
    api: 'ok',
    env: 'ok',
  }
  let dbIssue: string | undefined

  // Probe Supabase with a lightweight query
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
    const { error } = await supabase
      .from('profiles')
      .select('wallet_address', { count: 'exact', head: true })
      .limit(0)

    if (error) {
      checks.database = 'fail'
      dbIssue = error.message
    } else {
      checks.database = 'ok'
    }
  } catch (err) {
    checks.database = 'fail'
    dbIssue = err instanceof Error ? err.message : 'Connection failed'
  }

  // Check KV availability
  if (c.env.RATE_LIMIT_KV) {
    try {
      await c.env.RATE_LIMIT_KV.get('__probe__')
      checks.kv = 'ok'
    } catch {
      checks.kv = 'fail'
    }
  } else {
    checks.kv = 'unavailable'
  }

  // Check Modal runtime
  if (c.env.MODAL_RUNTIME_URL) {
    try {
      const modalUrl = c.env.MODAL_RUNTIME_URL.replace(/\/+$/, '') + '/health'
      const res = await fetch(modalUrl, {
        signal: AbortSignal.timeout(3000),
      })
      checks.modal = res.ok ? 'ok' : 'fail'
    } catch {
      checks.modal = 'fail'
    }
  } else {
    checks.modal = 'unavailable'
  }

  // Circuit breaker status
  const circuitBreaker = new CircuitBreaker(c.env.RATE_LIMIT_KV || null)
  const circuitStatus = await circuitBreaker.status()

  // DB is the critical dependency; KV and Modal can be unavailable
  const allOk = checks.database === 'ok'
  const status = allOk ? 'ready' : 'degraded'

  return c.json(
    {
      status,
      checks,
      circuit_breaker: circuitStatus,
      ...(dbIssue ? { issue: dbIssue } : {}),
      ...(envResult.warnings.length > 0 ? { warnings: envResult.warnings } : {}),
    },
    status === 'ready' ? 200 : 503
  )
})
