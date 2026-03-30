'use client'

import { memo, useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Wand2,
  Search,
  TrendingUp,
  Drama,
  AlertTriangle,
  Target,
  Bot,
  Cpu,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Layers,
  Minus,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

/**
 * Detector category
 */
type DetectorCategory = 'preprocessing' | 'detection' | 'reduction'

/**
 * Weight level for visual styling
 */
type WeightLevel = 'none' | 'base' | 'elevated' | 'high' | 'critical'

/**
 * Detector configuration
 */
interface Detector {
  id: string
  name: string
  weight: string
  weightLevel: WeightLevel
  description: string
  details: string[]
  category: DetectorCategory
  icon: typeof Shield
  isOptional?: boolean
}

/**
 * Category configuration
 */
interface CategoryConfig {
  id: DetectorCategory
  name: string
  description: string
  icon: typeof Shield
  theme: 'zinc' | 'blue' | 'green'
}

/**
 * Props for InputValidatorTree component
 */
export interface InputValidatorTreeProps {
  /** Animate items on mount/scroll into view */
  animated?: boolean
  /** Start with all items expanded */
  defaultExpanded?: boolean
  /** Show category headers */
  showCategories?: boolean
  /** Compact mode */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                              Configuration                                  */
/* -------------------------------------------------------------------------- */

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'preprocessing',
    name: 'Preprocessing',
    description: 'Input normalization and deobfuscation',
    icon: Wand2,
    theme: 'zinc',
  },
  {
    id: 'detection',
    name: 'Detection',
    description: 'Threat identification and scoring',
    icon: Search,
    theme: 'blue',
  },
  {
    id: 'reduction',
    name: 'False Positive Reduction',
    description: 'Legitimate context recognition',
    icon: Sparkles,
    theme: 'green',
  },
]

const DETECTORS: Detector[] = [
  // Preprocessing
  {
    id: 'text-normalizer',
    name: 'TextNormalizer',
    weight: '-',
    weightLevel: 'none',
    description: '8 deobfuscation stages for attack payload normalization',
    details: [
      'Base64 decoding (nested up to 3 levels)',
      'Unicode normalization (NFKC)',
      'HTML entity decoding',
      'URL decoding (percent-encoding)',
      'Whitespace normalization',
      'Zero-width character removal',
      'Homoglyph standardization',
      'Case normalization for patterns',
    ],
    category: 'preprocessing',
    icon: Wand2,
  },

  // Detection (ordered by weight)
  {
    id: 'pattern-detector',
    name: 'PatternDetector',
    weight: '1.0',
    weightLevel: 'base',
    description: '700+ regex patterns for direct attack detection',
    details: [
      'Jailbreak prompt patterns',
      'Prompt injection signatures',
      'System prompt extraction attempts',
      'Role manipulation phrases',
      'Instruction override patterns',
      'DAN mode variations',
      'Base64/encoding bypass attempts',
    ],
    category: 'detection',
    icon: Search,
  },
  {
    id: 'escalation-detector',
    name: 'EscalationDetector',
    weight: '1.1',
    weightLevel: 'elevated',
    description: 'Multi-turn attack detection across conversation history',
    details: [
      'Crescendo attack patterns (gradual escalation)',
      'Many-shot Hijacking (MHJ) detection',
      'Context accumulation tracking',
      'Turn-by-turn risk scoring',
      'Threshold breach alerting',
    ],
    category: 'detection',
    icon: TrendingUp,
  },
  {
    id: 'framing-detector',
    name: 'FramingDetector',
    weight: '1.2',
    weightLevel: 'elevated',
    description: 'Roleplay, fiction, and hypothetical framing detection',
    details: [
      'Roleplay scenario detection',
      'Fiction/story framing',
      'Hypothetical request patterns',
      'Educational pretext analysis',
      '"For research purposes" detection',
      'Character persona hijacking',
    ],
    category: 'detection',
    icon: Drama,
  },
  {
    id: 'harmful-request-detector',
    name: 'HarmfulRequestDetector',
    weight: '1.3',
    weightLevel: 'high',
    description: '10 avoidance categories covering major threat vectors',
    details: [
      'Violence and weapons',
      'Fraud and scams',
      'Malware and hacking',
      'Illegal substances',
      'Self-harm content',
      'CSAM detection',
      'Harassment patterns',
      'Misinformation seeds',
      'Privacy violations',
      'Discrimination content',
    ],
    category: 'detection',
    icon: AlertTriangle,
  },
  {
    id: 'intent-signal-detector',
    name: 'IntentSignalDetector',
    weight: '1.3',
    weightLevel: 'high',
    description: 'Compositional analysis of action + target + context',
    details: [
      'Action verb extraction (delete, transfer, access)',
      'Target identification (database, wallet, files)',
      'Context analysis (unauthorized, without permission)',
      'Composite risk scoring',
      'Semantic intent classification',
    ],
    category: 'detection',
    icon: Target,
  },
  {
    id: 'physical-safety-detector',
    name: 'PhysicalSafetyDetector',
    weight: '1.4',
    weightLevel: 'critical',
    description: 'Embodied AI risks for robots and smart home systems',
    details: [
      'Robot command validation',
      'Smart home safety checks',
      'Physical harm prevention',
      'Human proximity awareness',
      'Emergency stop recognition',
      'ISO/TS 15066 compliance',
    ],
    category: 'detection',
    icon: Cpu,
  },
  {
    id: 'safe-agent-detector',
    name: 'SafeAgentDetector',
    weight: '1.4',
    weightLevel: 'critical',
    description: 'SafeAgentBench coverage for autonomous agent safety',
    details: [
      'Contamination risk detection',
      'Electrical hazard awareness',
      'Location safety validation',
      'Tool misuse prevention',
      'Autonomous action boundaries',
      'Task limits verification',
    ],
    category: 'detection',
    icon: Bot,
  },
  {
    id: 'embedding-detector',
    name: 'EmbeddingDetector',
    weight: '1.4',
    weightLevel: 'critical',
    description: 'Semantic similarity to known attack patterns',
    details: [
      'Vector embedding comparison',
      'Cosine similarity scoring',
      'Known attack database matching',
      'Semantic cluster detection',
      'Novel attack surface identification',
    ],
    category: 'detection',
    icon: Brain,
    isOptional: true,
  },

  // False Positive Reduction
  {
    id: 'benign-context-detector',
    name: 'BenignContextDetector',
    weight: '-',
    weightLevel: 'none',
    description: 'False positive reduction for legitimate technical contexts',
    details: [
      'Security research context',
      'Educational material detection',
      'Code review scenarios',
      'Penetration testing context',
      'Academic discussion patterns',
      'Documentation queries',
      'Reduces FP rate by ~15%',
    ],
    category: 'reduction',
    icon: Sparkles,
  },
]

const WEIGHT_STYLES: Record<
  WeightLevel,
  { bg: string; text: string; border: string; label: string }
> = {
  none: { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-700', label: 'No weight' },
  base: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    label: 'Base (1.0)',
  },
  elevated: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    label: 'Elevated',
  },
  high: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    label: 'High',
  },
  critical: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'Critical',
  },
}

const CATEGORY_STYLES: Record<
  CategoryConfig['theme'],
  { bg: string; border: string; text: string }
> = {
  zinc: { bg: 'bg-zinc-800/50', border: 'border-zinc-700', text: 'text-zinc-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
}

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                               */
/* -------------------------------------------------------------------------- */

/**
 * Get detectors by category
 */
function getDetectorsByCategory(category: DetectorCategory): Detector[] {
  return DETECTORS.filter((d) => d.category === category)
}

/**
 * Get category config by ID
 */
function getCategoryConfig(category: DetectorCategory): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.id === category)
}

/* -------------------------------------------------------------------------- */
/*                           Sub-Components                                    */
/* -------------------------------------------------------------------------- */

/**
 * Weight badge component
 */
interface WeightBadgeProps {
  weight: string
  level: WeightLevel
  compact?: boolean
}

const WeightBadge = memo(function WeightBadge({ weight, level, compact }: WeightBadgeProps) {
  const styles = WEIGHT_STYLES[level]

  if (weight === '-') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full border',
          compact ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
          styles.bg,
          styles.border,
          styles.text
        )}
        aria-label="No weight"
      >
        <Minus className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-mono font-semibold',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        styles.bg,
        styles.border,
        styles.text
      )}
      aria-label={`Weight: ${weight}`}
    >
      {weight}
    </span>
  )
})

/**
 * Detector item component
 */
interface DetectorItemProps {
  detector: Detector
  index: number
  animated: boolean
  isExpanded: boolean
  onToggle: () => void
  compact?: boolean
}

const DetectorItem = memo(function DetectorItem({
  detector,
  index,
  animated,
  isExpanded,
  onToggle,
  compact,
}: DetectorItemProps) {
  const Icon = detector.icon
  const weightStyles = WEIGHT_STYLES[detector.weightLevel]

  return (
    <motion.div
      initial={animated ? { opacity: 0, x: -20 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: animated ? index * 0.05 : 0 }}
      className={cn(
        'rounded-xl border transition-all duration-200',
        isExpanded ? 'bg-zinc-900/80' : 'bg-zinc-900/50 hover:bg-zinc-900/70',
        weightStyles.border
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 text-left transition-colors',
          compact ? 'p-3' : 'p-4'
        )}
        aria-expanded={isExpanded}
        aria-controls={`detector-details-${detector.id}`}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg',
            compact ? 'h-8 w-8' : 'h-10 w-10',
            weightStyles.bg
          )}
        >
          <Icon
            className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', weightStyles.text)}
            aria-hidden="true"
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className={cn('font-semibold text-white', compact ? 'text-sm' : 'text-base')}>
              {detector.name}
            </span>
            {detector.isOptional && (
              <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                Optional
              </span>
            )}
          </div>
          <p className={cn('line-clamp-1 text-zinc-400', compact ? 'text-xs' : 'text-sm')}>
            {detector.description}
          </p>
        </div>

        {/* Weight badge */}
        <WeightBadge weight={detector.weight} level={detector.weightLevel} compact={compact} />

        {/* Expand icon */}
        <div className="shrink-0 text-zinc-500">
          {isExpanded ? (
            <ChevronDown className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          ) : (
            <ChevronRight className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          )}
        </div>
      </button>

      {/* Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            id={`detector-details-${detector.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('border-t', weightStyles.border)}>
              <ul className={cn('space-y-1', compact ? 'p-3' : 'p-4')}>
                {detector.details.map((detail, i) => (
                  <li
                    key={i}
                    className={cn('flex items-start gap-2', compact ? 'text-xs' : 'text-sm')}
                  >
                    <span className={cn('mt-1.5 h-1 w-1 shrink-0 rounded-full', weightStyles.bg)} />
                    <span className="text-zinc-400">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

/**
 * Category section component
 */
interface CategorySectionProps {
  category: CategoryConfig
  detectors: Detector[]
  animated: boolean
  expandedItems: Set<string>
  onToggleItem: (id: string) => void
  categoryIndex: number
  compact?: boolean
}

const CategorySection = memo(function CategorySection({
  category,
  detectors,
  animated,
  expandedItems,
  onToggleItem,
  categoryIndex,
  compact,
}: CategorySectionProps) {
  const styles = CATEGORY_STYLES[category.theme]
  const Icon = category.icon

  return (
    <motion.section
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animated ? categoryIndex * 0.15 : 0 }}
      className="mb-6 last:mb-0"
      aria-labelledby={`category-${category.id}`}
    >
      {/* Category header */}
      <div
        className={cn(
          'mb-3 flex items-center gap-3 rounded-lg p-3',
          styles.bg,
          'border',
          styles.border
        )}
      >
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', styles.bg)}>
          <Icon className={cn('h-4 w-4', styles.text)} aria-hidden="true" />
        </div>
        <div>
          <h4 id={`category-${category.id}`} className="text-sm font-semibold text-white">
            {category.name}
            <span className="ml-2 text-xs font-normal text-zinc-500">({detectors.length})</span>
          </h4>
          <p className="text-xs text-zinc-500">{category.description}</p>
        </div>
      </div>

      {/* Detectors */}
      <div className="space-y-2">
        {detectors.map((detector, index) => (
          <DetectorItem
            key={detector.id}
            detector={detector}
            index={index}
            animated={animated}
            isExpanded={expandedItems.has(detector.id)}
            onToggle={() => onToggleItem(detector.id)}
            compact={compact}
          />
        ))}
      </div>
    </motion.section>
  )
})

/**
 * Legend component
 */
const Legend = memo(function Legend({ compact }: { compact?: boolean }) {
  const levels: WeightLevel[] = ['none', 'base', 'elevated', 'high', 'critical']

  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3',
        compact && 'gap-2 p-2'
      )}
    >
      <span className={cn('font-medium text-zinc-400', compact ? 'text-xs' : 'text-sm')}>
        Weight Scale:
      </span>
      {levels.map((level) => {
        const styles = WEIGHT_STYLES[level]
        return (
          <div key={level} className="flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded-full', styles.bg, 'border', styles.border)} />
            <span className={cn('text-zinc-500', compact ? 'text-[10px]' : 'text-xs')}>
              {level === 'none' ? 'N/A' : level.charAt(0).toUpperCase() + level.slice(1)}
            </span>
          </div>
        )
      })}
    </div>
  )
})

/**
 * Summary stats component
 */
const SummaryStats = memo(function SummaryStats({ animated }: { animated: boolean }) {
  const stats = [
    { label: 'Total Detectors', value: DETECTORS.length, icon: Layers },
    {
      label: 'Detection Stage',
      value: DETECTORS.filter((d) => d.category === 'detection').length,
      icon: Search,
    },
    { label: 'Highest Weight', value: '1.4', icon: AlertTriangle },
    { label: 'Pattern Count', value: '700+', icon: Target },
  ]

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: animated ? index * 0.1 : 0 }}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">{stat.value}</div>
              <div className="text-[10px] text-zinc-500">{stat.label}</div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
})

/* -------------------------------------------------------------------------- */
/*                              Main Component                                 */
/* -------------------------------------------------------------------------- */

/**
 * InputValidatorTree - Interactive tree view of L1 InputValidator detectors
 *
 * Displays all detectors in the InputValidator pipeline with their weights,
 * descriptions, and detailed breakdowns. Organized by category.
 *
 * Features:
 * - 10 detectors across 3 categories
 * - Weight badges with color-coded severity
 * - Expandable details for each detector
 * - Category headers with descriptions
 * - Summary statistics
 * - Animated entrance on scroll
 * - Keyboard accessible
 */
export const InputValidatorTree = memo(function InputValidatorTree({
  animated = true,
  defaultExpanded = false,
  showCategories = true,
  compact = false,
  className,
}: InputValidatorTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(!animated)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    defaultExpanded ? new Set(DETECTORS.map((d) => d.id)) : new Set()
  )

  // Intersection observer for scroll-triggered animation
  useEffect(() => {
    if (!animated || !containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [animated])

  // Toggle expanded state
  const handleToggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Expand/collapse all
  const handleExpandAll = () => {
    setExpandedItems(new Set(DETECTORS.map((d) => d.id)))
  }

  const handleCollapseAll = () => {
    setExpandedItems(new Set())
  }

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      role="region"
      aria-label="InputValidator detector tree"
    >
      {/* Summary stats */}
      {!compact && isInView && <SummaryStats animated={animated} />}

      {/* Legend */}
      {isInView && <Legend compact={compact} />}

      {/* Controls */}
      {isInView && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Click on a detector to see details</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExpandAll}
              className="px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-white"
            >
              Expand all
            </button>
            <span className="text-zinc-700">|</span>
            <button
              onClick={handleCollapseAll}
              className="px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-white"
            >
              Collapse all
            </button>
          </div>
        </div>
      )}

      {/* Detector tree by category */}
      {isInView && showCategories && (
        <div className="space-y-6">
          {CATEGORIES.map((category, categoryIndex) => {
            const detectors = getDetectorsByCategory(category.id)
            if (detectors.length === 0) return null

            return (
              <CategorySection
                key={category.id}
                category={category}
                detectors={detectors}
                animated={animated}
                expandedItems={expandedItems}
                onToggleItem={handleToggleItem}
                categoryIndex={categoryIndex}
                compact={compact}
              />
            )
          })}
        </div>
      )}

      {/* Flat list mode (no categories) */}
      {isInView && !showCategories && (
        <div className="space-y-2">
          {DETECTORS.map((detector, index) => (
            <DetectorItem
              key={detector.id}
              detector={detector}
              index={index}
              animated={animated}
              isExpanded={expandedItems.has(detector.id)}
              onToggle={() => handleToggleItem(detector.id)}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {expandedItems.size > 0
          ? `${expandedItems.size} detector${expandedItems.size > 1 ? 's' : ''} expanded`
          : 'All detectors collapsed'}
      </div>
    </div>
  )
})

export default InputValidatorTree
