/**
 * Shared types for GuardianClaw integration demos
 *
 * This module provides type definitions used across all demo components,
 * ensuring consistency and type safety throughout the demo system.
 */

import type { LucideIcon } from 'lucide-react'

// Theme colors supported by demo components
export type DemoTheme =
  | 'purple'
  | 'violet'
  | 'amber'
  | 'teal'
  | 'orange'
  | 'blue'
  | 'green'
  | 'red'
  | 'claw'

// Scenario type for all demos
export type DemoScenario = 'safe' | 'blocked'

// Common status types for steps and agents
export type StepStatus =
  | 'pending'
  | 'checking'
  | 'validating'
  | 'working'
  | 'complete'
  | 'blocked'
  | 'failed'
  | 'passed'

// Validation-specific status (subset of StepStatus)
export type ValidationStatus = 'pending' | 'checking' | 'passed' | 'failed'

// Agent-specific status (subset of StepStatus)
export type AgentStatus = 'pending' | 'validating' | 'working' | 'complete' | 'blocked'

/**
 * Message in the demo chat interface
 */
export interface DemoMessage {
  id: string
  type: 'user' | 'agent' | 'system' | 'crew'
  content: string
  status?: 'typing' | 'complete'
  agentName?: string
  agentIcon?: string
}

/**
 * Generic step in a pipeline (can be agent or validation step)
 */
export interface DemoStep {
  id: string
  name: string
  description?: string
  status: StepStatus
  icon?: string
}

/**
 * Validation step configuration
 */
export interface ValidationStep {
  id: string
  name: string
  result: 'passed' | 'failed'
}

/**
 * Agent step configuration
 */
export interface AgentStep {
  id: string
  name: string
  icon: string
  task: string
  output?: string
}

/**
 * Base scenario configuration
 */
export interface BaseScenario {
  userMessage: string
  blocked: boolean
}

/**
 * Scenario with validation steps (like Coinbase)
 */
export interface ValidationScenario extends BaseScenario {
  agentThinking: string
  validationSteps: ValidationStep[]
  agentResponse: string
}

/**
 * Scenario with agent pipeline (like VoltAgent)
 */
export interface AgentScenario extends BaseScenario {
  crewAck: string
  agents: AgentStep[]
  finalOutput: string
  blockedAt?: string | null
  blockedReason?: string
}

/**
 * Demo header configuration
 */
export interface DemoHeaderConfig {
  icon: LucideIcon
  badge: string
  title: string
  subtitle: string
  theme: DemoTheme
}

/**
 * Demo chat header configuration
 */
export interface DemoChatHeaderConfig {
  icon: LucideIcon
  title: string
  subtitle: string
  status?: 'ready' | 'online' | 'processing' | 'error'
  theme: DemoTheme
}

/**
 * Phase configuration for progress indicator
 */
export interface DemoPhase {
  id: string
  label?: string
}

/**
 * Props for the TypewriterText component
 */
export interface TypewriterTextProps {
  text: string
  speed?: number
  onComplete?: () => void
  cursor?: boolean
  className?: string
}

/**
 * Props for the FlowParticle component
 */
export interface FlowParticleProps {
  active: boolean
  color?: DemoTheme
  direction?: 'down' | 'up' | 'left' | 'right'
  duration?: number
}

/**
 * Props for the DemoHeader component
 */
export interface DemoHeaderProps {
  icon: LucideIcon
  badge: string
  title: string
  subtitle: string
  theme?: DemoTheme
}

/**
 * Props for the DemoScenarioSelector component
 */
export interface DemoScenarioSelectorProps {
  scenario: DemoScenario
  onScenarioChange: (scenario: DemoScenario) => void
  disabled?: boolean
  safeLabel?: string
  blockedLabel?: string
}

/**
 * Props for the DemoControls component
 */
export interface DemoControlsProps {
  onPlay: () => void
  onReset: () => void
  isPlaying: boolean
  theme?: DemoTheme
  playLabel?: string
  playingLabel?: string
  resetLabel?: string
}

/**
 * Props for the DemoProgress component
 */
export interface DemoProgressProps {
  phases: string[]
  currentPhase: string
  theme?: DemoTheme
}

/**
 * Props for the DemoStepCard component
 */
export interface DemoStepCardProps {
  name: string
  description?: string
  status: StepStatus
  icon?: LucideIcon
  theme?: DemoTheme
  validating?: boolean
  showConnector?: boolean
}

/**
 * Props for the DemoNode component
 */
export interface DemoNodeProps {
  title: string
  subtitle: string
  icon: LucideIcon
  active?: boolean
  complete?: boolean
  blocked?: boolean
  theme?: DemoTheme
}

/**
 * Props for the DemoChat component
 */
export interface DemoChatProps {
  header: DemoChatHeaderConfig
  messages: DemoMessage[]
  isIdle?: boolean
  idleMessage?: string
  showThinking?: boolean
  thinkingMessage?: string
  /** Custom content for thinking indicator (overrides thinkingMessage) */
  thinkingContent?: React.ReactNode
  /** Height of messages area in pixels (default: 320). Used as minHeight when autoExpand is true */
  messagesHeight?: number
  /** When true, chat area grows with content instead of scrolling (default: true) */
  autoExpand?: boolean
  renderAgentIcon?: (iconType: string) => React.ReactNode
  className?: string
}

/**
 * Theme color mapping utilities
 */
export const themeColors: Record<
  DemoTheme,
  {
    bg: string
    bgLight: string
    text: string
    border: string
    shadow: string
  }
> = {
  purple: {
    bg: 'bg-purple-500',
    bgLight: 'bg-purple-500/20',
    text: 'text-purple-500',
    border: 'border-purple-500/30',
    shadow: 'shadow-purple-500/25',
  },
  violet: {
    bg: 'bg-violet-500',
    bgLight: 'bg-violet-500/20',
    text: 'text-violet-500',
    border: 'border-violet-500/30',
    shadow: 'shadow-violet-500/25',
  },
  amber: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-500/20',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    shadow: 'shadow-amber-500/25',
  },
  teal: {
    bg: 'bg-teal-500',
    bgLight: 'bg-teal-500/20',
    text: 'text-teal-500',
    border: 'border-teal-500/30',
    shadow: 'shadow-teal-500/25',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-500/20',
    text: 'text-orange-500',
    border: 'border-orange-500/30',
    shadow: 'shadow-orange-500/25',
  },
  blue: {
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-500/20',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
    shadow: 'shadow-blue-500/25',
  },
  green: {
    bg: 'bg-green-500',
    bgLight: 'bg-green-500/20',
    text: 'text-green-500',
    border: 'border-green-500/30',
    shadow: 'shadow-green-500/25',
  },
  red: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-500/20',
    text: 'text-red-500',
    border: 'border-red-500/30',
    shadow: 'shadow-red-500/25',
  },
  claw: {
    bg: 'bg-claw-500',
    bgLight: 'bg-claw-500/20',
    text: 'text-claw-500',
    border: 'border-claw-500/30',
    shadow: 'shadow-claw-500/25',
  },
}

/**
 * Get status color classes based on step status
 */
export function getStatusColors(status: StepStatus): {
  border: string
  bg: string
  text: string
  iconBg: string
  iconText: string
} {
  switch (status) {
    case 'pending':
      return {
        border: 'border-zinc-800',
        bg: 'bg-zinc-900/30',
        text: '',
        iconBg: 'bg-zinc-800',
        iconText: 'text-zinc-500',
      }
    case 'checking':
    case 'validating':
      return {
        border: 'border-claw-500/50',
        bg: 'bg-claw-500/5',
        text: '',
        iconBg: 'bg-claw-500/20',
        iconText: 'text-claw-500',
      }
    case 'working':
      return {
        border: 'border-blue-500/50',
        bg: 'bg-blue-500/5',
        text: '',
        iconBg: 'bg-blue-500/20',
        iconText: 'text-blue-500',
      }
    case 'complete':
    case 'passed':
      return {
        border: 'border-green-500/50',
        bg: 'bg-green-500/5',
        text: 'text-green-500',
        iconBg: 'bg-green-500/20',
        iconText: 'text-green-500',
      }
    case 'blocked':
    case 'failed':
      return {
        border: 'border-red-500/50',
        bg: 'bg-red-500/5',
        text: 'text-red-500',
        iconBg: 'bg-red-500/20',
        iconText: 'text-red-500',
      }
    default:
      return {
        border: 'border-zinc-800',
        bg: 'bg-zinc-900/50',
        text: '',
        iconBg: 'bg-zinc-800',
        iconText: 'text-zinc-500',
      }
  }
}
