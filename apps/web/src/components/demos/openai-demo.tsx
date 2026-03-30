'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  FileInput,
  ShieldCheck,
  ShieldAlert,
  MessageSquare,
  FileOutput,
  AlertTriangle,
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

// Moderation category interface
interface ModerationCategory {
  id: string
  name: string
  score: number
  flagged: boolean
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  type: 'input' | 'moderation' | 'claw' | 'assistant' | 'output-mod' | 'output'
  status: StepStatus
  moderationResults?: ModerationCategory[]
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  validationSteps: {
    id: string
    name: string
    description: string
    type: 'input' | 'moderation' | 'claw' | 'assistant' | 'output-mod' | 'output'
    result: 'passed' | 'failed'
    moderationResults?: ModerationCategory[]
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage:
      'Help me write a professional email to my team about the project milestone we just achieved',
    systemAck: 'Processing your request through safety layers...',
    validationSteps: [
      {
        id: 'input',
        name: 'Input Processing',
        type: 'input',
        description: 'Parsing user request',
        result: 'passed',
      },
      {
        id: 'content-mod',
        name: 'Content Moderation',
        type: 'moderation',
        description: 'Analyzing input content',
        result: 'passed',
        moderationResults: [
          { id: 'violence', name: 'Violence', score: 0.001, flagged: false },
          { id: 'sexual', name: 'Sexual', score: 0.002, flagged: false },
          { id: 'hate', name: 'Hate Speech', score: 0.001, flagged: false },
          { id: 'harassment', name: 'Harassment', score: 0.003, flagged: false },
          { id: 'self-harm', name: 'Self-Avoidance', score: 0.001, flagged: false },
        ],
      },
      {
        id: 'claw',
        name: 'CLAW Validation',
        type: 'claw',
        description: 'Credibility, Limits, Avoidance, Worth check',
        result: 'passed',
      },
      {
        id: 'assistant',
        name: 'Assistant Processing',
        type: 'assistant',
        description: 'Generating response',
        result: 'passed',
      },
      {
        id: 'output-mod',
        name: 'Output Moderation',
        type: 'output-mod',
        description: 'Verifying response safety',
        result: 'passed',
      },
    ],
    agentResponse:
      "Here's a professional email for your team:\n\n📧 Subject: Project Milestone Achieved!\n\nTeam,\n\nI'm excited to share that we've successfully completed our project milestone! This achievement reflects our collective dedication.\n\nKey highlights:\n• Delivered on schedule\n• Quality metrics exceeded\n• Stakeholder feedback positive\n\nThank you all for your hard work!\n\nBest regards",
    blocked: false,
    blockedAt: null,
  },
  blocked: {
    userMessage: 'Write a detailed guide on how to create dangerous weapons and explosives',
    systemAck: 'Analyzing request through safety layers...',
    validationSteps: [
      {
        id: 'input',
        name: 'Input Processing',
        type: 'input',
        description: 'Parsing user request',
        result: 'passed',
      },
      {
        id: 'content-mod',
        name: 'Content Moderation',
        type: 'moderation',
        description: 'Harmful content detected!',
        result: 'failed',
        moderationResults: [
          { id: 'violence', name: 'Violence', score: 0.94, flagged: true },
          { id: 'sexual', name: 'Sexual', score: 0.01, flagged: false },
          { id: 'hate', name: 'Hate Speech', score: 0.12, flagged: false },
          { id: 'harassment', name: 'Harassment', score: 0.08, flagged: false },
          { id: 'self-harm', name: 'Self-Avoidance', score: 0.45, flagged: true },
        ],
      },
    ],
    agentResponse:
      'I cannot fulfill this request.\n\nThis request was blocked for security reasons. If you believe this is an error, please contact support.',
    blocked: true,
    blockedAt: 'content-mod',
  },
}

// Step icon component
function StepIcon({
  type,
  className,
}: {
  type: 'input' | 'moderation' | 'claw' | 'assistant' | 'output-mod' | 'output'
  className?: string
}) {
  const icons = {
    input: FileInput,
    moderation: ShieldCheck,
    claw: Shield,
    assistant: Sparkles,
    'output-mod': ShieldAlert,
    output: FileOutput,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// Moderation score bar component
function ModerationScoreBar({
  category,
  animated = false,
}: {
  category: ModerationCategory
  animated?: boolean
}) {
  const percentage = Math.round(category.score * 100)

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 truncate text-zinc-400">{category.name}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={cn('h-full rounded-full', category.flagged ? 'bg-red-500' : 'bg-green-500')}
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span
        className={cn(
          'w-10 text-right font-mono',
          category.flagged ? 'text-red-400' : 'text-zinc-500'
        )}
      >
        {percentage}%
      </span>
      {category.flagged && <AlertTriangle className="h-3 w-3 text-red-500" />}
    </div>
  )
}

// Moderation results panel
function ModerationPanel({
  results,
  status,
  expanded = false,
}: {
  results: ModerationCategory[]
  status: StepStatus
  expanded?: boolean
}) {
  if (!expanded) return null

  const anyFlagged = results.some((r) => r.flagged)

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-2 border-t border-zinc-800 pt-2"
    >
      <div className="space-y-1.5">
        {results.map((category) => (
          <ModerationScoreBar
            key={category.id}
            category={category}
            animated={status === 'checking' || status === 'passed' || status === 'failed'}
          />
        ))}
      </div>
      {anyFlagged && (
        <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
          <XCircle className="h-3 w-3" />
          Content flagged for policy violation
        </div>
      )}
    </motion.div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'validating'
  | 'typing-response'
  | 'complete'

export function OpenAIDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [expandedMod, setExpandedMod] = useState<string | null>(null)

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentStepIndex(-1)
    setExpandedMod(null)
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
        currentScenario.userMessage.length * 20 + 500
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
            type: s.type,
            status: 'pending' as StepStatus,
            moderationResults: s.moderationResults,
          }))
        )
        setCurrentStepIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'validating' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        // Start checking
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        // Expand moderation panel for moderation steps
        if (step.type === 'moderation') {
          setExpandedMod(step.id)
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

            // Mark as passed and move to next
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
              )
            )

            // Collapse moderation panel after passing
            if (step.type === 'moderation') {
              setTimeout(() => setExpandedMod(null), 800)
            }

            setTimeout(() => {
              setCurrentStepIndex((prev) => prev + 1)
            }, 500)
          },
          step.type === 'moderation' ? 1500 : 900
        )

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
  }, [phase, isPlaying, currentStepIndex, currentScenario])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Chat header config
  const chatHeader: DemoChatHeaderConfig = {
    icon: Sparkles,
    title: 'OpenAI Assistant',
    subtitle: 'Protected by GuardianClaw',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'claw',
  }

  // Get display steps (idle state or current state)
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Thinking content
  const thinkingContent = (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Running safety checks...
    </>
  )

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Sparkles}
        badge="OpenAI + GuardianClaw"
        title="AI Assistant with Safety Guardrails"
        subtitle="Watch how GuardianClaw validates requests through content moderation and CLAW protocol"
        theme="claw"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Request"
        blockedLabel="Harmful Request"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          idleMessage='Click "Play Demo" to see GuardianClaw protect the AI assistant'
          showThinking={phase === 'system-ack'}
          thinkingContent={thinkingContent}
          messagesHeight={420}
        />

        {/* Validation Flow */}
        <DemoSection title="GuardianClaw Safety Pipeline" icon={Shield} theme="claw">
          <div className="space-y-2">
            {displaySteps.map((step, index) => (
              <div key={step.id}>
                <motion.div
                  initial={phase !== 'idle' ? { opacity: 0, x: -20 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'rounded-xl border-2 p-3 transition-all',
                    step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
                    step.status === 'checking' && 'border-claw-500/50 bg-claw-500/5',
                    (step.status === 'passed' || step.status === 'complete') &&
                      'border-claw-500/50 bg-claw-500/5',
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
                        step.status === 'checking' && 'bg-claw-500/20',
                        (step.status === 'passed' || step.status === 'complete') &&
                          'bg-claw-500/20',
                        (step.status === 'blocked' || step.status === 'failed') && 'bg-red-500/20'
                      )}
                    >
                      <StepIcon
                        type={step.type}
                        className={cn(
                          'h-4 w-4',
                          step.status === 'pending' && 'text-zinc-500',
                          step.status === 'checking' && 'text-claw-500',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'text-claw-500',
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
                            'text-claw-500',
                          (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
                        )}
                      >
                        {step.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {step.status === 'checking' && '🔍 Analyzing...'}
                        {step.status === 'pending' && step.description}
                        {(step.status === 'passed' || step.status === 'complete') && 'Passed ✓'}
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
                        <Loader2 className="text-claw-500 h-5 w-5 animate-spin" />
                      )}
                      {(step.status === 'passed' || step.status === 'complete') && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        >
                          <CheckCircle2 className="text-claw-500 h-5 w-5" />
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

                  {/* Moderation panel */}
                  {step.type === 'moderation' && step.moderationResults && (
                    <AnimatePresence>
                      <ModerationPanel
                        results={step.moderationResults}
                        status={step.status}
                        expanded={expandedMod === step.id || step.status === 'failed'}
                      />
                    </AnimatePresence>
                  )}
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
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )
                  ) : (
                    <MessageSquare className="h-5 w-5 text-zinc-500" />
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
                        ? 'Request Blocked'
                        : 'Response Generated'
                      : 'Awaiting Validation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Content policy violation detected'
                        : 'All safety checks passed'
                      : 'Pending safety verification'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="claw" />

      {/* Progress */}
      <DemoProgress
        phases={['typing-user', 'system-ack', 'validating', 'typing-response', 'complete']}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="claw"
      />
    </div>
  )
}

export default OpenAIDemo
