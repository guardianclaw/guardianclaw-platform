'use client'

import { memo, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FlowNodeData } from '@/stores'

export interface BaseNodeProps {
  data: FlowNodeData
  selected?: boolean
  icon: ReactNode
  title: string
  subtitle?: string
  color: 'blue' | 'purple' | 'green' | 'amber' | 'red' | 'zinc' | 'orange' | 'cyan' | 'gray'
  badge?: string
  status?: 'idle' | 'running' | 'success' | 'error'
  children?: ReactNode
  handles?: ReactNode
}

const colorStyles = {
  blue: {
    bar: 'bg-blue-500',
    borderSelected: 'border-blue-500',
    glow: 'shadow-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300',
  },
  purple: {
    bar: 'bg-purple-500',
    borderSelected: 'border-purple-500',
    glow: 'shadow-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-300',
  },
  green: {
    bar: 'bg-emerald-500',
    borderSelected: 'border-emerald-500',
    glow: 'shadow-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
  amber: {
    bar: 'bg-amber-500',
    borderSelected: 'border-amber-500',
    glow: 'shadow-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  red: {
    bar: 'bg-red-500',
    borderSelected: 'border-red-500',
    glow: 'shadow-red-500/30',
    badge: 'bg-red-500/20 text-red-300',
  },
  zinc: {
    bar: 'bg-zinc-500',
    borderSelected: 'border-zinc-400',
    glow: 'shadow-zinc-500/30',
    badge: 'bg-zinc-500/20 text-zinc-300',
  },
  orange: {
    bar: 'bg-claw-600',
    borderSelected: 'border-claw-600',
    glow: 'shadow-claw-600/30',
    badge: 'bg-claw-600/20 text-claw-300',
  },
  cyan: {
    bar: 'bg-cyan-500',
    borderSelected: 'border-cyan-500',
    glow: 'shadow-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300',
  },
  gray: {
    bar: 'bg-gray-500',
    borderSelected: 'border-gray-400',
    glow: 'shadow-gray-500/30',
    badge: 'bg-gray-500/20 text-gray-300',
  },
}

const statusStyles = {
  idle: 'border-border',
  running: 'border-yellow-500/50 ring-2 ring-yellow-500/20 animate-pulse',
  success: 'border-emerald-500/50',
  error: 'border-red-500/50',
}

function BaseNodeComponent({
  icon,
  title,
  subtitle,
  color,
  badge,
  status = 'idle',
  selected,
  children,
  handles,
}: BaseNodeProps) {
  const styles = colorStyles[color]

  return (
    <div
      className={cn(
        'bg-card relative w-60 rounded-md border shadow-md',
        'transition-all duration-200',
        statusStyles[status],
        selected && `shadow-lg ${styles.glow} ring-2 ${styles.borderSelected}`
      )}
    >
      <div className="flex items-start">
        {/* Color bar */}
        <div className={cn('w-1 self-stretch rounded-l-md', styles.bar)} />

        {/* Icon */}
        <div className="p-3">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', styles.bar)}>
            <div className="text-white">{icon}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1 pr-3 pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground truncate text-sm font-semibold">{title}</h3>
            {badge && (
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', styles.badge)}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-muted-foreground mt-0.5 truncate text-xs">{subtitle}</p>}

          {/* Body content */}
          {children && (
            <div className="border-border/50 text-foreground/90 mt-2 border-t pt-2">{children}</div>
          )}
        </div>
      </div>

      {/* Handles */}
      {handles}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
