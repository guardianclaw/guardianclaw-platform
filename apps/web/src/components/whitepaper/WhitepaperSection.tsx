/**
 * WhitepaperSection - Section wrapper with anchor and animation
 *
 * Wraps whitepaper content sections with proper anchor IDs,
 * section headers, and scroll-triggered animations.
 */

'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { WhitepaperSectionProps } from './types'

/**
 * Animation variants for section entrance
 */
const sectionVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
}

/**
 * Animation variants for the divider line
 */
const dividerVariants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: 'easeOut' as const,
    },
  },
}

/**
 * WhitepaperSection - Section container with header
 *
 * @example
 * ```tsx
 * <WhitepaperSection
 *   config={{
 *     id: 'executive-summary',
 *     title: 'Executive Summary',
 *     subtitle: 'Overview of GuardianClaw',
 *     icon: Shield,
 *     order: 1
 *   }}
 * >
 *   <p>Content here...</p>
 * </WhitepaperSection>
 * ```
 */
export function WhitepaperSection({ config, children, className }: WhitepaperSectionProps) {
  const { id, title, subtitle, icon: Icon } = config

  return (
    <motion.section
      id={id}
      className={cn('scroll-mt-24', className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={sectionVariants}
    >
      {/* Section header */}
      <header className="mb-8">
        {/* Title row */}
        <div className="mb-2 flex items-center gap-3">
          {Icon && (
            <div className="bg-claw-500/10 rounded-lg p-2">
              <Icon className="text-claw-500 h-5 w-5" />
            </div>
          )}
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
        </div>

        {/* Subtitle */}
        {subtitle && <p className="ml-0 text-lg text-zinc-400 sm:ml-11">{subtitle}</p>}

        {/* Animated divider */}
        <motion.div
          className="from-claw-500/50 via-claw-500/20 mt-4 h-px origin-left bg-gradient-to-r to-transparent"
          variants={dividerVariants}
        />
      </header>

      {/* Section content */}
      <div className="prose prose-invert prose-zinc max-w-none">{children}</div>
    </motion.section>
  )
}

/**
 * WhitepaperSubsection - Nested subsection with smaller heading
 */
export function WhitepaperSubsection({
  id,
  title,
  children,
  className,
}: {
  id: string
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div id={id} className={cn('mt-8 scroll-mt-24', className)}>
      <h3 className="mb-4 text-xl font-semibold text-white">{title}</h3>
      <div className="prose prose-invert prose-zinc max-w-none">{children}</div>
    </div>
  )
}

/**
 * WhitepaperDivider - Visual separator between major sections
 */
export function WhitepaperDivider({ className }: { className?: string }) {
  return (
    <motion.hr
      className={cn(
        'my-16 h-px border-0 bg-gradient-to-r from-transparent via-zinc-700 to-transparent',
        className
      )}
      initial={{ opacity: 0, scaleX: 0.5 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    />
  )
}

export default WhitepaperSection
