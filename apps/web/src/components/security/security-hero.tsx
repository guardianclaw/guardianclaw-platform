'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Shield } from 'lucide-react'

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return

    const duration = 1500
    const steps = 40
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current * 10) / 10)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isInView, target])

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  )
}

const metrics = [
  { value: 97.6, suffix: '%', label: 'Safety Score' },
  { value: 256, suffix: '', label: 'AES-256-GCM', display: 'AES-256-GCM' },
  { value: 0, suffix: '', label: 'Zero-Knowledge', display: 'Zero-Knowledge' },
  { value: 4, suffix: '-Layer', label: 'Validation' },
]

export function SecurityHero() {
  return (
    <section className="container relative mx-auto mb-24 overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Background grid + glow */}
      <div className="absolute inset-0 -z-10">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="security-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#security-grid)" />
        </svg>
        <div className="bg-claw-500/10 absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-4xl pt-16 text-center lg:pt-24"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2"
        >
          <Shield className="h-4 w-4" />
          <span className="text-sm font-medium">Security</span>
        </motion.div>

        <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
          Security at GuardianClaw
        </h1>

        <p className="text-muted-foreground mx-auto mb-12 max-w-2xl text-xl">
          AI Safety and Platform Security, built from the ground up. We protect behavior, not just
          assets.
        </p>

        {/* Metrics bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="bg-background/50 rounded-xl border p-4 backdrop-blur-sm"
            >
              <div className="text-claw-500 mb-1 text-2xl font-bold sm:text-3xl">
                {metric.display ? (
                  metric.display
                ) : (
                  <AnimatedCounter target={metric.value} suffix={metric.suffix} />
                )}
              </div>
              <div className="text-muted-foreground text-xs sm:text-sm">{metric.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  )
}
