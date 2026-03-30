'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, X, Shield, AlertTriangle, CheckCircle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useFlowStore } from '@/stores'
import { agentsApi, Agent, API_URL } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  blocked?: boolean
  claw?: {
    input?: { passed: boolean; violations: string[] }
    output?: { passed: boolean; violations: string[] }
  }
}

interface TestSandboxProps {
  agent: Agent
  onClose?: () => void
  isDemo?: boolean
}

export function TestSandbox({ agent, onClose, isDemo = false }: TestSandboxProps) {
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || loading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      let result: { blocked: boolean; response: string; claw?: Message['claw'] }

      if (isDemo) {
        // Use demo endpoint (no auth required)
        const response = await fetch(`${API_URL}/demo/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmedInput,
            flow: { nodes, edges },
            claw_config: agent.claw_config,
          }),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        result = await response.json()
      } else {
        // Use authenticated endpoint
        const apiResult = await agentsApi.test(agent.id, trimmedInput, { flow: { nodes, edges } })
        result = {
          blocked: apiResult.blocked,
          response: apiResult.response || '',
          claw: apiResult.claw as Message['claw'],
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.blocked
          ? `[BLOCKED] ${result.response || 'Request was blocked by GuardianClaw.'}`
          : result.response || 'No response generated.',
        timestamp: new Date(),
        blocked: result.blocked,
        claw: result.claw as Message['claw'],
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      console.error('Test error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get response')

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Error: Could not get response from agent. Check console for details.',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, agent.id, agent.claw_config, nodes, edges, isDemo])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearMessages = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className="bg-background flex h-full flex-col border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="text-claw-600 h-5 w-5" />
          <h2 className="font-semibold">Test Sandbox</h2>
          <Badge variant="secondary" className="text-xs">
            {nodes.length} nodes
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            title="Clear messages"
            disabled={messages.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Shield className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">Test Your Agent</h3>
            <p className="text-muted-foreground max-w-xs text-sm">
              Send a message to test how your agent responds. GuardianClaw will validate both input
              and output.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </>
        )}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="bg-claw-100 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              <Shield className="text-claw-600 h-4 w-4" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-destructive/10 border-destructive/20 border-t px-4 py-2">
          <p className="text-destructive flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to test..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-claw-600 hover:bg-claw-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Press Enter to send. Your flow will be executed with GuardianClaw protection.
        </p>
      </div>
    </div>
  )
}

// Message bubble component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-blue-100' : isSystem ? 'bg-amber-100' : 'bg-claw-100'
        )}
      >
        {isUser ? (
          <span className="text-xs font-medium text-blue-600">You</span>
        ) : isSystem ? (
          <AlertTriangle className="h-4 w-4 text-amber-600" />
        ) : (
          <Shield className="text-claw-600 h-4 w-4" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex max-w-[80%] flex-col gap-1', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-lg px-4 py-2',
            isUser
              ? 'bg-blue-500 text-white'
              : isSystem
                ? 'border border-amber-200 bg-amber-50 text-amber-900'
                : message.blocked
                  ? 'border border-red-200 bg-red-50 text-red-900'
                  : 'bg-muted'
          )}
        >
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>

        {/* GuardianClaw info */}
        {message.claw && <GuardianClawInfo claw={message.claw} />}

        {/* Timestamp */}
        <span className="text-muted-foreground text-xs">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}

// GuardianClaw validation info
function GuardianClawInfo({ claw }: { claw: NonNullable<Message['claw']> }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {claw.input && (
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            claw.input.passed ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'
          )}
        >
          {claw.input.passed ? (
            <CheckCircle className="mr-1 h-3 w-3" />
          ) : (
            <AlertTriangle className="mr-1 h-3 w-3" />
          )}
          Input: {claw.input.passed ? 'Passed' : 'Failed'}
        </Badge>
      )}
      {claw.output && (
        <Badge
          variant="outline"
          className={cn(
            'text-xs',
            claw.output.passed ? 'border-green-200 text-green-700' : 'border-red-200 text-red-700'
          )}
        >
          {claw.output.passed ? (
            <CheckCircle className="mr-1 h-3 w-3" />
          ) : (
            <AlertTriangle className="mr-1 h-3 w-3" />
          )}
          Output: {claw.output.passed ? 'Passed' : 'Failed'}
        </Badge>
      )}
    </div>
  )
}
