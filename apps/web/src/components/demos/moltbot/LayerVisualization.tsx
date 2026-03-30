'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Scan,
  Sparkles,
  FileSearch,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LayerVisualizationProps, LayerState, ValidationLayer, ProtectionLevel } from './types'
import { layerConfigs, protectionLevelConfig } from './types'

/**
 * Icon mapping for each layer
 */
const layerIcons: Record<ValidationLayer, React.ComponentType<{ className?: string }>> = {
  L1: Scan,
  L2: Sparkles,
  L3: FileSearch,
  L4: Eye,
}

/**
 * Color configuration for each layer
 */
const layerColors: Record<
  ValidationLayer,
  {
    bg: string
    bgActive: string
    border: string
    borderActive: string
    text: string
    glow: string
  }
> = {
  L1: {
    bg: 'bg-purple-500/10',
    bgActive: 'bg-purple-500/20',
    border: 'border-purple-500/20',
    borderActive: 'border-purple-500/50',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/30',
  },
  L2: {
    bg: 'bg-blue-500/10',
    bgActive: 'bg-blue-500/20',
    border: 'border-blue-500/20',
    borderActive: 'border-blue-500/50',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/30',
  },
  L3: {
    bg: 'bg-amber-500/10',
    bgActive: 'bg-amber-500/20',
    border: 'border-amber-500/20',
    borderActive: 'border-amber-500/50',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/30',
  },
  L4: {
    bg: 'bg-claw-500/10',
    bgActive: 'bg-claw-500/20',
    border: 'border-claw-500/20',
    borderActive: 'border-claw-500/50',
    text: 'text-claw-400',
    glow: 'shadow-claw-500/30',
  },
}

/**
 * Animated particle that flows between layers
 */
function FlowingParticle({
  from,
  to,
  color,
  delay = 0,
}: {
  from: number
  to: number
  color: string
  delay?: number
}) {
  return (
    <motion.div
      className={cn('absolute h-2 w-2 rounded-full', color)}
      initial={{
        left: `${from}%`,
        opacity: 0,
        scale: 0.5,
      }}
      animate={{
        left: `${to}%`,
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 1, 0.5],
      }}
      transition={{
        duration: 0.6,
        delay,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatDelay: 1.2,
      }}
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
      }}
    />
  )
}

/**
 * Connection line between layers with particle animation
 */
function LayerConnection({
  isActive,
  isPassed,
  isBlocked,
  fromLayer,
}: {
  isActive: boolean
  isPassed: boolean
  isBlocked: boolean
  fromLayer: ValidationLayer
}) {
  const colors = layerColors[fromLayer]

  return (
    <div className="relative flex h-8 flex-1 items-center">
      {/* Static line */}
      <div
        className={cn(
          'h-0.5 w-full rounded-full transition-colors duration-300',
          isBlocked
            ? 'bg-red-500/50'
            : isPassed
              ? 'bg-green-500/30'
              : isActive
                ? colors.borderActive.replace('border-', 'bg-')
                : 'bg-zinc-800'
        )}
      />

      {/* Animated particles when active */}
      {isActive && !isPassed && !isBlocked && (
        <div className="absolute inset-0">
          <FlowingParticle
            from={0}
            to={100}
            color={colors.text.replace('text-', 'bg-')}
            delay={0}
          />
          <FlowingParticle
            from={0}
            to={100}
            color={colors.text.replace('text-', 'bg-')}
            delay={0.3}
          />
        </div>
      )}

      {/* Block indicator */}
      {isBlocked && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <XCircle className="h-4 w-4 text-red-500" />
        </motion.div>
      )}
    </div>
  )
}

/**
 * Individual layer card
 */
function LayerCard({
  layer,
  state,
  protectionLevel,
  isCurrentLayer,
}: {
  layer: ValidationLayer
  state: LayerState
  protectionLevel: ProtectionLevel
  isCurrentLayer: boolean
}) {
  const config = layerConfigs[layer]
  const colors = layerColors[layer]
  const Icon = layerIcons[layer]

  const isActive = state.status === 'active'
  const isPassed = state.status === 'passed'
  const isBlocked = state.status === 'blocked'
  const isIdle = state.status === 'idle'

  // Determine if this layer blocks in current protection level
  const canBlock =
    protectionLevel === 'shield' ||
    (protectionLevel === 'guard' && (layer === 'L3' || layer === 'L4'))

  return (
    <motion.div
      className={cn(
        'relative flex flex-col items-center rounded-xl border-2 p-3 transition-all duration-300',
        // Base styles
        isIdle && cn(colors.bg, colors.border),
        // Active (processing)
        isActive && cn(colors.bgActive, colors.borderActive, 'shadow-lg', colors.glow),
        // Passed
        isPassed && 'border-green-500/50 bg-green-500/10',
        // Blocked
        isBlocked && 'border-red-500/50 bg-red-500/10 shadow-lg shadow-red-500/20'
      )}
      animate={
        isActive
          ? {
              scale: [1, 1.02, 1],
              boxShadow: [
                '0 0 0 0 rgba(0,0,0,0)',
                '0 0 20px 4px rgba(0,0,0,0.2)',
                '0 0 0 0 rgba(0,0,0,0)',
              ],
            }
          : {}
      }
      transition={{
        duration: 1,
        repeat: isActive ? Infinity : 0,
      }}
    >
      {/* Status indicator */}
      <div className="absolute -right-1.5 -top-1.5">
        {isActive && (
          <motion.div
            className={cn('h-3 w-3 rounded-full', colors.text.replace('text-', 'bg-'))}
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
        {isPassed && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <CheckCircle2 className="h-4 w-4 rounded-full bg-zinc-950 text-green-500" />
          </motion.div>
        )}
        {isBlocked && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <XCircle className="h-4 w-4 rounded-full bg-zinc-950 text-red-500" />
          </motion.div>
        )}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'mb-2 flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
          isIdle && colors.bg,
          isActive && colors.bgActive,
          isPassed && 'bg-green-500/20',
          isBlocked && 'bg-red-500/20'
        )}
      >
        {isActive ? (
          <Loader2 className={cn('h-5 w-5 animate-spin', colors.text)} />
        ) : (
          <Icon
            className={cn(
              'h-5 w-5',
              isIdle && colors.text,
              isPassed && 'text-green-400',
              isBlocked && 'text-red-400'
            )}
          />
        )}
      </div>

      {/* Layer ID */}
      <span
        className={cn(
          'mb-1 font-mono text-xs font-bold',
          isIdle && colors.text,
          isActive && colors.text,
          isPassed && 'text-green-400',
          isBlocked && 'text-red-400'
        )}
      >
        {layer}
      </span>

      {/* Layer name */}
      <span className="text-[10px] text-zinc-500">{config.name}</span>

      {/* Message when active/passed/blocked */}
      <AnimatePresence mode="wait">
        {(isActive || isPassed || isBlocked) && state.message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 w-full border-t border-zinc-800 pt-2"
          >
            <p
              className={cn(
                'text-center text-[10px]',
                isActive && 'text-zinc-400',
                isPassed && 'text-green-400',
                isBlocked && 'text-red-400'
              )}
            >
              {state.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Blocking indicator for current protection level */}
      {canBlock && isIdle && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
          <Shield className="h-3 w-3 text-zinc-600" />
        </div>
      )}
    </motion.div>
  )
}

/**
 * LayerVisualization - Visual representation of the 4 validation layers
 *
 * Displays:
 * - L1 (Input Validator) - Pre-AI attack detection
 * - L2 (Safety Seed) - Alignment via system prompt
 * - L3 (Output Validator) - Post-AI checking
 * - L4 (Transcript Observer) - LLM-based transcript analysis
 *
 * Features:
 * - Animated particles flowing between layers when processing
 * - Pulse effects on active layers
 * - Green/red indicators for pass/block status
 * - Responsive layout (horizontal on large screens, can be vertical on mobile)
 */
export function LayerVisualization({
  layers,
  currentLayer,
  isProcessing,
  protectionLevel,
  className,
}: LayerVisualizationProps) {
  const layerOrder: ValidationLayer[] = ['L1', 'L2', 'L3', 'L4']

  // Get state for each layer
  const getLayerState = (layer: ValidationLayer): LayerState => {
    return layers.find((l) => l.id === layer) || { id: layer, status: 'idle' }
  }

  // Determine connection states
  const getConnectionState = (fromIndex: number) => {
    const fromLayer = layerOrder[fromIndex]
    const fromState = getLayerState(fromLayer)

    const isActive = fromState.status === 'active'
    const isPassed = fromState.status === 'passed'
    const isBlocked = fromState.status === 'blocked'

    return { isActive, isPassed, isBlocked }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Main visualization */}
      <div className="flex items-center gap-2">
        {layerOrder.map((layer, index) => {
          const state = getLayerState(layer)
          const isLast = index === layerOrder.length - 1

          return (
            <div key={layer} className="flex flex-1 items-center">
              {/* Layer card */}
              <LayerCard
                layer={layer}
                state={state}
                protectionLevel={protectionLevel}
                isCurrentLayer={currentLayer === layer}
              />

              {/* Connection to next layer */}
              {!isLast && (
                <LayerConnection
                  isActive={getConnectionState(index).isActive}
                  isPassed={getConnectionState(index).isPassed}
                  isBlocked={getConnectionState(index).isBlocked}
                  fromLayer={layer}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 border-t border-zinc-800 pt-4">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <div className="h-2 w-2 rounded-full bg-zinc-700" />
          <span>Idle</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span>Processing</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span>Passed</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <XCircle className="h-3 w-3 text-red-500" />
          <span>Blocked</span>
        </div>
      </div>
    </div>
  )
}

/**
 * LayerVisualizationCompact - Minimal version for tight spaces
 */
export function LayerVisualizationCompact({
  layers,
  className,
}: {
  layers: LayerState[]
  className?: string
}) {
  const layerOrder: ValidationLayer[] = ['L1', 'L2', 'L3', 'L4']

  const getLayerState = (layer: ValidationLayer): LayerState => {
    return layers.find((l) => l.id === layer) || { id: layer, status: 'idle' }
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {layerOrder.map((layer, index) => {
        const state = getLayerState(layer)
        const colors = layerColors[layer]
        const isLast = index === layerOrder.length - 1

        return (
          <div key={layer} className="flex items-center gap-1">
            <motion.div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-bold',
                state.status === 'idle' && cn(colors.bg, colors.text),
                state.status === 'active' && cn(colors.bgActive, colors.text),
                state.status === 'passed' && 'bg-green-500/20 text-green-400',
                state.status === 'blocked' && 'bg-red-500/20 text-red-400'
              )}
              animate={state.status === 'active' ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {layer.replace('L', '')}
            </motion.div>
            {!isLast && (
              <span
                className={cn(
                  'text-[10px]',
                  state.status === 'passed' ? 'text-green-500' : 'text-zinc-700'
                )}
              >
                →
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default LayerVisualization
