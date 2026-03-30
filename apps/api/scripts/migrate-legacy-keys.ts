#!/usr/bin/env npx ts-node

/**
 * Batch Migration Script for Legacy API Keys
 *
 * Migrates all API keys from SHA-256 to PBKDF2-SHA256 hashing.
 *
 * Usage:
 *   npx ts-node scripts/migrate-legacy-keys.ts
 *
 * Environment variables required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Supabase service role key
 *
 * Options:
 *   --dry-run    Preview migration without making changes
 *   --batch-size Number of keys to process per batch (default: 50)
 *   --verbose    Enable verbose logging
 *
 * Note: This script requires access to plaintext API keys.
 * In production, keys are never stored in plaintext, so this script
 * is intended for:
 * 1. Development/staging environments where keys may be recoverable
 * 2. Situations where online migration (during request) handles most cases
 *
 * For production, online migration via invoke.ts handles key upgrades
 * automatically when keys are used.
 */

import { createClient } from '@supabase/supabase-js'

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
const batchSizeArg = args.find((a) => a.startsWith('--batch-size='))
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50

// Validate environment
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing required environment variables')
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Log helper
function log(message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
    ...data,
  }
  console.log(JSON.stringify(entry))
}

// Verbose log
function vlog(message: string, data?: Record<string, unknown>) {
  if (verbose) {
    log(message, data)
  }
}

interface LegacyKey {
  id: string
  key_prefix: string
  agent_id: string
  created_at: string
}

interface MigrationSummary {
  total_found: number
  migrated: number
  skipped: number
  errors: number
  duration_ms: number
}

/**
 * Find all legacy keys (those without salt).
 */
async function findLegacyKeys(): Promise<LegacyKey[]> {
  const allKeys: LegacyKey[] = []
  let offset = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_prefix, agent_id, created_at')
      .is('key_salt', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      throw new Error(`Failed to fetch legacy keys: ${error.message}`)
    }

    if (!data || data.length === 0) {
      break
    }

    allKeys.push(...data)
    offset += batchSize

    vlog('Fetched batch of legacy keys', { count: data.length, total: allKeys.length })
  }

  return allKeys
}

/**
 * Main migration function.
 *
 * Note: In a real production scenario, you would need a secure way to
 * retrieve the plaintext API key. This script demonstrates the structure
 * but cannot actually migrate keys without access to the plaintext.
 *
 * The recommended approach is online migration via invoke.ts, which
 * receives the plaintext key in the request and can upgrade it.
 */
async function runMigration(): Promise<MigrationSummary> {
  const startTime = Date.now()
  const summary: MigrationSummary = {
    total_found: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    duration_ms: 0,
  }

  log('Starting legacy API key migration', {
    dry_run: dryRun,
    batch_size: batchSize,
    verbose,
  })

  // Find all legacy keys
  const legacyKeys = await findLegacyKeys()
  summary.total_found = legacyKeys.length

  log('Found legacy keys', { count: legacyKeys.length })

  if (legacyKeys.length === 0) {
    log('No legacy keys found - migration complete')
    summary.duration_ms = Date.now() - startTime
    return summary
  }

  if (dryRun) {
    log('Dry run mode - no changes will be made')
    log('Keys that would be migrated:')
    for (const key of legacyKeys) {
      console.log(`  - ${key.key_prefix}... (agent: ${key.agent_id}, created: ${key.created_at})`)
    }
    summary.skipped = legacyKeys.length
    summary.duration_ms = Date.now() - startTime
    return summary
  }

  // In production, we cannot migrate keys without the plaintext.
  // This script serves as documentation and can be extended if:
  // 1. A secure key recovery mechanism is available
  // 2. Keys are being migrated in a dev/staging environment

  log('Migration note: Cannot migrate keys without plaintext access')
  log('Recommended approach: Online migration via invoke.ts')
  log('Keys will be automatically upgraded when next used')

  // Mark keys as pending migration (optional metadata update)
  for (const key of legacyKeys) {
    vlog('Marking key for online migration', { key_id: key.id })

    // We could add a 'migration_pending' flag if desired
    // For now, just report the status
    summary.skipped++
  }

  summary.duration_ms = Date.now() - startTime
  return summary
}

/**
 * Generate a migration report.
 */
function generateReport(summary: MigrationSummary) {
  console.log('\n' + '='.repeat(60))
  console.log('MIGRATION REPORT')
  console.log('='.repeat(60))
  console.log(`Total legacy keys found: ${summary.total_found}`)
  console.log(`Successfully migrated:   ${summary.migrated}`)
  console.log(`Skipped (dry-run/pending): ${summary.skipped}`)
  console.log(`Errors:                  ${summary.errors}`)
  console.log(`Duration:                ${summary.duration_ms}ms`)
  console.log('='.repeat(60))

  if (summary.total_found > 0 && summary.migrated === 0) {
    console.log('\nNote: Keys will be migrated automatically when used.')
    console.log('The invoke endpoint handles online migration with retry logic.')
  }
}

// Run the migration
runMigration()
  .then((summary) => {
    generateReport(summary)
    process.exit(summary.errors > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error('Migration failed:', error.message)
    process.exit(1)
  })
