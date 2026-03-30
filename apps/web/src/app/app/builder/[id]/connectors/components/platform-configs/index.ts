/**
 * Platform Config Components
 *
 * Barrel exports for platform-specific configuration forms.
 */

export { TwitterConfig, type TwitterConfigData } from './twitter-config'
export { DiscordConfig, type DiscordConfigData } from './discord-config'
export { TelegramConfig, type TelegramConfigData } from './telegram-config'

// Validation exports
export {
  twitterConfigSchema,
  discordConfigSchema,
  telegramConfigSchema,
  validateTwitterConfig,
  validateDiscordConfig,
  validateTelegramConfig,
} from './validation'
