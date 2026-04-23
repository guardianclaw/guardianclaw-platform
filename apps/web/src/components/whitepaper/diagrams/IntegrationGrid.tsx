'use client'

import { memo, useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Bot,
  Brain,
  Coins,
  Cpu,
  Code2,
  Server,
  Lock,
  FileCheck,
  Blocks,
  Wrench,
  ChevronRight,
  ExternalLink,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

/**
 * Integration category configuration
 */
interface IntegrationCategory {
  id: string
  name: string
  description: string
  icon: typeof Shield
  theme: 'green' | 'blue' | 'purple' | 'amber' | 'pink' | 'teal' | 'orange' | 'zinc'
}

/**
 * Integration item configuration
 */
interface Integration {
  id: string
  name: string
  description: string
  categoryId: string
  website?: string
  isNew?: boolean
  isOfficial?: boolean
  icon?: string
}

/**
 * Props for IntegrationGrid component
 */
export interface IntegrationGridProps {
  /** Animate items on mount/scroll into view */
  animated?: boolean
  /** Show category filter */
  showFilter?: boolean
  /** Compact mode for mobile */
  compact?: boolean
  /** Show hover cards with details */
  showDetails?: boolean
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                              Configuration                                  */
/* -------------------------------------------------------------------------- */

const CATEGORIES: IntegrationCategory[] = [
  {
    id: 'agents',
    name: 'Agent Frameworks',
    description: 'Autonomous AI agent development frameworks',
    icon: Bot,
    theme: 'green',
  },
  {
    id: 'llm',
    name: 'LLM Providers',
    description: 'Large language model SDKs and APIs',
    icon: Brain,
    theme: 'blue',
  },
  {
    id: 'blockchain',
    name: 'Blockchain',
    description: 'Web3 and cryptocurrency integrations',
    icon: Coins,
    theme: 'purple',
  },
  {
    id: 'robotics',
    name: 'Robotics',
    description: 'Physical robotics and embodied AI',
    icon: Cpu,
    theme: 'pink',
  },
  {
    id: 'security',
    name: 'Security Tools',
    description: 'AI security testing and red-teaming',
    icon: Lock,
    theme: 'amber',
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Regulatory and security frameworks',
    icon: FileCheck,
    theme: 'teal',
  },
  {
    id: 'devtools',
    name: 'Developer Tools',
    description: 'IDE extensions and development utilities',
    icon: Code2,
    theme: 'orange',
  },
  {
    id: 'infra',
    name: 'Infrastructure',
    description: 'Deployment and hosting platforms',
    icon: Server,
    theme: 'zinc',
  },
]

const INTEGRATIONS: Integration[] = [
  // Agent Frameworks
  {
    id: 'voltagent',
    name: 'VoltAgent',
    description: 'TypeScript agent framework',
    categoryId: 'agents',
    website: 'https://voltagent.dev',
    isNew: true,
    icon: '/images/ecosystem/voltagent.svg',
  },
  {
    id: 'elizaos',
    name: 'ElizaOS',
    description: 'Crypto-native agent framework',
    categoryId: 'agents',
    website: 'https://elizaos.ai',
    icon: '/images/ecosystem/elizaos.svg',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'Personal AI agent with 5-layer safety',
    categoryId: 'agents',
    website: 'https://openclaw.com',
    isNew: true,
    icon: '/images/ecosystem/openclaw.svg',
  },

  // LLM Providers (3)
  {
    id: 'openai',
    name: 'OpenAI SDK',
    description: 'OpenAI Agents SDK integration',
    categoryId: 'llm',
    website: 'https://platform.openai.com',
    isOfficial: true,
    icon: '/images/ecosystem/openai.svg',
  },
  {
    id: 'anthropic',
    name: 'Anthropic SDK',
    description: 'Claude API integration',
    categoryId: 'llm',
    website: 'https://anthropic.com',
    isOfficial: true,
    icon: '/images/ecosystem/anthropic.svg',
  },
  {
    id: 'google-adk',
    name: 'Google ADK',
    description: 'Google Agent Development Kit',
    categoryId: 'llm',
    website: 'https://ai.google.dev',
    isNew: true,
    icon: '/images/ecosystem/google-adk.svg',
  },

  // Blockchain (3)
  {
    id: 'solana-kit',
    name: 'Solana Agent Kit',
    description: 'Solana blockchain integration',
    categoryId: 'blockchain',
    website: 'https://solana.com',
    icon: '/images/ecosystem/solana.svg',
  },
  {
    id: 'coinbase-kit',
    name: 'Coinbase AgentKit',
    description: 'Coinbase API integration',
    categoryId: 'blockchain',
    website: 'https://coinbase.com',
    icon: '/images/ecosystem/coinbase.svg',
  },
  {
    id: 'virtuals',
    name: 'Virtuals Protocol',
    description: 'AI agent tokenization platform',
    categoryId: 'blockchain',
    website: 'https://virtuals.io',
    icon: '/images/ecosystem/virtuals.svg',
  },

  // Robotics (1)
  {
    id: 'humanoid',
    name: 'Humanoid Safety',
    description: 'ISO/TS 15066 compliance module',
    categoryId: 'robotics',
    isNew: true,
    icon: '/images/ecosystem/humanoid.svg',
  },

  // Security Tools (4)
  {
    id: 'garak',
    name: 'garak',
    description: 'NVIDIA LLM vulnerability scanner',
    categoryId: 'security',
    website: 'https://github.com/NVIDIA/garak',
    icon: '/images/ecosystem/garak.svg',
  },
  {
    id: 'pyrit',
    name: 'PyRIT',
    description: 'Microsoft AI red-teaming tool',
    categoryId: 'security',
    website: 'https://github.com/Azure/PyRIT',
    icon: '/images/ecosystem/pyrit.svg',
  },
  {
    id: 'promptfoo',
    name: 'Promptfoo',
    description: 'Prompt testing framework',
    categoryId: 'security',
    website: 'https://promptfoo.dev',
    icon: '/images/ecosystem/promptfoo.svg',
  },
  {
    id: 'openguardrails',
    name: 'OpenGuardrails',
    description: 'Open source guardrails',
    categoryId: 'security',
    website: 'https://github.com/openguardrails',
    icon: '/images/ecosystem/openguardrails.svg',
  },

  // Compliance (4)
  {
    id: 'eu-ai-act',
    name: 'EU AI Act',
    description: 'European AI regulation compliance',
    categoryId: 'compliance',
    icon: '/images/ecosystem/eu-ai-act.svg',
  },
  {
    id: 'owasp-llm',
    name: 'OWASP LLM Top 10',
    description: 'LLM security vulnerabilities',
    categoryId: 'compliance',
    website: 'https://owasp.org',
    icon: '/images/ecosystem/owasp.svg',
  },
  {
    id: 'owasp-agentic',
    name: 'OWASP Agentic AI',
    description: 'Agent-specific security threats',
    categoryId: 'compliance',
    website: 'https://genai.owasp.org',
    isNew: true,
    icon: '/images/ecosystem/owasp.svg',
  },
  {
    id: 'csa-matrix',
    name: 'CSA Matrix',
    description: 'Cloud Security Alliance AI controls',
    categoryId: 'compliance',
    website: 'https://cloudsecurityalliance.org',
    icon: '/images/ecosystem/csa.svg',
  },

  // Developer Tools (2)
  {
    id: 'jetbrains',
    name: 'JetBrains',
    description: 'IntelliJ-based IDE plugin',
    categoryId: 'devtools',
    website: 'https://jetbrains.com',
    icon: '/images/ecosystem/jetbrains.svg',
  },
  {
    id: 'browser-ext',
    name: 'Browser Extension',
    description: 'Chrome/Firefox extension',
    categoryId: 'devtools',
    icon: '/images/ecosystem/chrome.svg',
  },

  // Infrastructure (2)
  {
    id: 'mcp-server',
    name: 'MCP Server',
    description: 'Model Context Protocol server',
    categoryId: 'infra',
    isNew: true,
    icon: '/images/ecosystem/mcp.svg',
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    description: 'Model hub integration',
    categoryId: 'infra',
    website: 'https://huggingface.co',
    icon: '/images/ecosystem/huggingface.svg',
  },
]

const THEME_COLORS: Record<
  IntegrationCategory['theme'],
  { bg: string; border: string; text: string; icon: string }
> = {
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: 'text-green-500',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: 'text-blue-500',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    icon: 'text-purple-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: 'text-amber-500',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    icon: 'text-pink-500',
  },
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    icon: 'text-teal-500',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: 'text-orange-500',
  },
  zinc: {
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    text: 'text-zinc-400',
    icon: 'text-zinc-500',
  },
}

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                               */
/* -------------------------------------------------------------------------- */

/**
 * Get integrations for a category
 */
function getIntegrationsByCategory(categoryId: string): Integration[] {
  return INTEGRATIONS.filter((i) => i.categoryId === categoryId)
}

/**
 * Get category by ID
 */
function getCategoryById(categoryId: string): IntegrationCategory | undefined {
  return CATEGORIES.find((c) => c.id === categoryId)
}

/* -------------------------------------------------------------------------- */
/*                           Sub-Components                                    */
/* -------------------------------------------------------------------------- */

/**
 * Integration card component
 */
interface IntegrationCardProps {
  integration: Integration
  category: IntegrationCategory
  index: number
  animated: boolean
  showDetails: boolean
  onSelect: (integration: Integration | null) => void
  isSelected: boolean
}

const IntegrationCard = memo(function IntegrationCard({
  integration,
  category,
  index,
  animated,
  showDetails,
  onSelect,
  isSelected,
}: IntegrationCardProps) {
  const colors = THEME_COLORS[category.theme]
  const Icon = category.icon

  return (
    <motion.button
      initial={animated ? { opacity: 0, scale: 0.8 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: animated ? index * 0.03 : 0 }}
      onClick={() => showDetails && onSelect(isSelected ? null : integration)}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-xl border p-4 transition-all duration-200',
        'hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950',
        colors.bg,
        colors.border,
        isSelected && 'ring-2 ring-offset-2 ring-offset-zinc-950',
        isSelected ? `ring-${category.theme}-500` : '',
        showDetails ? 'cursor-pointer' : 'cursor-default'
      )}
      aria-label={`${integration.name}: ${integration.description}`}
      aria-pressed={isSelected}
    >
      {/* New badge */}
      {integration.isNew && (
        <span className="absolute -right-2 -top-2 flex items-center gap-0.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <Sparkles className="h-2.5 w-2.5" />
          NEW
        </span>
      )}

      {/* Official badge */}
      {integration.isOfficial && (
        <span className="absolute -right-2 -top-2 flex items-center gap-0.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <Shield className="h-2.5 w-2.5" />
        </span>
      )}

      {/* Icon */}
      <div className={cn('mb-2 flex h-10 w-10 items-center justify-center rounded-lg', colors.bg)}>
        {integration.icon ? (
          <Image
            src={integration.icon}
            alt={integration.name}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            loading="lazy"
            unoptimized
          />
        ) : (
          <Icon className={cn('h-5 w-5', colors.icon)} aria-hidden="true" />
        )}
      </div>

      {/* Name */}
      <span className="line-clamp-1 text-center text-xs font-medium text-white">
        {integration.name}
      </span>

      {/* Hover indicator */}
      {showDetails && (
        <div className="absolute inset-0 rounded-xl border-2 border-transparent transition-colors group-hover:border-white/20" />
      )}
    </motion.button>
  )
})

/**
 * Detail panel component
 */
interface DetailPanelProps {
  integration: Integration | null
  onClose: () => void
}

const DetailPanel = memo(function DetailPanel({ integration, onClose }: DetailPanelProps) {
  if (!integration) return null

  const category = getCategoryById(integration.categoryId)
  if (!category) return null

  const colors = THEME_COLORS[category.theme]
  const Icon = category.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn('relative rounded-xl border p-6', colors.bg, colors.border)}
      role="dialog"
      aria-label={`Details for ${integration.name}`}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg p-1 transition-colors hover:bg-white/10"
        aria-label="Close details"
      >
        <X className="h-4 w-4 text-zinc-400" />
      </button>

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            colors.bg
          )}
        >
          {integration.icon ? (
            <Image
              src={integration.icon}
              alt={integration.name}
              width={24}
              height={24}
              className="h-6 w-6 object-contain"
              style={{ filter: 'brightness(0) invert(1)' }}
              loading="lazy"
              unoptimized
            />
          ) : (
            <Icon className={cn('h-6 w-6', colors.icon)} aria-hidden="true" />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h4 className="text-lg font-semibold text-white">{integration.name}</h4>
            {integration.isNew && (
              <span className="flex items-center gap-0.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Sparkles className="h-2.5 w-2.5" />
                NEW
              </span>
            )}
          </div>
          <p className="mb-3 text-sm text-zinc-400">{integration.description}</p>

          {/* Category */}
          <div className="mb-4 flex items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-xs', colors.bg, colors.text)}>
              {category.name}
            </span>
          </div>

          {/* Website link */}
          {integration.website && (
            <a
              href={integration.website}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
                colors.text,
                'hover:underline'
              )}
            >
              Visit website
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
})

/**
 * Category section component
 */
interface CategorySectionProps {
  category: IntegrationCategory
  integrations: Integration[]
  animated: boolean
  showDetails: boolean
  selectedIntegration: Integration | null
  onSelectIntegration: (integration: Integration | null) => void
  categoryIndex: number
}

const CategorySection = memo(function CategorySection({
  category,
  integrations,
  animated,
  showDetails,
  selectedIntegration,
  onSelectIntegration,
  categoryIndex,
}: CategorySectionProps) {
  const colors = THEME_COLORS[category.theme]
  const Icon = category.icon

  return (
    <motion.section
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animated ? categoryIndex * 0.1 : 0 }}
      className="mb-8 last:mb-0"
      aria-labelledby={`category-${category.id}`}
    >
      {/* Category header */}
      <div className="mb-4 flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.icon)} aria-hidden="true" />
        </div>
        <div>
          <h3 id={`category-${category.id}`} className="text-sm font-semibold text-white">
            {category.name}
            <span className="ml-2 text-xs font-normal text-zinc-500">({integrations.length})</span>
          </h3>
          <p className="text-xs text-zinc-500">{category.description}</p>
        </div>
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {integrations.map((integration, index) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            category={category}
            index={index}
            animated={animated}
            showDetails={showDetails}
            onSelect={onSelectIntegration}
            isSelected={selectedIntegration?.id === integration.id}
          />
        ))}
      </div>
    </motion.section>
  )
})

/**
 * Category filter component
 */
interface CategoryFilterProps {
  categories: IntegrationCategory[]
  activeCategory: string | null
  onSelectCategory: (categoryId: string | null) => void
}

const CategoryFilter = memo(function CategoryFilter({
  categories,
  activeCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-2"
      role="tablist"
      aria-label="Filter by category"
    >
      {/* All button */}
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
          activeCategory === null
            ? 'border-white bg-white text-zinc-900'
            : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600'
        )}
        role="tab"
        aria-selected={activeCategory === null}
      >
        All ({INTEGRATIONS.length})
      </button>

      {/* Category buttons */}
      {categories.map((category) => {
        const count = getIntegrationsByCategory(category.id).length
        const colors = THEME_COLORS[category.theme]
        const Icon = category.icon

        return (
          <button
            key={category.id}
            onClick={() => onSelectCategory(activeCategory === category.id ? null : category.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              activeCategory === category.id
                ? cn(colors.bg, colors.text, colors.border)
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600'
            )}
            role="tab"
            aria-selected={activeCategory === category.id}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {category.name}
            <span className="text-[10px] opacity-70">({count})</span>
          </button>
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
    { label: 'Total Integrations', value: INTEGRATIONS.length, icon: Blocks },
    { label: 'Categories', value: CATEGORIES.length, icon: Server },
    { label: 'New in v2.0', value: INTEGRATIONS.filter((i) => i.isNew).length, icon: Sparkles },
    {
      label: 'Official SDKs',
      value: INTEGRATIONS.filter((i) => i.isOfficial).length,
      icon: Shield,
    },
  ]

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: animated ? index * 0.1 : 0 }}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="bg-claw-500/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-claw-400 h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
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
 * IntegrationGrid - Interactive grid of 22 ecosystem items
 *
 * Displays all GuardianClaw integrations organized by category with
 * filtering, hover details, and animated entrance.
 *
 * Features:
 * - 22 items across 8 categories
 * - Category filter tabs
 * - Hover cards with details and links
 * - New/Official badges
 * - Responsive grid layout
 * - Animated entrance on scroll
 */
export const IntegrationGrid = memo(function IntegrationGrid({
  animated = true,
  showFilter = true,
  compact = false,
  showDetails = true,
  className,
}: IntegrationGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(!animated)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)

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

  // Filter categories and integrations
  const filteredCategories = activeCategory
    ? CATEGORIES.filter((c) => c.id === activeCategory)
    : CATEGORIES

  // Deselect integration when category changes
  useEffect(() => {
    if (
      activeCategory &&
      selectedIntegration &&
      selectedIntegration.categoryId !== activeCategory
    ) {
      setSelectedIntegration(null)
    }
  }, [activeCategory, selectedIntegration])

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      role="region"
      aria-label="GuardianClaw integrations grid"
    >
      {/* Summary stats */}
      {!compact && isInView && <SummaryStats animated={animated} />}

      {/* Category filter */}
      {showFilter && isInView && (
        <CategoryFilter
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />
      )}

      {/* Detail panel */}
      <AnimatePresence mode="wait">
        {selectedIntegration && (
          <div className="mb-6">
            <DetailPanel
              integration={selectedIntegration}
              onClose={() => setSelectedIntegration(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Integration grid by category */}
      {isInView && (
        <div className="space-y-6">
          {filteredCategories.map((category, categoryIndex) => {
            const integrations = getIntegrationsByCategory(category.id)
            if (integrations.length === 0) return null

            return (
              <CategorySection
                key={category.id}
                category={category}
                integrations={integrations}
                animated={animated}
                showDetails={showDetails}
                selectedIntegration={selectedIntegration}
                onSelectIntegration={setSelectedIntegration}
                categoryIndex={categoryIndex}
              />
            )
          })}
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {selectedIntegration
          ? `Selected ${selectedIntegration.name}. ${selectedIntegration.description}`
          : `Showing ${activeCategory ? getCategoryById(activeCategory)?.name : 'all'} integrations`}
      </div>
    </div>
  )
})

export default IntegrationGrid
