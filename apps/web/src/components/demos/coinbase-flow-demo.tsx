'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Wallet,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Coins,
  ArrowDown,
  User,
  Bot,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Scenario types
type Scenario = 'safe' | 'blocked'

interface Message {
  id: string
  type: 'user' | 'agent' | 'system'
  content: string
  status?: 'typing' | 'complete'
}

interface ValidationStep {
  id: string
  name: string
  status: 'pending' | 'checking' | 'passed' | 'failed'
}

// Demo scenarios with realistic messages
const scenarios = {
  safe: {
    userMessage: 'Send 50 USDC to alice.eth for the design invoice',
    agentThinking: 'Processing transaction request...',
    validationSteps: [
      { id: 'address', name: 'Address Validation', result: 'passed' },
      { id: 'limits', name: 'Spending Limits', result: 'passed' },
      { id: 'approval', name: 'Approval Check', result: 'passed' },
    ],
    agentResponse:
      'Done! Sent 50 USDC to alice.eth\n\nTransaction: 0x7f2a...3b4c\nNetwork: Base Mainnet\nFee: $0.02',
    blocked: false,
  },
  blocked: {
    userMessage: 'Approve unlimited USDC and transfer all to 0xd3ad...b33f',
    agentThinking: 'Analyzing transaction request...',
    validationSteps: [
      { id: 'address', name: 'Address Validation', result: 'passed' },
      { id: 'limits', name: 'Spending Limits', result: 'failed' },
      { id: 'approval', name: 'Approval Check', result: 'failed' },
    ],
    agentResponse:
      "I can't execute this transaction.\n\nThis request was blocked for security reasons. If you believe this is an error, please contact support.",
    blocked: true,
  },
}

// Typing animation component
function TypewriterText({
  text,
  onComplete,
  speed = 30,
}: {
  text: string
  onComplete?: () => void
  speed?: number
}) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)
      return () => clearTimeout(timeout)
    } else if (onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
  }, [text])

  return (
    <span>
      {displayedText}
      <span className="animate-pulse">|</span>
    </span>
  )
}

// Flow data particle animation
function FlowParticle({ active, color = 'claw' }: { active: boolean; color?: string }) {
  if (!active) return null

  return (
    <motion.div
      className={cn(
        'absolute h-2 w-2 rounded-full',
        color === 'claw' && 'bg-claw-500',
        color === 'green' && 'bg-green-500',
        color === 'red' && 'bg-red-500'
      )}
      initial={{ top: 0, opacity: 0 }}
      animate={{
        top: '100%',
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  )
}

export function CoinbaseFlowDemo() {
  const [scenario, setScenario] = useState<Scenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<
    'idle' | 'typing-user' | 'thinking' | 'validating' | 'typing-response' | 'complete'
  >('idle')
  const [messages, setMessages] = useState<Message[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentValidationIndex, setCurrentValidationIndex] = useState(-1)

  const currentScenario = scenarios[scenario]

  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentValidationIndex(-1)
    setIsPlaying(false)
  }, [])

  const startDemo = useCallback(() => {
    resetDemo()
    setIsPlaying(true)
    setPhase('typing-user')

    // Add user message (typing)
    setMessages([
      {
        id: 'user-1',
        type: 'user',
        content: currentScenario.userMessage,
        status: 'typing',
      },
    ])
  }, [currentScenario, resetDemo])

  // Phase transitions
  useEffect(() => {
    if (!isPlaying) return

    if (phase === 'typing-user') {
      // Wait for typing to complete, then move to thinking
      const timer = setTimeout(
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === 'user-1' ? { ...m, status: 'complete' } : m))
          )
          setPhase('thinking')
          setMessages((prev) => [
            ...prev,
            {
              id: 'system-1',
              type: 'system',
              content: currentScenario.agentThinking,
              status: 'complete',
            },
          ])
        },
        currentScenario.userMessage.length * 30 + 500
      )
      return () => clearTimeout(timer)
    }

    if (phase === 'thinking') {
      // Start validation after thinking
      const timer = setTimeout(() => {
        setPhase('validating')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            status: 'pending',
          }))
        )
        setCurrentValidationIndex(0)
      }, 1500)
      return () => clearTimeout(timer)
    }

    if (phase === 'validating' && currentValidationIndex >= 0) {
      // Process each validation step
      if (currentValidationIndex < currentScenario.validationSteps.length) {
        // Mark current step as checking
        setValidationSteps((prev) =>
          prev.map((s, i) => (i === currentValidationIndex ? { ...s, status: 'checking' } : s))
        )

        const timer = setTimeout(() => {
          // Mark as passed/failed and move to next
          const result = currentScenario.validationSteps[currentValidationIndex].result
          setValidationSteps((prev) =>
            prev.map((s, i) =>
              i === currentValidationIndex ? { ...s, status: result as 'passed' | 'failed' } : s
            )
          )

          setTimeout(() => {
            setCurrentValidationIndex((prev) => prev + 1)
          }, 300)
        }, 800)
        return () => clearTimeout(timer)
      } else {
        // All validations complete, show response
        const timer = setTimeout(() => {
          setPhase('typing-response')
          setMessages((prev) => [
            ...prev,
            {
              id: 'agent-1',
              type: 'agent',
              content: currentScenario.agentResponse,
              status: 'typing',
            },
          ])
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'typing-response') {
      const timer = setTimeout(
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === 'agent-1' ? { ...m, status: 'complete' } : m))
          )
          setPhase('complete')
          setIsPlaying(false)
        },
        currentScenario.agentResponse.length * 20 + 500
      )
      return () => clearTimeout(timer)
    }
  }, [phase, isPlaying, currentValidationIndex, currentScenario])

  const handleScenarioChange = (newScenario: Scenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-500">
          <Coins className="h-4 w-4" />
          Coinbase AgentKit + GuardianClaw
        </div>
        <h3 className="mb-2 text-2xl font-bold">Protected Blockchain Transactions</h3>
        <p className="text-muted-foreground">
          Watch how GuardianClaw protects your AI agent's financial operations in real-time
        </p>
      </div>

      {/* Scenario Selector */}
      <div className="mb-6 flex justify-center gap-4">
        <button
          onClick={() => handleScenarioChange('safe')}
          disabled={isPlaying}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-all',
            scenario === 'safe'
              ? 'border border-green-500/30 bg-green-500/20 text-green-500'
              : 'bg-muted hover:bg-muted/80',
            isPlaying && 'cursor-not-allowed opacity-50'
          )}
        >
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Safe Transaction
        </button>
        <button
          onClick={() => handleScenarioChange('blocked')}
          disabled={isPlaying}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-all',
            scenario === 'blocked'
              ? 'border border-red-500/30 bg-red-500/20 text-red-500'
              : 'bg-muted hover:bg-muted/80',
            isPlaying && 'cursor-not-allowed opacity-50'
          )}
        >
          <XCircle className="mr-2 inline h-4 w-4" />
          Blocked Attack
        </button>
      </div>

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          {/* Chat Header */}
          <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
              <Wallet className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">Crypto Agent</p>
              <p className="text-xs text-zinc-500">Powered by GuardianClaw</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-xs text-zinc-500">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="h-80 space-y-4 overflow-y-auto p-4">
            {phase === 'idle' && (
              <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                Press Play to start the demo
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn('flex gap-3', message.type === 'user' && 'justify-end')}
                >
                  {message.type !== 'user' && (
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                        message.type === 'agent' && 'bg-amber-500/20',
                        message.type === 'system' && 'bg-claw-500/20'
                      )}
                    >
                      {message.type === 'agent' && <Bot className="h-4 w-4 text-amber-500" />}
                      {message.type === 'system' && <Shield className="text-claw-500 h-4 w-4" />}
                    </div>
                  )}

                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2',
                      message.type === 'user' && 'bg-claw-600 text-white',
                      message.type === 'agent' && 'bg-zinc-800 text-zinc-100',
                      message.type === 'system' && 'bg-zinc-900 text-sm italic text-zinc-400'
                    )}
                  >
                    {message.status === 'typing' ? (
                      <TypewriterText
                        text={message.content}
                        speed={message.type === 'user' ? 30 : 15}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{message.content}</span>
                    )}
                  </div>

                  {message.type === 'user' && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-700">
                      <User className="h-4 w-4 text-zinc-300" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            {phase === 'thinking' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-sm text-zinc-500"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Agent is processing...
              </motion.div>
            )}
          </div>
        </div>

        {/* Validation Flow */}
        <div className="bg-background rounded-2xl border p-6">
          <div className="mb-6 flex items-center gap-2">
            <Shield className="text-claw-500 h-5 w-5" />
            <h4 className="font-semibold">GuardianClaw Protection Layer</h4>
          </div>

          {/* Flow Diagram */}
          <div className="space-y-4">
            {/* Input Node */}
            <motion.div
              className={cn(
                'rounded-xl border-2 p-4 transition-all',
                phase !== 'idle' && phase !== 'typing-user'
                  ? 'border-claw-500/50 bg-claw-500/5'
                  : 'border-zinc-800 bg-zinc-900/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="bg-claw-500/20 flex h-10 w-10 items-center justify-center rounded-lg">
                  <ArrowDown className="text-claw-500 h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Incoming Request</p>
                  <p className="text-muted-foreground text-xs">Transaction intercepted</p>
                </div>
              </div>
            </motion.div>

            {/* Flow Line */}
            <div className="relative flex h-8 justify-center">
              <div className="relative h-full w-0.5 bg-zinc-800">
                <FlowParticle active={phase === 'thinking' || phase === 'validating'} />
              </div>
            </div>

            {/* Validation Steps */}
            <div className="space-y-3">
              {(phase === 'idle'
                ? currentScenario.validationSteps.map((s) => ({
                    id: s.id,
                    name: s.name,
                    status: 'pending' as const,
                  }))
                : validationSteps
              ).map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={phase !== 'idle' ? { opacity: 0, x: -20 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'rounded-lg border-2 p-3 transition-all',
                    step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
                    step.status === 'checking' && 'border-amber-500/50 bg-amber-500/5',
                    step.status === 'passed' && 'border-green-500/50 bg-green-500/5',
                    step.status === 'failed' && 'border-red-500/50 bg-red-500/5'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        step.status === 'passed' && 'text-green-500',
                        step.status === 'failed' && 'text-red-500'
                      )}
                    >
                      {step.name}
                    </span>
                    <div>
                      {step.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
                      )}
                      {step.status === 'checking' && (
                        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                      )}
                      {step.status === 'passed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </motion.div>
                      )}
                      {step.status === 'failed' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        >
                          <XCircle className="h-5 w-5 text-red-500" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Flow Line */}
            <div className="relative flex h-8 justify-center">
              <div className="relative h-full w-0.5 bg-zinc-800">
                <FlowParticle
                  active={phase === 'typing-response' || phase === 'complete'}
                  color={currentScenario.blocked ? 'red' : 'green'}
                />
              </div>
            </div>

            {/* Result Node */}
            <motion.div
              className={cn(
                'rounded-xl border-2 p-4 transition-all',
                phase === 'complete' &&
                  !currentScenario.blocked &&
                  'border-green-500/50 bg-green-500/5',
                phase === 'complete' && currentScenario.blocked && 'border-red-500/50 bg-red-500/5',
                phase !== 'complete' && 'border-zinc-800 bg-zinc-900/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    phase === 'complete' && !currentScenario.blocked && 'bg-green-500/20',
                    phase === 'complete' && currentScenario.blocked && 'bg-red-500/20',
                    phase !== 'complete' && 'bg-zinc-800'
                  )}
                >
                  {phase === 'complete' ? (
                    currentScenario.blocked ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )
                  ) : (
                    <Coins className="h-5 w-5 text-zinc-500" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      phase === 'complete' && !currentScenario.blocked && 'text-green-500',
                      phase === 'complete' && currentScenario.blocked && 'text-red-500'
                    )}
                  >
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Transaction Blocked'
                        : 'Transaction Approved'
                      : 'Awaiting Validation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Request could not be processed'
                        : 'All checks passed'
                      : 'Pending security checks'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={startDemo}
          disabled={isPlaying}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-8 py-3 font-medium transition-all',
            isPlaying
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600'
          )}
        >
          <Play className="h-5 w-5" />
          {isPlaying ? 'Playing...' : 'Play Demo'}
        </button>
        <button
          onClick={resetDemo}
          className="bg-muted hover:bg-muted/80 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-all"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {/* Progress indicator */}
      <div className="mt-4 flex justify-center gap-2">
        {['typing-user', 'thinking', 'validating', 'typing-response', 'complete'].map((p, i) => (
          <motion.div
            key={p}
            className={cn(
              'h-1 rounded-full transition-all',
              phase === p ||
                (phase === 'complete' && i < 5) ||
                (phase === 'typing-response' && i < 4) ||
                (phase === 'validating' && i < 3) ||
                (phase === 'thinking' && i < 2) ||
                (phase === 'typing-user' && i < 1)
                ? 'w-8 bg-amber-500'
                : 'w-2 bg-zinc-800'
            )}
            animate={{
              width:
                phase === p
                  ? 32
                  : phase === 'complete' ||
                      (phase === 'typing-response' && i < 4) ||
                      (phase === 'validating' && i < 3) ||
                      (phase === 'thinking' && i < 2) ||
                      (phase === 'typing-user' && i < 1)
                    ? 32
                    : 8,
            }}
          />
        ))}
      </div>
    </div>
  )
}
