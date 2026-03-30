/**
 * Platform Config Validation Schemas
 *
 * Zod schemas for validating social platform credentials.
 * These schemas ensure proper format before submission.
 */

import { z } from 'zod'

// ============================================
// TWITTER VALIDATION
// ============================================

export const twitterConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Connection name is required')
    .max(100, 'Name must be 100 characters or less'),
  bearerToken: z.string().min(1, 'Bearer token is required').min(20, 'Bearer token is too short'),
})

export type TwitterConfigData = z.infer<typeof twitterConfigSchema>

export function validateTwitterConfig(data: TwitterConfigData): {
  valid: boolean
  errors: Record<string, string>
} {
  const result = twitterConfigSchema.safeParse(data)
  if (result.success) {
    return { valid: true, errors: {} }
  }
  const errors: Record<string, string> = {}
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as string
    errors[path] = issue.message
  })
  return { valid: false, errors }
}

// ============================================
// DISCORD VALIDATION
// ============================================

const discordWebhookUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/

export const discordConfigSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Connection name is required')
      .max(100, 'Name must be 100 characters or less'),
    mode: z.enum(['webhook', 'bot']),
    credential: z.string().min(1, 'Credential is required'),
    channelId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'webhook') {
      if (!discordWebhookUrlPattern.test(data.credential)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid Discord webhook URL format',
          path: ['credential'],
        })
      }
    } else if (data.mode === 'bot') {
      // Bot tokens are typically 59-72 characters
      if (data.credential.length < 50) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bot token appears too short',
          path: ['credential'],
        })
      }
      if (!data.channelId || data.channelId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Channel ID is required for bot mode',
          path: ['channelId'],
        })
      } else if (!/^\d{17,19}$/.test(data.channelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Channel ID must be a valid Discord snowflake (17-19 digits)',
          path: ['channelId'],
        })
      }
    }
  })

export type DiscordConfigData = z.infer<typeof discordConfigSchema>

export function validateDiscordConfig(data: DiscordConfigData): {
  valid: boolean
  errors: Record<string, string>
} {
  const result = discordConfigSchema.safeParse(data)
  if (result.success) {
    return { valid: true, errors: {} }
  }
  const errors: Record<string, string> = {}
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as string
    errors[path] = issue.message
  })
  return { valid: false, errors }
}

// ============================================
// TELEGRAM VALIDATION
// ============================================

// Telegram bot tokens format: 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
// More permissive pattern - just checks for digits:alphanumeric structure
const telegramBotTokenPattern = /^\d+:[A-Za-z0-9_-]+$/

export const telegramConfigSchema = z.object({
  name: z
    .string()
    .min(1, 'Connection name is required')
    .max(100, 'Name must be 100 characters or less'),
  botToken: z
    .string()
    .min(1, 'Bot token is required')
    .min(30, 'Bot token is too short')
    .refine(
      (token) => telegramBotTokenPattern.test(token),
      'Invalid bot token format. Expected format: 123456789:ABCdefGHI...'
    ),
  defaultChatId: z
    .string()
    .optional()
    .refine((chatId) => {
      if (!chatId || chatId.trim() === '') return true
      // Chat ID can be negative (groups) or positive (users), or @username
      return /^-?\d+$/.test(chatId) || /^@[A-Za-z][A-Za-z0-9_]{4,}$/.test(chatId)
    }, 'Chat ID must be a number or @username'),
})

export type TelegramConfigData = z.infer<typeof telegramConfigSchema>

export function validateTelegramConfig(data: TelegramConfigData): {
  valid: boolean
  errors: Record<string, string>
} {
  const result = telegramConfigSchema.safeParse(data)
  if (result.success) {
    return { valid: true, errors: {} }
  }
  const errors: Record<string, string> = {}
  result.error.issues.forEach((issue) => {
    const path = issue.path[0] as string
    errors[path] = issue.message
  })
  return { valid: false, errors }
}
