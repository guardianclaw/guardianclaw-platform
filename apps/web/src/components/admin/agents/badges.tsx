'use client'

import { Badge } from '@/components/ui/badge'
import { Ban } from 'lucide-react'

// Framework colors and labels for agent frameworks
const FRAMEWORK_CONFIG: Record<string, { color: string; label: string }> = {
  openai_agents: {
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    label: 'OpenAI Agents',
  },
  anthropic_sdk: {
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    label: 'Anthropic',
  },
  coinbase_agentkit: {
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    label: 'Coinbase AgentKit',
  },
  solana_agent_kit: {
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    label: 'Solana Agent Kit',
  },
  google_adk: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Google ADK' },
  virtuals_protocol: {
    color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    label: 'Virtuals Protocol',
  },
  elizaos: { color: 'bg-pink-500/10 text-pink-500 border-pink-500/20', label: 'ElizaOS' },
  voltagent: { color: 'bg-violet-500/10 text-violet-500 border-violet-500/20', label: 'VoltAgent' },
  moltbot: { color: 'bg-teal-500/10 text-teal-500 border-teal-500/20', label: 'Moltbot' },
  custom: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', label: 'Custom' },
}

// Agent status configuration
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', label: 'Draft' },
  testing: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Testing' },
  deployed: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Deployed' },
  archived: { color: 'bg-gray-500/10 text-gray-400 border-gray-400/20', label: 'Archived' },
}

// CLAW gate configuration
const GATE_CONFIG: Record<string, { color: string; label: string }> = {
  credibility: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Credibility' },
  avoidance: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Avoidance' },
  limits: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Limits' },
  worth: { color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', label: 'Worth' },
}

export interface FrameworkBadgeProps {
  framework: string
}

export function FrameworkBadge({ framework }: FrameworkBadgeProps) {
  const config = FRAMEWORK_CONFIG[framework] || FRAMEWORK_CONFIG.custom
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

export interface AgentStatusBadgeProps {
  status: string
  isSuspended: boolean
}

export function AgentStatusBadge({ status, isSuspended }: AgentStatusBadgeProps) {
  if (isSuspended) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <Ban className="h-3 w-3" />
        Suspended
      </Badge>
    )
  }

  const config = STATUS_CONFIG[status] || { color: '', label: status }
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

export interface GateBadgeProps {
  gate: string | null
}

export function GateBadge({ gate }: GateBadgeProps) {
  if (!gate) return <span className="text-muted-foreground">-</span>

  const config = GATE_CONFIG[gate] || { color: '', label: gate }
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

// Re-export framework list for filters
export const FRAMEWORK_OPTIONS = Object.entries(FRAMEWORK_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}))

export const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({
  value,
  label,
}))
