'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { User, Bot, Shield, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TypewriterText } from './TypewriterText'
import type { DemoChatProps, DemoMessage, DemoTheme, DemoChatHeaderConfig } from './types'

/**
 * Theme color mappings for chat components
 * Note: All classes must be static strings for Tailwind tree-shaking
 */
const chatThemeColors: Record<
  DemoTheme,
  {
    headerIcon: string
    iconText: string
    userBubble: string
    agentBubble: string
    systemBubble: string
  }
> = {
  purple: {
    headerIcon: 'bg-purple-500/20',
    iconText: 'text-purple-500',
    userBubble: 'bg-purple-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  violet: {
    headerIcon: 'bg-violet-500/20',
    iconText: 'text-violet-500',
    userBubble: 'bg-violet-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  amber: {
    headerIcon: 'bg-amber-500/20',
    iconText: 'text-amber-500',
    userBubble: 'bg-claw-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  teal: {
    headerIcon: 'bg-teal-500/20',
    iconText: 'text-teal-500',
    userBubble: 'bg-teal-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  orange: {
    headerIcon: 'bg-orange-500/20',
    iconText: 'text-orange-500',
    userBubble: 'bg-orange-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  blue: {
    headerIcon: 'bg-blue-500/20',
    iconText: 'text-blue-500',
    userBubble: 'bg-blue-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  green: {
    headerIcon: 'bg-green-500/20',
    iconText: 'text-green-500',
    userBubble: 'bg-green-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  red: {
    headerIcon: 'bg-red-500/20',
    iconText: 'text-red-500',
    userBubble: 'bg-red-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
  claw: {
    headerIcon: 'bg-claw-500/20',
    iconText: 'text-claw-500',
    userBubble: 'bg-claw-600 text-white',
    agentBubble: 'bg-zinc-800 text-zinc-100',
    systemBubble: 'bg-zinc-900 text-zinc-400',
  },
}

/**
 * Status indicator colors
 */
const statusColors = {
  ready: 'bg-green-500',
  online: 'bg-green-500',
  processing: 'bg-amber-500',
  error: 'bg-red-500',
}

/**
 * Status labels
 */
const statusLabels = {
  ready: 'Ready',
  online: 'Online',
  processing: 'Processing',
  error: 'Error',
}

/**
 * DemoChat - Chat interface for demo components
 *
 * A full-featured chat interface with header, message list, and
 * support for different message types (user, agent, system).
 *
 * @example
 * ```tsx
 * <DemoChat
 *   header={{
 *     icon: Wallet,
 *     title: "Crypto Agent",
 *     subtitle: "Powered by GuardianClaw",
 *     status: "ready",
 *     theme: "amber"
 *   }}
 *   messages={messages}
 *   isIdle={phase === 'idle'}
 *   showThinking={phase === 'thinking'}
 * />
 * ```
 */
export function DemoChat({
  header,
  messages,
  isIdle = false,
  idleMessage = 'Press Play to start the demo',
  showThinking = false,
  thinkingMessage = 'Agent is processing...',
  thinkingContent,
  messagesHeight = 320,
  autoExpand = true,
  renderAgentIcon,
  className,
}: DemoChatProps) {
  const theme = header.theme
  const colors = chatThemeColors[theme]

  return (
    <div
      className={cn('overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950', className)}
    >
      {/* Chat Header */}
      <DemoChatHeader header={header} />

      {/* Messages Area - grows with content when autoExpand is true */}
      <div
        className={cn('space-y-4 p-4', !autoExpand && 'overflow-y-auto')}
        style={autoExpand ? { minHeight: messagesHeight } : { height: messagesHeight }}
      >
        {/* Idle state */}
        {isIdle && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            {idleMessage}
          </div>
        )}

        {/* Message List */}
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <DemoChatMessage
              key={message.id}
              message={message}
              theme={theme}
              renderAgentIcon={renderAgentIcon}
            />
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        {showThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-zinc-500"
          >
            {thinkingContent ? (
              thinkingContent
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {thinkingMessage}
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

/**
 * DemoChatHeader - Header section of the chat interface
 */
export function DemoChatHeader({ header }: { header: DemoChatHeaderConfig }) {
  const Icon = header.icon
  const status = header.status || 'ready'
  const colors = chatThemeColors[header.theme]

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
      {/* Icon */}
      <div
        className={cn('flex h-8 w-8 items-center justify-center rounded-full', colors.headerIcon)}
      >
        <Icon className={cn('h-4 w-4', colors.iconText)} />
      </div>

      {/* Title & Subtitle */}
      <div>
        <p className="text-sm font-medium text-zinc-100">{header.title}</p>
        <p className="text-xs text-zinc-500">{header.subtitle}</p>
      </div>

      {/* Status */}
      <div className="ml-auto flex items-center gap-1">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            statusColors[status],
            status === 'processing' && 'animate-pulse'
          )}
        />
        <span className="text-xs text-zinc-500">{statusLabels[status]}</span>
      </div>
    </div>
  )
}

/**
 * DemoChatMessage - Individual message in the chat
 */
export function DemoChatMessage({
  message,
  theme,
  renderAgentIcon,
}: {
  message: DemoMessage
  theme: DemoTheme
  renderAgentIcon?: (iconType: string) => React.ReactNode
}) {
  const colors = chatThemeColors[theme]
  const isUser = message.type === 'user'

  // Determine bubble style
  const getBubbleStyle = () => {
    switch (message.type) {
      case 'user':
        return colors.userBubble
      case 'agent':
        return colors.agentBubble
      case 'crew':
        return colors.agentBubble
      case 'system':
        return cn(colors.systemBubble, 'text-sm italic')
      default:
        return colors.agentBubble
    }
  }

  // Determine typing speed based on message type
  const getTypingSpeed = () => {
    switch (message.type) {
      case 'user':
        return 25
      case 'agent':
      case 'crew':
        return 12
      case 'system':
        return 15
      default:
        return 15
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn('flex gap-3', isUser && 'justify-end')}
    >
      {/* Left avatar (non-user messages) */}
      {!isUser && (
        <MessageAvatar
          type={message.type}
          agentIcon={message.agentIcon}
          theme={theme}
          renderAgentIcon={renderAgentIcon}
        />
      )}

      {/* Message content */}
      <div className="max-w-[85%]">
        {/* Agent name label */}
        {message.type === 'agent' && message.agentName && (
          <p className="mb-1 text-xs font-medium text-blue-400">{message.agentName}</p>
        )}

        {/* Bubble */}
        <div className={cn('rounded-2xl px-4 py-2', getBubbleStyle())}>
          {message.status === 'typing' ? (
            <TypewriterText text={message.content} speed={getTypingSpeed()} />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
      </div>

      {/* Right avatar (user messages) */}
      {isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-700">
          <User className="h-4 w-4 text-zinc-300" />
        </div>
      )}
    </motion.div>
  )
}

/**
 * MessageAvatar - Avatar for non-user messages
 */
function MessageAvatar({
  type,
  agentIcon,
  theme,
  renderAgentIcon,
}: {
  type: string
  agentIcon?: string
  theme: DemoTheme
  renderAgentIcon?: (iconType: string) => React.ReactNode
}) {
  const colors = chatThemeColors[theme]

  // Determine icon and background
  const getAvatarContent = () => {
    switch (type) {
      case 'agent':
        if (agentIcon && renderAgentIcon) {
          return {
            bg: 'bg-blue-500/20',
            icon: renderAgentIcon(agentIcon),
          }
        }
        return {
          bg: colors.headerIcon,
          icon: <Bot className={cn('h-4 w-4', colors.iconText)} />,
        }
      case 'crew':
        return {
          bg: colors.headerIcon,
          icon: <Bot className={cn('h-4 w-4', colors.iconText)} />,
        }
      case 'system':
        return {
          bg: 'bg-claw-500/20',
          icon: <Shield className="text-claw-500 h-4 w-4" />,
        }
      default:
        return {
          bg: colors.headerIcon,
          icon: <Bot className={cn('h-4 w-4', colors.iconText)} />,
        }
    }
  }

  const { bg, icon } = getAvatarContent()

  return (
    <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', bg)}>
      {icon}
    </div>
  )
}

/**
 * DemoChatCompact - A more compact version of the chat
 *
 * For demos that need a smaller chat interface.
 */
export function DemoChatCompact({
  messages,
  theme = 'purple',
  minHeight = 256,
  autoExpand = true,
  className,
}: {
  messages: DemoMessage[]
  theme?: DemoTheme
  minHeight?: number
  autoExpand?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3',
        !autoExpand && 'overflow-y-auto',
        className
      )}
      style={autoExpand ? { minHeight } : { maxHeight: minHeight }}
    >
      <AnimatePresence mode="popLayout">
        {messages.map((message) => (
          <DemoChatMessage key={message.id} message={message} theme={theme} />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default DemoChat
