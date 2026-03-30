'use client'

import { motion } from 'framer-motion'
import { Shield, AlertTriangle, Activity, Clock, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SecurityDashboardProps, LayerState, ProtectionLevel, ValidationLayer } from './types'
import { protectionLevelConfig, layerConfigs } from './types'

/**
 * Get the appropriate icon for a layer status
 */
function getLayerStatusIcon(status: LayerState['status']) {
  switch (status) {
    case 'active':
      return (
        <motion.div
          className="h-2 w-2 rounded-full bg-amber-500"
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )
    case 'passed':
      return <div className="h-2 w-2 rounded-full bg-green-500" />
    case 'blocked':
      return <div className="h-2 w-2 rounded-full bg-red-500" />
    case 'skipped':
      return <div className="h-2 w-2 rounded-full bg-zinc-600" />
    default:
      return <div className="h-2 w-2 rounded-full bg-zinc-700" />
  }
}

/**
 * Get border color class based on protection level
 */
function getProtectionBorderClass(level: ProtectionLevel, isActive: boolean): string {
  if (!isActive) return 'border-zinc-800'

  switch (level) {
    case 'off':
      return 'border-zinc-700'
    case 'watch':
      return 'border-blue-500/50'
    case 'guard':
      return 'border-amber-500/50'
    case 'shield':
      return 'border-claw-500/50'
  }
}

/**
 * AnimatedGradientBorder - Wrapper with animated gradient border effect
 */
function AnimatedGradientBorder({
  children,
  isActive,
  protectionLevel,
  className,
}: {
  children: React.ReactNode
  isActive: boolean
  protectionLevel: ProtectionLevel
  className?: string
}) {
  const gradientColors = {
    off: 'from-zinc-700 via-zinc-600 to-zinc-700',
    watch: 'from-blue-600 via-cyan-500 to-blue-600',
    guard: 'from-amber-600 via-orange-500 to-amber-600',
    shield: 'from-claw-600 via-claw-500 to-claw-600',
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl p-[1px]', className)}>
      {/* Animated gradient background */}
      {isActive && protectionLevel !== 'off' && (
        <motion.div
          className={cn(
            'absolute inset-0 bg-gradient-to-r opacity-60',
            gradientColors[protectionLevel]
          )}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{ backgroundSize: '200% 100%' }}
        />
      )}

      {/* Static border fallback */}
      {(!isActive || protectionLevel === 'off') && <div className="absolute inset-0 bg-zinc-800" />}

      {/* Content */}
      <div className="relative rounded-2xl bg-zinc-950">{children}</div>
    </div>
  )
}

/**
 * LayerStatusBar - Horizontal bar showing all 4 layers status
 */
function LayerStatusBar({
  layers,
  protectionLevel,
}: {
  layers: LayerState[]
  protectionLevel: ProtectionLevel
}) {
  const layerOrder: ValidationLayer[] = ['L1', 'L2', 'L3', 'L4']

  return (
    <div className="flex items-center gap-1">
      {layerOrder.map((layerId, index) => {
        const layer = layers.find((l) => l.id === layerId) || {
          id: layerId,
          status: 'idle' as const,
        }
        const config = layerConfigs[layerId]
        const isLast = index === layerOrder.length - 1

        return (
          <div key={layerId} className="flex items-center gap-1">
            {/* Layer indicator */}
            <motion.div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs transition-colors',
                layer.status === 'idle' && 'bg-zinc-800/50 text-zinc-500',
                layer.status === 'active' && 'bg-amber-500/20 text-amber-400',
                layer.status === 'passed' && 'bg-green-500/20 text-green-400',
                layer.status === 'blocked' && 'bg-red-500/20 text-red-400',
                layer.status === 'skipped' && 'bg-zinc-800/50 text-zinc-600'
              )}
              animate={layer.status === 'active' ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.5, repeat: layer.status === 'active' ? Infinity : 0 }}
            >
              {getLayerStatusIcon(layer.status)}
              <span>{config.name}</span>
            </motion.div>

            {/* Connector arrow */}
            {!isLast && (
              <motion.span
                className={cn(
                  'text-xs transition-colors',
                  layer.status === 'passed' ? 'text-green-500' : 'text-zinc-700'
                )}
                animate={layer.status === 'active' ? { opacity: [0.5, 1, 0.5] } : {}}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                →
              </motion.span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * MetricCard - Individual metric display
 */
function MetricCard({
  label,
  value,
  icon: Icon,
  color = 'zinc',
  animate = false,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: 'zinc' | 'green' | 'amber' | 'red' | 'blue'
  animate?: boolean
}) {
  const colorClasses = {
    zinc: 'text-zinc-400',
    green: 'text-green-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    blue: 'text-blue-500',
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-3.5 w-3.5', colorClasses[color])} />
      <span className="text-xs text-zinc-500">{label}:</span>
      <motion.span
        className={cn('font-mono text-xs', colorClasses[color])}
        key={String(value)}
        initial={animate ? { scale: 1.2, opacity: 0.8 } : {}}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {value}
      </motion.span>
    </div>
  )
}

/**
 * ProtectionLevelBadge - Shows current protection level with visual indicator
 */
function ProtectionLevelBadge({ level, isActive }: { level: ProtectionLevel; isActive: boolean }) {
  const config = protectionLevelConfig[level]

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Protection:</span>
      <motion.div
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
          config.bgColor,
          config.color
        )}
        animate={
          isActive && level !== 'off'
            ? {
                boxShadow: [
                  '0 0 0 0 rgba(0,0,0,0)',
                  '0 0 8px 2px rgba(0,0,0,0.2)',
                  '0 0 0 0 rgba(0,0,0,0)',
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Shield className="h-3 w-3" />
        {config.name.toUpperCase()}
      </motion.div>
    </div>
  )
}

/**
 * SessionStatus - Live status indicator
 */
function SessionStatus({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500">Session:</span>
      <div className="flex items-center gap-1.5">
        <motion.div
          className={cn('h-2 w-2 rounded-full', isActive ? 'bg-green-500' : 'bg-zinc-600')}
          animate={isActive ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className={cn('text-xs', isActive ? 'text-green-400' : 'text-zinc-500')}>
          {isActive ? 'Protected' : 'Standby'}
        </span>
      </div>
    </div>
  )
}

/**
 * SecurityDashboard - Main dashboard header component
 *
 * Displays:
 * - GuardianClaw x Moltbot branding
 * - Current protection level with visual indicator
 * - 4-layer status bar showing current state of each validation layer
 * - Real-time metrics (threats blocked, alerts, response time)
 * - Session status indicator
 *
 * Features animated gradient border based on protection level and
 * real-time updates as the demo progresses.
 */
export function SecurityDashboard({
  protectionLevel,
  layers,
  metrics,
  isActive,
  className,
}: SecurityDashboardProps) {
  const getThreatColor = (level: number) => {
    if (level >= 70) return 'red'
    if (level >= 40) return 'amber'
    if (level >= 10) return 'blue'
    return 'green'
  }

  return (
    <AnimatedGradientBorder
      isActive={isActive}
      protectionLevel={protectionLevel}
      className={className}
    >
      <div className="space-y-4 p-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Shield className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-semibold text-zinc-100">GCLAW</span>
            </div>
            <span className="text-zinc-600">×</span>
            <span className="text-sm font-semibold text-orange-400">MOLTBOT</span>
          </div>

          {/* Protection level badge */}
          <ProtectionLevelBadge level={protectionLevel} isActive={isActive} />
        </div>

        {/* Layer status bar */}
        <div className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <LayerStatusBar layers={layers} protectionLevel={protectionLevel} />
        </div>

        {/* Metrics row */}
        <div className="flex items-center justify-between text-xs">
          <MetricCard
            label="Threats"
            value={metrics.threatsBlocked}
            icon={Shield}
            color={metrics.threatsBlocked > 0 ? 'red' : 'zinc'}
            animate
          />
          <MetricCard
            label="Alerts"
            value={metrics.alertsTriggered}
            icon={AlertTriangle}
            color={metrics.alertsTriggered > 0 ? 'amber' : 'zinc'}
            animate
          />
          <MetricCard
            label="Level"
            value={`${metrics.threatLevel}%`}
            icon={Activity}
            color={getThreatColor(metrics.threatLevel)}
            animate
          />
          <MetricCard
            label="Response"
            value={`${metrics.responseTimeMs}ms`}
            icon={Clock}
            color="zinc"
          />
          <SessionStatus isActive={isActive} />
        </div>
      </div>
    </AnimatedGradientBorder>
  )
}

export default SecurityDashboard
