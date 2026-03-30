import { z } from 'zod'

// Solana wallet address validation
// Base58 encoded, 32-44 characters
const walletAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const walletAddressSchema = z
  .string()
  .min(32, 'Wallet address must be at least 32 characters')
  .max(44, 'Wallet address must be at most 44 characters')
  .regex(walletAddressRegex, 'Invalid Solana wallet address format')

// Admin role validation
export const adminRoleSchema = z.enum(['super_admin', 'admin', 'support', 'viewer'])

// Add admin form validation
export const addAdminSchema = z.object({
  wallet_address: walletAddressSchema,
  role: adminRoleSchema,
})

export type AddAdminInput = z.infer<typeof addAdminSchema>

// Alert rule form validation
export const conditionSchema = z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'spike'])
export const severitySchema = z.enum(['info', 'warning', 'critical'])

export const alertRuleSchema = z.object({
  name: z
    .string()
    .min(1, 'Rule name is required')
    .max(100, 'Rule name must be at most 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional()
    .nullable(),
  metric_name: z
    .string()
    .min(1, 'Metric name is required')
    .max(50, 'Metric name must be at most 50 characters'),
  condition: conditionSchema,
  threshold_value: z.number().finite('Threshold must be a valid number'),
  severity: severitySchema,
  cooldown_minutes: z
    .number()
    .int('Cooldown must be a whole number')
    .min(1, 'Cooldown must be at least 1 minute')
    .max(1440, 'Cooldown must be at most 1440 minutes (24 hours)'),
  is_enabled: z.boolean().default(true),
})

export type AlertRuleInput = z.infer<typeof alertRuleSchema>

// Update alert status validation
export const updateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'resolved']),
})

export type UpdateAlertInput = z.infer<typeof updateAlertSchema>

// User search validation
export const userSearchSchema = z.object({
  query: z
    .string()
    .min(3, 'Search query must be at least 3 characters')
    .max(44, 'Search query must be at most 44 characters'),
})

export type UserSearchInput = z.infer<typeof userSearchSchema>

// Pagination validation
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

// Helper function to validate form data
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}
  for (const error of result.error.errors) {
    const path = error.path.join('.')
    if (!errors[path]) {
      errors[path] = error.message
    }
  }

  return { success: false, errors }
}

// Helper to get first error message
export function getFirstError(errors: Record<string, string>): string {
  const firstKey = Object.keys(errors)[0]
  return firstKey ? errors[firstKey] : 'Validation failed'
}
