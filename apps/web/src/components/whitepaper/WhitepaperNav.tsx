/**
 * WhitepaperNav - Sticky table of contents navigation
 *
 * Displays a navigable list of whitepaper sections with scroll spy
 * highlighting. Supports nested sections with visual hierarchy.
 */

'use client'

import { motion } from 'framer-motion'
import { ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WhitepaperNavProps, WhitepaperNavItem } from './types'

/**
 * Single navigation item component
 */
function NavItem({
  item,
  isActive,
  onClick,
}: {
  item: WhitepaperNavItem
  isActive: boolean
  onClick: () => void
}) {
  const Icon = item.icon || FileText
  const isSubsection = item.level === 2

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-all duration-200',
        'hover:bg-zinc-800/50',
        isSubsection && 'ml-4 text-sm',
        isActive ? 'text-claw-500 bg-claw-500/10' : 'text-zinc-400 hover:text-zinc-200'
      )}
      aria-current={isActive ? 'location' : undefined}
    >
      {/* Active indicator line */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="bg-claw-500 absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full"
          initial={false}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      )}

      {/* Icon */}
      {!isSubsection && (
        <Icon
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors',
            isActive ? 'text-claw-500' : 'text-zinc-500 group-hover:text-zinc-400'
          )}
        />
      )}

      {/* Subsection bullet */}
      {isSubsection && (
        <ChevronRight
          className={cn(
            'h-3 w-3 flex-shrink-0 transition-colors',
            isActive ? 'text-claw-500' : 'text-zinc-600'
          )}
        />
      )}

      {/* Title */}
      <span className="truncate">{item.title}</span>
    </button>
  )
}

/**
 * WhitepaperNav - Table of contents navigation
 *
 * @example
 * ```tsx
 * <WhitepaperNav
 *   items={navItems}
 *   activeId={activeSection}
 *   onNavigate={scrollTo}
 * />
 * ```
 */
export function WhitepaperNav({ items, activeId, onNavigate, className }: WhitepaperNavProps) {
  return (
    <nav className={cn('space-y-1', className)} aria-label="Table of contents">
      {/* Header */}
      <div className="mb-2 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contents</h2>
      </div>

      {/* Navigation items */}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeId === item.id}
            onClick={() => onNavigate?.(item.id)}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="mt-4 border-t border-zinc-800 pt-4">
        <div className="space-y-2 px-3">
          {/* Download PDF link */}
          <a
            href="https://github.com/guardianclaw/guardianclaw-platform/raw/main/docs/whitepaper/WHITEPAPER_v2.0_EN.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300',
              'py-2'
            )}
          >
            <FileText className="h-4 w-4" />
            <span>Download PDF</span>
          </a>

          {/* Progress indicator */}
          <div className="text-xs text-zinc-600">
            {items.findIndex((item) => item.id === activeId) + 1} of {items.length} sections
          </div>
        </div>
      </div>
    </nav>
  )
}

export default WhitepaperNav
