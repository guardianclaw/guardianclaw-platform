/**
 * API Key Migration Service
 *
 * Handles migration from legacy SHA-256 to PBKDF2-SHA256 hashing.
 *
 * Features:
 * - Retry with exponential backoff
 * - Structured logging for monitoring
 * - Non-blocking online migration during request
 * - Batch migration support for scheduled jobs
 */

import { hashNewApiKey, needsMigration } from './api-key-hash'

/**
 * Migration result for monitoring.
 */
export interface MigrationResult {
  success: boolean
  keyId: string
  agentId?: string
  duration_ms: number
  attempts: number
  error?: string
}

/**
 * Migration options.
 */
interface MigrationOptions {
  /** Maximum retry attempts */
  maxRetries?: number
  /** Base delay in ms for exponential backoff */
  baseDelayMs?: number
  /** Maximum delay in ms */
  maxDelayMs?: number
}

const DEFAULT_OPTIONS: Required<MigrationOptions> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
}

/**
 * Log migration event for monitoring/alerting.
 */
function logMigrationEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  details: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    category: 'api_key_migration',
    message,
    ...details,
  }

  if (level === 'error') {
    console.error(JSON.stringify(logEntry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry))
  } else {
    console.log(JSON.stringify(logEntry))
  }
}

/**
 * Calculate delay for exponential backoff.
 */
function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1)
  return Math.floor(delay + jitter)
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Migrate a single API key from SHA-256 to PBKDF2.
 *
 * @param supabase - Supabase client instance
 * @param apiKey - The plaintext API key
 * @param keyId - The database key ID
 * @param agentId - The associated agent ID (for logging)
 * @param options - Migration options
 * @returns Migration result
 */
export async function migrateApiKey(
  supabase: {
    from: (table: string) => {
      update: (data: unknown) => {
        eq: (field: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  },
  apiKey: string,
  keyId: string,
  agentId?: string,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const startTime = Date.now()
  let lastError: string | undefined

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Hash the key with PBKDF2
      const { hash: newHash, salt: newSalt } = await hashNewApiKey(apiKey)

      // Update in database
      const { error } = await supabase
        .from('api_keys')
        .update({ key_hash: newHash, key_salt: newSalt })
        .eq('id', keyId)

      if (error) {
        throw new Error(error.message)
      }

      // Success
      const result: MigrationResult = {
        success: true,
        keyId,
        agentId,
        duration_ms: Date.now() - startTime,
        attempts: attempt + 1,
      }

      logMigrationEvent('info', 'API key migrated to PBKDF2', {
        key_id: keyId,
        agent_id: agentId,
        duration_ms: result.duration_ms,
        attempts: result.attempts,
      })

      return result
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error'

      if (attempt < opts.maxRetries) {
        const delay = calculateBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs)

        logMigrationEvent('warn', 'API key migration attempt failed, retrying', {
          key_id: keyId,
          agent_id: agentId,
          attempt: attempt + 1,
          max_retries: opts.maxRetries,
          retry_delay_ms: delay,
          error: lastError,
        })

        await sleep(delay)
      }
    }
  }

  // All retries exhausted
  const result: MigrationResult = {
    success: false,
    keyId,
    agentId,
    duration_ms: Date.now() - startTime,
    attempts: opts.maxRetries + 1,
    error: lastError,
  }

  logMigrationEvent('error', 'API key migration failed after all retries', {
    key_id: keyId,
    agent_id: agentId,
    duration_ms: result.duration_ms,
    attempts: result.attempts,
    error: lastError,
  })

  return result
}

/**
 * Queue a non-blocking migration during request processing.
 * Uses fire-and-forget but with proper retry and logging.
 *
 * @param supabase - Supabase client instance
 * @param apiKey - The plaintext API key
 * @param keyId - The database key ID
 * @param agentId - The associated agent ID
 */
export function queueKeyMigration(
  supabase: {
    from: (table: string) => {
      update: (data: unknown) => {
        eq: (field: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  },
  apiKey: string,
  keyId: string,
  agentId?: string
): void {
  // Log that migration is starting
  logMigrationEvent('info', 'Legacy API key detected, queueing migration', {
    key_id: keyId,
    agent_id: agentId,
  })

  // Fire-and-forget with proper error handling
  migrateApiKey(supabase, apiKey, keyId, agentId).catch((err) => {
    // This shouldn't happen since migrateApiKey handles its own errors,
    // but catch any unexpected issues
    logMigrationEvent('error', 'Unexpected error in migration queue', {
      key_id: keyId,
      agent_id: agentId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  })
}

/**
 * Batch migrate all legacy keys in the database.
 * Intended for scheduled jobs or manual migration.
 *
 * @param supabase - Supabase client with full access
 * @param getApiKeyById - Function to retrieve plaintext key (from secure storage)
 * @param batchSize - Number of keys to process per batch
 * @returns Summary of migration results
 */
export async function batchMigrateLegacyKeys(
  supabase: {
    from: (table: string) => {
      select: (fields: string) => {
        is: (
          field: string,
          value: null
        ) => {
          limit: (
            n: number
          ) => Promise<{
            data: Array<{ id: string; agent_id: string }> | null
            error: { message: string } | null
          }>
        }
      }
      update: (data: unknown) => {
        eq: (field: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  },
  getApiKeyById: (keyId: string) => Promise<string | null>,
  batchSize: number = 100
): Promise<{
  total: number
  successful: number
  failed: number
  errors: Array<{ keyId: string; error: string }>
}> {
  const summary = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ keyId: string; error: string }>,
  }

  logMigrationEvent('info', 'Starting batch migration of legacy API keys', {
    batch_size: batchSize,
  })

  // Fetch legacy keys (those without salt)
  const { data: legacyKeys, error: fetchError } = await supabase
    .from('api_keys')
    .select('id, agent_id')
    .is('key_salt', null)
    .limit(batchSize)

  if (fetchError) {
    logMigrationEvent('error', 'Failed to fetch legacy keys for batch migration', {
      error: fetchError.message,
    })
    throw new Error(`Failed to fetch legacy keys: ${fetchError.message}`)
  }

  if (!legacyKeys || legacyKeys.length === 0) {
    logMigrationEvent('info', 'No legacy keys found for migration', {})
    return summary
  }

  summary.total = legacyKeys.length

  // Process each key
  for (const key of legacyKeys) {
    const apiKey = await getApiKeyById(key.id)

    if (!apiKey) {
      summary.failed++
      summary.errors.push({ keyId: key.id, error: 'Could not retrieve plaintext key' })
      continue
    }

    const result = await migrateApiKey(supabase, apiKey, key.id, key.agent_id)

    if (result.success) {
      summary.successful++
    } else {
      summary.failed++
      summary.errors.push({ keyId: key.id, error: result.error || 'Unknown error' })
    }
  }

  logMigrationEvent('info', 'Batch migration completed', {
    total: summary.total,
    successful: summary.successful,
    failed: summary.failed,
  })

  return summary
}

/**
 * Check if a key record needs migration.
 * Re-exported from api-key-hash for convenience.
 */
export { needsMigration }
