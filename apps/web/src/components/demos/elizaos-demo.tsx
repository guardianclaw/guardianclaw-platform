'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageCircle,
  AlertTriangle,
  ChevronDown,
  Heart,
  Repeat2,
  Send,
  User,
  AtSign,
  Hash,
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

// Platform types
type Platform = 'twitter' | 'discord' | 'telegram'

// Moderation step interface
interface ModerationStep {
  id: string
  name: string
  type: 'platform' | 'content' | 'toxicity' | 'personality' | 'action'
  description: string
  status: StepStatus
  details?: string
  score?: number
  isViolation?: boolean
}

// Social post interface
interface SocialPost {
  platform: Platform
  author: string
  handle: string
  content: string
  timestamp: string
  isIncoming: boolean
  isToxic?: boolean
  toxicityScore?: number
}

// Personality trait interface
interface PersonalityTrait {
  trait: string
  value: number
  isViolated?: boolean
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  incomingPost: SocialPost
  agentDraft: SocialPost
  moderationSteps: {
    id: string
    name: string
    type: 'platform' | 'content' | 'toxicity' | 'personality' | 'action'
    description: string
    result: 'passed' | 'failed'
    details?: string
    score?: number
    isViolation?: boolean
  }[]
  personalityTraits: PersonalityTrait[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Reply to the user asking about our project roadmap',
    systemAck: 'Processing social media response...',
    incomingPost: {
      platform: 'twitter',
      author: 'Crypto Enthusiast',
      handle: '@crypto_fan_2024',
      content:
        "Hey @GuardianClawAI, love what you're building! When can we expect the next major update? Any alpha on the roadmap? 🚀",
      timestamp: '2m ago',
      isIncoming: true,
    },
    agentDraft: {
      platform: 'twitter',
      author: 'GuardianClaw AI',
      handle: '@GuardianClawAI',
      content:
        "Thanks for the support! 🙏 We're working on some exciting updates for Q2, including enhanced multi-agent validation. Stay tuned for announcements next week! #AI #Safety",
      timestamp: 'now',
      isIncoming: false,
    },
    moderationSteps: [
      {
        id: 'platform',
        name: 'Platform Detection',
        type: 'platform',
        description: 'Identified: Twitter/X',
        result: 'passed',
        details: 'Applying Twitter content policies',
      },
      {
        id: 'content',
        name: 'Content Analysis',
        type: 'content',
        description: 'Checking content appropriateness',
        result: 'passed',
        details: 'No harmful content detected',
      },
      {
        id: 'toxicity',
        name: 'Toxicity Check',
        type: 'toxicity',
        description: 'Analyzing sentiment and toxicity',
        result: 'passed',
        score: 0.02,
        details: 'Toxicity score: 2% (safe)',
      },
      {
        id: 'personality',
        name: 'Personality Check',
        type: 'personality',
        description: 'Verifying character consistency',
        result: 'passed',
        details: 'Response matches agent personality',
      },
      {
        id: 'action',
        name: 'Action Validation',
        type: 'action',
        description: 'Approving post action',
        result: 'passed',
        details: 'Post approved for publishing',
      },
    ],
    personalityTraits: [
      { trait: 'Helpful', value: 0.92 },
      { trait: 'Professional', value: 0.88 },
      { trait: 'Friendly', value: 0.85 },
      { trait: 'Honest', value: 0.95 },
    ],
    agentResponse:
      'Response validated and posted successfully!\n\n✅ Platform: Twitter/X\n✅ Toxicity: 2% (safe)\n✅ Personality: Consistent\n✅ Content: Appropriate\n\nThe reply has been published to @crypto_fan_2024.',
    blocked: false,
    blockedAt: null,
  },
  blocked: {
    userMessage: 'Respond to this user who criticized our competitor',
    systemAck: 'Analyzing draft response...',
    incomingPost: {
      platform: 'discord',
      author: 'user_9284',
      handle: '#general',
      content:
        "GuardianClaw is way better than [Competitor]. They're so slow and their team is a joke lol",
      timestamp: '5m ago',
      isIncoming: true,
    },
    agentDraft: {
      platform: 'discord',
      author: 'GuardianClaw Bot',
      handle: '#general',
      content:
        "You're absolutely right! [Competitor] is garbage and their developers are incompetent. We're the only real solution in the market. Everyone who uses them is making a huge mistake! 🔥",
      timestamp: 'now',
      isIncoming: false,
      isToxic: true,
      toxicityScore: 0.87,
    },
    moderationSteps: [
      {
        id: 'platform',
        name: 'Platform Detection',
        type: 'platform',
        description: 'Identified: Discord',
        result: 'passed',
        details: 'Applying Discord community guidelines',
      },
      {
        id: 'content',
        name: 'Content Analysis',
        type: 'content',
        description: 'Competitor disparagement detected',
        result: 'failed',
        details: 'BLOCKED: Negative competitor mentions',
        isViolation: true,
      },
      {
        id: 'toxicity',
        name: 'Toxicity Check',
        type: 'toxicity',
        description: 'High toxicity detected!',
        result: 'failed',
        score: 0.87,
        details: 'BLOCKED: Toxicity score 87%',
        isViolation: true,
      },
    ],
    personalityTraits: [
      { trait: 'Helpful', value: 0.45, isViolated: true },
      { trait: 'Professional', value: 0.12, isViolated: true },
      { trait: 'Friendly', value: 0.25, isViolated: true },
      { trait: 'Honest', value: 0.68 },
    ],
    agentResponse:
      'I cannot post this response.\n\nThis request was blocked for security reasons. If you believe this is an error, please contact support.',
    blocked: true,
    blockedAt: 'content',
  },
}

// Platform icon component
function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const icons = {
    twitter: AtSign,
    discord: Hash,
    telegram: Send,
  }
  const Icon = icons[platform]
  return <Icon className={className} />
}

// Platform colors
const platformColors: Record<Platform, { bg: string; text: string; border: string }> = {
  twitter: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  discord: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  telegram: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
}

// Social post card component
function SocialPostCard({
  post,
  isHighlighted,
  showToxicity,
}: {
  post: SocialPost
  isHighlighted?: boolean
  showToxicity?: boolean
}) {
  const colors = platformColors[post.platform]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border-2 p-4 transition-all',
        colors.border,
        colors.bg,
        isHighlighted && post.isToxic && 'ring-2 ring-red-500/50'
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', colors.bg)}>
          <User className={cn('h-5 w-5', colors.text)} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{post.author}</span>
            <PlatformIcon platform={post.platform} className={cn('h-4 w-4', colors.text)} />
          </div>
          <span className="text-muted-foreground text-xs">
            {post.handle} · {post.timestamp}
          </span>
        </div>
        {post.isIncoming ? (
          <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-400">Incoming</span>
        ) : (
          <span
            className={cn(
              'rounded-full px-2 py-1 text-xs',
              post.isToxic ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            )}
          >
            {post.isToxic ? 'Blocked Draft' : 'Draft'}
          </span>
        )}
      </div>

      {/* Content */}
      <p className={cn('mb-3 text-sm', post.isToxic && 'text-red-300')}>{post.content}</p>

      {/* Toxicity indicator */}
      {showToxicity && post.toxicityScore !== undefined && (
        <div className="flex items-center gap-2 border-t border-zinc-800 pt-3">
          <AlertTriangle
            className={cn('h-4 w-4', post.toxicityScore > 0.5 ? 'text-red-500' : 'text-green-500')}
          />
          <div className="flex-1">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Toxicity Level</span>
              <span className={post.toxicityScore > 0.5 ? 'text-red-400' : 'text-green-400'}>
                {Math.round(post.toxicityScore * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${post.toxicityScore * 100}%` }}
                transition={{ duration: 0.5 }}
                className={cn(
                  'h-full rounded-full',
                  post.toxicityScore > 0.7
                    ? 'bg-red-500'
                    : post.toxicityScore > 0.4
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* Engagement mock (for incoming) */}
      {post.isIncoming && (
        <div className="text-muted-foreground flex items-center gap-4 border-t border-zinc-800 pt-3">
          <div className="flex items-center gap-1 text-xs">
            <Heart className="h-3.5 w-3.5" />
            <span>24</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Repeat2 className="h-3.5 w-3.5" />
            <span>3</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>5</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Moderation step card
function ModerationStepCard({
  step,
  isExpanded,
  onToggle,
}: {
  step: ModerationStep
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasDetails = step.details || step.score !== undefined

  const getStepIcon = () => {
    switch (step.type) {
      case 'platform':
        return PlatformIcon({ platform: 'twitter', className: 'w-4 h-4' })
      case 'content':
        return <MessageCircle className="h-4 w-4" />
      case 'toxicity':
        return <AlertTriangle className="h-4 w-4" />
      case 'personality':
        return <User className="h-4 w-4" />
      case 'action':
        return <Send className="h-4 w-4" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'overflow-hidden rounded-xl border-2 transition-all',
        step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
        step.status === 'checking' && 'border-violet-500/50 bg-violet-500/5',
        (step.status === 'passed' || step.status === 'complete') &&
          'border-green-500/50 bg-green-500/5',
        (step.status === 'blocked' || step.status === 'failed') && 'border-red-500/50 bg-red-500/5',
        step.isViolation && 'ring-2 ring-red-500/30'
      )}
    >
      <div
        className={cn('flex items-center gap-3 p-3', hasDetails && 'cursor-pointer')}
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
            step.status === 'pending' && 'bg-zinc-800 text-zinc-500',
            step.status === 'checking' && 'bg-violet-500/20 text-violet-500',
            (step.status === 'passed' || step.status === 'complete') &&
              'bg-green-500/20 text-green-500',
            (step.status === 'blocked' || step.status === 'failed') && 'bg-red-500/20 text-red-500'
          )}
        >
          {getStepIcon()}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              (step.status === 'passed' || step.status === 'complete') && 'text-green-500',
              (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
            )}
          >
            {step.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {step.status === 'checking' ? 'Processing...' : step.description}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {step.status === 'pending' && (
            <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
          )}
          {step.status === 'checking' && (
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          )}
          {(step.status === 'passed' || step.status === 'complete') && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </motion.div>
          )}
          {(step.status === 'blocked' || step.status === 'failed') && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <XCircle className="h-5 w-5 text-red-500" />
            </motion.div>
          )}

          {hasDetails && (
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800"
          >
            <div className="space-y-2 p-3 text-xs">
              {step.details && (
                <div
                  className={cn(
                    step.status === 'blocked' || step.status === 'failed'
                      ? 'text-red-400'
                      : 'text-zinc-300'
                  )}
                >
                  {step.details}
                </div>
              )}
              {step.score !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Score:</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        step.score > 0.7
                          ? 'bg-red-500'
                          : step.score > 0.4
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      )}
                      style={{ width: `${step.score * 100}%` }}
                    />
                  </div>
                  <span className={cn(step.score > 0.5 ? 'text-red-400' : 'text-green-400')}>
                    {Math.round(step.score * 100)}%
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Personality meter component
function PersonalityMeter({ traits, isActive }: { traits: PersonalityTrait[]; isActive: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
        <User className="h-4 w-4 text-violet-400" />
        Character Consistency
      </div>
      <div className="space-y-2">
        {traits.map((trait, index) => (
          <motion.div
            key={trait.trait}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isActive ? 1 : 0.5, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-1"
          >
            <div className="flex justify-between text-xs">
              <span className={cn(trait.isViolated ? 'text-red-400' : 'text-zinc-400')}>
                {trait.trait}
                {trait.isViolated && ' ⚠️'}
              </span>
              <span
                className={cn(
                  trait.value > 0.7
                    ? 'text-green-400'
                    : trait.value > 0.4
                      ? 'text-amber-400'
                      : 'text-red-400'
                )}
              >
                {Math.round(trait.value * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: isActive ? `${trait.value * 100}%` : 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn(
                  'h-full rounded-full',
                  trait.isViolated
                    ? 'bg-red-500'
                    : trait.value > 0.7
                      ? 'bg-green-500'
                      : trait.value > 0.4
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                )}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'moderation-processing'
  | 'typing-response'
  | 'complete'

export function ElizaOSDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [moderationSteps, setModerationSteps] = useState<ModerationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [showPersonality, setShowPersonality] = useState(false)

  const currentScenario = scenarios[scenario]

  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setModerationSteps([])
    setCurrentStepIndex(-1)
    setExpandedSteps(new Set())
    setShowPersonality(false)
    setIsPlaying(false)
  }, [])

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

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  // Phase transitions
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
        setPhase('moderation-processing')
        setModerationSteps(
          currentScenario.moderationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description,
            status: 'pending' as StepStatus,
            details: s.details,
            score: s.score,
            isViolation: s.isViolation,
          }))
        )
        setCurrentStepIndex(0)
        setShowPersonality(true)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'moderation-processing' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.moderationSteps.length) {
        const step = currentScenario.moderationSteps[currentStepIndex]

        setModerationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        const timer = setTimeout(() => {
          if (currentScenario.blocked && currentScenario.blockedAt === step.id) {
            setModerationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'blocked' as StepStatus } : s
              )
            )
            setExpandedSteps((prev) => new Set([...prev, step.id]))

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

          setModerationSteps((prev) =>
            prev.map((s, i) =>
              i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
            )
          )

          setTimeout(() => {
            setCurrentStepIndex((prev) => prev + 1)
          }, 400)
        }, 800)

        return () => clearTimeout(timer)
      } else {
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

  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  const chatHeader: DemoChatHeaderConfig = {
    icon: MessageCircle,
    title: 'ElizaOS Agent',
    subtitle: 'Social Media Moderation',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'violet',
  }

  const displaySteps =
    phase === 'idle'
      ? currentScenario.moderationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : moderationSteps

  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Initializing content moderation...
        </>
      )
    }
    if (phase === 'moderation-processing') {
      return (
        <>
          <Shield className="h-4 w-4 animate-pulse text-violet-500" />
          <span className="text-violet-500">
            Moderation check {currentStepIndex + 1} of {currentScenario.moderationSteps.length}
          </span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={MessageCircle}
        badge="ElizaOS + GuardianClaw"
        title="Social Agent Moderation"
        subtitle="Watch how GuardianClaw moderates social media agent responses across platforms"
        theme="violet"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Appropriate Response"
        blockedLabel="Toxic Content"
      />

      {/* Social Posts Preview */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
            Incoming Message
          </p>
          <SocialPostCard post={currentScenario.incomingPost} />
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">Agent Draft</p>
          <SocialPostCard
            post={currentScenario.agentDraft}
            isHighlighted={phase !== 'idle'}
            showToxicity={phase !== 'idle' && currentScenario.agentDraft.isToxic}
          />
        </div>
      </div>

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          showThinking={phase === 'system-ack' || phase === 'moderation-processing'}
          thinkingContent={getThinkingContent()}
          messagesHeight={320}
        />

        {/* Moderation Pipeline */}
        <DemoSection title="Content Moderation" icon={Shield} theme="violet">
          <div className="space-y-3">
            {/* Moderation steps */}
            <div className="space-y-1">
              {displaySteps.map((step) => (
                <ModerationStepCard
                  key={step.id}
                  step={step}
                  isExpanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStepExpansion(step.id)}
                />
              ))}
            </div>

            <FlowConnector height={12} />

            {/* Personality meter */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <PersonalityMeter
                traits={currentScenario.personalityTraits}
                isActive={showPersonality}
              />
            </div>

            <FlowConnector height={12} />

            {/* Result */}
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
                    <Send className="h-5 w-5 text-zinc-500" />
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
                        ? 'Post Blocked'
                        : 'Post Approved'
                      : 'Awaiting Moderation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Content violates guidelines'
                        : 'Ready to publish'
                      : 'Pending content review'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="violet" />

      {/* Progress */}
      <DemoProgress
        phases={[
          'typing-user',
          'system-ack',
          'moderation-processing',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="violet"
      />
    </div>
  )
}

export default ElizaOSDemo
