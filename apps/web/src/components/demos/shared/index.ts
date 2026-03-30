/**
 * GuardianClaw Demo Components - Shared Library
 *
 * This module exports all shared components and utilities for building
 * consistent, high-quality integration demos across the GuardianClaw platform.
 *
 * @example
 * ```tsx
 * import {
 *   DemoHeader,
 *   DemoScenarioSelector,
 *   DemoChat,
 *   DemoControls,
 *   DemoProgress,
 *   TypewriterText,
 * } from '@/components/demos/shared'
 * ```
 */

// Types
export * from './types'

// Core animation components
export { TypewriterText, useTypewriter } from './TypewriterText'
export { FlowParticle, FlowLine, FlowConnector } from './FlowParticle'

// Layout components
export { DemoHeader, DemoSection } from './DemoHeader'

// Control components
export { DemoScenarioSelector, DemoScenarioSelectorExtended } from './DemoScenarioSelector'
export { DemoControls, DemoControlsExtended } from './DemoControls'
export { DemoProgress, DemoProgressLabeled, DemoProgressBar } from './DemoProgress'

// Pipeline components
export {
  DemoStepCard,
  StepStatusIndicator,
  DemoValidationStep,
  DemoAgentCard,
} from './DemoStepCard'
export { DemoNode, DemoInputNode, DemoOutputNode } from './DemoNode'

// Chat components
export { DemoChat, DemoChatHeader, DemoChatMessage, DemoChatCompact } from './DemoChat'
