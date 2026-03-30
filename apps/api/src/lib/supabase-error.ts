/**
 * Supabase error handling helpers.
 * Maps PostgrestError codes to ApiError types with sanitized messages.
 */

import { ApiError, Errors } from './errors'
import type { PostgrestError, PostgrestResponse } from '@supabase/supabase-js'

/**
 * Map a Supabase/PostgrestError to our standard ApiError.
 * Sanitizes internal details (column names, constraints) to prevent schema leaks.
 */
export function handleSupabaseError(error: PostgrestError, context: string): ApiError {
  const code = error.code

  switch (code) {
    case '23505': // unique_violation
      return Errors.alreadyExists(context)

    case '23503': // foreign_key_violation
      return Errors.validation({ context, issue: 'Referenced resource does not exist' })

    case '23502': // not_null_violation
      return Errors.validation({ context, issue: 'Missing required field' })

    case '42501': // insufficient_privilege
      return Errors.forbidden(`Access denied for ${context}`)

    case '42P01': // undefined_table
    case '42703': // undefined_column
      // These are schema errors — log but don't expose
      console.error(`[DB SCHEMA] ${context}: ${error.message}`)
      return Errors.database('A database configuration error occurred')

    case 'PGRST116': // no rows returned (not really an error)
      return Errors.notFound(context)

    default:
      // Log the real error internally, return sanitized version
      console.error(`[DB] ${context} (code: ${code}): ${error.message}`)
      return Errors.database(`Operation failed for ${context}`)
  }
}

/**
 * Execute a Supabase query and throw ApiError on failure.
 * Wraps the common pattern of checking for errors after a query.
 */
export async function safeQuery<T>(
  query: PromiseLike<PostgrestResponse<T>>,
  context: string
): Promise<T> {
  const { data, error } = await query

  if (error) {
    throw handleSupabaseError(error, context)
  }

  if (data === null) {
    throw Errors.notFound(context)
  }

  return data as T
}
