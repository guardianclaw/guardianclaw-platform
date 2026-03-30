/**
 * WhitepaperHeader - Hero section for the whitepaper page
 *
 * Displays the main title, version badge, and key value proposition
 * with animated entrance effects.
 */

'use client'

import { motion } from 'framer-motion'
import { Shield, FileText, Calendar, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { WhitepaperHeaderProps } from './types'

/**
 * Animation variants
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

/**
 * WhitepaperHeader - Main header section
 *
 * @example
 * ```tsx
 * <WhitepaperHeader
 *   title="GuardianClaw Whitepaper"
 *   subtitle="The Decision Firewall for AI Agents"
 *   version="v2.0"
 *   lastUpdated="January 2026"
 * />
 * ```
 */
export function WhitepaperHeader({
  title,
  subtitle,
  version = 'v2.0',
  lastUpdated = 'January 2026',
}: WhitepaperHeaderProps) {
  return (
    <motion.header
      className="relative mb-12 overflow-hidden py-12 lg:py-16"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-claw-500/5 absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <div className="relative">
        {/* Badge row */}
        <motion.div className="mb-6 flex flex-wrap items-center gap-3" variants={itemVariants}>
          {/* Version badge */}
          <div className="bg-claw-500/10 text-claw-500 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
            <FileText className="h-4 w-4" />
            <span>Technical Whitepaper</span>
            <span className="bg-claw-500/20 rounded-full px-2 py-0.5 text-xs">{version}</span>
          </div>

          {/* Date badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400">
            <Calendar className="h-4 w-4" />
            <span>{lastUpdated}</span>
          </div>
        </motion.div>

        {/* Main title */}
        <motion.h1
          className="mb-4 text-4xl font-bold sm:text-5xl lg:text-6xl"
          variants={itemVariants}
        >
          <span className="text-claw-500">GCLAW</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p className="mb-2 text-xl text-zinc-300 sm:text-2xl" variants={itemVariants}>
          {subtitle || 'The Decision Firewall for AI Agents'}
        </motion.p>

        {/* Tagline */}
        <motion.p className="mb-8 max-w-2xl text-lg text-zinc-500" variants={itemVariants}>
          A comprehensive security framework that validates AI decisions before they become actions.
          Protecting the behavioral layer of autonomous systems.
        </motion.p>

        {/* Key metrics */}
        <motion.div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4" variants={itemVariants}>
          {[
            { value: '97.6%', label: 'Safety Rate' },
            { value: '17', label: 'Integrations' },
            { value: '4-Layer', label: 'Architecture' },
            { value: 'CLAW', label: 'Protocol' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-claw-500 text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA buttons */}
        <motion.div className="flex flex-wrap gap-3" variants={itemVariants}>
          <Button size="lg" className="bg-claw-500 hover:bg-claw-600">
            <Shield className="mr-2 h-4 w-4" />
            Start Building
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href="https://github.com/guardianclaw/guardianclaw-platform"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </motion.div>
      </div>

      {/* Decorative bottom border */}
      <motion.div
        className="via-claw-500/30 absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      />
    </motion.header>
  )
}

export default WhitepaperHeader
