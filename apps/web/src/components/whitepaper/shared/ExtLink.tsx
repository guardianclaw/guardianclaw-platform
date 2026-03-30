/**
 * ExtLink Component
 *
 * A styled external link component with optional icon indicator.
 * Opens in new tab with proper security attributes.
 */

'use client'

import { memo } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtLinkProps } from './types'

/**
 * ExtLink - Styled external link for whitepaper
 *
 * @example
 * ```tsx
 * <ExtLink href="https://github.com/guardianclaw/guardianclaw-platform">
 *   GitHub Repository
 * </ExtLink>
 * ```
 */
export const ExtLink = memo(function ExtLink({
  href,
  children,
  showIcon = true,
  className,
}: ExtLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1',
        'text-claw-400 hover:text-claw-300',
        'transition-colors duration-150',
        'underline-offset-2 hover:underline',
        className
      )}
    >
      {children}
      {showIcon && <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
      <span className="sr-only">(opens in new tab)</span>
    </a>
  )
})

ExtLink.displayName = 'ExtLink'

export default ExtLink
