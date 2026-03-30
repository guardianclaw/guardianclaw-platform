'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Clock, Search, Code, Globe, Award } from 'lucide-react'

const steps = [
  {
    icon: Mail,
    title: 'Report',
    color: 'bg-blue-500',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    summary: 'Email contact@guardianclaw.org',
    details:
      'Send a detailed report to contact@guardianclaw.org. Include steps to reproduce, impact assessment, and any proof-of-concept code. Use our PGP key for sensitive reports.',
  },
  {
    icon: Clock,
    title: 'Acknowledgment',
    color: 'bg-green-500',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-500/10',
    summary: 'Within 48 hours',
    details:
      "We acknowledge receipt within 48 hours with a tracking ID. You'll receive a dedicated contact for ongoing communication about the issue.",
  },
  {
    icon: Search,
    title: 'Assessment & Triage',
    color: 'bg-yellow-500',
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    summary: 'CVSS classification',
    details:
      "Our security team assesses the vulnerability using CVSS v3.1 scoring. We determine severity, affected components, and potential impact. You'll be notified of the severity classification.",
  },
  {
    icon: Code,
    title: 'Fix Development',
    color: 'bg-orange-500',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    summary: '90-day disclosure window',
    details:
      'We develop and test a fix within a 90-day disclosure window. For critical issues, we aim for faster resolution. We may reach out for clarification during this phase.',
  },
  {
    icon: Globe,
    title: 'Coordinated Disclosure',
    color: 'bg-purple-500',
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    summary: 'Public advisory',
    details:
      'Once the fix is released, we publish a security advisory with technical details. We coordinate disclosure timing with the reporter to ensure users have time to update.',
  },
  {
    icon: Award,
    title: 'Credit',
    color: 'bg-claw-500',
    iconColor: 'text-claw-500',
    bgColor: 'bg-claw-500/10',
    summary: 'Advisory + acknowledgment',
    details:
      "Researchers are credited in our security advisory (unless they prefer anonymity). We maintain a Hall of Fame for significant contributions to GuardianClaw's security.",
  },
]

export function DisclosureTimeline() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  return (
    <div className="mx-auto max-w-3xl">
      {/* Desktop: vertical timeline */}
      <div className="relative hidden md:block">
        {/* Connector line */}
        <div className="bg-border absolute bottom-8 left-[23px] top-8 w-[2px]" />

        <div className="space-y-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group relative flex cursor-pointer gap-6"
              onClick={() => setExpandedStep(expandedStep === i ? null : i)}
            >
              {/* Icon circle */}
              <div
                className={`relative z-10 h-12 w-12 flex-shrink-0 rounded-full ${step.bgColor} ring-background flex items-center justify-center ring-4`}
              >
                <step.icon className={`h-5 w-5 ${step.iconColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-baseline gap-3">
                  <h4 className="group-hover:text-claw-500 font-semibold transition-colors">
                    {step.title}
                  </h4>
                  <span className="text-muted-foreground text-sm">{step.summary}</span>
                </div>
                <AnimatePresence>
                  {expandedStep === i && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-muted-foreground mt-2 text-sm"
                    >
                      {step.details}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="space-y-4 md:hidden">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="bg-background cursor-pointer rounded-xl border p-4"
            onClick={() => setExpandedStep(expandedStep === i ? null : i)}
          >
            <div className="mb-1 flex items-center gap-3">
              <div className={`rounded-lg p-2 ${step.bgColor}`}>
                <step.icon className={`h-4 w-4 ${step.iconColor}`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold">{step.title}</h4>
                <span className="text-muted-foreground text-xs">{step.summary}</span>
              </div>
            </div>
            <AnimatePresence>
              {expandedStep === i && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-muted-foreground mt-3 pl-11 text-sm"
                >
                  {step.details}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
