'use client'

/**
 * Connector List Component
 *
 * Displays a grouped list of social connectors organized by platform.
 */

import { Twitter, MessageCircle, Send } from 'lucide-react'
import type { ToolCredential } from '@/lib/api'
import { ConnectorCard } from './connector-card'

// Platform group configuration
const platformGroups: Array<{
  toolType: string
  label: string
  icon: typeof Twitter
}> = [
  { toolType: 'twitter_api', label: 'Twitter / X', icon: Twitter },
  { toolType: 'discord_bot', label: 'Discord', icon: MessageCircle },
  { toolType: 'telegram_bot', label: 'Telegram', icon: Send },
]

export interface ConnectorListProps {
  credentials: ToolCredential[]
  onTest: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  testingId: string | null
  deletingId: string | null
  testResults: Record<string, { success: boolean; message: string }>
}

export function ConnectorList({
  credentials,
  onTest,
  onDelete,
  testingId,
  deletingId,
  testResults,
}: ConnectorListProps) {
  // Group credentials by platform
  const groupedCredentials = platformGroups
    .map((group) => ({
      ...group,
      credentials: credentials.filter((c) => c.tool_type === group.toolType),
    }))
    .filter((group) => group.credentials.length > 0)

  if (groupedCredentials.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {groupedCredentials.map((group) => (
        <div key={group.toolType} className="space-y-3">
          {/* Platform header */}
          <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <group.icon className="h-4 w-4" />
            <span>{group.label}</span>
            <span className="text-xs">({group.credentials.length})</span>
          </div>

          {/* Connector cards */}
          <div className="space-y-2">
            {group.credentials.map((credential) => (
              <ConnectorCard
                key={credential.id}
                credential={credential}
                onTest={onTest}
                onDelete={onDelete}
                testing={testingId === credential.id}
                deleting={deletingId === credential.id}
                testResult={testResults[credential.id]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
