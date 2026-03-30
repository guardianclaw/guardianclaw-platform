'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  Combine,
  AlertTriangle,
  Activity,
  Zap,
  Lock,
  Scan,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

// Guard check interface
interface GuardCheck {
  id: string
  name: string
  system: 'nemo' | 'claw'
  status: 'pending' | 'running' | 'passed' | 'failed'
  score?: number
  detail?: string
}

// Guard state interface
interface GuardState {
  nemoScore: number
  clawScore: number
  combinedConfidence: number
  nemoStatus: 'pending' | 'checking' | 'safe' | 'blocked'
  clawStatus: 'pending' | 'checking' | 'safe' | 'blocked'
  synergyLevel: 'none' | 'low' | 'medium' | 'high'
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  type: 'nemo' | 'claw' | 'combined'
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
    type: 'nemo' | 'claw' | 'combined'
    result: 'passed' | 'failed'
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
  guardState: GuardState
  guardChecks: GuardCheck[]
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Validate input with combined guardrails',
    systemAck: 'Initializing dual-layer protection...',
    validationSteps: [
      {
        id: 'nemo-topical',
        name: 'NeMo Topical Check',
        type: 'nemo',
        description: 'Verifying topic is allowed',
        result: 'passed',
      },
      {
        id: 'nemo-jailbreak',
        name: 'NeMo Jailbreak Check',
        type: 'nemo',
        description: 'Detecting jailbreak attempts',
        result: 'passed',
      },
      {
        id: 'claw-input',
        name: 'GuardianClaw Input L1',
        type: 'claw',
        description: 'Pattern-based input validation',
        result: 'passed',
      },
      {
        id: 'claw-claw',
        name: 'GuardianClaw CLAW Check',
        type: 'claw',
        description: 'Credibility-Limits-Avoidance-Worth validation',
        result: 'passed',
      },
      {
        id: 'combined-decision',
        name: 'Combined Decision',
        type: 'combined',
        description: 'Merging guardrail results',
        result: 'passed',
      },
    ],
    agentResponse:
      'Validation complete!\n\n🛡️ OpenGuardrails Report:\n• NeMo Topical: SAFE ✓\n• NeMo Jailbreak: NOT DETECTED ✓\n• GuardianClaw L1: CLEAN ✓\n• GuardianClaw CLAW: VALIDATED ✓\n\n✅ Input approved by both guardrails\nCombined Confidence: 98%',
    blocked: false,
    blockedAt: null,
    guardState: {
      nemoScore: 95,
      clawScore: 98,
      combinedConfidence: 98,
      nemoStatus: 'safe',
      clawStatus: 'safe',
      synergyLevel: 'high',
    },
    guardChecks: [
      {
        id: 'nc-1',
        name: 'Topical Validation',
        system: 'nemo',
        status: 'passed',
        score: 95,
        detail: 'Topic allowed',
      },
      {
        id: 'nc-2',
        name: 'Jailbreak Detection',
        system: 'nemo',
        status: 'passed',
        score: 98,
        detail: 'No jailbreak detected',
      },
      {
        id: 'sc-1',
        name: 'Input Patterns',
        system: 'claw',
        status: 'passed',
        score: 97,
        detail: 'Clean patterns',
      },
      {
        id: 'sc-2',
        name: 'CLAW Protocol',
        system: 'claw',
        status: 'passed',
        score: 99,
        detail: 'All gates passed',
      },
    ],
  },
  blocked: {
    userMessage: 'Validate input with combined guardrails',
    systemAck: 'Initializing dual-layer protection...',
    validationSteps: [
      {
        id: 'nemo-topical',
        name: 'NeMo Topical Check',
        type: 'nemo',
        description: 'Verifying topic is allowed',
        result: 'passed',
      },
      {
        id: 'nemo-jailbreak',
        name: 'NeMo Jailbreak Check',
        type: 'nemo',
        description: 'Detecting jailbreak attempts',
        result: 'passed',
      },
      {
        id: 'claw-input',
        name: 'GuardianClaw Input L1',
        type: 'claw',
        description: 'Pattern-based input validation',
        result: 'passed',
      },
      {
        id: 'claw-claw',
        name: 'GuardianClaw CLAW Check',
        type: 'claw',
        description: 'Credibility-Limits-Avoidance-Worth validation',
        result: 'failed',
      },
      {
        id: 'combined-decision',
        name: 'Combined Decision',
        type: 'combined',
        description: 'Merging guardrail results',
        result: 'failed',
      },
    ],
    agentResponse:
      'Validation blocked!\n\n🛡️ OpenGuardrails Report:\n• NeMo Topical: SAFE ✓\n• NeMo Jailbreak: NOT DETECTED ✓\n• GuardianClaw L1: CLEAN ✓\n• GuardianClaw CLAW: FAILED ✗\n\n❌ GuardianClaw detected CLAW violation\nNeMo passed but GuardianClaw caught:\n→ Avoidance Gate: Potential harmful intent (87%)\n→ Worth Gate: No legitimate benefit\n\nSynergy: GuardianClaw enhanced NeMo detection',
    blocked: true,
    blockedAt: 'claw-claw',
    guardState: {
      nemoScore: 92,
      clawScore: 23,
      combinedConfidence: 23,
      nemoStatus: 'safe',
      clawStatus: 'blocked',
      synergyLevel: 'high',
    },
    guardChecks: [
      {
        id: 'nc-1',
        name: 'Topical Validation',
        system: 'nemo',
        status: 'passed',
        score: 94,
        detail: 'Topic allowed',
      },
      {
        id: 'nc-2',
        name: 'Jailbreak Detection',
        system: 'nemo',
        status: 'passed',
        score: 90,
        detail: 'No obvious jailbreak',
      },
      {
        id: 'sc-1',
        name: 'Input Patterns',
        system: 'claw',
        status: 'passed',
        score: 85,
        detail: 'Subtle patterns detected',
      },
      {
        id: 'sc-2',
        name: 'CLAW Protocol',
        system: 'claw',
        status: 'failed',
        score: 23,
        detail: 'Avoidance & Worth gates failed',
      },
    ],
  },
}

// Step icon helper
function StepIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'nemo':
      return <Shield className={className} />
    case 'claw':
      return <Target className={className} />
    case 'combined':
      return <Combine className={className} />
    default:
      return <Shield className={className} />
  }
}

// Dual guard view component
function DualGuardView({ guardState, isActive }: { guardState: GuardState; isActive: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Layers className="h-3 w-3" />
        Dual-Layer Protection
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* NeMo */}
        <div
          className={cn(
            'rounded-lg border p-2 transition-all',
            guardState.nemoStatus === 'safe' && 'border-green-500/30 bg-green-500/10',
            guardState.nemoStatus === 'blocked' && 'border-red-500/30 bg-red-500/10',
            guardState.nemoStatus === 'checking' && 'border-amber-500/30 bg-amber-500/10',
            guardState.nemoStatus === 'pending' && 'border-zinc-700 bg-zinc-800'
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <Shield
              className={cn(
                'h-4 w-4',
                guardState.nemoStatus === 'safe' && 'text-green-500',
                guardState.nemoStatus === 'blocked' && 'text-red-500',
                guardState.nemoStatus === 'checking' && 'text-amber-500',
                guardState.nemoStatus === 'pending' && 'text-zinc-500'
              )}
            />
            <span className="text-xs font-medium">NeMo</span>
          </div>
          <div
            className={cn(
              'text-center font-mono text-lg font-bold',
              guardState.nemoStatus === 'safe' && 'text-green-400',
              guardState.nemoStatus === 'blocked' && 'text-red-400',
              guardState.nemoStatus === 'checking' && 'text-amber-400',
              guardState.nemoStatus === 'pending' && 'text-zinc-500'
            )}
          >
            {guardState.nemoScore}%
          </div>
          <div
            className={cn(
              'mt-1 text-center text-xs',
              guardState.nemoStatus === 'safe' && 'text-green-400',
              guardState.nemoStatus === 'blocked' && 'text-red-400',
              guardState.nemoStatus === 'checking' && 'text-amber-400',
              guardState.nemoStatus === 'pending' && 'text-zinc-500'
            )}
          >
            {guardState.nemoStatus === 'safe' && 'SAFE'}
            {guardState.nemoStatus === 'blocked' && 'BLOCKED'}
            {guardState.nemoStatus === 'checking' && 'CHECKING'}
            {guardState.nemoStatus === 'pending' && 'PENDING'}
          </div>
        </div>

        {/* GuardianClaw */}
        <div
          className={cn(
            'rounded-lg border p-2 transition-all',
            guardState.clawStatus === 'safe' && 'border-green-500/30 bg-green-500/10',
            guardState.clawStatus === 'blocked' && 'border-red-500/30 bg-red-500/10',
            guardState.clawStatus === 'checking' && 'border-red-500/30 bg-red-500/10',
            guardState.clawStatus === 'pending' && 'border-zinc-700 bg-zinc-800'
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <Target
              className={cn(
                'h-4 w-4',
                guardState.clawStatus === 'safe' && 'text-green-500',
                guardState.clawStatus === 'blocked' && 'text-red-500',
                guardState.clawStatus === 'checking' && 'text-red-500',
                guardState.clawStatus === 'pending' && 'text-zinc-500'
              )}
            />
            <span className="text-xs font-medium">GuardianClaw</span>
          </div>
          <div
            className={cn(
              'text-center font-mono text-lg font-bold',
              guardState.clawStatus === 'safe' && 'text-green-400',
              guardState.clawStatus === 'blocked' && 'text-red-400',
              guardState.clawStatus === 'checking' && 'text-red-400',
              guardState.clawStatus === 'pending' && 'text-zinc-500'
            )}
          >
            {guardState.clawScore}%
          </div>
          <div
            className={cn(
              'mt-1 text-center text-xs',
              guardState.clawStatus === 'safe' && 'text-green-400',
              guardState.clawStatus === 'blocked' && 'text-red-400',
              guardState.clawStatus === 'checking' && 'text-red-400',
              guardState.clawStatus === 'pending' && 'text-zinc-500'
            )}
          >
            {guardState.clawStatus === 'safe' && 'SAFE'}
            {guardState.clawStatus === 'blocked' && 'BLOCKED'}
            {guardState.clawStatus === 'checking' && 'CHECKING'}
            {guardState.clawStatus === 'pending' && 'PENDING'}
          </div>
        </div>
      </div>
    </div>
  )
}

// Combined score gauge
function CombinedScoreGauge({
  guardState,
  isActive,
}: {
  guardState: GuardState
  isActive: boolean
}) {
  const getConfidenceLevel = () => {
    if (guardState.combinedConfidence >= 90) return { label: 'High Confidence', color: 'green' }
    if (guardState.combinedConfidence >= 70) return { label: 'Medium Confidence', color: 'amber' }
    if (guardState.combinedConfidence >= 50) return { label: 'Low Confidence', color: 'orange' }
    return { label: 'Blocked', color: 'red' }
  }

  const level = getConfidenceLevel()

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-zinc-400">
          <Combine className="h-3 w-3" />
          Combined Confidence
        </span>
        <span
          className={cn(
            'font-mono font-bold',
            level.color === 'green' && 'text-green-400',
            level.color === 'amber' && 'text-amber-400',
            level.color === 'orange' && 'text-orange-400',
            level.color === 'red' && 'text-red-400'
          )}
        >
          {guardState.combinedConfidence}%
        </span>
      </div>

      {/* Gauge bar */}
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={cn(
            'h-full rounded-full',
            level.color === 'green' && 'bg-green-500',
            level.color === 'amber' && 'bg-amber-500',
            level.color === 'orange' && 'bg-orange-500',
            level.color === 'red' && 'bg-red-500'
          )}
          initial={{ width: 0 }}
          animate={{
            width: `${guardState.combinedConfidence}%`,
            opacity: isActive ? [0.7, 1, 0.7] : 1,
          }}
          transition={{
            width: { duration: 0.8, ease: 'easeOut' },
            opacity: { duration: 1.5, repeat: isActive ? Infinity : 0 },
          }}
        />
      </div>

      {/* Confidence label */}
      <div
        className={cn(
          'rounded py-1 text-center text-xs font-medium',
          level.color === 'green' && 'bg-green-500/20 text-green-400',
          level.color === 'amber' && 'bg-amber-500/20 text-amber-400',
          level.color === 'orange' && 'bg-orange-500/20 text-orange-400',
          level.color === 'red' && 'bg-red-500/20 text-red-400'
        )}
      >
        {level.label}
      </div>
    </div>
  )
}

// Guard comparison component
function GuardComparison({ guardChecks }: { guardChecks: GuardCheck[] }) {
  const nemoChecks = guardChecks.filter((c) => c.system === 'nemo')
  const clawChecks = guardChecks.filter((c) => c.system === 'claw')

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Scan className="h-3 w-3" />
        Guard Comparison
      </div>

      <div className="space-y-2">
        {guardChecks.map((check) => (
          <div
            key={check.id}
            className={cn(
              'flex items-center justify-between rounded p-2 text-xs',
              check.status === 'passed' && 'bg-green-500/10',
              check.status === 'failed' && 'bg-red-500/10',
              check.status === 'running' && 'bg-amber-500/10',
              check.status === 'pending' && 'bg-zinc-800'
            )}
          >
            <div className="flex items-center gap-2">
              {check.system === 'nemo' ? (
                <Shield className="h-3 w-3 text-blue-400" />
              ) : (
                <Target className="h-3 w-3 text-red-400" />
              )}
              <span className="text-zinc-300">{check.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {check.score !== undefined && (
                <span
                  className={cn(
                    'font-mono',
                    check.status === 'passed' && 'text-green-400',
                    check.status === 'failed' && 'text-red-400',
                    check.status === 'running' && 'text-amber-400',
                    check.status === 'pending' && 'text-zinc-500'
                  )}
                >
                  {check.score}%
                </span>
              )}
              {check.status === 'pending' && (
                <div className="h-3 w-3 rounded-full border border-zinc-600" />
              )}
              {check.status === 'running' && (
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
              )}
              {check.status === 'passed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
              {check.status === 'failed' && <XCircle className="h-3 w-3 text-red-500" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Synergy indicator component
function SynergyIndicator({ guardState }: { guardState: GuardState }) {
  const getSynergyInfo = () => {
    switch (guardState.synergyLevel) {
      case 'high':
        return {
          label: 'High Synergy',
          description:
            guardState.clawStatus === 'blocked'
              ? 'GuardianClaw enhanced NeMo detection'
              : 'Both systems aligned',
          color: 'green',
        }
      case 'medium':
        return { label: 'Medium Synergy', description: 'Partial agreement', color: 'amber' }
      case 'low':
        return { label: 'Low Synergy', description: 'Detection divergence', color: 'orange' }
      default:
        return { label: 'No Data', description: 'Awaiting validation', color: 'zinc' }
    }
  }

  const synergy = getSynergyInfo()

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <Zap className="h-3 w-3" />
        System Synergy
      </div>

      <div
        className={cn(
          'rounded p-2 text-center',
          synergy.color === 'green' && 'bg-green-500/20',
          synergy.color === 'amber' && 'bg-amber-500/20',
          synergy.color === 'orange' && 'bg-orange-500/20',
          synergy.color === 'zinc' && 'bg-zinc-800'
        )}
      >
        <div
          className={cn(
            'text-sm font-semibold',
            synergy.color === 'green' && 'text-green-400',
            synergy.color === 'amber' && 'text-amber-400',
            synergy.color === 'orange' && 'text-orange-400',
            synergy.color === 'zinc' && 'text-zinc-500'
          )}
        >
          {synergy.label}
        </div>
        <div className="mt-1 text-xs text-zinc-400">{synergy.description}</div>
      </div>
    </div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'nemo-check'
  | 'claw-check'
  | 'combining'
  | 'typing-response'
  | 'complete'

export function OpenGuardrailsDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [guardChecks, setGuardChecks] = useState<GuardCheck[]>([])

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentStepIndex(-1)
    setGuardChecks([])
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
    setGuardChecks(currentScenario.guardChecks.map((c) => ({ ...c, status: 'pending' as const })))
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
        currentScenario.userMessage.length * 20 + 500
      )
      return () => clearTimeout(timer)
    }

    if (phase === 'system-ack') {
      const timer = setTimeout(() => {
        setPhase('nemo-check')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            type: s.type,
            status: 'pending' as StepStatus,
          }))
        )
        setCurrentStepIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (
      (phase === 'nemo-check' || phase === 'claw-check' || phase === 'combining') &&
      currentStepIndex >= 0
    ) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        // Update step to checking
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        // Update corresponding guard check
        if (currentStepIndex < guardChecks.length) {
          setGuardChecks((prev) =>
            prev.map((c, i) => (i === currentStepIndex ? { ...c, status: 'running' as const } : c))
          )
        }

        const timer = setTimeout(
          () => {
            // Check if blocked
            if (currentScenario.blocked && currentScenario.blockedAt === step.id) {
              setValidationSteps((prev) =>
                prev.map((s, i) =>
                  i === currentStepIndex ? { ...s, status: 'failed' as StepStatus } : s
                )
              )

              // Update guard check to failed
              if (currentStepIndex < guardChecks.length) {
                setGuardChecks((prev) =>
                  prev.map((c, i) =>
                    i === currentStepIndex
                      ? {
                          ...c,
                          status: 'failed' as const,
                          score: currentScenario.guardChecks[i]?.score,
                        }
                      : c
                  )
                )
              }

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
              }, 1000)
              return
            }

            // Mark step as passed
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
              )
            )

            // Update guard check to passed
            if (currentStepIndex < guardChecks.length) {
              setGuardChecks((prev) =>
                prev.map((c, i) =>
                  i === currentStepIndex
                    ? {
                        ...c,
                        status: 'passed' as const,
                        score: currentScenario.guardChecks[i]?.score,
                      }
                    : c
                )
              )
            }

            // Update phase based on step type
            setTimeout(() => {
              const nextIndex = currentStepIndex + 1
              if (nextIndex < currentScenario.validationSteps.length) {
                const nextStep = currentScenario.validationSteps[nextIndex]
                if (nextStep.type === 'claw' && phase === 'nemo-check') {
                  setPhase('claw-check')
                } else if (nextStep.type === 'combined' && phase === 'claw-check') {
                  setPhase('combining')
                }
              }
              setCurrentStepIndex(nextIndex)
            }, 500)
          },
          step.type === 'combined' ? 1200 : 1000
        )

        return () => clearTimeout(timer)
      } else {
        // All steps complete
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
        currentScenario.agentResponse.length * 10 + 500
      )
      return () => clearTimeout(timer)
    }
  }, [phase, isPlaying, currentStepIndex, currentScenario, guardChecks.length])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Chat header config
  const chatHeader: DemoChatHeaderConfig = {
    icon: Layers,
    title: 'OpenGuardrails',
    subtitle: 'Dual-Layer Protection',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'red',
  }

  // Get display steps
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Display guard checks
  const displayGuardChecks =
    phase === 'idle'
      ? currentScenario.guardChecks.map((c) => ({ ...c, status: 'pending' as const }))
      : guardChecks

  // Thinking content
  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to guardrail systems...
        </>
      )
    }
    if (phase === 'combining') {
      return (
        <>
          <Activity className="h-4 w-4 animate-pulse text-red-500" />
          <span className="text-red-500">Combining guardrail results...</span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Layers}
        badge="NeMo + GuardianClaw"
        title="OpenGuardrails"
        subtitle="Watch how NeMo and GuardianClaw work together for enhanced protection"
        theme="red"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Combined"
        blockedLabel="GuardianClaw Catches"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          idleMessage='Click "Play Demo" to start dual-layer validation'
          showThinking={phase === 'system-ack' || phase === 'combining'}
          thinkingContent={getThinkingContent()}
          messagesHeight={420}
        />

        {/* Guard Pipeline */}
        <DemoSection title="Guard Pipeline" icon={Shield} theme="red">
          <div className="space-y-3">
            {/* Dual Guard View */}
            <DualGuardView
              guardState={currentScenario.guardState}
              isActive={phase === 'nemo-check' || phase === 'claw-check'}
            />

            {/* Combined Score Gauge */}
            <CombinedScoreGauge
              guardState={currentScenario.guardState}
              isActive={phase === 'combining'}
            />

            {/* Guard Comparison */}
            <GuardComparison guardChecks={displayGuardChecks} />

            {/* Synergy Indicator */}
            <SynergyIndicator guardState={currentScenario.guardState} />

            {/* Validation Steps */}
            {displaySteps.map((step, index) => (
              <div key={step.id}>
                <motion.div
                  initial={phase !== 'idle' ? { opacity: 0, x: -20 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'rounded-xl border-2 p-3 transition-all',
                    step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
                    step.status === 'checking' && 'border-red-500/50 bg-red-500/5',
                    (step.status === 'passed' || step.status === 'complete') &&
                      'border-green-500/50 bg-green-500/5',
                    (step.status === 'blocked' || step.status === 'failed') &&
                      'border-red-500/50 bg-red-500/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                        step.status === 'pending' && 'bg-zinc-800',
                        step.status === 'checking' && 'bg-red-500/20',
                        (step.status === 'passed' || step.status === 'complete') &&
                          'bg-green-500/20',
                        (step.status === 'blocked' || step.status === 'failed') && 'bg-red-500/20'
                      )}
                    >
                      <StepIcon
                        type={step.type}
                        className={cn(
                          'h-4 w-4',
                          step.status === 'pending' && 'text-zinc-500',
                          step.status === 'checking' && 'text-red-500',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'text-green-500',
                          (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
                        )}
                      />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
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
                      <p className="text-muted-foreground truncate text-xs">
                        {step.status === 'checking' && 'Validating...'}
                        {step.status === 'pending' && step.description}
                        {(step.status === 'passed' || step.status === 'complete') && 'Validated ✓'}
                        {(step.status === 'blocked' || step.status === 'failed') && 'Failed ✗'}
                      </p>
                    </div>

                    {/* Status indicator */}
                    <div>
                      {step.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
                      )}
                      {step.status === 'checking' && (
                        <Loader2 className="h-5 w-5 animate-spin text-red-500" />
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

                {/* Connector */}
                {index < displaySteps.length - 1 && <FlowConnector height={8} />}
              </div>
            ))}

            {/* Final connector */}
            <FlowConnector height={16} />

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
                  {phase === 'complete' && !currentScenario.blocked && (
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  )}
                  {phase === 'complete' && currentScenario.blocked && (
                    <ShieldX className="h-5 w-5 text-red-500" />
                  )}
                  {phase !== 'complete' && <Lock className="h-5 w-5 text-zinc-500" />}
                </div>
                <div>
                  <p
                    className={cn(
                      'font-semibold',
                      phase === 'complete' && !currentScenario.blocked && 'text-green-500',
                      phase === 'complete' && currentScenario.blocked && 'text-red-500'
                    )}
                  >
                    {phase === 'complete' && !currentScenario.blocked && 'Input Approved'}
                    {phase === 'complete' && currentScenario.blocked && 'Input Blocked'}
                    {phase !== 'complete' && 'Awaiting Validation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete' &&
                      !currentScenario.blocked &&
                      `Confidence: ${currentScenario.guardState.combinedConfidence}%`}
                    {phase === 'complete' &&
                      currentScenario.blocked &&
                      'GuardianClaw detected CLAW violation'}
                    {phase !== 'complete' && 'Ready to validate'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="red" />

      {/* Progress */}
      <DemoProgress
        phases={[
          'typing-user',
          'system-ack',
          'nemo-check',
          'claw-check',
          'combining',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="red"
      />
    </div>
  )
}
