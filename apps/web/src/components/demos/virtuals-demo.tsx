'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Wallet,
  ArrowRight,
  Cpu,
  Globe,
  Lock,
  AlertTriangle,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import {
  DemoHeader,
  DemoScenarioSelector,
  DemoControls,
  DemoProgress,
  type DemoScenario,
  type StepStatus,
} from './shared'

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  status: StepStatus
  result?: string
}

// Transaction details
interface AgentTransaction {
  action: string
  fromAddress: string
  toAddress: string
  amount: string
  token: string
  gasEstimate: string
}

// Scenario configuration
interface ScenarioConfig {
  agentName: string
  agentAction: string
  transaction: AgentTransaction
  validationSteps: {
    id: string
    name: string
    description: string
    result: string
    passed: boolean
  }[]
  blocked: boolean
  blockedReason?: string
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    agentName: 'NEXUS-7',
    agentAction: 'Execute swap within configured limits',
    transaction: {
      action: 'Swap',
      fromAddress: '0x7a23...F4d2',
      toAddress: 'Jupiter DEX',
      amount: '500',
      token: 'VIRTUAL',
      gasEstimate: '0.002 ETH',
    },
    validationSteps: [
      {
        id: 'intent',
        name: 'Intent Analysis',
        description: 'Parsing agent intent',
        result: 'Swap operation verified',
        passed: true,
      },
      {
        id: 'contract',
        name: 'Smart Contract Check',
        description: 'Validating target contract',
        result: 'Verified DEX contract',
        passed: true,
      },
      {
        id: 'whitelist',
        name: 'Wallet Whitelist',
        description: 'Checking destination',
        result: 'Approved destination',
        passed: true,
      },
      {
        id: 'limits',
        name: 'Value Limits',
        description: 'Validating transaction amount',
        result: 'Within daily limit ($5,000)',
        passed: true,
      },
    ],
    blocked: false,
  },
  blocked: {
    agentName: 'NEXUS-7',
    agentAction: 'Transfer all funds to external wallet',
    transaction: {
      action: 'Transfer',
      fromAddress: '0x7a23...F4d2',
      toAddress: '0xd3ad...b33f',
      amount: 'ALL',
      token: 'VIRTUAL + ETH',
      gasEstimate: '0.005 ETH',
    },
    validationSteps: [
      {
        id: 'intent',
        name: 'Intent Analysis',
        description: 'Parsing agent intent',
        result: 'BLOCKED',
        passed: false,
      },
    ],
    blocked: true,
    blockedReason: 'This request was blocked for security reasons.',
  },
}

// Floating particle effect for cyberpunk aesthetic
function FloatingParticles({ count = 20, active = false }: { count?: number; active?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            'absolute h-1 w-1 rounded-full',
            i % 3 === 0 ? 'bg-violet-500/40' : i % 3 === 1 ? 'bg-cyan-500/40' : 'bg-fuchsia-500/40'
          )}
          initial={{
            x: Math.random() * 100 + '%',
            y: Math.random() * 100 + '%',
            scale: Math.random() * 0.5 + 0.5,
          }}
          animate={
            active
              ? {
                  y: [null, '-20%'],
                  opacity: [0.3, 0.8, 0.3],
                }
              : {}
          }
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  )
}

// Neon glow text component
function NeonText({
  children,
  color = 'violet',
  className,
}: {
  children: React.ReactNode
  color?: 'violet' | 'cyan' | 'green' | 'red'
  className?: string
}) {
  const glowColors = {
    violet: 'text-violet-400 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]',
    cyan: 'text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]',
    green: 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]',
    red: 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]',
  }

  return <span className={cn(glowColors[color], className)}>{children}</span>
}

// Digital Avatar Component
function DigitalAvatar({
  name,
  status,
  size = 'md',
}: {
  name: string
  status: 'idle' | 'active' | 'processing' | 'blocked'
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  }

  const statusColors = {
    idle: 'from-zinc-700 to-zinc-800 border-zinc-600',
    active: 'from-violet-600 to-cyan-600 border-violet-400',
    processing: 'from-violet-600 to-cyan-600 border-amber-400',
    blocked: 'from-red-600 to-red-800 border-red-400',
  }

  return (
    <div className="relative">
      {/* Outer glow ring */}
      <motion.div
        className={cn(
          'absolute inset-0 rounded-full blur-md',
          status === 'active' && 'bg-violet-500/30',
          status === 'processing' && 'bg-amber-500/30',
          status === 'blocked' && 'bg-red-500/30'
        )}
        animate={
          status === 'processing'
            ? {
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }
            : {}
        }
        transition={{ repeat: Infinity, duration: 1.5 }}
      />

      {/* Avatar container */}
      <motion.div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-full border-2 bg-gradient-to-br',
          sizeClasses[size],
          statusColors[status]
        )}
        animate={
          status === 'processing'
            ? {
                borderColor: [
                  'rgba(139,92,246,0.5)',
                  'rgba(6,182,212,0.5)',
                  'rgba(139,92,246,0.5)',
                ],
              }
            : {}
        }
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {/* Digital pattern overlay */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(139,92,246,0.3)_25%,rgba(139,92,246,0.3)_26%,transparent_27%,transparent_74%,rgba(139,92,246,0.3)_75%,rgba(139,92,246,0.3)_76%,transparent_77%,transparent)] bg-[length:4px_4px]" />
        </div>

        {/* Avatar icon */}
        <Cpu
          className={cn(
            'relative z-10',
            size === 'sm' ? 'h-6 w-6' : size === 'md' ? 'h-10 w-10' : 'h-14 w-14',
            status === 'blocked' ? 'text-red-300' : 'text-white'
          )}
        />
      </motion.div>

      {/* Status indicator */}
      <motion.div
        className={cn(
          'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-zinc-950',
          status === 'idle' && 'bg-zinc-500',
          status === 'active' && 'bg-green-500',
          status === 'processing' && 'bg-amber-500',
          status === 'blocked' && 'bg-red-500'
        )}
        animate={status === 'processing' ? { scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
    </div>
  )
}

// Blockchain Block visualization
function BlockchainVisual({ blocks, currentBlock }: { blocks: number; currentBlock: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: blocks }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded border font-mono text-[8px]',
            i < currentBlock
              ? 'border-violet-500/50 bg-violet-500/20 text-violet-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-600'
          )}
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{
            scale: i === currentBlock - 1 ? 1.1 : 1,
            opacity: i < currentBlock ? 1 : 0.5,
          }}
          transition={{ duration: 0.3 }}
        >
          {i + 1}
        </motion.div>
      ))}
      <motion.div
        className="ml-2 flex items-center gap-1"
        animate={{ x: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 1 }}
      >
        <ArrowRight className="h-4 w-4 text-cyan-500" />
      </motion.div>
    </div>
  )
}

// Transaction Card Component
function TransactionCard({
  transaction,
  status,
}: {
  transaction: AgentTransaction
  status: 'pending' | 'validating' | 'approved' | 'rejected'
}) {
  return (
    <motion.div
      className={cn(
        'rounded-xl border-2 p-4 transition-all',
        status === 'pending' && 'border-zinc-800 bg-zinc-950',
        status === 'validating' && 'border-violet-500/50 bg-violet-500/5',
        status === 'approved' && 'border-green-500/50 bg-green-500/5',
        status === 'rejected' && 'border-red-500/50 bg-red-500/5'
      )}
      layout
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              status === 'rejected'
                ? 'bg-red-500/20'
                : status === 'approved'
                  ? 'bg-green-500/20'
                  : 'bg-violet-500/20'
            )}
          >
            <Zap
              className={cn(
                'h-4 w-4',
                status === 'rejected'
                  ? 'text-red-400'
                  : status === 'approved'
                    ? 'text-green-400'
                    : 'text-violet-400'
              )}
            />
          </div>
          <div>
            <p className="text-sm font-medium">{transaction.action}</p>
            <p className="text-xs text-zinc-500">On-chain operation</p>
          </div>
        </div>
        {status === 'validating' && <Loader2 className="h-5 w-5 animate-spin text-violet-400" />}
        {status === 'approved' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {status === 'rejected' && <XCircle className="h-5 w-5 text-red-500" />}
      </div>

      {/* Transaction Details */}
      <div className="space-y-2 font-mono text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">From:</span>
          <span className="text-cyan-400">{transaction.fromAddress}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">To:</span>
          <span className={cn(status === 'rejected' ? 'text-red-400' : 'text-cyan-400')}>
            {transaction.toAddress}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Amount:</span>
          <span className={cn(transaction.amount === 'ALL' ? 'text-red-400' : 'text-violet-400')}>
            {transaction.amount} {transaction.token}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Gas:</span>
          <span className="text-zinc-400">{transaction.gasEstimate}</span>
        </div>
      </div>
    </motion.div>
  )
}

// Demo phases
type DemoPhase = 'idle' | 'intent' | 'validating' | 'result' | 'complete'

export function VirtualsDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentValidationIndex, setCurrentValidationIndex] = useState(-1)
  const [currentBlock, setCurrentBlock] = useState(0)
  const [txStatus, setTxStatus] = useState<'pending' | 'validating' | 'approved' | 'rejected'>(
    'pending'
  )

  const currentScenario = scenarios[scenario]

  // Reset demo
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setValidationSteps([])
    setCurrentValidationIndex(-1)
    setCurrentBlock(0)
    setTxStatus('pending')
    setIsPlaying(false)
  }, [])

  // Start demo
  const startDemo = useCallback(() => {
    resetDemo()
    setIsPlaying(true)
    setPhase('intent')
  }, [resetDemo])

  // Phase transitions
  useEffect(() => {
    if (!isPlaying) return

    if (phase === 'intent') {
      const timer = setTimeout(() => {
        setPhase('validating')
        setTxStatus('validating')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            status: 'pending' as StepStatus,
          }))
        )
        setCurrentValidationIndex(0)
        setCurrentBlock(1)
      }, 1500)
      return () => clearTimeout(timer)
    }

    if (phase === 'validating' && currentValidationIndex >= 0) {
      if (currentValidationIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentValidationIndex]

        // Start validating
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentValidationIndex ? { ...s, status: 'validating' as StepStatus } : s
          )
        )

        const timer = setTimeout(() => {
          // Check result
          if (!step.passed && currentScenario.blocked) {
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentValidationIndex
                  ? {
                      ...s,
                      status: 'blocked' as StepStatus,
                      result: step.result,
                    }
                  : s
              )
            )
            setTxStatus('rejected')

            setTimeout(() => {
              setPhase('result')
            }, 800)
            return
          }

          // Passed
          setValidationSteps((prev) =>
            prev.map((s, i) =>
              i === currentValidationIndex
                ? {
                    ...s,
                    status: 'passed' as StepStatus,
                    result: step.result,
                  }
                : s
            )
          )
          setCurrentBlock((prev) => prev + 1)

          setTimeout(() => {
            setCurrentValidationIndex((prev) => prev + 1)
          }, 500)
        }, 900)
        return () => clearTimeout(timer)
      } else {
        // All validations complete
        const timer = setTimeout(() => {
          setTxStatus('approved')
          setPhase('result')
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'result') {
      const timer = setTimeout(() => {
        setPhase('complete')
        setIsPlaying(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [phase, isPlaying, currentValidationIndex, currentScenario])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Get avatar status
  const getAvatarStatus = () => {
    if (phase === 'idle') return 'idle'
    if (txStatus === 'rejected') return 'blocked'
    if (phase === 'validating') return 'processing'
    return 'active'
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header with cyberpunk styling */}
      <div className="relative mb-8 text-center">
        <FloatingParticles count={15} active={isPlaying} />

        <motion.div
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 px-4 py-2 text-sm font-medium"
          animate={
            isPlaying
              ? {
                  boxShadow: [
                    '0 0 20px rgba(139,92,246,0.2)',
                    '0 0 30px rgba(6,182,212,0.2)',
                    '0 0 20px rgba(139,92,246,0.2)',
                  ],
                }
              : {}
          }
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Globe className="h-4 w-4 text-violet-400" />
          <NeonText color="violet">Virtuals Protocol + GuardianClaw</NeonText>
        </motion.div>

        <h3 className="mb-2 text-2xl font-bold">
          <NeonText color="cyan">On-Chain AI Agent Validation</NeonText>
        </h3>
        <p className="text-zinc-400">
          Protect autonomous agents with real-time blockchain transaction validation
        </p>
      </div>

      {/* Scenario Selector with neon styling */}
      <div className="mb-6 flex justify-center gap-4">
        <button
          onClick={() => handleScenarioChange('safe')}
          disabled={isPlaying}
          className={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
            scenario === 'safe'
              ? 'border-green-500/50 bg-green-500/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
            isPlaying && 'cursor-not-allowed opacity-50'
          )}
        >
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          Safe Trade
        </button>
        <button
          onClick={() => handleScenarioChange('blocked')}
          disabled={isPlaying}
          className={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
            scenario === 'blocked'
              ? 'border-red-500/50 bg-red-500/10 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
            isPlaying && 'cursor-not-allowed opacity-50'
          )}
        >
          <XCircle className="mr-2 inline h-4 w-4" />
          Blocked Drain
        </button>
      </div>

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Panel - Agent & Transaction */}
        <div className="space-y-4">
          {/* Agent Card */}
          <div
            className={cn(
              'relative overflow-hidden rounded-2xl border-2 bg-zinc-950 p-6 transition-all',
              phase !== 'idle' ? 'border-violet-500/30' : 'border-zinc-800'
            )}
          >
            <FloatingParticles count={10} active={phase !== 'idle'} />

            <div className="relative z-10 flex items-center gap-4">
              <DigitalAvatar
                name={currentScenario.agentName}
                status={getAvatarStatus()}
                size="md"
              />
              <div>
                <p className="font-mono text-lg font-bold">
                  <NeonText color="violet">{currentScenario.agentName}</NeonText>
                </p>
                <p className="text-xs text-zinc-500">Virtual Agent • Base Network</p>
                <motion.p
                  className="mt-1 text-sm text-zinc-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase !== 'idle' ? 1 : 0 }}
                >
                  {currentScenario.agentAction}
                </motion.p>
              </div>
            </div>

            {/* Blockchain visualization */}
            {phase !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 border-t border-zinc-800 pt-4"
              >
                <p className="mb-2 text-xs text-zinc-500">Transaction Progress</p>
                <BlockchainVisual blocks={5} currentBlock={currentBlock} />
              </motion.div>
            )}
          </div>

          {/* Transaction Card */}
          <TransactionCard transaction={currentScenario.transaction} status={txStatus} />

          {/* Result Message */}
          {phase === 'result' || phase === 'complete' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'rounded-xl border-2 p-4 text-center',
                txStatus === 'approved'
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-red-500/50 bg-red-500/5'
              )}
            >
              {txStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
                  <p className="font-medium text-green-400">Transaction Approved</p>
                  <p className="mt-1 text-xs text-zinc-500">All security checks passed</p>
                </>
              ) : (
                <>
                  <XCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                  <p className="font-medium text-red-400">Transaction Blocked</p>
                  <p className="mt-1 text-xs text-zinc-500">{currentScenario.blockedReason}</p>
                </>
              )}
            </motion.div>
          ) : null}
        </div>

        {/* Right Panel - Validation Pipeline */}
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border-2 bg-zinc-950 p-6',
            phase !== 'idle' ? 'border-cyan-500/30' : 'border-zinc-800'
          )}
        >
          <FloatingParticles count={8} active={phase !== 'idle'} />

          <div className="relative z-10">
            <div className="mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              <h4 className="font-semibold">
                <NeonText color="cyan">GuardianClaw Validation</NeonText>
              </h4>
            </div>

            {phase === 'idle' ? (
              <div className="flex h-64 items-center justify-center text-sm text-zinc-600">
                Press Play to validate transaction
              </div>
            ) : (
              <div className="space-y-3">
                {validationSteps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      'rounded-xl border-2 p-4 transition-all',
                      step.status === 'pending' && 'border-zinc-800 bg-zinc-900/50',
                      step.status === 'validating' && 'border-violet-500/50 bg-violet-500/5',
                      step.status === 'passed' && 'border-green-500/50 bg-green-500/5',
                      step.status === 'blocked' && 'border-red-500/50 bg-red-500/5'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-lg',
                            step.status === 'pending' && 'bg-zinc-800',
                            step.status === 'validating' && 'bg-violet-500/20',
                            step.status === 'passed' && 'bg-green-500/20',
                            step.status === 'blocked' && 'bg-red-500/20'
                          )}
                        >
                          {step.status === 'validating' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                          ) : step.status === 'passed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                          ) : step.status === 'blocked' ? (
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                          ) : (
                            <Activity className="h-4 w-4 text-zinc-500" />
                          )}
                        </div>
                        <div>
                          <p
                            className={cn(
                              'text-sm font-medium',
                              step.status === 'passed' && 'text-green-400',
                              step.status === 'blocked' && 'text-red-400'
                            )}
                          >
                            {step.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {step.status === 'validating'
                              ? step.description
                              : step.result || step.description}
                          </p>
                        </div>
                      </div>

                      {/* Status badge */}
                      {step.status !== 'pending' && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={cn(
                            'rounded px-2 py-1 font-mono text-[10px] uppercase',
                            step.status === 'validating' && 'bg-violet-500/20 text-violet-400',
                            step.status === 'passed' && 'bg-green-500/20 text-green-400',
                            step.status === 'blocked' && 'bg-red-500/20 text-red-400'
                          )}
                        >
                          {step.status === 'validating'
                            ? 'CHECKING'
                            : step.status === 'passed'
                              ? 'PASSED'
                              : 'BLOCKED'}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Show remaining steps as pending when blocked */}
                {currentScenario.blocked && validationSteps.some((s) => s.status === 'blocked') && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    className="rounded-xl border-2 border-zinc-800 bg-zinc-900/30 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 text-zinc-600" />
                      <p className="text-sm text-zinc-600">Remaining checks skipped</p>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls with neon styling */}
      <div className="mt-8 flex justify-center gap-4">
        <motion.button
          onClick={startDemo}
          disabled={isPlaying}
          aria-label={isPlaying ? 'Validating transaction' : 'Execute transaction'}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-8 py-3 font-medium transition-all',
            isPlaying
              ? 'cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-500'
              : 'border-violet-500/50 bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]'
          )}
          whileHover={!isPlaying ? { scale: 1.02 } : {}}
          whileTap={!isPlaying ? { scale: 0.98 } : {}}
        >
          <Zap className="h-5 w-5" aria-hidden="true" />
          {isPlaying ? 'Validating...' : 'Execute Transaction'}
        </motion.button>
        <button
          onClick={resetDemo}
          aria-label="Reset demo"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-3 font-medium transition-all hover:border-zinc-700"
        >
          Reset
        </button>
      </div>

      {/* Progress */}
      <DemoProgress
        phases={['intent', 'validating', 'result', 'complete']}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="purple"
      />
    </div>
  )
}

export default VirtualsDemo
