'use client'

/**
 * Discord Configuration Form
 *
 * Form for entering Discord credentials with Zod validation.
 * Supports both Webhook URL and Bot Token modes.
 */

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type DiscordConfigData, validateDiscordConfig } from './validation'

interface DiscordConfigProps {
  data: DiscordConfigData
  onChange: (data: DiscordConfigData) => void
  onValidationChange?: (valid: boolean) => void
}

export type { DiscordConfigData }

export function DiscordConfig({ data, onChange, onValidationChange }: DiscordConfigProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validate on data change
  useEffect(() => {
    const result = validateDiscordConfig(data)
    setErrors(result.errors)
    onValidationChange?.(result.valid)
  }, [data, onValidationChange])

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const showError = (field: string) => touched[field] && errors[field]

  const handleModeChange = (mode: 'webhook' | 'bot') => {
    onChange({
      ...data,
      mode,
      credential: '',
      channelId: mode === 'bot' ? '' : undefined,
    })
    setTouched({})
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="discord-name">Connection Name</Label>
        <Input
          id="discord-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          onBlur={() => handleBlur('name')}
          placeholder="My Discord Channel"
          aria-invalid={!!showError('name')}
          aria-describedby={showError('name') ? 'discord-name-error' : undefined}
        />
        {showError('name') ? (
          <p id="discord-name-error" className="text-destructive text-xs">
            {errors.name}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            A friendly name to identify this connection
          </p>
        )}
      </div>

      {/* Mode selector */}
      <div className="space-y-2">
        <Label>Connection Type</Label>
        <Select value={data.mode} onValueChange={(v) => handleModeChange(v as 'webhook' | 'bot')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="webhook">
              <div>
                <div className="font-medium">Webhook URL</div>
                <div className="text-muted-foreground text-xs">Easiest setup, channel-specific</div>
              </div>
            </SelectItem>
            <SelectItem value="bot">
              <div>
                <div className="font-medium">Bot Token</div>
                <div className="text-muted-foreground text-xs">
                  More flexible, requires bot setup
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Webhook URL mode */}
      {data.mode === 'webhook' && (
        <div className="space-y-2">
          <Label htmlFor="discord-webhook">Webhook URL</Label>
          <Input
            id="discord-webhook"
            type="password"
            value={data.credential}
            onChange={(e) => onChange({ ...data, credential: e.target.value })}
            onBlur={() => handleBlur('credential')}
            placeholder="https://discord.com/api/webhooks/..."
            aria-invalid={!!showError('credential')}
            aria-describedby={showError('credential') ? 'discord-credential-error' : undefined}
          />
          {showError('credential') ? (
            <p id="discord-credential-error" className="text-destructive text-xs">
              {errors.credential}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Right-click a channel → Edit Channel → Integrations → Webhooks
            </p>
          )}
        </div>
      )}

      {/* Bot Token mode */}
      {data.mode === 'bot' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="discord-token">Bot Token</Label>
            <Input
              id="discord-token"
              type="password"
              value={data.credential}
              onChange={(e) => onChange({ ...data, credential: e.target.value })}
              onBlur={() => handleBlur('credential')}
              placeholder="MTIzNDU2Nzg..."
              aria-invalid={!!showError('credential')}
              aria-describedby={showError('credential') ? 'discord-token-error' : undefined}
            />
            {showError('credential') ? (
              <p id="discord-token-error" className="text-destructive text-xs">
                {errors.credential}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Your Discord bot token from the Developer Portal
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="discord-channel">Channel ID</Label>
            <Input
              id="discord-channel"
              value={data.channelId || ''}
              onChange={(e) => onChange({ ...data, channelId: e.target.value })}
              onBlur={() => handleBlur('channelId')}
              placeholder="123456789012345678"
              aria-invalid={!!showError('channelId')}
              aria-describedby={showError('channelId') ? 'discord-channel-error' : undefined}
            />
            {showError('channelId') ? (
              <p id="discord-channel-error" className="text-destructive text-xs">
                {errors.channelId}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Enable Developer Mode in Discord settings, then right-click channel → Copy ID
              </p>
            )}
          </div>
        </>
      )}

      {/* Help link */}
      <div className="pt-2">
        <a
          href="https://discord.com/developers/applications"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Discord Developer Portal
        </a>
      </div>

      {/* Info box */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="mb-1 font-medium">{data.mode === 'webhook' ? 'Webhook Mode' : 'Bot Mode'}</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          {data.mode === 'webhook' ? (
            <>
              <li>Quick setup - no bot required</li>
              <li>Messages sent to a specific channel</li>
              <li>Custom username and avatar per webhook</li>
            </>
          ) : (
            <>
              <li>Requires a Discord Application with Bot</li>
              <li>Bot must be invited to server with Send Messages permission</li>
              <li>Can send to any channel the bot has access to</li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
