/**
 * Unit tests for env-validation.
 *
 * The middleware in src/index.ts gates every non-/health request on
 * validateRequiredEnv — a regression that quietly drops a var from
 * REQUIRED_VARS would surface as silent 500s in production. Pin the
 * required set and the missing-detection semantics here.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { validateRequiredEnv, resetEnvValidation } from './env-validation'

const FULL_ENV = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_KEY: 'svc-key',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_JWT_SECRET: 'jwt-secret-min-32-chars-for-realism!',
  JWT_SECRET: 'app-jwt-secret-min-32-chars!',
  TREASURY_WALLET: 'wallet',
  SOLANA_RPC_URL: 'https://rpc',
  MODAL_RUNTIME_URL: 'https://modal',
}

const REQUIRED_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'JWT_SECRET',
] as const

describe('validateRequiredEnv', () => {
  beforeEach(() => {
    resetEnvValidation()
  })

  it('returns valid when every required var is present', () => {
    const result = validateRequiredEnv(FULL_ENV)
    expect(result.valid).toBe(true)
    expect(result.missing).toEqual([])
  })

  it('treats an entirely missing env as all-required-missing', () => {
    const result = validateRequiredEnv(undefined)
    expect(result.valid).toBe(false)
    expect(result.missing).toEqual([...REQUIRED_KEYS])
  })

  it.each(REQUIRED_KEYS)('flags %s as missing when absent', (key) => {
    const env = { ...FULL_ENV }
    delete (env as Record<string, unknown>)[key]
    const result = validateRequiredEnv(env)
    expect(result.valid).toBe(false)
    expect(result.missing).toContain(key)
  })

  it.each(REQUIRED_KEYS)('treats %s as missing when empty string', (key) => {
    const result = validateRequiredEnv({ ...FULL_ENV, [key]: '' })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain(key)
  })

  it.each(REQUIRED_KEYS)('treats %s as missing when whitespace-only', (key) => {
    const result = validateRequiredEnv({ ...FULL_ENV, [key]: '   ' })
    expect(result.valid).toBe(false)
    expect(result.missing).toContain(key)
  })

  it('warns (does not fail) when optional critical vars are missing', () => {
    const env = { ...FULL_ENV }
    delete (env as Record<string, unknown>).TREASURY_WALLET
    delete (env as Record<string, unknown>).SOLANA_RPC_URL
    delete (env as Record<string, unknown>).MODAL_RUNTIME_URL
    const result = validateRequiredEnv(env)
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(3)
    expect(result.warnings.some((w) => w.includes('TREASURY_WALLET'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('SOLANA_RPC_URL'))).toBe(true)
    expect(result.warnings.some((w) => w.includes('MODAL_RUNTIME_URL'))).toBe(true)
  })

  it('caches the result across calls', () => {
    const first = validateRequiredEnv(FULL_ENV)
    // Mutating the env after the first call should not change the second result.
    const second = validateRequiredEnv({})
    expect(second).toBe(first)
  })

  it('resetEnvValidation clears the cache', () => {
    validateRequiredEnv(FULL_ENV)
    resetEnvValidation()
    const result = validateRequiredEnv({})
    expect(result.valid).toBe(false)
    expect(result.missing).toEqual([...REQUIRED_KEYS])
  })
})
