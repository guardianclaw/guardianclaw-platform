'use client'

import { Loader2, Plus, History, Trash2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Conversation, MemoryStrategy } from '@/lib/api'

export interface MemoryStrategyOption {
  value: MemoryStrategy
  label: string
  description: string
}

/**
 * Available memory strategies for conversation context.
 *
 * Note on 'summary' strategy:
 * This feature is partially implemented. It currently falls back to
 * sliding_window behavior. Full implementation requires:
 * 1. LLM call to generate summaries of older messages
 * 2. Token counting to determine when to summarize
 * 3. Storage of summaries in conversation_context table
 *
 * For now, use 'sliding_window' or 'full' for production.
 */
export const MEMORY_STRATEGIES: MemoryStrategyOption[] = [
  {
    value: 'sliding_window',
    label: 'Sliding Window',
    description: 'Last N messages (recommended)',
  },
  { value: 'full', label: 'Full History', description: 'All messages (up to 1000)' },
  { value: 'summary', label: 'Summary', description: 'Falls back to sliding window (WIP)' },
  { value: 'none', label: 'No Memory', description: 'Each message is independent' },
]

interface ConversationPanelProps {
  conversations: Conversation[]
  activeConversation: Conversation | null
  conversationMode: 'sandbox' | 'persistent'
  memoryStrategy: MemoryStrategy
  loadingConversations: boolean
  onCreateNew: () => void
  onSelectConversation: (conv: Conversation) => void
  onArchiveConversation: (id: string) => void
  onSwitchToSandbox: () => void
  onMemoryStrategyChange: (value: MemoryStrategy) => void
}

export function ConversationPanel({
  conversations,
  activeConversation,
  conversationMode,
  memoryStrategy,
  loadingConversations,
  onCreateNew,
  onSelectConversation,
  onArchiveConversation,
  onSwitchToSandbox,
  onMemoryStrategyChange,
}: ConversationPanelProps) {
  return (
    <div className="bg-background flex w-64 flex-col border-r">
      <div className="border-b p-3">
        <h3 className="text-sm font-medium">Conversations</h3>
      </div>

      <div className="p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4" />
          New Conversation
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'mt-1 w-full justify-start gap-2',
            conversationMode === 'sandbox' && 'bg-muted'
          )}
          onClick={onSwitchToSandbox}
        >
          <MessageSquare className="h-4 w-4" />
          Sandbox Mode
        </Button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {loadingConversations ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                'hover:bg-muted group flex cursor-pointer items-center gap-2 rounded-md p-2',
                activeConversation?.id === conv.id && 'bg-muted'
              )}
              onClick={() => onSelectConversation(conv)}
            >
              <History className="text-muted-foreground h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{conv.title || 'Untitled'}</p>
                <p className="text-muted-foreground text-xs">{conv.message_count} messages</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="pointer-events-auto h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onArchiveConversation(conv.id)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Memory Strategy Selector */}
      <div className="border-t p-3">
        <label className="text-muted-foreground mb-1 block text-xs">Memory Strategy</label>
        <Select
          value={memoryStrategy}
          onValueChange={(v) => onMemoryStrategyChange(v as MemoryStrategy)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEMORY_STRATEGIES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <div>
                  <div className="font-medium">{s.label}</div>
                  <div className="text-muted-foreground text-xs">{s.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
