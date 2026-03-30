'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Scale,
  Target,
  CheckCircle2,
  Sparkles,
  Zap,
  Settings2,
} from 'lucide-react'
import { FlowNodeData, GuardianClawLayerType } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle, TargetHandle } from './custom-handle'
import { cn } from '@/lib/utils'

interface ClawNodeProps {
  data: FlowNodeData
  selected?: boolean
}

// =============================================================================
// v2.25 Layer Configuration
// =============================================================================

interface LayerConfig {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  badge: string
  color: string
  bgColor: string
  borderColor: string
}

const layerTypeConfig: Record<GuardianClawLayerType, LayerConfig> = {
  input_validator: {
    icon: ShieldCheck,
    title: 'Input Validator',
    subtitle: 'L1: Pre-AI Detection',
    badge: 'L1',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  seed_injection: {
    icon: Sparkles,
    title: 'Seed Injection',
    subtitle: 'L2: Alignment Prompt',
    badge: 'L2',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  output_validator: {
    icon: ShieldAlert,
    title: 'Output Validator',
    subtitle: 'L3: Post-AI Heuristic',
    badge: 'L3',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  observer: {
    icon: Eye,
    title: 'GuardianClaw Observer',
    subtitle: 'L4: LLM Analysis',
    badge: 'L4',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
  },
}

// =============================================================================
// Legacy Gate Configuration (v2.18 compatibility)
// =============================================================================

const gateTypeConfig = {
  all: {
    icon: ShieldCheck,
    title: 'All Gates',
    subtitle: 'Complete CLAW validation',
    badge: 'CLAW',
    gates: ['C', 'L', 'A', 'W'],
  },
  credibility: {
    icon: Eye,
    title: 'Credibility Gate',
    subtitle: 'Verify factual accuracy',
    badge: 'C',
    gates: ['C'],
  },
  avoidance: {
    icon: ShieldAlert,
    title: 'Avoidance Gate',
    subtitle: 'Check for harmful content',
    badge: 'A',
    gates: ['A'],
  },
  limits: {
    icon: Scale,
    title: 'Limits Gate',
    subtitle: 'Verify boundaries',
    badge: 'L',
    gates: ['L'],
  },
  worth: {
    icon: Target,
    title: 'Worth Gate',
    subtitle: 'Require beneficial purpose',
    badge: 'W',
    gates: ['W'],
  },
}

const gateColors: Record<string, string> = {
  C: 'bg-cyan-500',
  L: 'bg-amber-500',
  A: 'bg-red-500',
  W: 'bg-violet-500',
}

const gateLabels: Record<string, string> = {
  C: 'Credibility',
  L: 'Limits',
  A: 'Avoidance',
  W: 'Worth',
}

// =============================================================================
// Layer Node View (v2.25)
// =============================================================================

function LayerNodeView({ data, selected }: ClawNodeProps) {
  const layerType = data.layerType as GuardianClawLayerType
  const config = layerTypeConfig[layerType]
  const Icon = config.icon

  // Get layer-specific status info
  const getLayerStatus = () => {
    switch (layerType) {
      case 'input_validator': {
        const l1 = data.l1Config
        if (!l1) return { text: 'Default config', icon: Settings2 }
        const activeCount = Object.values(l1.enabledDetectors || {}).filter(Boolean).length
        return { text: `${activeCount} detectors • ${l1.mode}`, icon: Zap }
      }
      case 'seed_injection': {
        const l2 = data.l2Config
        if (!l2) return { text: 'Standard seed', icon: Sparkles }
        return { text: `${l2.seedLevel} seed`, icon: Sparkles }
      }
      case 'output_validator': {
        const l3 = data.l3Config
        if (!l3) return { text: 'All gates active', icon: Shield }
        const activeGates = Object.values(l3.enabledGates || {}).filter(Boolean).length
        return { text: `${activeGates}/4 gates • ${l3.mode}`, icon: Shield }
      }
      case 'observer': {
        const l4 = data.l4Config
        if (!l4) return { text: 'LLM analysis', icon: Eye }
        if (!l4.enabled) return { text: 'Disabled', icon: Eye }
        return { text: `${l4.model} • ${l4.fallbackPolicy}`, icon: Eye }
      }
      default:
        return { text: 'Unknown', icon: Shield }
    }
  }

  const status = getLayerStatus()
  const StatusIcon = status.icon

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="orange"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="claw" />
          <SourceHandle position={Position.Right} category="claw" />
        </>
      }
    >
      <div className="space-y-3">
        {/* Layer badge with color */}
        <div
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-3 py-2',
            config.bgColor,
            'border',
            config.borderColor
          )}
        >
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold',
              'bg-zinc-900/50',
              config.color
            )}
          >
            {config.badge}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-medium', config.color)}>{config.title}</p>
          </div>
        </div>

        {/* Status info */}
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <StatusIcon className="h-3 w-3" />
          <span className="truncate">{status.text}</span>
        </div>

        {/* L4 specific: enabled indicator */}
        {layerType === 'observer' && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">LLM Analysis</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                data.l4Config?.enabled
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-zinc-700 text-zinc-500'
              )}
            >
              {data.l4Config?.enabled ? 'ON' : 'OFF'}
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

// =============================================================================
// Legacy Gate Node View (v2.18)
// =============================================================================

function GateNodeView({ data, selected }: ClawNodeProps) {
  const gateType = data.gateType || 'all'
  const config = gateTypeConfig[gateType] || gateTypeConfig.all
  const Icon = config.icon

  const isEnabled = data.config?.enabled !== false
  const strictMode = data.config?.strictMode === true

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="orange"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="claw" />
          <SourceHandle position={Position.Right} category="claw" />
        </>
      }
    >
      {/* CLAW Gates visualization */}
      <div className="space-y-3">
        {/* Gate indicators */}
        <div className="flex items-center justify-center gap-1">
          {['C', 'L', 'A', 'W'].map((gate) => {
            const isActive = config.gates.includes(gate)
            return (
              <div
                key={gate}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-all',
                  isActive
                    ? cn(gateColors[gate], 'text-white shadow-lg')
                    : 'bg-zinc-800 text-zinc-600'
                )}
                title={gateLabels[gate]}
              >
                {gate}
              </div>
            )
          })}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className={cn('h-2 w-2 rounded-full', isEnabled ? 'bg-emerald-500' : 'bg-zinc-600')}
            />
            <span className={isEnabled ? 'text-emerald-400' : 'text-zinc-500'}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {strictMode && (
            <span className="flex items-center gap-1 text-amber-400">
              <ShieldAlert className="h-3 w-3" />
              Strict
            </span>
          )}
        </div>

        {/* All gates description */}
        {gateType === 'all' && (
          <div className="rounded border border-orange-600/20 bg-orange-600/10 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-xs text-orange-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>All 4 gates active</span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function ClawNodeComponent({ data, selected }: ClawNodeProps) {
  // Check if this is a v2.25 layer node
  if (data.layerType && layerTypeConfig[data.layerType as GuardianClawLayerType]) {
    return <LayerNodeView data={data} selected={selected} />
  }

  // Fallback to legacy gate view
  return <GateNodeView data={data} selected={selected} />
}

export const ClawNode = memo(ClawNodeComponent)
