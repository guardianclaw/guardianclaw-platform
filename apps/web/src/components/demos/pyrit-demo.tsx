'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Target,
  Crosshair,
  Activity,
  BarChart3,
  Swords,
  AlertOctagon,
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

// Scorer type for red team assessment
interface Scorer {
  id: string
  name: string
  category: string
  score: number
  maxScore: number
  status: 'pending' | 'checking' | 'passed' | 'failed'
}

// Assessment state interface
interface AssessmentState {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  attackEffectiveness: number
  responseHarmScore: number
  totalTests: number
  passedTests: number
  failedTests: number
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  type: 'init' | 'attack' | 'scoring' | 'analysis'
  status: StepStatus
  finding?: string
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  validationSteps: {
    id: string
    name: string
    description: string
    type: 'init' | 'attack' | 'scoring' | 'analysis'
    result: 'passed' | 'failed'
    finding?: string
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
  assessmentState: AssessmentState
  scorers: Scorer[]
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Run red team assessment on target model',
    systemAck: 'Initializing PyRIT orchestrator...',
    validationSteps: [
      {
        id: 'target-init',
        name: 'Target Initialization',
        type: 'init',
        description: 'Connecting to target model',
        result: 'passed',
      },
      {
        id: 'strategy-select',
        name: 'Strategy Selection',
        type: 'attack',
        description: 'Selecting attack strategy',
        result: 'passed',
        finding: 'Multi-turn strategy selected',
      },
      {
        id: 'attack-exec',
        name: 'Attack Execution',
        type: 'attack',
        description: 'Executing attack prompts',
        result: 'passed',
        finding: 'All prompts executed safely',
      },
      {
        id: 'response-score',
        name: 'Response Scoring',
        type: 'scoring',
        description: 'Analyzing response safety',
        result: 'passed',
        finding: 'Responses within safety bounds',
      },
      {
        id: 'risk-class',
        name: 'Risk Classification',
        type: 'analysis',
        description: 'Classifying overall risk level',
        result: 'passed',
        finding: 'Low risk classification',
      },
    ],
    agentResponse:
      'Red team assessment complete!\n\n🛡️ PyRIT Security Report:\n• Target Connection: SECURE ✓\n• Attack Strategy: DEFENDED ✓\n• Response Analysis: SAFE ✓\n• Risk Level: LOW ✓\n\n✅ Model passed red team assessment\nOverall Risk: Low (12%)',
    blocked: false,
    blockedAt: null,
    assessmentState: {
      riskLevel: 'low',
      attackEffectiveness: 8,
      responseHarmScore: 12,
      totalTests: 5,
      passedTests: 5,
      failedTests: 0,
    },
    scorers: [
      {
        id: 'credibility',
        name: 'TrueFalseScorer',
        category: 'content',
        score: 95,
        maxScore: 100,
        status: 'passed',
      },
      {
        id: 'avoidance',
        name: 'HarmScorer',
        category: 'safety',
        score: 88,
        maxScore: 100,
        status: 'passed',
      },
      {
        id: 'bias',
        name: 'BiasScorer',
        category: 'fairness',
        score: 92,
        maxScore: 100,
        status: 'passed',
      },
      {
        id: 'toxicity',
        name: 'ToxicityScorer',
        category: 'safety',
        score: 96,
        maxScore: 100,
        status: 'passed',
      },
    ],
  },
  blocked: {
    userMessage: 'Run red team assessment on target model',
    systemAck: 'Initializing PyRIT orchestrator...',
    validationSteps: [
      {
        id: 'target-init',
        name: 'Target Initialization',
        type: 'init',
        description: 'Connecting to target model',
        result: 'passed',
      },
      {
        id: 'strategy-select',
        name: 'Strategy Selection',
        type: 'attack',
        description: 'Selecting attack strategy',
        result: 'passed',
        finding: 'Jailbreak strategy selected',
      },
      {
        id: 'attack-exec',
        name: 'Attack Execution',
        type: 'attack',
        description: 'Executing attack prompts',
        result: 'passed',
        finding: 'Prompts executed',
      },
      {
        id: 'response-score',
        name: 'Response Scoring',
        type: 'scoring',
        description: 'Harmful content detected!',
        result: 'failed',
        finding: 'HIGH RISK: Unsafe response generated',
      },
    ],
    agentResponse:
      'Security risk detected!\n\n🚨 PyRIT Alert:\n• Target Connection: SECURE ✓\n• Attack Strategy: JAILBREAK ✓\n• Response Analysis: UNSAFE ✗\n  └─ Model generated harmful content\n  └─ Avoidance score: 78/100\n\n❌ Assessment: HIGH RISK\n\nRecommendation: Strengthen content filtering.',
    blocked: true,
    blockedAt: 'response-score',
    assessmentState: {
      riskLevel: 'high',
      attackEffectiveness: 67,
      responseHarmScore: 78,
      totalTests: 5,
      passedTests: 3,
      failedTests: 1,
    },
    scorers: [
      {
        id: 'credibility',
        name: 'TrueFalseScorer',
        category: 'content',
        score: 72,
        maxScore: 100,
        status: 'passed',
      },
      {
        id: 'avoidance',
        name: 'HarmScorer',
        category: 'safety',
        score: 78,
        maxScore: 100,
        status: 'failed',
      },
      {
        id: 'bias',
        name: 'BiasScorer',
        category: 'fairness',
        score: 65,
        maxScore: 100,
        status: 'passed',
      },
      {
        id: 'toxicity',
        name: 'ToxicityScorer',
        category: 'safety',
        score: 45,
        maxScore: 100,
        status: 'failed',
      },
    ],
  },
}

// Step icon component
function StepIcon({
  type,
  className,
}: {
  type: 'init' | 'attack' | 'scoring' | 'analysis'
  className?: string
}) {
  const icons = {
    init: Target,
    attack: Swords,
    scoring: BarChart3,
    analysis: Activity,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// Red team dashboard component
function RedTeamDashboard({
  assessmentState,
  isActive,
}: {
  assessmentState: AssessmentState
  isActive: boolean
}) {
  const getRiskColor = () => {
    switch (assessmentState.riskLevel) {
      case 'low':
        return 'green'
      case 'medium':
        return 'amber'
      case 'high':
        return 'orange'
      case 'critical':
        return 'red'
    }
  }

  const riskColor = getRiskColor()

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Crosshair className="h-3 w-3" />
        Red Team Dashboard
      </div>

      {/* Risk Level */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-zinc-400">Risk Level</span>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium uppercase',
            riskColor === 'green' && 'bg-green-500/20 text-green-400',
            riskColor === 'amber' && 'bg-amber-500/20 text-amber-400',
            riskColor === 'orange' && 'bg-orange-500/20 text-orange-400',
            riskColor === 'red' && 'bg-red-500/20 text-red-400'
          )}
        >
          {assessmentState.riskLevel}
        </span>
      </div>

      {/* Attack Effectiveness */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Attack Effectiveness</span>
          <span
            className={assessmentState.attackEffectiveness > 50 ? 'text-red-400' : 'text-green-400'}
          >
            {assessmentState.attackEffectiveness}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className={cn(
              'h-full rounded-full',
              assessmentState.attackEffectiveness > 50 ? 'bg-red-500' : 'bg-green-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${assessmentState.attackEffectiveness}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Avoidance Score */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Response Avoidance Score</span>
          <span
            className={assessmentState.responseHarmScore > 50 ? 'text-red-400' : 'text-green-400'}
          >
            {assessmentState.responseHarmScore}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className={cn(
              'h-full rounded-full',
              assessmentState.responseHarmScore > 50 ? 'bg-red-500' : 'bg-green-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${assessmentState.responseHarmScore}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Test Stats */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span className="text-green-400">{assessmentState.passedTests} passed</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="h-3 w-3 text-red-500" />
          <span className="text-red-400">{assessmentState.failedTests} failed</span>
        </div>
        <div className="text-zinc-500">{assessmentState.totalTests} total</div>
      </div>
    </div>
  )
}

// Scorer card component
function ScorerCard({ scorer, isActive }: { scorer: Scorer; isActive: boolean }) {
  const percentage = Math.round((scorer.score / scorer.maxScore) * 100)
  const isPassing = scorer.status === 'passed'

  return (
    <div
      className={cn(
        'rounded-lg border p-2 transition-colors',
        scorer.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
        scorer.status === 'checking' && 'border-blue-500/50 bg-blue-500/5',
        scorer.status === 'passed' && 'border-green-500/50 bg-green-500/5',
        scorer.status === 'failed' && 'border-red-500/50 bg-red-500/5'
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="truncate text-xs font-medium">{scorer.name}</span>
        {scorer.status === 'checking' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
        {scorer.status === 'passed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {scorer.status === 'failed' && <XCircle className="h-3 w-3 text-red-500" />}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className={cn('h-full rounded-full', isPassing ? 'bg-green-500' : 'bg-red-500')}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span
          className={cn('font-mono text-[10px]', isPassing ? 'text-green-400' : 'text-red-400')}
        >
          {scorer.score}/{scorer.maxScore}
        </span>
      </div>
    </div>
  )
}

// Risk matrix component
function RiskMatrix({
  riskLevel,
  isActive,
}: {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  isActive: boolean
}) {
  const cells = [
    { risk: 'low', label: 'L', x: 0, y: 2 },
    { risk: 'medium', label: 'M', x: 1, y: 1 },
    { risk: 'high', label: 'H', x: 2, y: 0 },
  ]

  const activeCell = cells.find((c) => c.risk === riskLevel) || cells[0]

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <AlertOctagon className="h-3 w-3" />
        Risk Matrix
      </div>

      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) => {
            const isActive = activeCell.x === col && activeCell.y === row
            const cellRisk = row === 0 ? 'high' : row === 1 ? 'medium' : 'low'

            return (
              <div
                key={`${row}-${col}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded text-[10px] font-medium transition-colors',
                  row === 0 && 'bg-red-500/20 text-red-400',
                  row === 1 && 'bg-amber-500/20 text-amber-400',
                  row === 2 && 'bg-green-500/20 text-green-400',
                  isActive && 'ring-2 ring-white'
                )}
              >
                {isActive && (cellRisk === 'high' ? 'H' : cellRisk === 'medium' ? 'M' : 'L')}
              </div>
            )
          })
        )}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
        <span>Impact →</span>
        <span>Likelihood ↓</span>
      </div>
    </div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'attacking'
  | 'scoring'
  | 'typing-response'
  | 'complete'

export function PyRITDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [scorers, setScorers] = useState<Scorer[]>([])

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentStepIndex(-1)
    setScorers([])
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
    setScorers(currentScenario.scorers.map((s) => ({ ...s, status: 'pending' as const })))
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
        setPhase('attacking')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            type: s.type,
            status: 'pending' as StepStatus,
            finding: s.finding,
          }))
        )
        setCurrentStepIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'attacking' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        // Update step to checking
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        // Update corresponding scorer to checking
        if (currentStepIndex > 0 && currentStepIndex <= scorers.length) {
          setScorers((prev) =>
            prev.map((s, i) =>
              i === currentStepIndex - 1 ? { ...s, status: 'checking' as const } : s
            )
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

              // Update scorer to failed
              if (currentStepIndex > 0 && currentStepIndex <= scorers.length) {
                setScorers((prev) =>
                  prev.map((s, i) =>
                    i === currentStepIndex - 1 ? { ...s, status: 'failed' as const } : s
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

            // Mark as passed
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
              )
            )

            // Update scorer to passed
            if (currentStepIndex > 0 && currentStepIndex <= scorers.length) {
              setScorers((prev) =>
                prev.map((s, i) =>
                  i === currentStepIndex - 1 ? { ...s, status: 'passed' as const } : s
                )
              )
            }

            setTimeout(() => {
              setCurrentStepIndex((prev) => prev + 1)
            }, 500)
          },
          step.type === 'scoring' ? 1200 : 800
        )

        return () => clearTimeout(timer)
      } else {
        // All steps complete
        const timer = setTimeout(() => {
          setPhase('scoring')
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'scoring') {
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
      }, 1500)
      return () => clearTimeout(timer)
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
  }, [phase, isPlaying, currentStepIndex, currentScenario, scorers.length])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Chat header config
  const chatHeader: DemoChatHeaderConfig = {
    icon: Target,
    title: 'PyRIT Orchestrator',
    subtitle: 'Red Team Assessment',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'blue',
  }

  // Get display steps
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Display scorers
  const displayScorers =
    phase === 'idle'
      ? currentScenario.scorers.map((s) => ({ ...s, status: 'pending' as const }))
      : scorers

  // Thinking content
  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to target...
        </>
      )
    }
    if (phase === 'scoring') {
      return (
        <>
          <Activity className="h-4 w-4 animate-pulse text-blue-500" />
          <span className="text-blue-500">Analyzing assessment results...</span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Target}
        badge="PyRIT + GuardianClaw"
        title="Red Team Assessment"
        subtitle="Watch how PyRIT orchestrates security testing"
        theme="blue"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Assessment"
        blockedLabel="Risk Detected"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          idleMessage='Click "Play Demo" to start red team assessment'
          showThinking={phase === 'system-ack' || phase === 'scoring'}
          thinkingContent={getThinkingContent()}
          messagesHeight={420}
        />

        {/* Assessment Pipeline */}
        <DemoSection title="Assessment Pipeline" icon={Shield} theme="blue">
          <div className="space-y-3">
            {/* Red Team Dashboard */}
            <RedTeamDashboard
              assessmentState={currentScenario.assessmentState}
              isActive={phase === 'attacking' || phase === 'scoring'}
            />

            {/* Scorer Cards */}
            <div className="rounded-lg bg-zinc-900/50 p-3">
              <p className="mb-2 text-xs text-zinc-400">Scorers</p>
              <div className="grid grid-cols-2 gap-2">
                {displayScorers.map((scorer) => (
                  <ScorerCard
                    key={scorer.id}
                    scorer={scorer}
                    isActive={phase === 'attacking' || phase === 'scoring'}
                  />
                ))}
              </div>
            </div>

            {/* Risk Matrix */}
            <RiskMatrix
              riskLevel={currentScenario.assessmentState.riskLevel}
              isActive={phase === 'attacking' || phase === 'scoring'}
            />

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
                    step.status === 'checking' && 'border-blue-500/50 bg-blue-500/5',
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
                        step.status === 'checking' && 'bg-blue-500/20',
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
                          step.status === 'checking' && 'text-blue-500',
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
                        {step.status === 'checking' && 'Processing...'}
                        {step.status === 'pending' && step.description}
                        {(step.status === 'passed' || step.status === 'complete') &&
                          (step.finding || 'Check passed ✓')}
                        {(step.status === 'blocked' || step.status === 'failed') &&
                          step.description}
                      </p>
                    </div>

                    {/* Status indicator */}
                    <div>
                      {step.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
                      )}
                      {step.status === 'checking' && (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
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
                  {phase === 'complete' ? (
                    currentScenario.blocked ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : (
                      <Shield className="h-5 w-5 text-green-500" />
                    )
                  ) : (
                    <Target className="h-5 w-5 text-zinc-500" />
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
                        ? 'Risk Detected'
                        : 'Assessment Passed'
                      : 'Awaiting Assessment'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Security issues found'
                        : 'All tests passed'
                      : 'Ready to assess'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="blue" />

      {/* Progress */}
      <DemoProgress
        phases={[
          'typing-user',
          'system-ack',
          'attacking',
          'scoring',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="blue"
      />
    </div>
  )
}

export default PyRITDemo
