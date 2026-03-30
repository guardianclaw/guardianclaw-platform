'use client'

/**
 * Empty State Component
 *
 * Displayed when no connectors have been added yet.
 */

import { Twitter, MessageCircle, Send, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onAdd: () => void
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {/* Platform icons */}
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-sky-500/10 p-3">
          <Twitter className="h-6 w-6 text-sky-500" />
        </div>
        <div className="rounded-lg bg-indigo-500/10 p-3">
          <MessageCircle className="h-6 w-6 text-indigo-500" />
        </div>
        <div className="rounded-lg bg-blue-500/10 p-3">
          <Send className="h-6 w-6 text-blue-500" />
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold">No Connectors Yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Connect your social platforms to enable your agent to post to Twitter, send Discord
        messages, or message Telegram channels.
      </p>

      <Button onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add Your First Connector
      </Button>
    </div>
  )
}
