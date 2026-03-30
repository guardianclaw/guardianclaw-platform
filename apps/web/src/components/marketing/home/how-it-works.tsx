'use client'

import { motion } from 'framer-motion'
import { Wand2, Shield, Rocket, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const steps = [
  {
    number: '01',
    title: 'Build',
    description:
      'Create AI agents with our visual builder or integrate GuardianClaw into your existing codebase with a few lines of code.',
    icon: Wand2,
    color: 'blue',
    features: [
      'Visual drag-and-drop builder',
      'Python & JavaScript SDKs',
      '17 framework integrations',
    ],
  },
  {
    number: '02',
    title: 'Protect',
    description:
      'The CLAW protocol validates every input and output through four gates: Credibility, Avoidance, Limits, and Worth.',
    icon: Shield,
    color: 'claw',
    features: ['4-gate CLAW validation', 'Real-time threat detection', '97.6% safety score'],
  },
  {
    number: '03',
    title: 'Deploy',
    description:
      'Ship with confidence. Monitor safety metrics, get alerts, and maintain compliance with our dashboard.',
    icon: Rocket,
    color: 'purple',
    features: ['One-click deployment', 'Real-time monitoring', 'Compliance reporting'],
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
}

export function HowItWorks() {
  return (
    <section className="bg-muted/30 py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How It Works</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Three simple steps to build and deploy AI agents with enterprise-grade safety.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-8 lg:grid-cols-3 lg:gap-4"
        >
          {steps.map((step, index) => {
            const Icon = step.icon
            const colorClasses = getColorClasses(step.color)

            return (
              <motion.div key={step.title} variants={itemVariants} className="relative">
                {/* Connector line (desktop) */}
                {index < steps.length - 1 && (
                  <div className="from-border absolute left-full top-16 z-0 hidden h-px w-full bg-gradient-to-r to-transparent lg:block" />
                )}

                <div className="bg-background relative h-full rounded-2xl border p-8">
                  {/* Step number */}
                  <div className="absolute -top-3 left-8">
                    <span
                      className={cn(
                        'inline-block rounded-full px-3 py-1 text-xs font-bold',
                        colorClasses.bg,
                        colorClasses.text
                      )}
                    >
                      {step.number}
                    </span>
                  </div>

                  {/* Icon */}
                  <div
                    className={cn(
                      'mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl',
                      colorClasses.bg
                    )}
                  >
                    <Icon className={cn('h-7 w-7', colorClasses.text)} />
                  </div>

                  {/* Content */}
                  <h3 className="mb-3 text-2xl font-bold">{step.title}</h3>
                  <p className="text-muted-foreground mb-6">{step.description}</p>

                  {/* Features */}
                  <ul className="space-y-2">
                    {step.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <div className={cn('h-1.5 w-1.5 rounded-full', colorClasses.dot)} />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Arrow to next (mobile) */}
                  {index < steps.length - 1 && (
                    <div className="mt-6 flex justify-center lg:hidden">
                      <ArrowRight className="text-muted-foreground h-5 w-5 rotate-90" />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Code Preview (optional visual) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="overflow-hidden rounded-xl border bg-gray-950">
            {/* Terminal header */}
            <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="ml-2 text-xs text-gray-400">quick_start.py</span>
            </div>

            {/* Code content */}
            <div className="p-6 font-mono text-sm">
              <div className="text-gray-400"># Add safety to any agent in 3 lines</div>
              <div className="mt-2">
                <span className="text-purple-400">from</span>
                <span className="text-gray-300"> guardianclaw </span>
                <span className="text-purple-400">import</span>
                <span className="text-gray-300"> GuardianClaw</span>
              </div>
              <div className="mt-4">
                <span className="text-gray-300">claw = </span>
                <span className="text-yellow-400">GuardianClaw</span>
                <span className="text-gray-300">()</span>
              </div>
              <div className="mt-2">
                <span className="text-gray-300">safe_agent = claw.</span>
                <span className="text-blue-400">protect</span>
                <span className="text-gray-300">(my_agent)</span>
              </div>
              <div className="mt-4 text-gray-400"># That's it. Your agent is now protected.</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function getColorClasses(color: string) {
  const classes: Record<string, { bg: string; text: string; dot: string }> = {
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      dot: 'bg-blue-500',
    },
    claw: {
      bg: 'bg-claw-500/10',
      text: 'text-claw-500',
      dot: 'bg-claw-500',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      dot: 'bg-purple-500',
    },
  }
  return classes[color] || classes.claw
}
