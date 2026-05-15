/**
 * Environment variable validation.
 * Ensures critical vars are present before the API accepts traffic.
 */

interface EnvValidationResult {
  valid: boolean
  missing: string[]
  warnings: string[]
}

// SUPABASE_ANON_KEY + SUPABASE_JWT_SECRET feed getUserClient (anon key + per-request
// HS256 JWTs that drive JWT-claims RLS). Frente B.1/B.2/B.4 closed in 2026-04 — every
// user-scoped route now goes through getUserClient, so booting without these vars
// would surface as silent 500s on every authenticated request. Fail fast at the
// boundary instead.
const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'JWT_SECRET',
] as const

const OPTIONAL_CRITICAL_VARS = ['TREASURY_WALLET', 'SOLANA_RPC_URL', 'MODAL_RUNTIME_URL'] as const

let validated = false
let cachedResult: EnvValidationResult | null = null

/**
 * Validate required environment variables.
 * Caches result after first call — env vars don't change at runtime.
 */
export function validateRequiredEnv(env: Record<string, unknown> | undefined): EnvValidationResult {
  if (validated && cachedResult) return cachedResult

  const missing: string[] = []
  const warnings: string[] = []

  // If env is entirely missing, all required vars are missing
  if (!env) {
    cachedResult = {
      valid: false,
      missing: [...REQUIRED_VARS],
      warnings: [],
    }
    validated = true
    return cachedResult
  }

  for (const key of REQUIRED_VARS) {
    if (!env[key] || (typeof env[key] === 'string' && (env[key] as string).trim() === '')) {
      missing.push(key)
    }
  }

  for (const key of OPTIONAL_CRITICAL_VARS) {
    if (!env[key]) {
      warnings.push(`${key} is not set — related features will be unavailable`)
    }
  }

  cachedResult = {
    valid: missing.length === 0,
    missing,
    warnings,
  }

  validated = true
  return cachedResult
}

/**
 * Reset validation cache (useful for testing).
 */
export function resetEnvValidation(): void {
  validated = false
  cachedResult = null
}
