'use client'

import { forwardRef } from 'react'
import { Shield, X, Clock, AlertCircle, Bot, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  claw?: {
    input?: { passed: boolean; violations: string[] }
    output?: { passed: boolean; violations: string[] }
  }
  blocked?: boolean
  blocked_reason?: string
  latency_ms?: number
  gate?: string
}

interface MessageListProps {
  messages: Message[]
  conversationMode: 'sandbox' | 'persistent'
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList(
  { messages, conversationMode },
  ref
) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <Bot className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">Test Your Agent</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            {conversationMode === 'sandbox'
              ? 'Messages in sandbox mode are not persisted. Create a conversation to save history.'
              : 'Messages will be saved to this conversation and used as context for future responses.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
      <div ref={ref} />
    </>
  )
})

interface MessageItemProps {
  message: Message
}

function MessageItem({ message }: MessageItemProps) {
  return (
    <div
      className={cn(
        'flex max-w-3xl gap-3',
        message.role === 'user' ? 'ml-auto flex-row-reverse' : ''
      )}
    >
      <MessageAvatar role={message.role} />
      <MessageContent message={message} />
    </div>
  )
}

function MessageAvatar({ role }: { role: Message['role'] }) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        role === 'user' ? 'bg-blue-500' : role === 'assistant' ? 'bg-claw-500' : 'bg-yellow-500'
      )}
    >
      {role === 'user' ? (
        <User className="h-4 w-4 text-white" />
      ) : role === 'assistant' ? (
        <Bot className="h-4 w-4 text-white" />
      ) : (
        <AlertCircle className="h-4 w-4 text-white" />
      )}
    </div>
  )
}

function MessageContent({ message }: { message: Message }) {
  return (
    <div
      className={cn(
        'max-w-[80%] rounded-lg px-4 py-3',
        message.role === 'user'
          ? 'bg-blue-500 text-white'
          : message.role === 'system'
            ? 'border border-yellow-500/20 bg-yellow-500/10'
            : 'bg-muted'
      )}
    >
      <p className="whitespace-pre-wrap text-sm">{message.content}</p>

      {message.claw && <GuardianClawInfo message={message} />}
    </div>
  )
}

function GuardianClawInfo({ message }: { message: Message }) {
  return (
    <div className="border-foreground/10 mt-2 border-t pt-2">
      <div className="flex items-center gap-2 text-xs">
        <Shield className={cn('h-3 w-3', message.blocked ? 'text-red-500' : 'text-green-500')} />
        <span className={message.blocked ? 'text-red-500' : 'text-green-500'}>
          {message.blocked ? 'Blocked' : 'Passed'}
        </span>
        {message.latency_ms && (
          <>
            <span className="text-muted-foreground">|</span>
            <Clock className="text-muted-foreground h-3 w-3" />
            <span className="text-muted-foreground">{message.latency_ms}ms</span>
          </>
        )}
      </div>

      {message.claw?.input?.violations && message.claw.input.violations.length > 0 && (
        <ViolationBadges violations={message.claw.input.violations} prefix="in" />
      )}
      {message.claw?.output?.violations && message.claw.output.violations.length > 0 && (
        <ViolationBadges violations={message.claw.output.violations} prefix="out" />
      )}

      {message.blocked_reason && (
        <p className="mt-1 text-xs text-red-400">Reason: {message.blocked_reason}</p>
      )}
    </div>
  )
}

function ViolationBadges({ violations, prefix }: { violations: string[]; prefix: string }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {violations.map((violation, i) => (
        <Badge
          key={`${prefix}-${i}`}
          variant="secondary"
          className="bg-red-500/20 text-[10px] text-red-500"
        >
          <X className="mr-1 h-2 w-2" />
          {violation}
        </Badge>
      ))}
    </div>
  )
}
