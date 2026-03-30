'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Crown,
  Zap,
  Lock,
  Brain,
  Bot,
  Cpu,
  Coins,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

/**
 * Coverage status for a domain
 */
type CoverageStatus = 'full' | 'partial' | 'none'

/**
 * Domain category configuration
 */
interface DomainCategory {
  id: string
  name: string
  shortName: string
  description: string
  icon: typeof Shield
}

/**
 * Competitor configuration
 */
interface Competitor {
  id: string
  name: string
  description: string
  coverage: Record<string, CoverageStatus>
  highlight?: boolean
  website?: string
}

/**
 * Differentiator configuration
 */
interface Differentiator {
  id: string
  title: string
  description: string
  icon: typeof Shield
  theme: 'claw' | 'green' | 'blue' | 'purple' | 'amber'
}

/**
 * Props for MarketComparison component
 */
export interface MarketComparisonProps {
  /** Animate rows on mount/scroll into view */
  animated?: boolean
  /** Show differentiators section */
  showDifferentiators?: boolean
  /** Compact mode for mobile */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                              Configuration                                  */
/* -------------------------------------------------------------------------- */

const DOMAINS: DomainCategory[] = [
  {
    id: 'llms',
    name: 'LLMs',
    shortName: 'LLMs',
    description: 'Text generation and chat models',
    icon: Brain,
  },
  {
    id: 'agents',
    name: 'Agents',
    shortName: 'Agents',
    description: 'Autonomous AI agents',
    icon: Bot,
  },
  {
    id: 'robots',
    name: 'Robots',
    shortName: 'Robots',
    description: 'Physical robotics systems',
    icon: Cpu,
  },
  {
    id: 'crypto',
    name: 'Crypto',
    shortName: 'Crypto',
    description: 'Blockchain and DeFi',
    icon: Coins,
  },
]

const COMPETITORS: Competitor[] = [
  {
    id: 'lakera',
    name: 'Lakera',
    description: 'LLM security platform focused on prompt injection detection',
    coverage: { llms: 'full', agents: 'partial', robots: 'none', crypto: 'none' },
    website: 'https://lakera.ai',
  },
  {
    id: 'lasso',
    name: 'Lasso Security',
    description: 'Enterprise LLM security with content moderation',
    coverage: { llms: 'full', agents: 'partial', robots: 'none', crypto: 'none' },
    website: 'https://lasso.security',
  },
  {
    id: 'prompt-security',
    name: 'Prompt Security',
    description: 'Prompt-level security for LLM applications',
    coverage: { llms: 'full', agents: 'none', robots: 'none', crypto: 'none' },
    website: 'https://promptsecurity.io',
  },
  {
    id: 'goplus',
    name: 'GoPlus',
    description: 'Web3 security infrastructure for token analysis',
    coverage: { llms: 'none', agents: 'none', robots: 'none', crypto: 'full' },
    website: 'https://gopluslabs.io',
  },
  {
    id: 'claw',
    name: 'GuardianClaw',
    description: 'Universal AI safety framework covering all domains',
    coverage: { llms: 'full', agents: 'full', robots: 'full', crypto: 'full' },
    highlight: true,
    website: 'https://guardianclaw.org',
  },
]

const DIFFERENTIATORS: Differentiator[] = [
  {
    id: 'architecture',
    title: '4-Layer Architecture',
    description: 'Only solution with L1-L4 defense in depth: Input → Seed → Output → Observer',
    icon: Shield,
    theme: 'claw',
  },
  {
    id: 'teleological',
    title: 'Teleological Core',
    description:
      'Only solution requiring WORTH, not just avoidance avoidance. The absence of harm is insufficient.',
    icon: Zap,
    theme: 'purple',
  },
  {
    id: 'memory-shield',
    title: 'Memory Shield v2.0',
    description:
      'Content validation + cryptographic protection against the #1 attack vector (85% success rate)',
    icon: Lock,
    theme: 'blue',
  },
  {
    id: 'coverage',
    title: 'Universal Coverage',
    description: 'LLMs + Agents + Robotics + Crypto in a single, unified framework',
    icon: Crown,
    theme: 'amber',
  },
]

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                               */
/* -------------------------------------------------------------------------- */

/**
 * Get visual representation for coverage status
 */
function getCoverageDisplay(status: CoverageStatus): {
  icon: typeof CheckCircle2
  text: string
  className: string
  bgClassName: string
} {
  switch (status) {
    case 'full':
      return {
        icon: CheckCircle2,
        text: 'Yes',
        className: 'text-green-400',
        bgClassName: 'bg-green-500/10',
      }
    case 'partial':
      return {
        icon: AlertCircle,
        text: 'Partial',
        className: 'text-amber-400',
        bgClassName: 'bg-amber-500/10',
      }
    case 'none':
      return {
        icon: XCircle,
        text: 'No',
        className: 'text-red-400',
        bgClassName: 'bg-red-500/10',
      }
  }
}

/**
 * Get theme colors for differentiator
 */
function getDifferentiatorTheme(theme: Differentiator['theme']): {
  bg: string
  border: string
  iconBg: string
  text: string
} {
  const themes = {
    claw: {
      bg: 'bg-claw-500/5',
      border: 'border-claw-500/30',
      iconBg: 'bg-claw-500/20',
      text: 'text-claw-500',
    },
    green: {
      bg: 'bg-green-500/5',
      border: 'border-green-500/30',
      iconBg: 'bg-green-500/20',
      text: 'text-green-400',
    },
    blue: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/30',
      iconBg: 'bg-blue-500/20',
      text: 'text-blue-400',
    },
    purple: {
      bg: 'bg-purple-500/5',
      border: 'border-purple-500/30',
      iconBg: 'bg-purple-500/20',
      text: 'text-purple-400',
    },
    amber: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-500/20',
      text: 'text-amber-400',
    },
  }
  return themes[theme]
}

/* -------------------------------------------------------------------------- */
/*                              Helper Components                              */
/* -------------------------------------------------------------------------- */

/**
 * Coverage cell with icon
 */
const CoverageCell = memo(function CoverageCell({
  status,
  compact,
  animated,
  delay,
}: {
  status: CoverageStatus
  compact?: boolean
  animated?: boolean
  delay?: number
}) {
  const display = getCoverageDisplay(status)
  const Icon = display.icon

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.8 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: delay ? delay / 1000 : 0 }}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg',
        display.bgClassName,
        compact ? 'p-1.5' : 'p-2'
      )}
    >
      <Icon className={cn(display.className, compact ? 'h-4 w-4' : 'h-5 w-5')} />
      {!compact && (
        <span className={cn('text-sm font-medium', display.className)}>{display.text}</span>
      )}
    </motion.div>
  )
})

/**
 * Competitor row in table
 */
const CompetitorRow = memo(function CompetitorRow({
  competitor,
  index,
  animated,
  compact,
  expanded,
  onToggle,
}: {
  competitor: Competitor
  index: number
  animated: boolean
  compact: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const baseDelay = index * 150
  const isHighlighted = competitor.highlight

  return (
    <>
      <motion.tr
        initial={animated ? { opacity: 0, x: -30 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: 0.5,
          delay: baseDelay / 1000,
          type: isHighlighted ? 'spring' : 'tween',
          stiffness: isHighlighted ? 100 : undefined,
        }}
        className={cn(
          'border-b transition-all',
          isHighlighted
            ? 'border-green-500/30 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent'
            : 'border-zinc-800 hover:bg-zinc-900/50'
        )}
      >
        {/* Competitor name */}
        <td className={cn('py-4', compact ? 'px-2' : 'px-4')}>
          <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              {isHighlighted && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="h-4 w-4 text-green-500" />
                </motion.div>
              )}
              <div>
                <p
                  className={cn(
                    'font-semibold',
                    compact ? 'text-sm' : 'text-base',
                    isHighlighted ? 'text-green-400' : 'text-white'
                  )}
                >
                  {competitor.name}
                </p>
                {!compact && !isHighlighted && (
                  <p className="max-w-[200px] truncate text-xs text-zinc-500">
                    {competitor.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Domain coverage */}
        {DOMAINS.map((domain, dIndex) => (
          <td key={domain.id} className={cn('py-4', compact ? 'px-2' : 'px-3')}>
            <CoverageCell
              status={competitor.coverage[domain.id]}
              compact={compact}
              animated={animated}
              delay={baseDelay + dIndex * 50 + 100}
            />
          </td>
        ))}

        {/* Score/Actions */}
        <td className={cn('py-4', compact ? 'px-2' : 'px-4')}>
          {isHighlighted ? (
            <motion.div
              initial={animated ? { opacity: 0, scale: 0.5 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: (baseDelay + 300) / 1000 }}
              className="flex items-center justify-center gap-1"
            >
              <span className="text-lg font-bold text-green-400">4/4</span>
              <Crown className="h-5 w-5 text-amber-500" />
            </motion.div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-sm text-zinc-500">
                {Object.values(competitor.coverage).filter((s) => s === 'full').length}/4
              </span>
            </div>
          )}
        </td>
      </motion.tr>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <td colSpan={DOMAINS.length + 2} className="bg-zinc-900/30 px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-2 text-sm text-zinc-300">{competitor.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {DOMAINS.map((domain) => {
                      const status = competitor.coverage[domain.id]
                      const display = getCoverageDisplay(status)
                      return (
                        <span
                          key={domain.id}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs',
                            display.bgClassName,
                            display.className
                          )}
                        >
                          <domain.icon className="h-3 w-3" />
                          {domain.name}: {display.text}
                        </span>
                      )
                    })}
                  </div>
                </div>
                {competitor.website && (
                  <a
                    href={competitor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Website
                  </a>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
})

/**
 * Differentiator card
 */
const DifferentiatorCard = memo(function DifferentiatorCard({
  differentiator,
  index,
  animated,
  compact,
}: {
  differentiator: Differentiator
  index: number
  animated: boolean
  compact?: boolean
}) {
  const theme = getDifferentiatorTheme(differentiator.theme)
  const Icon = differentiator.icon
  const delay = index * 100

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay / 1000 }}
      className={cn('rounded-xl border p-4', theme.bg, theme.border)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('rounded-lg p-2', theme.iconBg)}>
          <Icon className={cn('h-5 w-5', theme.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={cn('font-semibold', compact ? 'text-sm' : 'text-base', theme.text)}>
            {differentiator.title}
          </h4>
          <p className={cn('mt-1 text-zinc-400', compact ? 'text-xs' : 'text-sm')}>
            {differentiator.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
})

/**
 * Mobile card view for competitor
 */
const MobileCompetitorCard = memo(function MobileCompetitorCard({
  competitor,
  index,
  animated,
}: {
  competitor: Competitor
  index: number
  animated: boolean
}) {
  const isHighlighted = competitor.highlight
  const baseDelay = index * 100

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: baseDelay / 1000,
        type: isHighlighted ? 'spring' : 'tween',
      }}
      className={cn(
        'rounded-xl border p-4',
        isHighlighted
          ? 'border-green-500/50 bg-gradient-to-br from-green-500/10 to-transparent'
          : 'border-zinc-800 bg-zinc-900/50'
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isHighlighted && <Sparkles className="h-4 w-4 text-green-500" />}
          <span className={cn('font-semibold', isHighlighted ? 'text-green-400' : 'text-white')}>
            {competitor.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn('text-lg font-bold', isHighlighted ? 'text-green-400' : 'text-zinc-400')}
          >
            {Object.values(competitor.coverage).filter((s) => s === 'full').length}/4
          </span>
          {isHighlighted && <Crown className="h-4 w-4 text-amber-500" />}
        </div>
      </div>

      {/* Coverage grid */}
      <div className="grid grid-cols-4 gap-2">
        {DOMAINS.map((domain) => {
          const status = competitor.coverage[domain.id]
          const display = getCoverageDisplay(status)
          const DomainIcon = domain.icon
          return (
            <div
              key={domain.id}
              className={cn('flex flex-col items-center gap-1 rounded-lg p-2', display.bgClassName)}
            >
              <DomainIcon className={cn('h-4 w-4', display.className)} />
              <span className="text-[10px] text-zinc-500">{domain.shortName}</span>
              <display.icon className={cn('h-3 w-3', display.className)} />
            </div>
          )
        })}
      </div>

      {/* Description */}
      {isHighlighted && (
        <p className="mt-3 text-center text-xs text-zinc-400">
          Universal AI safety framework covering all domains
        </p>
      )}
    </motion.div>
  )
})

/* -------------------------------------------------------------------------- */
/*                              Main Component                                 */
/* -------------------------------------------------------------------------- */

/**
 * MarketComparison - Visual comparison of GuardianClaw vs competitors
 *
 * Displays a comparison table showing coverage across different AI domains
 * (LLMs, Agents, Robots, Crypto) for various security solutions.
 *
 * Features:
 * - Animated table with coverage indicators
 * - Highlighted GuardianClaw row showing full coverage
 * - Expandable rows with details
 * - Mobile card layout
 * - Differentiator cards highlighting unique features
 *
 * @example
 * ```tsx
 * <MarketComparison
 *   animated
 *   showDifferentiators
 * />
 * ```
 */
export const MarketComparison = memo(function MarketComparison({
  animated = true,
  showDifferentiators = true,
  compact = false,
  className,
}: MarketComparisonProps) {
  // Intersection observer for animation trigger
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(!animated)
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)

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

  const toggleCompetitor = (competitorId: string) => {
    setExpandedCompetitor(expandedCompetitor === competitorId ? null : competitorId)
  }

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      role="region"
      aria-label="Market Comparison"
    >
      {/* Comparison Table Container */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
                <Shield className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Market Gap Analysis</h3>
                <p className="text-xs text-zinc-500">
                  Coverage comparison across AI safety domains
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-4 text-xs md:flex">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-zinc-400">Full</span>
              </span>
              <span className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span className="text-zinc-400">Partial</span>
              </span>
              <span className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-zinc-400">None</span>
              </span>
            </div>
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
                  Solution
                </th>
                {DOMAINS.map((domain) => {
                  const Icon = domain.icon
                  return (
                    <th
                      key={domain.id}
                      className={cn(
                        'py-3 text-center font-medium text-zinc-400',
                        compact ? 'px-2 text-xs' : 'px-3 text-sm'
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon className="h-4 w-4" />
                        {domain.name}
                      </div>
                    </th>
                  )
                })}
                <th
                  className={cn(
                    'py-3 text-center font-medium text-zinc-400',
                    compact ? 'px-2 text-xs' : 'px-4 text-sm'
                  )}
                >
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((competitor, index) => (
                <CompetitorRow
                  key={competitor.id}
                  competitor={competitor}
                  index={index}
                  animated={isInView && animated}
                  compact={compact}
                  expanded={expandedCompetitor === competitor.id}
                  onToggle={() => toggleCompetitor(competitor.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        {!compact && (
          <div className="space-y-3 p-4 md:hidden">
            {COMPETITORS.map((competitor, index) => (
              <MobileCompetitorCard
                key={competitor.id}
                competitor={competitor}
                index={index}
                animated={isInView && animated}
              />
            ))}
          </div>
        )}

        {/* Key insight */}
        <motion.div
          initial={animated ? { opacity: 0, y: 10 } : false}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="border-t border-zinc-800 bg-gradient-to-r from-green-500/5 to-transparent px-6 py-4"
        >
          <p className="text-center text-sm">
            <span className="font-semibold text-green-400">
              NOBODY protects AI agent DECISIONS in crypto.
            </span>{' '}
            <span className="text-zinc-400">
              GuardianClaw is the only solution covering all four domains.
            </span>
          </p>
        </motion.div>
      </div>

      {/* Differentiators */}
      {showDifferentiators && (
        <div className="mt-6">
          <h4 className="mb-4 text-lg font-semibold text-white">Key Differentiators</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DIFFERENTIATORS.map((diff, index) => (
              <DifferentiatorCard
                key={diff.id}
                differentiator={diff}
                index={index}
                animated={isInView && animated}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Screen reader summary */}
      <div className="sr-only" role="status" aria-live="polite">
        {isInView && (
          <span>
            Market comparison loaded. GuardianClaw provides full coverage across all 4 domains:
            LLMs, Agents, Robots, and Crypto. Competitors like Lakera and Lasso focus primarily on
            LLMs with partial agent support. GoPlus covers only Crypto.
          </span>
        )}
      </div>
    </div>
  )
})

export default MarketComparison
