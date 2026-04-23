/**
 * Type definitions for the OpenClaw Demo
 *
 * These types define the data structures used throughout the OpenClaw demo,
 * ensuring type safety and clear contracts between components.
 */

import type { LucideIcon } from 'lucide-react'

/**
 * Protection levels available in GuardianClaw for OpenClaw
 * Each level provides different blocking and alerting behavior
 */
export type ProtectionLevel = 'off' | 'watch' | 'guard' | 'shield'

/**
 * The four validation layers in GuardianClaw's architecture
 */
export type ValidationLayer = 'L1' | 'L2' | 'L3' | 'L4'

/**
 * Status of a validation layer during processing
 */
export type LayerStatus = 'idle' | 'active' | 'passed' | 'blocked' | 'skipped'

/**
 * Scenario identifiers for the demo
 * Unlike other demos with 2 scenarios, OpenClaw has 4 to showcase all protection layers
 */
export type OpenClawScenario = 'normal' | 'injection' | 'dataleak' | 'behavioral-escalation'

/**
 * Configuration for each validation layer
 */
export interface LayerConfig {
  id: ValidationLayer
  name: string
  fullName: string
  description: string
  icon: LucideIcon
  detects: string[]
}

/**
 * State of a layer during demo execution
 */
export interface LayerState {
  id: ValidationLayer
  status: LayerStatus
  message?: string
  details?: string
  threatLevel?: number
}

/**
 * Entry in the audit log
 */
export interface AuditEntry {
  id: string
  timestamp: string
  layer: ValidationLayer | 'system'
  type: 'info' | 'warning' | 'error' | 'success' | 'blocked'
  message: string
  details?: string
}

/**
 * Real-time metrics displayed in the dashboard
 */
export interface DemoMetrics {
  threatsBlocked: number
  alertsTriggered: number
  patternsDetected: number
  threatLevel: number // 0-100
  responseTimeMs: number
}

/**
 * Message in the OpenClaw chat interface
 */
export interface OpenClawMessage {
  id: string
  type: 'user' | 'bot' | 'system' | 'claw'
  content: string
  status?: 'typing' | 'complete'
  metadata?: {
    blocked?: boolean
    layer?: ValidationLayer
    threatType?: string
  }
}

/**
 * Tool call attempted by the agent
 */
export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status: 'pending' | 'executing' | 'allowed' | 'blocked'
  blockedReason?: string
}

/**
 * Configuration for a demo scenario
 */
export interface ScenarioConfig {
  id: OpenClawScenario
  name: string
  description: string
  icon: LucideIcon
  userMessage: string
  attackType?: string
  blockedAt?: ValidationLayer
  layers: {
    L1: { result: 'passed' | 'blocked'; message: string; details?: string }
    L2: { result: 'passed' | 'blocked'; message: string; details?: string }
    L3: { result: 'passed' | 'blocked'; message: string; details?: string }
    L4: { result: 'passed' | 'blocked'; message: string; details?: string }
  }
  toolCall?: ToolCall
  botResponse: string
  auditEntries: Omit<AuditEntry, 'id' | 'timestamp'>[]
  metrics: DemoMetrics
}

/**
 * Demo phase representing the current state of the animation
 */
export type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'analyzing-input'
  | 'layer-L1'
  | 'layer-L2'
  | 'layer-L3'
  | 'layer-L4'
  | 'executing-tool'
  | 'typing-response'
  | 'complete'

/**
 * Props for the main OpenClawDemo component
 */
export interface OpenClawDemoProps {
  className?: string
}

/**
 * Props for the SecurityDashboard component
 */
export interface SecurityDashboardProps {
  protectionLevel: ProtectionLevel
  layers: LayerState[]
  metrics: DemoMetrics
  isActive: boolean
  className?: string
}

/**
 * Props for the LayerVisualization component
 */
export interface LayerVisualizationProps {
  layers: LayerState[]
  currentLayer?: ValidationLayer
  isProcessing: boolean
  protectionLevel: ProtectionLevel
  className?: string
}

/**
 * Props for the AuditTerminal component
 */
export interface AuditTerminalProps {
  entries: AuditEntry[]
  isExpanded?: boolean
  onToggleExpand?: () => void
  maxVisibleEntries?: number
  className?: string
}

/**
 * Props for the ThreatGauge component
 */
export interface ThreatGaugeProps {
  level: number // 0-100
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

/**
 * Props for the ProtectionLevelSelector component
 */
export interface ProtectionLevelSelectorProps {
  level: ProtectionLevel
  onChange: (level: ProtectionLevel) => void
  disabled?: boolean
  className?: string
}

/**
 * Protection level configuration details
 */
export const protectionLevelConfig: Record<
  ProtectionLevel,
  {
    name: string
    description: string
    blocking: string
    alerting: string
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  off: {
    name: 'Off',
    description: 'GuardianClaw disabled',
    blocking: 'None',
    alerting: 'None',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/30',
  },
  watch: {
    name: 'Watch',
    description: 'Monitor only',
    blocking: 'None',
    alerting: 'All threats',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  guard: {
    name: 'Guard',
    description: 'Block critical',
    blocking: 'Critical',
    alerting: 'High+ threats',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  shield: {
    name: 'Shield',
    description: 'Maximum protection',
    blocking: 'Maximum',
    alerting: 'All threats',
    color: 'text-claw-500',
    bgColor: 'bg-claw-500/10',
    borderColor: 'border-claw-500/30',
  },
}

/**
 * Layer configuration with static metadata
 */
export const layerConfigs: Record<ValidationLayer, Omit<LayerConfig, 'icon'>> = {
  L1: {
    id: 'L1',
    name: 'Input',
    fullName: 'Input Validator',
    description: 'Pre-AI attack detection with 700+ patterns',
    detects: [
      'Prompt injection',
      'Jailbreak attempts',
      'Role manipulation',
      'System prompt extraction',
    ],
  },
  L2: {
    id: 'L2',
    name: 'Seed',
    fullName: 'Safety Seed',
    description: 'Alignment via system prompt injection',
    detects: ['Context poisoning', 'Instruction override', 'Persona manipulation'],
  },
  L3: {
    id: 'L3',
    name: 'Output',
    fullName: 'Output Validator',
    description: 'Post-AI heuristic checking',
    detects: ['API keys', 'Passwords', 'Private keys', 'Credit cards', 'SSNs', 'PII'],
  },
  L4: {
    id: 'L4',
    name: 'Observer',
    fullName: 'Transcript Observer',
    description: 'LLM-based 6-question transcript analysis (async)',
    detects: [
      'Multi-turn escalation',
      'Deceptive framing',
      'CLAW gate violations',
      'Behavioral drift patterns',
    ],
  },
}
