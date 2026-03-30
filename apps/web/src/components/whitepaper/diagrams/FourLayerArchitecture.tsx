'use client'

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Shield,
  Cpu,
  FileOutput,
  Eye,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  FourLayerArchitectureProps,
  ArchitectureLayer,
  LayerAnimationState,
  DiagramState,
} from './types'
import { diagramThemeColors, diagramStateColors } from './types'

/* -------------------------------------------------------------------------- */
/*                              Layer Configuration                            */
/* -------------------------------------------------------------------------- */

const LAYERS: ArchitectureLayer[] = [
  {
    id: 'L1',
    name: 'Input Validator',
    label: 'L1 Input',
    description: 'Pre-AI attack detection with 700+ patterns across 9 categories',
    icon: Shield,
    theme: 'blue',
    function: 'Detect attacks before they reach the LLM',
    features: [
      'Pattern matching (700+ signatures)',
      'Escalation detection',
      'Framing analysis',
      'Physical safety checks',
    ],
  },
  {
    id: 'L2',
    name: 'Seed Injection',
    label: 'L2 Seed',
    description: 'Alignment via system prompt with CLAW protocol',
    icon: Cpu,
    theme: 'claw',
    function: 'Inject ethical guidelines into context',
    features: [
      'CLAW protocol (Credibility, Limits, Avoidance, Worth)',
      'Anti-self-preservation principles',
      'Priority hierarchy enforcement',
      'Contextual alignment',
    ],
  },
  {
    id: 'L3',
    name: 'Output Validator',
    label: 'L3 Output',
    description: 'Post-AI heuristic checking for harmful outputs',
    icon: FileOutput,
    theme: 'amber',
    function: 'Validate AI responses before execution',
    features: [
      'Avoidance pattern detection',
      'Limits boundary enforcement',
      'Response sanitization',
      'Action validation',
    ],
  },
  {
    id: 'L4',
    name: 'GuardianClaw Observer',
    label: 'L4 Observer',
    description: 'LLM-based transcript analysis for deep inspection',
    icon: Eye,
    theme: 'teal',
    function: 'Comprehensive session analysis',
    features: [
      'Full transcript review',
      'Behavioral pattern analysis',
      'Multi-turn attack detection',
      'Trust score calculation',
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*                            Scenario Configuration                           */
/* -------------------------------------------------------------------------- */

interface ScenarioConfig {
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** Layer index where the request gets blocked (-1 = no block, full pass) */
  blockedAtIndex: number
  /** Whether this scenario represents a threat */
  isThreat: boolean
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'safe',
    name: 'Full Pass',
    description: 'Request passes all 4 validation layers',
    icon: CheckCircle2,
    blockedAtIndex: -1,
    isThreat: false,
  },
  {
    id: 'blocked-L1',
    name: 'Input Attack',
    description: 'Injection pattern detected and blocked at L1',
    icon: Shield,
    blockedAtIndex: 0,
    isThreat: true,
  },
  {
    id: 'blocked-L3',
    name: 'Data Leak',
    description: 'Sensitive data in output blocked at L3',
    icon: FileOutput,
    blockedAtIndex: 2,
    isThreat: true,
  },
  {
    id: 'flagged-L4',
    name: 'Observer Flag',
    description: 'Behavioral concern flagged by L4 Observer',
    icon: Eye,
    blockedAtIndex: 3,
    isThreat: true,
  },
]

function getScenarioById(id: string): ScenarioConfig {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0]
}

/* -------------------------------------------------------------------------- */
/*                              Helper Components                              */
/* -------------------------------------------------------------------------- */

/**
 * Flow particle animation between layers
 */
const FlowParticle = memo(function FlowParticle({
  active,
  fromIndex,
  toIndex,
  blocked,
}: {
  active: boolean
  fromIndex: number
  toIndex: number
  blocked?: boolean
}) {
  if (!active) return null

  const color = blocked ? 'bg-red-500' : 'bg-green-500'

  return (
    <motion.div
      className={cn('absolute z-20 h-3 w-3 rounded-full', color)}
      style={{ top: '50%', left: 0 }}
      initial={{ x: 0, y: '-50%', opacity: 0, scale: 0.5 }}
      animate={{
        x: '100%',
        opacity: [0, 1, 1, blocked ? 1 : 0],
        scale: [0.5, 1, 1, blocked ? 1.5 : 0.5],
      }}
      transition={{
        duration: blocked ? 0.4 : 0.6,
        ease: 'easeInOut',
      }}
      aria-hidden="true"
    />
  )
})

/**
 * Connection line between layers
 */
const ConnectionLine = memo(function ConnectionLine({
  active,
  complete,
  blocked,
}: {
  active: boolean
  complete: boolean
  blocked: boolean
}) {
  const getColor = () => {
    if (blocked) return 'bg-red-500/50'
    if (complete) return 'bg-green-500/50'
    if (active) return 'bg-zinc-600'
    return 'bg-zinc-800'
  }

  return (
    <div className="relative flex w-8 flex-shrink-0 items-center md:w-12 lg:w-16">
      <motion.div
        className={cn('h-0.5 w-full transition-colors duration-300', getColor())}
        initial={false}
      />
      <ChevronRight
        className={cn(
          'absolute right-0 -mr-2 h-4 w-4 transition-colors duration-300',
          blocked ? 'text-red-500' : complete ? 'text-green-500' : 'text-zinc-600'
        )}
      />
      {active && !complete && !blocked && (
        <FlowParticle active fromIndex={0} toIndex={1} blocked={blocked} />
      )}
    </div>
  )
})

/**
 * Individual layer card
 */
const LayerCard = memo(function LayerCard({
  layer,
  state,
  expanded,
  onClick,
  compact,
}: {
  layer: ArchitectureLayer
  state: DiagramState
  expanded: boolean
  onClick: () => void
  compact?: boolean
}) {
  const Icon = layer.icon
  const themeColors = diagramThemeColors[layer.theme]
  const stateColors = diagramStateColors[state]

  // Determine colors based on state
  const getColors = () => {
    if (state === 'blocked') {
      return {
        border: stateColors.border,
        bg: stateColors.bg,
        text: stateColors.text,
        iconBg: stateColors.iconBg,
      }
    }
    if (state === 'complete') {
      return {
        border: stateColors.border,
        bg: stateColors.bg,
        text: stateColors.text,
        iconBg: stateColors.iconBg,
      }
    }
    if (state === 'active') {
      return {
        border: themeColors.borderActive,
        bg: themeColors.bgActive,
        text: themeColors.text,
        iconBg: themeColors.iconBg,
      }
    }
    return {
      border: 'border-zinc-800',
      bg: 'bg-zinc-900/30',
      text: 'text-zinc-500',
      iconBg: 'bg-zinc-800',
    }
  }

  const colors = getColors()

  // Render status icon
  const renderStatusIcon = () => {
    if (state === 'blocked') {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    if (state === 'complete') {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
    if (state === 'active') {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className={cn('h-4 w-4', themeColors.text)} />
        </motion.div>
      )
    }
    return null
  }

  const isL4 = layer.id === 'L4'

  return (
    <motion.button
      className={cn(
        'relative min-w-0 flex-1 rounded-xl border-2 transition-all duration-300',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        colors.border,
        colors.bg,
        isL4 && 'border-dashed',
        state === 'active' && 'shadow-lg',
        state === 'active' && themeColors.glow,
        compact ? 'p-2 md:p-3' : 'p-3 md:p-4'
      )}
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`${layer.name}: ${layer.description}`}
      layout
    >
      {/* Async badge for L4 */}
      {isL4 && (
        <span className="absolute -top-2 right-2 rounded-full border border-teal-500/30 bg-teal-500/20 px-1.5 py-0.5 font-mono text-[9px] text-teal-400">
          async
        </span>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        {/* Layer ID badge */}
        <div
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider',
            colors.iconBg,
            colors.text
          )}
        >
          {layer.id}
        </div>

        {/* Icon */}
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg md:h-12 md:w-12',
            colors.iconBg
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5 transition-colors md:h-6 md:w-6',
              state === 'idle' ? 'text-zinc-500' : colors.text
            )}
          />
        </div>

        {/* Label */}
        <div className="space-y-0.5">
          <p
            className={cn(
              'text-xs font-semibold transition-colors md:text-sm',
              state === 'idle' ? 'text-zinc-400' : colors.text
            )}
          >
            {compact ? layer.label : layer.name}
          </p>
          {!compact && (
            <p className="line-clamp-1 text-[10px] text-zinc-500 md:text-xs">{layer.function}</p>
          )}
        </div>

        {/* Status indicator */}
        <div className="h-4">{renderStatusIcon()}</div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && !compact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-zinc-800 pt-3 text-left">
              <p className="mb-2 text-xs text-zinc-400">{layer.description}</p>
              <ul className="space-y-1">
                {layer.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[10px] text-zinc-500">
                    <span
                      className={cn('mt-1 h-1 w-1 flex-shrink-0 rounded-full', colors.iconBg)}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
})

/**
 * Scenario selector component — supports multiple blocking scenarios
 */
const ScenarioSelector = memo(function ScenarioSelector({
  scenario,
  onScenarioChange,
  disabled,
}: {
  scenario: string
  onScenarioChange: (s: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Demo scenario">
      {SCENARIOS.map((s) => {
        const Icon = s.icon
        const isSelected = scenario === s.id
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onScenarioChange(s.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
              isSelected &&
                !s.isThreat &&
                'border border-green-500/50 bg-green-500/20 text-green-500',
              isSelected && s.isThreat && 'border border-red-500/50 bg-red-500/20 text-red-500',
              !isSelected &&
                'border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {s.name}
            </span>
          </button>
        )
      })}
    </div>
  )
})

/**
 * Playback controls component
 */
const PlaybackControls = memo(function PlaybackControls({
  isPlaying,
  onPlay,
  onReset,
  disabled,
}: {
  isPlaying: boolean
  onPlay: () => void
  onReset: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPlay}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
          isPlaying
            ? 'border border-amber-500/50 bg-amber-500/20 text-amber-500'
            : 'border border-green-500/50 bg-green-500/20 text-green-500 hover:bg-green-500/30',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
      >
        {isPlaying ? (
          <>
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Play</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
          'border border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500'
        )}
        aria-label="Reset animation"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/*                            Main Component                                   */
/* -------------------------------------------------------------------------- */

/**
 * FourLayerArchitecture - Animated diagram of the 4-layer validation architecture
 *
 * Visualizes the flow of requests through the GuardianClaw validation pipeline:
 * L1 (Input) → L2 (Seed) → L3 (Output) → L4 (Observer)
 *
 * Features:
 * - Auto-play animation with configurable speed
 * - Interactive layer cards with expanded details
 * - Safe/blocked scenario demonstration
 * - Responsive design with compact mode
 * - Full keyboard accessibility
 *
 * @example
 * ```tsx
 * <FourLayerArchitecture
 *   autoPlay={false}
 *   interactive
 *   stepDuration={1000}
 * />
 * ```
 */
export const FourLayerArchitecture = memo(function FourLayerArchitecture({
  autoPlay = false,
  stepDuration = 1200,
  interactive = true,
  compact = false,
  initialLayer,
  onLayerSelect,
  className,
}: FourLayerArchitectureProps) {
  // Animation state
  const [animState, setAnimState] = useState<LayerAnimationState>({
    activeIndex: -1,
    completedIndices: [],
    blockedIndex: -1,
    isPlaying: false,
    scenario: 'safe',
  })

  // Expanded layer for details
  const [expandedLayer, setExpandedLayer] = useState<string | null>(initialLayer ?? null)

  // Animation timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Determine layer state
  const getLayerState = useCallback(
    (index: number): DiagramState => {
      if (animState.blockedIndex === index) return 'blocked'
      if (animState.completedIndices.includes(index)) return 'complete'
      if (animState.activeIndex === index) return 'active'
      return 'idle'
    },
    [animState]
  )

  // Ref for async L4 timers
  const asyncTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Animation step function
  const runAnimationStep = useCallback(() => {
    setAnimState((prev) => {
      const nextIndex = prev.activeIndex + 1
      const scenarioConfig = getScenarioById(prev.scenario)

      // For "flagged-L4" scenario: L4 is async — complete L1-L3 first, then trigger L4 post-response
      if (scenarioConfig.id === 'flagged-L4' && nextIndex === scenarioConfig.blockedAtIndex) {
        // Complete L3 (index 2), stop main animation, enter async pending phase
        return {
          ...prev,
          activeIndex: -1,
          completedIndices:
            prev.activeIndex >= 0
              ? [...prev.completedIndices, prev.activeIndex]
              : prev.completedIndices,
          isPlaying: false,
          asyncPhase: 'pending' as const,
        }
      }

      // Check if we should block at this layer (non-async scenarios)
      if (scenarioConfig.blockedAtIndex >= 0 && nextIndex === scenarioConfig.blockedAtIndex) {
        return {
          ...prev,
          activeIndex: nextIndex,
          blockedIndex: nextIndex,
          completedIndices:
            prev.activeIndex >= 0
              ? [...prev.completedIndices, prev.activeIndex]
              : prev.completedIndices,
          isPlaying: false,
        }
      }

      // Check if animation complete
      if (nextIndex >= LAYERS.length) {
        return {
          ...prev,
          activeIndex: -1,
          completedIndices: LAYERS.map((_, i) => i),
          isPlaying: false,
        }
      }

      // Move to next layer
      return {
        ...prev,
        activeIndex: nextIndex,
        completedIndices:
          prev.activeIndex >= 0
            ? [...prev.completedIndices, prev.activeIndex]
            : prev.completedIndices,
      }
    })
  }, [])

  // L4 async phase progression: pending → analyzing → flagged
  useEffect(() => {
    if (animState.asyncPhase === 'pending') {
      asyncTimerRef.current = setTimeout(() => {
        setAnimState((prev) => ({
          ...prev,
          activeIndex: 3, // L4 becomes active
          asyncPhase: 'analyzing' as const,
        }))
      }, 1500)
    } else if (animState.asyncPhase === 'analyzing') {
      asyncTimerRef.current = setTimeout(() => {
        setAnimState((prev) => ({
          ...prev,
          activeIndex: 3,
          blockedIndex: 3,
          asyncPhase: 'flagged' as const,
        }))
      }, 1200)
    }
    return () => {
      if (asyncTimerRef.current) {
        clearTimeout(asyncTimerRef.current)
      }
    }
  }, [animState.asyncPhase])

  // Start animation
  const startAnimation = useCallback(() => {
    if (asyncTimerRef.current) {
      clearTimeout(asyncTimerRef.current)
      asyncTimerRef.current = null
    }
    // Reset state first
    setAnimState((prev) => ({
      ...prev,
      activeIndex: -1,
      completedIndices: [],
      blockedIndex: -1,
      isPlaying: true,
      asyncPhase: undefined,
    }))

    // Start the animation loop
    setTimeout(runAnimationStep, 300)
  }, [runAnimationStep])

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (animState.isPlaying) {
      // Pause
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setAnimState((prev) => ({ ...prev, isPlaying: false }))
    } else {
      // Resume or start
      if (animState.asyncPhase) {
        // Async phase in progress or done — restart
        startAnimation()
      } else if (animState.activeIndex === -1 && animState.completedIndices.length === 0) {
        startAnimation()
      } else if (
        animState.blockedIndex === -1 &&
        animState.completedIndices.length < LAYERS.length
      ) {
        setAnimState((prev) => ({ ...prev, isPlaying: true }))
      } else {
        startAnimation()
      }
    }
  }, [animState, startAnimation])

  // Handle reset
  const handleReset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (asyncTimerRef.current) {
      clearTimeout(asyncTimerRef.current)
      asyncTimerRef.current = null
    }
    setAnimState({
      activeIndex: -1,
      completedIndices: [],
      blockedIndex: -1,
      isPlaying: false,
      scenario: animState.scenario,
      asyncPhase: undefined,
    })
    setExpandedLayer(null)
  }, [animState.scenario])

  // Handle scenario change
  const handleScenarioChange = useCallback((scenario: string) => {
    if (asyncTimerRef.current) {
      clearTimeout(asyncTimerRef.current)
      asyncTimerRef.current = null
    }
    setAnimState((prev) => ({
      ...prev,
      scenario,
      activeIndex: -1,
      completedIndices: [],
      blockedIndex: -1,
      isPlaying: false,
      asyncPhase: undefined,
    }))
  }, [])

  // Handle layer click
  const handleLayerClick = useCallback(
    (layerId: string) => {
      if (!interactive) return
      const newExpanded = expandedLayer === layerId ? null : layerId
      setExpandedLayer(newExpanded)
      onLayerSelect?.(newExpanded)
    },
    [interactive, expandedLayer, onLayerSelect]
  )

  // Animation loop effect
  useEffect(() => {
    if (animState.isPlaying && animState.blockedIndex === -1) {
      timerRef.current = setTimeout(runAnimationStep, stepDuration)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [
    animState.isPlaying,
    animState.activeIndex,
    animState.blockedIndex,
    stepDuration,
    runAnimationStep,
  ])

  // Auto-play on mount
  useEffect(() => {
    if (autoPlay) {
      const timeout = setTimeout(startAnimation, 500)
      return () => clearTimeout(timeout)
    }
  }, [autoPlay, startAnimation])

  // Check if animation is complete or blocked
  const isComplete = animState.completedIndices.length === LAYERS.length
  const isBlocked = animState.blockedIndex >= 0

  return (
    <div
      className={cn('w-full', className)}
      role="region"
      aria-label="Four Layer Architecture Diagram"
    >
      {/* Controls header */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <ScenarioSelector
          scenario={animState.scenario}
          onScenarioChange={handleScenarioChange}
          disabled={animState.isPlaying}
        />
        <PlaybackControls
          isPlaying={animState.isPlaying}
          onPlay={handlePlayPause}
          onReset={handleReset}
          disabled={false}
        />
      </div>

      {/* Main diagram */}
      <div
        className={cn(
          'relative rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 md:p-6',
          'overflow-hidden'
        )}
      >
        {/* Status banner */}
        <AnimatePresence mode="wait">
          {/* Async L4 banners — two-stage transition */}
          {animState.asyncPhase === 'pending' && (
            <motion.div
              key="async-pending"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-0 border-b border-green-500/20 bg-green-500/10 px-4 py-2 text-center text-xs font-medium text-green-500"
            >
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Response delivered
              </span>
            </motion.div>
          )}
          {animState.asyncPhase === 'analyzing' && (
            <motion.div
              key="async-analyzing"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-400"
            >
              <span className="flex items-center justify-center gap-2">
                <Eye className="h-4 w-4 animate-pulse" />
                Response delivered. L4 Observer analyzing transcript...
              </span>
            </motion.div>
          )}
          {animState.asyncPhase === 'flagged' && (
            <motion.div
              key="async-flagged"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-0 right-0 top-0 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-center text-xs font-medium text-red-500"
            >
              <span className="flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4" />
                L4 Observer flagged behavioral concern
              </span>
            </motion.div>
          )}
          {/* Standard banners (non-async) */}
          {!animState.asyncPhase && (isComplete || isBlocked) && (
            <motion.div
              key="standard"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'absolute left-0 right-0 top-0 px-4 py-2 text-center text-xs font-medium',
                isBlocked
                  ? 'border-b border-red-500/20 bg-red-500/10 text-red-500'
                  : 'border-b border-green-500/20 bg-green-500/10 text-green-500'
              )}
            >
              {isBlocked ? (
                <span className="flex items-center justify-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {animState.blockedIndex >= 0 && LAYERS[animState.blockedIndex]
                    ? `Attack detected and blocked at ${LAYERS[animState.blockedIndex].label}`
                    : 'Attack detected and blocked'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Request validated successfully through all layers
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Layer cards with connections */}
        <div
          className={cn(
            'flex items-stretch justify-between gap-1',
            (isComplete || isBlocked || animState.asyncPhase) && 'mt-8'
          )}
        >
          {LAYERS.map((layer, index) => (
            <div key={layer.id} className="contents">
              {/* Layer card */}
              <LayerCard
                layer={layer}
                state={getLayerState(index)}
                expanded={expandedLayer === layer.id}
                onClick={() => handleLayerClick(layer.id)}
                compact={compact}
              />

              {/* Connection line (except after last) */}
              {index < LAYERS.length - 1 && (
                <ConnectionLine
                  active={animState.activeIndex === index}
                  complete={animState.completedIndices.includes(index)}
                  blocked={animState.blockedIndex === index}
                />
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-zinc-600" />
              Idle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              Processing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Complete
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Blocked
            </span>
          </div>
        </div>
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {animState.isPlaying && animState.activeIndex >= 0 && (
          <span>Processing at {LAYERS[animState.activeIndex]?.name}</span>
        )}
        {isComplete && !animState.asyncPhase && <span>All layers validated successfully</span>}
        {isBlocked && !animState.asyncPhase && animState.blockedIndex >= 0 && (
          <span>Request blocked at {LAYERS[animState.blockedIndex]?.name ?? 'unknown layer'}</span>
        )}
        {animState.asyncPhase === 'pending' && (
          <span>Response delivered. L4 Observer starting analysis.</span>
        )}
        {animState.asyncPhase === 'analyzing' && <span>L4 Observer analyzing transcript.</span>}
        {animState.asyncPhase === 'flagged' && <span>L4 Observer flagged behavioral concern.</span>}
      </div>
    </div>
  )
})

export default FourLayerArchitecture
