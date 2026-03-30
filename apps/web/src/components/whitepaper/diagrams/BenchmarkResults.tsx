'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Trophy,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

/**
 * Benchmark category configuration
 */
interface BenchmarkCategory {
  id: string
  name: string
  shortName: string
  description: string
  attackSurface: string
}

/**
 * Model benchmark result
 */
interface ModelResult {
  id: string
  name: string
  provider: string
  results: Record<string, number>
  average: number
  highlight?: boolean
}

/**
 * Props for BenchmarkResults component
 */
export interface BenchmarkResultsProps {
  /** Animate bars on mount/scroll into view */
  animated?: boolean
  /** Show detailed tooltips on hover */
  showTooltips?: boolean
  /** Compact mode for mobile */
  compact?: boolean
  /** Show model details on expand */
  expandable?: boolean
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                              Configuration                                  */
/* -------------------------------------------------------------------------- */

const BENCHMARKS: BenchmarkCategory[] = [
  {
    id: 'avoidance',
    name: 'HarmBench',
    shortName: 'Avoidance',
    description: 'Direct harmful requests, 400+ behaviors',
    attackSurface: 'LLM (Text)',
  },
  {
    id: 'agent',
    name: 'SafeAgentBench',
    shortName: 'Agent',
    description: 'Embodied AI safety, task manipulation',
    attackSurface: 'Agent (Digital)',
  },
  {
    id: 'robot',
    name: 'BadRobot',
    shortName: 'Robot',
    description: '277 physical robot safety scenarios',
    attackSurface: 'Robot (Physical)',
  },
  {
    id: 'jail',
    name: 'JailbreakBench',
    shortName: 'Jail',
    description: 'Standard jailbreak attempts, latest techniques',
    attackSurface: 'All Surfaces',
  },
]

const MODEL_RESULTS: ModelResult[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o-mini',
    provider: 'OpenAI',
    results: { avoidance: 100, agent: 98, robot: 100, jail: 100 },
    average: 99.5,
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    results: { avoidance: 98, agent: 98, robot: 100, jail: 94 },
    average: 97.5,
  },
  {
    id: 'qwen',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    results: { avoidance: 96, agent: 98, robot: 98, jail: 94 },
    average: 96.5,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    results: { avoidance: 100, agent: 96, robot: 100, jail: 100 },
    average: 99.0,
  },
  {
    id: 'llama',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    results: { avoidance: 88, agent: 94, robot: 98, jail: 94 },
    average: 93.5,
  },
  {
    id: 'mistral',
    name: 'Mistral Small',
    provider: 'Mistral',
    results: { avoidance: 98, agent: 100, robot: 100, jail: 100 },
    average: 99.5,
  },
]

// Calculate averages per benchmark
const BENCHMARK_AVERAGES: Record<string, number> = {
  avoidance: 96.7,
  agent: 97.3,
  robot: 99.3,
  jail: 97.0,
}

const OVERALL_AVERAGE = 97.6

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                               */
/* -------------------------------------------------------------------------- */

/**
 * Get color theme based on score
 */
function getScoreTheme(score: number): {
  bg: string
  bgBar: string
  text: string
  border: string
  icon: typeof CheckCircle2
} {
  if (score >= 95) {
    return {
      bg: 'bg-green-500/10',
      bgBar: 'bg-green-500',
      text: 'text-green-400',
      border: 'border-green-500/30',
      icon: CheckCircle2,
    }
  }
  if (score >= 90) {
    return {
      bg: 'bg-amber-500/10',
      bgBar: 'bg-amber-500',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      icon: AlertCircle,
    }
  }
  return {
    bg: 'bg-red-500/10',
    bgBar: 'bg-red-500',
    text: 'text-red-400',
    border: 'border-red-500/30',
    icon: XCircle,
  }
}

/**
 * Format percentage display
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/* -------------------------------------------------------------------------- */
/*                              Helper Components                              */
/* -------------------------------------------------------------------------- */

/**
 * Animated progress bar
 */
const ProgressBar = memo(function ProgressBar({
  value,
  animated,
  delay,
  showValue,
  compact,
}: {
  value: number
  animated: boolean
  delay: number
  showValue?: boolean
  compact?: boolean
}) {
  const theme = getScoreTheme(value)
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value)

  useEffect(() => {
    if (!animated) {
      setDisplayValue(value)
      return
    }

    const timeout = setTimeout(() => {
      const duration = 800
      const steps = 30
      const increment = value / steps
      let current = 0
      let step = 0

      const interval = setInterval(() => {
        step++
        current = Math.min(value, increment * step)
        setDisplayValue(current)

        if (step >= steps) {
          clearInterval(interval)
          setDisplayValue(value)
        }
      }, duration / steps)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timeout)
  }, [value, animated, delay])

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-zinc-800',
          compact ? 'h-2 flex-1' : 'h-3 w-24'
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${displayValue}%` }}
          transition={{ duration: 0.8, delay: delay / 1000, ease: 'easeOut' }}
          className={cn('absolute inset-y-0 left-0 rounded-full', theme.bgBar)}
        />
      </div>
      {showValue && (
        <span
          className={cn('font-mono font-semibold', compact ? 'text-xs' : 'text-sm', theme.text)}
        >
          {formatPercent(displayValue)}
        </span>
      )}
    </div>
  )
})

/**
 * Score cell with tooltip
 */
const ScoreCell = memo(function ScoreCell({
  score,
  benchmark,
  animated,
  delay,
  showTooltip,
  compact,
}: {
  score: number
  benchmark: BenchmarkCategory
  animated: boolean
  delay: number
  showTooltip?: boolean
  compact?: boolean
}) {
  const [isHovered, setIsHovered] = useState(false)
  const theme = getScoreTheme(score)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn('flex flex-col gap-1', compact ? 'items-center' : '')}>
        <ProgressBar
          value={score}
          animated={animated}
          delay={delay}
          showValue={!compact}
          compact={compact}
        />
        {compact && (
          <span className={cn('font-mono text-xs font-semibold', theme.text)}>{score}%</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl"
            >
              <p className="mb-1 text-xs font-semibold text-white">{benchmark.name}</p>
              <p className="mb-2 text-[10px] text-zinc-400">{benchmark.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">Attack Surface:</span>
                <span className="text-[10px] text-zinc-300">{benchmark.attackSurface}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">Safety Rate:</span>
                <span className={cn('text-xs font-semibold', theme.text)}>{score}%</span>
              </div>
              {/* Arrow */}
              <div className="absolute left-1/2 top-full -mt-px -translate-x-1/2">
                <div className="h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-zinc-700 bg-zinc-900" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
})

/**
 * Model row in table
 */
const ModelRow = memo(function ModelRow({
  model,
  index,
  animated,
  showTooltips,
  compact,
  expanded,
  onToggle,
  expandable,
}: {
  model: ModelResult
  index: number
  animated: boolean
  showTooltips: boolean
  compact: boolean
  expanded: boolean
  onToggle: () => void
  expandable: boolean
}) {
  const avgTheme = getScoreTheme(model.average)
  const baseDelay = index * 150

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: baseDelay / 1000 }}
        className={cn(
          'border-b border-zinc-800 transition-colors',
          model.highlight ? 'bg-green-500/5' : 'hover:bg-zinc-900/50'
        )}
      >
        {/* Model name */}
        <td className={cn('py-3', compact ? 'px-2' : 'px-4')}>
          <div className="flex items-center gap-2">
            {expandable && (
              <button
                onClick={onToggle}
                className="rounded p-0.5 transition-colors hover:bg-zinc-800"
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                )}
              </button>
            )}
            <div>
              <p className={cn('font-medium text-white', compact ? 'text-xs' : 'text-sm')}>
                {model.name}
              </p>
              {!compact && <p className="text-[10px] text-zinc-500">{model.provider}</p>}
            </div>
          </div>
        </td>

        {/* Benchmark scores */}
        {BENCHMARKS.map((benchmark, bIndex) => (
          <td key={benchmark.id} className={cn('py-3', compact ? 'px-2' : 'px-3')}>
            <ScoreCell
              score={model.results[benchmark.id]}
              benchmark={benchmark}
              animated={animated}
              delay={baseDelay + bIndex * 50}
              showTooltip={showTooltips}
              compact={compact}
            />
          </td>
        ))}

        {/* Average */}
        <td className={cn('py-3', compact ? 'px-2' : 'px-4')}>
          <div className={cn('flex items-center gap-2', compact && 'justify-center')}>
            <span
              className={cn(
                'font-mono font-bold',
                compact ? 'text-sm' : 'text-base',
                avgTheme.text
              )}
            >
              {formatPercent(model.average)}
            </span>
            {model.average >= 99 && !compact && <Trophy className="h-4 w-4 text-amber-500" />}
          </div>
        </td>
      </motion.tr>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && expandable && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <td colSpan={BENCHMARKS.length + 2} className="bg-zinc-900/30 px-4 py-3">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {BENCHMARKS.map((benchmark) => {
                  const score = model.results[benchmark.id]
                  const theme = getScoreTheme(score)
                  return (
                    <div
                      key={benchmark.id}
                      className={cn('rounded-lg border p-3', theme.border, theme.bg)}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <theme.icon className={cn('h-4 w-4', theme.text)} />
                        <span className="text-xs font-medium text-zinc-300">{benchmark.name}</span>
                      </div>
                      <p className={cn('text-lg font-bold', theme.text)}>{score}%</p>
                      <p className="mt-1 text-[10px] text-zinc-500">{benchmark.attackSurface}</p>
                    </div>
                  )
                })}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
})

/**
 * Average row (footer)
 */
const AverageRow = memo(function AverageRow({
  animated,
  compact,
}: {
  animated: boolean
  compact: boolean
}) {
  const baseDelay = MODEL_RESULTS.length * 150 + 200
  const avgTheme = getScoreTheme(OVERALL_AVERAGE)

  return (
    <motion.tr
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: baseDelay / 1000 }}
      className="border-t-2 border-green-500/30 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent"
    >
      <td className={cn('py-4', compact ? 'px-2' : 'px-4')}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-green-500" />
          <span className={cn('font-bold text-green-400', compact ? 'text-xs' : 'text-sm')}>
            Average
          </span>
        </div>
      </td>

      {BENCHMARKS.map((benchmark, index) => {
        const avg = BENCHMARK_AVERAGES[benchmark.id]
        const theme = getScoreTheme(avg)
        return (
          <td key={benchmark.id} className={cn('py-4', compact ? 'px-2' : 'px-3')}>
            <ProgressBar
              value={avg}
              animated={animated}
              delay={baseDelay + index * 50}
              showValue={!compact}
              compact={compact}
            />
            {compact && (
              <span
                className={cn('mt-1 block text-center font-mono text-xs font-semibold', theme.text)}
              >
                {avg}%
              </span>
            )}
          </td>
        )
      })}

      <td className={cn('py-4', compact ? 'px-2' : 'px-4')}>
        <div className={cn('flex items-center gap-2', compact && 'justify-center')}>
          <span
            className={cn('font-mono font-bold', compact ? 'text-lg' : 'text-xl', avgTheme.text)}
          >
            {formatPercent(OVERALL_AVERAGE)}
          </span>
          <TrendingUp className="h-5 w-5 text-green-500" />
        </div>
      </td>
    </motion.tr>
  )
})

/**
 * Mobile card view
 */
const MobileCard = memo(function MobileCard({
  model,
  index,
  animated,
}: {
  model: ModelResult
  index: number
  animated: boolean
}) {
  const avgTheme = getScoreTheme(model.average)
  const baseDelay = index * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: baseDelay / 1000 }}
      className={cn(
        'rounded-xl border p-4',
        model.highlight ? 'border-green-500/50 bg-green-500/5' : 'border-zinc-800 bg-zinc-900/50'
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">{model.name}</p>
          <p className="text-xs text-zinc-500">{model.provider}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-2xl font-bold', avgTheme.text)}>
            {model.average}%
          </span>
          {model.average >= 99 && <Trophy className="h-5 w-5 text-amber-500" />}
        </div>
      </div>

      {/* Benchmarks grid */}
      <div className="grid grid-cols-2 gap-2">
        {BENCHMARKS.map((benchmark, bIndex) => {
          const score = model.results[benchmark.id]
          const theme = getScoreTheme(score)
          return (
            <div
              key={benchmark.id}
              className={cn('rounded-lg p-2', theme.bg, theme.border, 'border')}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">{benchmark.shortName}</span>
                <span className={cn('font-mono text-xs font-semibold', theme.text)}>{score}%</span>
              </div>
              <ProgressBar
                value={score}
                animated={animated}
                delay={baseDelay + bIndex * 50}
                showValue={false}
                compact
              />
            </div>
          )
        })}
      </div>
    </motion.div>
  )
})

/* -------------------------------------------------------------------------- */
/*                              Main Component                                 */
/* -------------------------------------------------------------------------- */

/**
 * BenchmarkResults - Interactive visualization of GuardianClaw benchmark performance
 *
 * Displays safety benchmark results across multiple models with animated
 * progress bars and color-coded scores.
 *
 * Features:
 * - Table view with animated progress bars
 * - Color-coded scores (green 95%+, amber 90-94%, red <90%)
 * - Expandable rows with detailed breakdown
 * - Mobile card layout
 * - Hover tooltips with benchmark details
 * - Average row with highlight
 *
 * @example
 * ```tsx
 * <BenchmarkResults
 *   animated
 *   showTooltips
 *   expandable
 * />
 * ```
 */
export const BenchmarkResults = memo(function BenchmarkResults({
  animated = true,
  showTooltips = true,
  compact = false,
  expandable = true,
  className,
}: BenchmarkResultsProps) {
  // Intersection observer for animation trigger
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(!animated)
  const [expandedModel, setExpandedModel] = useState<string | null>(null)

  useEffect(() => {
    if (!animated) {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [animated])

  const toggleModel = (modelId: string) => {
    setExpandedModel(expandedModel === modelId ? null : modelId)
  }

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      role="region"
      aria-label="Benchmark Results"
    >
      {/* Container */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/20">
                <BarChart3 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Benchmark Performance</h3>
                <p className="text-xs text-zinc-500">6 models × 4 benchmarks × 3 runs each</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">Overall:</span>
              <span className="font-mono text-xl font-bold text-green-400">
                {formatPercent(OVERALL_AVERAGE)}
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="border-b border-zinc-800 bg-zinc-900/20 px-6 py-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="text-zinc-500">Safety Rate:</span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-zinc-400">95-100%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-zinc-400">90-94%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-zinc-400">&lt;90%</span>
            </span>
            {showTooltips && (
              <span className="flex items-center gap-1.5 text-zinc-600">
                <Info className="h-3 w-3" />
                Hover for details
              </span>
            )}
          </div>
        </div>

        {/* Desktop table */}
        <div className={cn('overflow-x-auto', compact ? 'block' : 'hidden md:block')}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th
                  className={cn(
                    'py-3 text-left font-medium text-zinc-400',
                    compact ? 'px-2 text-xs' : 'px-4 text-sm'
                  )}
                >
                  Model
                </th>
                {BENCHMARKS.map((benchmark) => (
                  <th
                    key={benchmark.id}
                    className={cn(
                      'py-3 text-left font-medium text-zinc-400',
                      compact ? 'px-2 text-xs' : 'px-3 text-sm'
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {compact ? benchmark.shortName : benchmark.name}
                      {!compact && (
                        <span className="text-[10px] font-normal text-zinc-600">
                          ({benchmark.attackSurface})
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th
                  className={cn(
                    'py-3 text-left font-medium text-zinc-400',
                    compact ? 'px-2 text-xs' : 'px-4 text-sm'
                  )}
                >
                  Average
                </th>
              </tr>
            </thead>
            <tbody>
              {MODEL_RESULTS.map((model, index) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  index={index}
                  animated={isInView && animated}
                  showTooltips={showTooltips}
                  compact={compact}
                  expanded={expandedModel === model.id}
                  onToggle={() => toggleModel(model.id)}
                  expandable={expandable}
                />
              ))}
              <AverageRow animated={isInView && animated} compact={compact} />
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        {!compact && (
          <div className="space-y-3 p-4 md:hidden">
            {MODEL_RESULTS.map((model, index) => (
              <MobileCard
                key={model.id}
                model={model}
                index={index}
                animated={isInView && animated}
              />
            ))}

            {/* Mobile average card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: MODEL_RESULTS.length * 0.1 + 0.2 }}
              className="rounded-xl border-2 border-green-500/50 bg-gradient-to-br from-green-500/10 to-transparent p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-green-500" />
                  <span className="font-bold text-green-400">Overall Average</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-3xl font-bold text-green-400">
                    {formatPercent(OVERALL_AVERAGE)}
                  </span>
                  <TrendingUp className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {BENCHMARKS.map((benchmark) => {
                  const avg = BENCHMARK_AVERAGES[benchmark.id]
                  const theme = getScoreTheme(avg)
                  return (
                    <div key={benchmark.id} className="text-center">
                      <span className={cn('font-mono text-sm font-bold', theme.text)}>{avg}%</span>
                      <p className="text-[10px] text-zinc-500">{benchmark.shortName}</p>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Screen reader summary */}
      <div className="sr-only" role="status" aria-live="polite">
        {isInView && (
          <span>
            Benchmark results loaded. Overall safety rate: {OVERALL_AVERAGE}% across 6 models and 4
            benchmarks. Highest scores: BadRobot at {BENCHMARK_AVERAGES.robot}%, SafeAgentBench at{' '}
            {BENCHMARK_AVERAGES.agent}%.
          </span>
        )}
      </div>
    </div>
  )
})

export default BenchmarkResults
