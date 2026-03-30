/**
 * Worker Configuration Types
 *
 * Type definitions for Cloudflare Worker bindings (KV, Secrets, Vars).
 * These are defined in wrangler.toml and made available at runtime.
 */

interface Env {
  // KV Namespaces
  RATE_LIMIT_KV: KVNamespace

  // Environment Variables (from wrangler.toml vars)
  ENVIRONMENT: string
  MODAL_RUNTIME_URL: string
  MODAL_HEALTH_URL: string
  MODAL_VALIDATE_INPUT_URL: string
  MODAL_VALIDATE_OUTPUT_URL: string
  SOLANA_RPC_URL: string

  // Secrets (set via wrangler secret put)
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  JWT_ES256_PRIVATE_KEY: string
  JWT_ES256_PUBLIC_KEY?: string
  IP_HASH_SECRET?: string
}
