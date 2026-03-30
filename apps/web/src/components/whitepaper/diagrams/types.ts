/**
 * Type definitions for Whitepaper diagram components
 *
 * Provides strongly-typed interfaces for animated diagrams
 * used throughout the whitepaper page.
 */

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/* -------------------------------------------------------------------------- */
/*                              Common Diagram Types                           */
/* -------------------------------------------------------------------------- */

/**
 * Theme colors for diagram components
 */
export type DiagramTheme = 'blue' | 'green' | 'amber' | 'teal' | 'purple' | 'red' | 'zinc' | 'claw'

/**
 * Animation state for diagram elements
 */
export type DiagramState = 'idle' | 'active' | 'complete' | 'blocked'

/**
 * Flow direction for animations
 */
export type FlowDirection = 'left' | 'right' | 'up' | 'down'

/* -------------------------------------------------------------------------- */
/*                         FourLayerArchitecture Types                         */
/* -------------------------------------------------------------------------- */

/**
 * Layer configuration for the 4-layer architecture diagram
 */
export interface ArchitectureLayer {
  /** Layer identifier (L1, L2, L3, L4) */
  id: string
  /** Display name */
  name: string
  /** Short label */
  label: string
  /** Layer description */
  description: string
  /** Icon component */
  icon: LucideIcon
  /** Theme color */
  theme: DiagramTheme
  /** Function performed by this layer */
  function: string
  /** Key features of this layer */
  features: string[]
}

/**
 * Props for FourLayerArchitecture component
 */
export interface FourLayerArchitectureProps {
  /** Auto-play animation on mount */
  autoPlay?: boolean
  /** Animation speed in milliseconds per step */
  stepDuration?: number
  /** Show layer details on hover/click */
  interactive?: boolean
  /** Compact mode for mobile */
  compact?: boolean
  /** Initial layer to highlight (optional) */
  initialLayer?: string
  /** Callback when layer is selected */
  onLayerSelect?: (layerId: string | null) => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Internal state for layer animation
 */
export interface LayerAnimationState {
  /** Current active layer index (-1 for none) */
  activeIndex: number
  /** Completed layer indices */
  completedIndices: number[]
  /** Blocked layer index (-1 for none) */
  blockedIndex: number
  /** Whether animation is playing */
  isPlaying: boolean
  /** Selected scenario id */
  scenario: string
  /** L4 async phase — L4 runs post-response as a transcript observer */
  asyncPhase?: 'pending' | 'analyzing' | 'flagged'
}

/* -------------------------------------------------------------------------- */
/*                              Shared UI Types                                */
/* -------------------------------------------------------------------------- */

/**
 * Props for diagram control buttons
 */
export interface DiagramControlsProps {
  /** Play/resume animation */
  onPlay: () => void
  /** Reset to initial state */
  onReset: () => void
  /** Whether animation is currently playing */
  isPlaying: boolean
  /** Disable controls */
  disabled?: boolean
  /** Theme color for buttons */
  theme?: DiagramTheme
  /** Additional CSS classes */
  className?: string
}

/**
 * Props for scenario selector
 */
export interface ScenarioSelectorProps {
  /** Current scenario id */
  scenario: string
  /** Callback when scenario changes */
  onScenarioChange: (scenario: string) => void
  /** Disable selector */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Props for flow particle animation
 */
export interface DiagramFlowParticleProps {
  /** Whether particle is active */
  active: boolean
  /** Theme color */
  theme?: DiagramTheme
  /** Flow direction */
  direction?: FlowDirection
  /** Animation duration in seconds */
  duration?: number
}

/**
 * Layer card display configuration
 */
export interface LayerCardConfig {
  /** Layer data */
  layer: ArchitectureLayer
  /** Current state */
  state: DiagramState
  /** Whether expanded to show details */
  expanded: boolean
  /** Click handler */
  onClick?: () => void
  /** Theme color override */
  theme?: DiagramTheme
}

/* -------------------------------------------------------------------------- */
/*                             Color Configurations                            */
/* -------------------------------------------------------------------------- */

/**
 * Theme color classes mapping
 */
export const diagramThemeColors: Record<
  DiagramTheme,
  {
    border: string
    borderActive: string
    bg: string
    bgActive: string
    text: string
    iconBg: string
    particle: string
    glow: string
  }
> = {
  blue: {
    border: 'border-blue-500/30',
    borderActive: 'border-blue-500',
    bg: 'bg-blue-500/5',
    bgActive: 'bg-blue-500/10',
    text: 'text-blue-500',
    iconBg: 'bg-blue-500/20',
    particle: 'bg-blue-500',
    glow: 'shadow-blue-500/25',
  },
  green: {
    border: 'border-green-500/30',
    borderActive: 'border-green-500',
    bg: 'bg-green-500/5',
    bgActive: 'bg-green-500/10',
    text: 'text-green-500',
    iconBg: 'bg-green-500/20',
    particle: 'bg-green-500',
    glow: 'shadow-green-500/25',
  },
  amber: {
    border: 'border-amber-500/30',
    borderActive: 'border-amber-500',
    bg: 'bg-amber-500/5',
    bgActive: 'bg-amber-500/10',
    text: 'text-amber-500',
    iconBg: 'bg-amber-500/20',
    particle: 'bg-amber-500',
    glow: 'shadow-amber-500/25',
  },
  teal: {
    border: 'border-teal-500/30',
    borderActive: 'border-teal-500',
    bg: 'bg-teal-500/5',
    bgActive: 'bg-teal-500/10',
    text: 'text-teal-500',
    iconBg: 'bg-teal-500/20',
    particle: 'bg-teal-500',
    glow: 'shadow-teal-500/25',
  },
  purple: {
    border: 'border-purple-500/30',
    borderActive: 'border-purple-500',
    bg: 'bg-purple-500/5',
    bgActive: 'bg-purple-500/10',
    text: 'text-purple-500',
    iconBg: 'bg-purple-500/20',
    particle: 'bg-purple-500',
    glow: 'shadow-purple-500/25',
  },
  red: {
    border: 'border-red-500/30',
    borderActive: 'border-red-500',
    bg: 'bg-red-500/5',
    bgActive: 'bg-red-500/10',
    text: 'text-red-500',
    iconBg: 'bg-red-500/20',
    particle: 'bg-red-500',
    glow: 'shadow-red-500/25',
  },
  zinc: {
    border: 'border-zinc-700',
    borderActive: 'border-zinc-500',
    bg: 'bg-zinc-900/50',
    bgActive: 'bg-zinc-800/50',
    text: 'text-zinc-400',
    iconBg: 'bg-zinc-800',
    particle: 'bg-zinc-500',
    glow: 'shadow-zinc-500/25',
  },
  claw: {
    border: 'border-claw-500/30',
    borderActive: 'border-claw-500',
    bg: 'bg-claw-500/5',
    bgActive: 'bg-claw-500/10',
    text: 'text-claw-500',
    iconBg: 'bg-claw-500/20',
    particle: 'bg-claw-500',
    glow: 'shadow-claw-500/25',
  },
}

/**
 * State-based color overrides
 */
export const diagramStateColors: Record<
  DiagramState,
  {
    border: string
    bg: string
    text: string
    iconBg: string
  }
> = {
  idle: {
    border: 'border-zinc-800',
    bg: 'bg-zinc-900/30',
    text: 'text-zinc-500',
    iconBg: 'bg-zinc-800',
  },
  active: {
    border: '', // Use theme color
    bg: '', // Use theme color
    text: '', // Use theme color
    iconBg: '', // Use theme color
  },
  complete: {
    border: 'border-green-500/50',
    bg: 'bg-green-500/5',
    text: 'text-green-500',
    iconBg: 'bg-green-500/20',
  },
  blocked: {
    border: 'border-red-500/50',
    bg: 'bg-red-500/5',
    text: 'text-red-500',
    iconBg: 'bg-red-500/20',
  },
}
