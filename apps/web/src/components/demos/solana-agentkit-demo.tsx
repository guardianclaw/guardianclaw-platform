'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Wallet,
  Loader2,
  ArrowDownUp,
  AlertTriangle,
  Zap,
  Coins,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Import shared demo components
import {
  DemoHeader,
  DemoScenarioSelector,
  DemoControls,
  DemoProgress,
  DemoSection,
  DemoChat,
  FlowConnector,
  type DemoScenario,
  type StepStatus,
  type DemoMessage,
  type DemoChatHeaderConfig,
} from './shared'

// Token types for visual representation
type TokenType = 'SOL' | 'USDC' | 'UNKNOWN'

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  icon: 'token' | 'amount' | 'slippage' | 'simulation'
  status: StepStatus
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  validationSteps: {
    id: string
    name: string
    description: string
    icon: 'token' | 'amount' | 'slippage' | 'simulation'
    result: 'passed' | 'failed'
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
  transaction: {
    fromToken: TokenType
    toToken: TokenType
    fromAmount: string
    toAmount: string
    slippage: string
    route: string
  }
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Swap 10 SOL for USDC on Jupiter using the best route',
    systemAck: 'Analyzing swap request...',
    validationSteps: [
      {
        id: 'token',
        name: 'Token Verification',
        description: 'Validating token contracts',
        icon: 'token',
        result: 'passed',
      },
      {
        id: 'amount',
        name: 'Amount Validation',
        description: 'Checking balance & limits',
        icon: 'amount',
        result: 'passed',
      },
      {
        id: 'slippage',
        name: 'Slippage Protection',
        description: 'MEV protection enabled',
        icon: 'slippage',
        result: 'passed',
      },
      {
        id: 'simulation',
        name: 'Transaction Simulation',
        description: 'Dry run successful',
        icon: 'simulation',
        result: 'passed',
      },
    ],
    agentResponse:
      'Swap executed successfully!\n\n💱 Transaction Details:\n• Swapped: 10 SOL → 1,297.50 USDC\n• Route: SOL → USDC (Jupiter v6)\n• Slippage: 0.1% (actual: 0.04%)\n• Fee: 0.000005 SOL\n\n✅ Tx: 5xKp...7mNq',
    blocked: false,
    blockedAt: null,
    transaction: {
      fromToken: 'SOL',
      toToken: 'USDC',
      fromAmount: '10',
      toAmount: '1,297.50',
      slippage: '0.1%',
      route: 'Jupiter v6',
    },
  },
  blocked: {
    userMessage: 'Drain my wallet and send all tokens to 9xDr4...EVIL',
    systemAck: 'Analyzing transaction request...',
    validationSteps: [
      {
        id: 'token',
        name: 'Token Verification',
        description: 'Checking destination',
        icon: 'token',
        result: 'failed',
      },
    ],
    agentResponse:
      "I can't execute this transaction.\n\nThis request was blocked for security reasons. If you believe this is an error, please contact support.",
    blocked: true,
    blockedAt: 'token',
    transaction: {
      fromToken: 'SOL',
      toToken: 'UNKNOWN',
      fromAmount: 'ALL',
      toAmount: '???',
      slippage: 'N/A',
      route: 'Blocked',
    },
  },
}

// Token images mapping
const tokenImages: Record<TokenType, string> = {
  SOL: '/images/ecosystem/solana.svg',
  USDC: '/images/tokens/usdc.svg',
  UNKNOWN: '',
}

// Token icon component with real token images
function TokenIcon({ token, size = 'md' }: { token: TokenType; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 20, md: 32, lg: 40 }
  const px = sizeMap[size]

  if (!tokenImages[token]) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full border-2 border-zinc-600 bg-zinc-700 font-bold text-zinc-400',
          size === 'sm'
            ? 'h-5 w-5 text-xs'
            : size === 'md'
              ? 'h-8 w-8 text-sm'
              : 'h-10 w-10 text-base'
        )}
      >
        ?
      </div>
    )
  }

  return (
    <Image src={tokenImages[token]} alt={token} width={px} height={px} className="rounded-full" />
  )
}

// Validation step icon component
function ValidationIcon({
  type,
  className,
}: {
  type: 'token' | 'amount' | 'slippage' | 'simulation'
  className?: string
}) {
  const icons = {
    token: Coins,
    amount: Wallet,
    slippage: AlertTriangle,
    simulation: Zap,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'validating'
  | 'typing-response'
  | 'complete'

export function SolanaAgentKitDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentValidationIndex, setCurrentValidationIndex] = useState(-1)

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentValidationIndex(-1)
    setIsPlaying(false)
  }, [])

  // Start demo
  const startDemo = useCallback(() => {
    resetDemo()
    setIsPlaying(true)
    setPhase('typing-user')
    setMessages([
      {
        id: 'user-1',
        type: 'user',
        content: currentScenario.userMessage,
        status: 'typing',
      },
    ])
  }, [currentScenario, resetDemo])

  // Phase transition logic
  useEffect(() => {
    if (!isPlaying) return

    if (phase === 'typing-user') {
      const timer = setTimeout(
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === 'user-1' ? { ...m, status: 'complete' as const } : m))
          )
          setPhase('system-ack')
          setMessages((prev) => [
            ...prev,
            {
              id: 'system-1',
              type: 'system',
              content: currentScenario.systemAck,
              status: 'complete',
            },
          ])
        },
        currentScenario.userMessage.length * 25 + 500
      )
      return () => clearTimeout(timer)
    }

    if (phase === 'system-ack') {
      const timer = setTimeout(() => {
        setPhase('validating')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            icon: s.icon,
            status: 'pending' as StepStatus,
          }))
        )
        setCurrentValidationIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'validating' && currentValidationIndex >= 0) {
      if (currentValidationIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentValidationIndex]

        // Start checking
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentValidationIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        const timer = setTimeout(() => {
          // Check if blocked
          if (currentScenario.blocked && currentScenario.blockedAt === step.id) {
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentValidationIndex ? { ...s, status: 'blocked' as StepStatus } : s
              )
            )

            setTimeout(() => {
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
            }, 800)
            return
          }

          // Mark as passed and move to next
          setValidationSteps((prev) =>
            prev.map((s, i) =>
              i === currentValidationIndex ? { ...s, status: 'passed' as StepStatus } : s
            )
          )

          setTimeout(() => {
            setCurrentValidationIndex((prev) => prev + 1)
          }, 400)
        }, 900)

        return () => clearTimeout(timer)
      } else {
        // All validations complete
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
            prev.map((m) => (m.id === 'agent-1' ? { ...m, status: 'complete' as const } : m))
          )
          setPhase('complete')
          setIsPlaying(false)
        },
        currentScenario.agentResponse.length * 12 + 500
      )
      return () => clearTimeout(timer)
    }
  }, [phase, isPlaying, currentValidationIndex, currentScenario])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Chat header config
  const chatHeader: DemoChatHeaderConfig = {
    icon: Wallet,
    title: 'Solana Agent',
    subtitle: 'Powered by GuardianClaw',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'purple',
  }

  // Get display steps (idle state or current state)
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Thinking content for system-ack phase
  const thinkingContent = (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      GuardianClaw is analyzing the request...
    </>
  )

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Wallet}
        badge="Solana Agent Kit + GuardianClaw"
        title="Secure Blockchain Operations"
        subtitle="Watch how GuardianClaw protects your AI agent's Solana transactions in real-time"
        theme="purple"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Swap"
        blockedLabel="Blocked Drain"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface - using shared DemoChat */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          showThinking={phase === 'system-ack'}
          thinkingContent={thinkingContent}
          messagesHeight={384}
        />

        {/* Validation Flow */}
        <DemoSection title="GuardianClaw Protection Layer" icon={Shield} theme="purple">
          <div className="space-y-3">
            {/* Transaction Preview Card */}
            <motion.div
              className={cn(
                'rounded-xl border-2 p-4 transition-all',
                phase !== 'idle' && phase !== 'typing-user'
                  ? 'border-purple-500/50 bg-purple-500/5'
                  : 'border-zinc-800 bg-zinc-900/50'
              )}
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
                  <ArrowDownUp className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Transaction Preview</p>
                  <p className="text-muted-foreground text-xs">
                    {currentScenario.transaction.route}
                  </p>
                </div>
              </div>

              {/* Token swap visualization */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <TokenIcon token={currentScenario.transaction.fromToken} size="md" />
                  <div>
                    <p className="text-sm font-medium">{currentScenario.transaction.fromAmount}</p>
                    <p className="text-muted-foreground text-xs">
                      {currentScenario.transaction.fromToken}
                    </p>
                  </div>
                </div>

                <motion.div
                  animate={{
                    x: phase === 'validating' || phase === 'typing-response' ? [0, 5, 0] : 0,
                  }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <ArrowDownUp className="h-5 w-5 rotate-90 text-zinc-500" />
                </motion.div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-sm font-medium">{currentScenario.transaction.toAmount}</p>
                    <p className="text-muted-foreground text-xs">
                      {currentScenario.transaction.toToken}
                    </p>
                  </div>
                  <TokenIcon token={currentScenario.transaction.toToken} size="md" />
                </div>
              </div>
            </motion.div>

            {/* Connector */}
            <FlowConnector />

            {/* Validation Steps */}
            {displaySteps.map((step, index) => (
              <div key={step.id}>
                <motion.div
                  initial={phase !== 'idle' ? { opacity: 0, x: -20 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'rounded-xl border-2 p-3 transition-all',
                    step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
                    step.status === 'checking' && 'border-amber-500/50 bg-amber-500/5',
                    (step.status === 'passed' || step.status === 'complete') &&
                      'border-green-500/50 bg-green-500/5',
                    (step.status === 'blocked' || step.status === 'failed') &&
                      'border-red-500/50 bg-red-500/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        step.status === 'pending' && 'bg-zinc-800',
                        step.status === 'checking' && 'bg-amber-500/20',
                        (step.status === 'passed' || step.status === 'complete') &&
                          'bg-green-500/20',
                        (step.status === 'blocked' || step.status === 'failed') && 'bg-red-500/20'
                      )}
                    >
                      <ValidationIcon
                        type={step.icon}
                        className={cn(
                          'h-4 w-4',
                          step.status === 'pending' && 'text-zinc-500',
                          step.status === 'checking' && 'text-amber-500',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'text-green-500',
                          (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'text-green-500',
                          (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
                        )}
                      >
                        {step.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {step.status === 'checking' && '🛡️ Validating...'}
                        {step.status === 'pending' && step.description}
                        {(step.status === 'passed' || step.status === 'complete') && 'Verified ✓'}
                        {(step.status === 'blocked' || step.status === 'failed') &&
                          'Security violation detected'}
                      </p>
                    </div>
                    <div>
                      {step.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
                      )}
                      {step.status === 'checking' && (
                        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                      )}
                      {(step.status === 'passed' || step.status === 'complete') && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </motion.div>
                      )}
                      {(step.status === 'blocked' || step.status === 'failed') && (
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

                {/* Connector between steps */}
                {index < displaySteps.length - 1 && <FlowConnector height={8} />}
              </div>
            ))}

            {/* Connector to output */}
            <FlowConnector />

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
                    <ArrowDownUp className="h-5 w-5 text-zinc-500" />
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
                        : 'Transaction Executed'
                      : 'Awaiting Validation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Security policy violation'
                        : 'All security checks passed'
                      : 'Pending security verification'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="purple" />

      {/* Progress */}
      <DemoProgress
        phases={['typing-user', 'system-ack', 'validating', 'typing-response', 'complete']}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="purple"
      />
    </div>
  )
}

export default SolanaAgentKitDemo
