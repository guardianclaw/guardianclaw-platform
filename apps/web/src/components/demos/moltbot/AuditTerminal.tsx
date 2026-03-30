'use client'

import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, ChevronDown, ChevronUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuditTerminalProps, AuditEntry, ValidationLayer } from './types'

/**
 * Get color class for entry type
 */
function getEntryTypeColor(type: AuditEntry['type']): string {
  switch (type) {
    case 'success':
      return 'text-green-400'
    case 'warning':
      return 'text-amber-400'
    case 'error':
      return 'text-red-400'
    case 'blocked':
      return 'text-red-500'
    case 'info':
    default:
      return 'text-zinc-400'
  }
}

/**
 * Get symbol for entry type
 */
function getEntryTypeSymbol(type: AuditEntry['type']): string {
  switch (type) {
    case 'success':
      return '✓'
    case 'warning':
      return '⚠'
    case 'error':
      return '✗'
    case 'blocked':
      return '⛔'
    case 'info':
    default:
      return '▸'
  }
}

/**
 * Get layer badge style
 */
function getLayerBadgeStyle(layer: ValidationLayer | 'system'): {
  bg: string
  text: string
} {
  switch (layer) {
    case 'L1':
      return { bg: 'bg-purple-500/20', text: 'text-purple-400' }
    case 'L2':
      return { bg: 'bg-blue-500/20', text: 'text-blue-400' }
    case 'L3':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400' }
    case 'L4':
      return { bg: 'bg-claw-500/20', text: 'text-claw-400' }
    case 'system':
    default:
      return { bg: 'bg-zinc-700/50', text: 'text-zinc-400' }
  }
}

/**
 * Single audit entry line
 */
function AuditEntryLine({ entry, animate = true }: { entry: AuditEntry; animate?: boolean }) {
  const typeColor = getEntryTypeColor(entry.type)
  const typeSymbol = getEntryTypeSymbol(entry.type)
  const layerStyle = getLayerBadgeStyle(entry.layer)

  return (
    <motion.div
      initial={animate ? { opacity: 0, x: -8 } : {}}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2 py-0.5 font-mono text-xs leading-relaxed"
    >
      {/* Timestamp */}
      <span className="shrink-0 text-zinc-600">[{entry.timestamp}]</span>

      {/* Layer badge */}
      <span
        className={cn(
          'shrink-0 rounded px-1 text-[10px] font-medium',
          layerStyle.bg,
          layerStyle.text
        )}
      >
        {entry.layer}
      </span>

      {/* Type symbol */}
      <span className={cn('shrink-0', typeColor)}>{typeSymbol}</span>

      {/* Message */}
      <span className={cn('flex-1', typeColor)}>
        {entry.message}
        {entry.details && <span className="ml-1 text-zinc-600">({entry.details})</span>}
      </span>
    </motion.div>
  )
}

/**
 * Terminal header with window controls
 */
function TerminalHeader({
  title,
  isExpanded,
  onToggle,
  entriesCount,
}: {
  title: string
  isExpanded: boolean
  onToggle?: () => void
  entriesCount: number
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
      <div className="flex items-center gap-3">
        {/* Window controls (decorative) */}
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/50 transition-colors hover:bg-red-500/70" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/50 transition-colors hover:bg-yellow-500/70" />
          <div className="h-3 w-3 rounded-full bg-green-500/50 transition-colors hover:bg-green-500/70" />
        </div>

        {/* Title */}
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-zinc-500" />
          <span className="font-mono text-xs text-zinc-400">{title}</span>
          {entriesCount > 0 && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              {entriesCount}
            </span>
          )}
        </div>
      </div>

      {/* Expand/collapse button */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="rounded p-1 transition-colors hover:bg-zinc-800"
          aria-label={isExpanded ? 'Collapse terminal' : 'Expand terminal'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          )}
        </button>
      )}
    </div>
  )
}

/**
 * Blinking cursor at the end of the terminal
 */
function TerminalCursor() {
  return (
    <motion.span
      className="ml-1 inline-block h-4 w-2 bg-orange-500/80"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
    />
  )
}

/**
 * AuditTerminal - Terminal-style log display component
 *
 * Displays GuardianClaw audit log entries with:
 * - Timestamps for each entry
 * - Layer badges (L1, L2, L3, L4, system)
 * - Type indicators (success, warning, error, blocked)
 * - Auto-scroll to newest entries
 * - Expand/collapse functionality
 * - Terminal-style aesthetics with window controls
 *
 * Entries appear with a subtle animation as they're added.
 */
export function AuditTerminal({
  entries,
  isExpanded = true,
  onToggleExpand,
  maxVisibleEntries = 8,
  className,
}: AuditTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Show all entries when expanded, or just the recent ones when collapsed
  const visibleEntries = isExpanded ? entries : entries.slice(-maxVisibleEntries)

  return (
    <div className={cn('overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950', className)}>
      {/* Header */}
      <TerminalHeader
        title="claw-audit"
        isExpanded={isExpanded}
        onToggle={onToggleExpand}
        entriesCount={entries.length}
      />

      {/* Content area - no scroll, content expands naturally */}
      <div ref={scrollRef} className="p-3">
        {entries.length === 0 ? (
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-600">
            <span>$ claw audit --follow</span>
            <TerminalCursor />
          </div>
        ) : (
          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {visibleEntries.map((entry) => (
                <AuditEntryLine key={entry.id} entry={entry} />
              ))}
            </AnimatePresence>

            {/* Cursor at end */}
            <div className="flex items-center gap-1 pt-1">
              <span className="font-mono text-xs text-zinc-700">$</span>
              <TerminalCursor />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * AuditTerminalCompact - Smaller version showing only recent entries
 */
export function AuditTerminalCompact({
  entries,
  maxEntries = 3,
  className,
}: {
  entries: AuditEntry[]
  maxEntries?: number
  className?: string
}) {
  const recentEntries = entries.slice(-maxEntries)

  return (
    <div className={cn('rounded-lg border border-zinc-800 bg-zinc-950 p-2', className)}>
      <div className="mb-2 flex items-center gap-2 border-b border-zinc-800 pb-2">
        <Terminal className="h-3 w-3 text-zinc-500" />
        <span className="font-mono text-[10px] text-zinc-500">audit log</span>
      </div>

      {recentEntries.length === 0 ? (
        <span className="font-mono text-[10px] text-zinc-600">No entries</span>
      ) : (
        <div className="space-y-1">
          {recentEntries.map((entry) => {
            const typeColor = getEntryTypeColor(entry.type)
            const layerStyle = getLayerBadgeStyle(entry.layer)

            return (
              <div key={entry.id} className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className={cn('rounded px-1', layerStyle.bg, layerStyle.text)}>
                  {entry.layer}
                </span>
                <span className={cn('truncate', typeColor)}>{entry.message}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AuditTerminal
