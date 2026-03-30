'use client'

/**
 * Telegram Configuration Form
 *
 * Form for entering Telegram Bot credentials with Zod validation.
 */

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type TelegramConfigData, validateTelegramConfig } from './validation'

interface TelegramConfigProps {
  data: TelegramConfigData
  onChange: (data: TelegramConfigData) => void
  onValidationChange?: (valid: boolean) => void
}

export type { TelegramConfigData }

export function TelegramConfig({ data, onChange, onValidationChange }: TelegramConfigProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validate on data change
  useEffect(() => {
    const result = validateTelegramConfig(data)
    setErrors(result.errors)
    onValidationChange?.(result.valid)
  }, [data, onValidationChange])

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const showError = (field: string) => touched[field] && errors[field]

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="telegram-name">Connection Name</Label>
        <Input
          id="telegram-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          onBlur={() => handleBlur('name')}
          placeholder="My Telegram Bot"
          aria-invalid={!!showError('name')}
          aria-describedby={showError('name') ? 'telegram-name-error' : undefined}
        />
        {showError('name') ? (
          <p id="telegram-name-error" className="text-destructive text-xs">
            {errors.name}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            A friendly name to identify this connection
          </p>
        )}
      </div>

      {/* Bot Token */}
      <div className="space-y-2">
        <Label htmlFor="telegram-token">Bot Token</Label>
        <Input
          id="telegram-token"
          type="password"
          value={data.botToken}
          onChange={(e) => onChange({ ...data, botToken: e.target.value })}
          onBlur={() => handleBlur('botToken')}
          placeholder="123456789:ABC..."
          aria-invalid={!!showError('botToken')}
          aria-describedby={showError('botToken') ? 'telegram-token-error' : undefined}
        />
        {showError('botToken') ? (
          <p id="telegram-token-error" className="text-destructive text-xs">
            {errors.botToken}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Token from @BotFather when you created your bot
          </p>
        )}
      </div>

      {/* Default Chat ID (optional) */}
      <div className="space-y-2">
        <Label htmlFor="telegram-chat">Default Chat ID (Optional)</Label>
        <Input
          id="telegram-chat"
          value={data.defaultChatId || ''}
          onChange={(e) => onChange({ ...data, defaultChatId: e.target.value })}
          onBlur={() => handleBlur('defaultChatId')}
          placeholder="-1001234567890 or @channelname"
          aria-invalid={!!showError('defaultChatId')}
          aria-describedby={showError('defaultChatId') ? 'telegram-chat-error' : undefined}
        />
        {showError('defaultChatId') ? (
          <p id="telegram-chat-error" className="text-destructive text-xs">
            {errors.defaultChatId}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            User ID, group ID, or @channel username. Can be overridden per output node.
          </p>
        )}
      </div>

      {/* Help link */}
      <div className="pt-2">
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Create bot with @BotFather
        </a>
      </div>

      {/* Info box */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="mb-1 font-medium">Getting Started</p>
        <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-xs">
          <li>Message @BotFather with /newbot</li>
          <li>Follow prompts to name your bot</li>
          <li>Copy the bot token provided</li>
          <li>Add the bot to your group or channel</li>
        </ol>
      </div>

      {/* Chat ID help */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="mb-1 font-medium">Finding Chat ID</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>For groups: Add @userinfobot to the group and it will show the ID</li>
          <li>For channels: Use @username format or forward a message to @userinfobot</li>
          <li>Group IDs are negative numbers (e.g., -1001234567890)</li>
        </ul>
      </div>
    </div>
  )
}
