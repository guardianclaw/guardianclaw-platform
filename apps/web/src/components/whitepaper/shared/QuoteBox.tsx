/**
 * QuoteBox Component
 *
 * A styled blockquote component for displaying quotes and highlighted text.
 * Supports multiple variants, attribution, and optional icons.
 */

'use client'

import { memo } from 'react'
import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { QuoteBoxProps, QuoteBoxVariant } from './types'

/**
 * Variant styles configuration
 */
const VARIANT_STYLES: Record<
  QuoteBoxVariant,
  {
    border: string
    bg: string
    text: string
    icon: string
  }
> = {
  default: {
    border: 'border-claw-500/50',
    bg: 'bg-transparent',
    text: 'text-zinc-300',
    icon: 'text-claw-500/50',
  },
  highlight: {
    border: 'border-claw-500',
    bg: 'bg-claw-500/5',
    text: 'text-zinc-200',
    icon: 'text-claw-400',
  },
  warning: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    text: 'text-zinc-300',
    icon: 'text-amber-500/50',
  },
  info: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/5',
    text: 'text-zinc-300',
    icon: 'text-blue-500/50',
  },
}

/**
 * QuoteBox - Styled blockquote for whitepaper
 *
 * @example
 * ```tsx
 * <QuoteBox
 *   attribution="Stuart Russell"
 *   variant="highlight"
 * >
 *   The absence of harm is NOT sufficient.
 * </QuoteBox>
 * ```
 */
export const QuoteBox = memo(function QuoteBox({
  children,
  attribution,
  icon: CustomIcon,
  variant = 'default',
  className,
}: QuoteBoxProps) {
  const styles = VARIANT_STYLES[variant]
  const Icon = CustomIcon || Quote

  return (
    <blockquote
      className={cn(
        'relative my-6 border-l-4 pl-4',
        styles.border,
        styles.bg,
        variant !== 'default' && 'rounded-r-xl py-4 pr-4',
        className
      )}
    >
      {/* Quote icon for highlight variant */}
      {variant === 'highlight' && (
        <Icon className={cn('absolute -left-3 -top-2 h-6 w-6', styles.icon)} aria-hidden="true" />
      )}

      {/* Quote content */}
      <div className={cn('italic', styles.text)}>{children}</div>

      {/* Attribution */}
      {attribution && (
        <footer className="mt-3 text-sm not-italic text-zinc-500">— {attribution}</footer>
      )}
    </blockquote>
  )
})

QuoteBox.displayName = 'QuoteBox'

export default QuoteBox
