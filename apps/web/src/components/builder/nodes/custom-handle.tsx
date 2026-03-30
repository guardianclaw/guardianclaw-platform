'use client'

import { Handle, HandleProps, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'

export type HandleCategory =
  | 'input'
  | 'claw'
  | 'process'
  | 'flow'
  | 'memory'
  | 'tool'
  | 'utility'
  | 'output'

// Category color map — idle and connected states
const categoryColors: Record<
  HandleCategory,
  { idle: string; border: string; connected: string; connectedBorder: string }
> = {
  input: {
    idle: '!bg-emerald-500',
    border: '!border-emerald-600',
    connected: '!bg-emerald-400',
    connectedBorder: '!border-emerald-500',
  },
  claw: {
    idle: '!bg-amber-500',
    border: '!border-amber-600',
    connected: '!bg-amber-400',
    connectedBorder: '!border-amber-500',
  },
  process: {
    idle: '!bg-blue-500',
    border: '!border-blue-600',
    connected: '!bg-blue-400',
    connectedBorder: '!border-blue-500',
  },
  flow: {
    idle: '!bg-purple-500',
    border: '!border-purple-600',
    connected: '!bg-purple-400',
    connectedBorder: '!border-purple-500',
  },
  memory: {
    idle: '!bg-cyan-500',
    border: '!border-cyan-600',
    connected: '!bg-cyan-400',
    connectedBorder: '!border-cyan-500',
  },
  tool: {
    idle: '!bg-orange-500',
    border: '!border-orange-600',
    connected: '!bg-orange-400',
    connectedBorder: '!border-orange-500',
  },
  utility: {
    idle: '!bg-zinc-400',
    border: '!border-zinc-500',
    connected: '!bg-zinc-300',
    connectedBorder: '!border-zinc-400',
  },
  output: {
    idle: '!bg-rose-500',
    border: '!border-rose-600',
    connected: '!bg-rose-400',
    connectedBorder: '!border-rose-500',
  },
}

interface CustomHandleProps extends Omit<HandleProps, 'position'> {
  position: Position
  label?: string
  color?: string
  isConnected?: boolean
  category?: HandleCategory
}

export function CustomHandle({
  position,
  type,
  label,
  color = 'bg-zinc-400',
  isConnected = false,
  category,
  className,
  ...props
}: CustomHandleProps) {
  const isSource = type === 'source'
  const catColors = category ? categoryColors[category] : null

  return (
    <Handle
      type={type}
      position={position}
      className={cn(
        '!h-3 !w-3 !rounded-full !border-2 !border-zinc-700 transition-all duration-200',
        // Category-colored or default gray
        catColors ? catColors.idle : '!bg-zinc-600',
        catColors && catColors.border,
        'hover:scale-125',
        // Connected state
        isConnected &&
          (catColors
            ? cn(catColors.connected, catColors.connectedBorder)
            : '!border-emerald-600 !bg-emerald-500'),
        // Hover fallback (only when no category)
        !catColors && isSource && 'hover:!border-blue-600 hover:!bg-blue-500',
        !catColors && !isSource && 'hover:!border-emerald-600 hover:!bg-emerald-500',
        className
      )}
      {...props}
    />
  )
}

// Preset handles for common positions
export function SourceHandle({
  label,
  position = Position.Right,
  category,
  ...props
}: Omit<CustomHandleProps, 'type'>) {
  return (
    <CustomHandle type="source" position={position} label={label} category={category} {...props} />
  )
}

export function TargetHandle({
  label,
  position = Position.Left,
  category,
  ...props
}: Omit<CustomHandleProps, 'type'>) {
  return (
    <CustomHandle type="target" position={position} label={label} category={category} {...props} />
  )
}
