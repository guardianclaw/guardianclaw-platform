'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HeroSection() {
  return (
    <section className="from-background via-background to-muted/30 relative overflow-hidden bg-gradient-to-b">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23888888' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Radial gradient overlay */}
        <div className="bg-claw-500/10 absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-claw-500/10 border-claw-500/20 text-claw-600 dark:text-claw-400 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
            >
              <span className="relative flex h-2 w-2">
                <span className="bg-claw-500 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-claw-500 relative inline-flex h-2 w-2 rounded-full" />
              </span>
              Now with CLAW Protocol v2
            </motion.div>

            {/* Headline */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-foreground">Build, Deploy, and </span>
              <span className="text-claw-500">Protect</span>
              <span className="text-foreground"> AI Agents</span>
            </h1>

            {/* Subheadline */}
            <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-lg sm:text-xl lg:mx-0">
              The Decision Firewall for AI. Validate every input and output with the CLAW protocol.
              Stop jailbreaks, prevent harmful actions, ensure compliance.
            </p>

            {/* CTAs */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
              <Button size="lg" className="group w-full sm:w-auto" asChild>
                <Link href="/app/agents">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/docs">View Docs</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/whitepaper">Whitepaper</Link>
              </Button>
            </div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-muted-foreground mt-12 flex items-center justify-center gap-8 text-sm lg:justify-start"
            >
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span>Open Source</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">97.6%</span>
                <span>Safety Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">17</span>
                <span>Integrations</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Shield Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <div className="relative h-72 w-72 sm:h-80 sm:w-80 lg:h-96 lg:w-96">
              {/* Outer ring - slow rotation */}
              <motion.div
                className="border-claw-500/20 absolute inset-0 rounded-full border-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              >
                <div className="bg-claw-500 absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" />
              </motion.div>

              {/* Middle ring - counter rotation */}
              <motion.div
                className="border-claw-500/30 absolute inset-8 rounded-full border"
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <div className="bg-claw-400 absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full" />
              </motion.div>

              {/* Inner glow */}
              <div className="bg-claw-500/10 absolute inset-16 rounded-full blur-xl" />

              {/* Center shield */}
              <motion.div
                className="absolute inset-20 flex items-center justify-center"
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <div className="relative">
                  <Shield
                    className="text-claw-500 h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32"
                    strokeWidth={1.5}
                  />

                  {/* Shield glow effect */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Shield
                      className="text-claw-500 h-24 w-24 blur-sm sm:h-28 sm:w-28 lg:h-32 lg:w-32"
                      strokeWidth={1.5}
                    />
                  </motion.div>
                </div>
              </motion.div>

              {/* Floating particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="bg-claw-500/60 absolute h-2 w-2 rounded-full"
                  style={{
                    top: `${20 + Math.random() * 60}%`,
                    left: `${20 + Math.random() * 60}%`,
                  }}
                  animate={{
                    y: [0, -10, 0],
                    opacity: [0.3, 0.8, 0.3],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                />
              ))}

              {/* CLAW Labels */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <motion.span
                  className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  Credibility
                </motion.span>
              </div>
              <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                <motion.span
                  className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-500"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0 }}
                >
                  Avoidance
                </motion.span>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <motion.span
                  className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  Limits
                </motion.span>
              </div>
              <div className="absolute -left-2 top-1/2 -translate-y-1/2">
                <motion.span
                  className="bg-claw-500/10 text-claw-500 rounded-full px-3 py-1 text-xs font-medium"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 }}
                >
                  Worth
                </motion.span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
