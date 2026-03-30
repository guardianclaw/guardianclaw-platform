'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react'
import { toolCredentialsApi, type ToolCredential } from '@/lib/api'
import type { PropertyComponentProps } from '../properties-panel'

const outputTypes = [
  { value: 'response', label: 'Response', description: 'Return to caller' },
  { value: 'webhook', label: 'Webhook', description: 'Send to external URL' },
  { value: 'store', label: 'Store', description: 'Save to storage' },
]

const socialOutputTypes = [
  { value: 'twitter_post', label: 'Twitter Post', description: 'Post to Twitter/X' },
  { value: 'discord_message', label: 'Discord Message', description: 'Send to Discord channel' },
  { value: 'telegram_message', label: 'Telegram Message', description: 'Send to Telegram chat' },
]

const formats = [
  { value: 'text', label: 'Plain Text' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
]

const parseModes = [
  { value: 'HTML', label: 'HTML' },
  { value: 'Markdown', label: 'Markdown' },
  { value: 'MarkdownV2', label: 'Markdown V2' },
]

// Check if output type is social
const isSocialOutput = (type: string) =>
  ['twitter_post', 'discord_message', 'telegram_message'].includes(type)

// Map output type to tool_type for credential filtering
const outputTypeToToolType: Record<string, string> = {
  twitter_post: 'twitter_api',
  discord_message: 'discord_bot',
  telegram_message: 'telegram_bot',
}

export function OutputProperties({ data, onChange }: PropertyComponentProps) {
  // Get agent ID from URL params for connector link
  const params = useParams()
  const agentId = params?.id as string | undefined
  const connectorsHref = agentId ? `/app/builder/${agentId}/connectors` : '/app/builder'

  // Credential loading state
  const [credentials, setCredentials] = useState<ToolCredential[]>([])
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const config = (data.config as Record<string, unknown>) || {}
  const outputType = (data.outputType as string) || 'response'
  const socialConfig = (config.socialConfig as Record<string, unknown>) || {}

  // Load credentials when output type changes to social
  useEffect(() => {
    if (!isSocialOutput(outputType)) {
      setCredentials([])
      return
    }

    const toolType = outputTypeToToolType[outputType]
    if (!toolType) return

    setLoadingCredentials(true)
    setCredentialsError(null)

    toolCredentialsApi
      .list({ tool_type: toolType })
      .then((response) => {
        setCredentials(response.credentials || [])
      })
      .catch((err) => {
        setCredentialsError(err.message || 'Failed to load credentials')
        setCredentials([])
      })
      .finally(() => {
        setLoadingCredentials(false)
      })
  }, [outputType])

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  const handleSocialConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: {
        ...config,
        socialConfig: { ...socialConfig, [key]: value },
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Output Type */}
      <div className="space-y-2">
        <Label>Output Type</Label>
        <Select value={outputType} onValueChange={(v) => onChange({ ...data, outputType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Standard outputs */}
            {outputTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-muted-foreground text-xs">{type.description}</div>
                </div>
              </SelectItem>
            ))}

            {/* Divider */}
            <div className="my-1 border-t px-2 py-1.5">
              <span className="text-muted-foreground text-xs uppercase">Social</span>
            </div>

            {/* Social outputs */}
            {socialOutputTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-muted-foreground text-xs">{type.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Response properties */}
      {outputType === 'response' && (
        <div className="space-y-2">
          <Label>Response Format</Label>
          <Select
            value={(config.format as string) || 'text'}
            onValueChange={(v) => handleConfigChange('format', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {formats.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Webhook properties */}
      {outputType === 'webhook' && (
        <>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value={(config.webhookUrl as string) || ''}
              onChange={(e) => handleConfigChange('webhookUrl', e.target.value)}
              placeholder="https://webhook.example.com/..."
            />
          </div>

          <div className="space-y-2">
            <Label>HTTP Method</Label>
            <Select
              value={(config.method as string) || 'POST'}
              onValueChange={(v) => handleConfigChange('method', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Response Format</Label>
            <Select
              value={(config.format as string) || 'json'}
              onValueChange={(v) => handleConfigChange('format', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Store properties */}
      {outputType === 'store' && (
        <>
          <div className="space-y-2">
            <Label>Storage Key</Label>
            <Input
              value={(config.storeKey as string) || ''}
              onChange={(e) => handleConfigChange('storeKey', e.target.value)}
              placeholder="result_{{timestamp}}"
            />
            <p className="text-muted-foreground text-xs">
              Use {'{{timestamp}}'} or {'{{uuid}}'} for dynamic keys
            </p>
          </div>

          <div className="space-y-2">
            <Label>Storage Type</Label>
            <Select
              value={(config.storageType as string) || 'memory'}
              onValueChange={(v) => handleConfigChange('storageType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="memory">Memory (Session)</SelectItem>
                <SelectItem value="persistent">Persistent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Social Output Properties */}
      {isSocialOutput(outputType) && (
        <div className="space-y-4 border-t pt-2">
          {/* Credential selection info */}
          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
              <div className="text-sm">
                <p className="font-medium">Credential Required</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Add your{' '}
                  {outputType === 'twitter_post'
                    ? 'Twitter'
                    : outputType === 'discord_message'
                      ? 'Discord'
                      : 'Telegram'}{' '}
                  credentials in Settings to enable this output.
                </p>
              </div>
            </div>
            <a
              href={connectorsHref}
              className="text-primary flex items-center gap-1 text-xs hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Manage Credentials
            </a>
          </div>

          {/* Credential Selection */}
          <div className="space-y-2">
            <Label>Credential</Label>
            {loadingCredentials ? (
              <div className="text-muted-foreground flex items-center gap-2 py-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading credentials...</span>
              </div>
            ) : credentialsError ? (
              <div className="flex items-center gap-2 py-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{credentialsError}</span>
              </div>
            ) : credentials.length === 0 ? (
              <div className="space-y-2 rounded border border-yellow-500/20 bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  No credentials found for this platform.
                </p>
                <a
                  href={connectorsHref}
                  className="text-primary flex items-center gap-1 text-xs hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Add Credentials
                </a>
              </div>
            ) : (
              <Select
                value={(socialConfig.credentialId as string) || ''}
                onValueChange={(v) => handleSocialConfigChange('credentialId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a credential" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id}>
                      <div className="flex items-center gap-2">
                        <span>{cred.name}</span>
                        {cred.is_active && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(socialConfig.credentialId as string) && credentials.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Using:{' '}
                {credentials.find((c) => c.id === socialConfig.credentialId)?.name || 'Unknown'}
              </p>
            )}
          </div>

          {/* Auto-send toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-send</Label>
              <p className="text-muted-foreground text-xs">Send immediately without confirmation</p>
            </div>
            <Switch
              checked={(socialConfig.autoSend as boolean) || false}
              onCheckedChange={(v) => handleSocialConfigChange('autoSend', v)}
            />
          </div>

          {!socialConfig.autoSend && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Deliveries will be held as drafts until approved.
            </p>
          )}

          {/* Twitter-specific options */}
          {outputType === 'twitter_post' && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Posts will be truncated to 280 characters.
              </p>
            </div>
          )}

          {/* Discord-specific options */}
          {outputType === 'discord_message' && (
            <>
              <div className="space-y-2">
                <Label>Channel ID</Label>
                <Input
                  value={(socialConfig.channelId as string) || ''}
                  onChange={(e) => handleSocialConfigChange('channelId', e.target.value)}
                  placeholder="123456789012345678"
                />
                <p className="text-muted-foreground text-xs">
                  Required for bot tokens. Not needed for webhooks.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Embed</Label>
                  <p className="text-muted-foreground text-xs">Format message as Discord embed</p>
                </div>
                <Switch
                  checked={(socialConfig.embedFormat as boolean) || false}
                  onCheckedChange={(v) => handleSocialConfigChange('embedFormat', v)}
                />
              </div>
            </>
          )}

          {/* Telegram-specific options */}
          {outputType === 'telegram_message' && (
            <>
              <div className="space-y-2">
                <Label>Chat ID</Label>
                <Input
                  value={(socialConfig.chatId as string) || ''}
                  onChange={(e) => handleSocialConfigChange('chatId', e.target.value)}
                  placeholder="-1001234567890 or @channelname"
                />
                <p className="text-muted-foreground text-xs">
                  User ID, group ID, or @channel username
                </p>
              </div>

              <div className="space-y-2">
                <Label>Parse Mode</Label>
                <Select
                  value={(socialConfig.parseMode as string) || 'HTML'}
                  onValueChange={(v) => handleSocialConfigChange('parseMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parseModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Silent</Label>
                  <p className="text-muted-foreground text-xs">Send without notification</p>
                </div>
                <Switch
                  checked={(socialConfig.disableNotification as boolean) || false}
                  onCheckedChange={(v) => handleSocialConfigChange('disableNotification', v)}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
