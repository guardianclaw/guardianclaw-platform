'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import {
  Send,
  Webhook,
  Database,
  FileText,
  CheckCircle,
  Twitter,
  MessageCircle,
} from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { TargetHandle } from './custom-handle'

interface OutputNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const outputTypeConfig: Record<
  string,
  {
    icon: typeof Send
    title: string
    subtitle: string
    badge: string
  }
> = {
  response: {
    icon: Send,
    title: 'Response',
    subtitle: 'Send to user',
    badge: 'OUTPUT',
  },
  webhook: {
    icon: Webhook,
    title: 'Webhook Out',
    subtitle: 'Send to webhook',
    badge: 'HOOK',
  },
  store: {
    icon: Database,
    title: 'Store',
    subtitle: 'Save to storage',
    badge: 'SAVE',
  },
  // Social outputs
  twitter_post: {
    icon: Twitter,
    title: 'Twitter Post',
    subtitle: 'Post to Twitter/X',
    badge: 'TWITTER',
  },
  discord_message: {
    icon: MessageCircle,
    title: 'Discord Message',
    subtitle: 'Send to Discord',
    badge: 'DISCORD',
  },
  telegram_message: {
    icon: Send,
    title: 'Telegram Message',
    subtitle: 'Send to Telegram',
    badge: 'TELEGRAM',
  },
}

const formatLabels: Record<string, string> = {
  text: 'Plain Text',
  json: 'JSON',
  markdown: 'Markdown',
  html: 'HTML',
}

// Social output type check
const isSocialOutput = (type: string) =>
  ['twitter_post', 'discord_message', 'telegram_message'].includes(type)

// Platform-specific colors
const socialColors: Record<string, { bg: string; text: string; border: string }> = {
  twitter_post: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/20' },
  discord_message: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
  },
  telegram_message: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
}

function OutputNodeComponent({ data, selected }: OutputNodeProps) {
  const outputType = (data.outputType as string) || 'response'
  const config = outputTypeConfig[outputType] || outputTypeConfig.response
  const Icon = config.icon

  const format = data.config?.format as string | undefined
  const webhookUrl = data.config?.webhookUrl as string | undefined
  const storageKey = data.config?.storageKey as string | undefined

  // Social config
  const socialConfig = data.config?.socialConfig as
    | {
        credentialId?: string
        channelId?: string
        chatId?: string
      }
    | undefined
  const hasCredential = !!socialConfig?.credentialId

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="red"
      badge={config.badge}
      handles={<TargetHandle position={Position.Left} category="output" />}
    >
      {/* Output configuration preview */}
      <div className="space-y-2">
        {outputType === 'response' && (
          <>
            <div className="flex items-center gap-2 text-xs">
              <FileText className="h-3 w-3 text-red-500" />
              <span className="text-muted-foreground">Format:</span>
              <span className="text-foreground/90">
                {format ? formatLabels[format] || format : 'Text'}
              </span>
            </div>
            <div className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1.5">
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <CheckCircle className="h-3 w-3" />
                <span>End of flow</span>
              </div>
            </div>
          </>
        )}

        {outputType === 'webhook' && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                POST
              </span>
            </div>
            {webhookUrl && (
              <div className="text-muted-foreground bg-muted/50 truncate rounded px-2 py-1 font-mono text-xs">
                {webhookUrl}
              </div>
            )}
          </div>
        )}

        {outputType === 'store' && (
          <div className="flex items-center gap-2 text-xs">
            <Database className="h-3 w-3 text-red-500" />
            <span className="text-muted-foreground">Key:</span>
            <span className="text-foreground/90 font-mono">{storageKey || 'auto'}</span>
          </div>
        )}

        {/* Social outputs */}
        {isSocialOutput(outputType) && (
          <div className="space-y-2">
            {hasCredential ? (
              <div
                className={`${socialColors[outputType]?.bg || 'bg-muted/50'} ${socialColors[outputType]?.border || 'border-muted'} rounded border px-2 py-1.5`}
              >
                <div
                  className={`flex items-center gap-1.5 text-xs ${socialColors[outputType]?.text || 'text-muted-foreground'}`}
                >
                  <CheckCircle className="h-3 w-3" />
                  <span>Connected</span>
                </div>
              </div>
            ) : (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/10 px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <span>Setup required</span>
                </div>
              </div>
            )}

            {/* Additional config preview */}
            {outputType === 'discord_message' && socialConfig?.channelId && (
              <div className="text-muted-foreground text-xs">
                Channel: <span className="font-mono">{socialConfig.channelId}</span>
              </div>
            )}
            {outputType === 'telegram_message' && socialConfig?.chatId && (
              <div className="text-muted-foreground text-xs">
                Chat: <span className="font-mono">{socialConfig.chatId}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const OutputNode = memo(OutputNodeComponent)
