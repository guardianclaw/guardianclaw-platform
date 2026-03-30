'use client'

import { useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Award, Shield, FileCheck, ChevronDown } from 'lucide-react'

interface Certification {
  title: string
  status: 'In Progress' | 'Planned' | 'Completed' | 'Not Started'
  statusColor: string
  progress: number
  icon: typeof Award
  iconColor: string
  eta: string
  description: string
  checklist: { label: string; done: boolean }[]
}

const certifications: Certification[] = [
  {
    title: 'Open Source Codebase',
    status: 'Completed',
    statusColor: 'bg-green-500/10 text-green-600 dark:text-green-400',
    progress: 100,
    icon: FileCheck,
    iconColor: 'text-green-500',
    eta: 'Available now',
    description: 'All security-critical code is MIT licensed and publicly auditable on GitHub.',
    checklist: [
      { label: 'Source code published', done: true },
      { label: 'MIT license applied', done: true },
      { label: 'Public issue tracker', done: true },
      { label: 'Dependency transparency', done: true },
      { label: 'Reproducible builds', done: true },
    ],
  },
  {
    title: 'EU AI Act Alignment',
    status: 'Completed',
    statusColor: 'bg-green-500/10 text-green-600 dark:text-green-400',
    progress: 100,
    icon: Shield,
    iconColor: 'text-green-500',
    eta: 'Available now',
    description: 'Full coverage of Article 5 prohibited practices through the CLAW protocol.',
    checklist: [
      { label: 'Article 5 mapping complete', done: true },
      { label: 'CLAW gates aligned', done: true },
      { label: 'Subliminal technique detection', done: true },
      { label: 'Vulnerability exploitation prevention', done: true },
      { label: 'Social scoring prevention', done: true },
    ],
  },
  {
    title: 'Formal Certifications',
    status: 'In Progress',
    statusColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    progress: 30,
    icon: Award,
    iconColor: 'text-yellow-500',
    eta: '2026',
    description:
      'Security documentation and internal procedures established. Formal certifications and external audits in progress.',
    checklist: [
      { label: 'Security documentation published', done: true },
      { label: 'Vulnerability disclosure policy', done: true },
      { label: 'Compliance framework mapping', done: true },
      { label: 'SOC 2 Type II', done: false },
      { label: 'ISO 27001', done: false },
      { label: 'External penetration test', done: false },
      { label: 'Third-party code audit', done: false },
      { label: 'Bug bounty program', done: false },
    ],
  },
]

function ProgressCircle({ progress, color }: { progress: number; color: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const isInView = useInView(ref, { once: true })
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg ref={ref} width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
      <circle
        cx="44"
        cy="44"
        r="36"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-muted/50"
      />
      <motion.circle
        cx="44"
        cy="44"
        r="36"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={isInView ? { strokeDashoffset: offset } : {}}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        transform="rotate(-90 44 44)"
      />
      <text
        x="44"
        y="44"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-sm font-bold"
      >
        {progress}%
      </text>
    </svg>
  )
}

const progressColors: Record<string, string> = {
  'text-green-500': '#22c55e',
  'text-muted-foreground': '#71717a',
  'text-yellow-500': '#eab308',
  'text-blue-500': '#3b82f6',
  'text-purple-500': '#a855f7',
}

export function TrustDashboard() {
  const [expandedCard, setExpandedCard] = useState<number | null>(null)

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {certifications.map((cert, i) => (
        <motion.div
          key={cert.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className="bg-background hover:border-claw-500/30 rounded-2xl border p-6 transition-all"
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cert.statusColor}`}
              >
                {cert.status}
              </span>
              <h3 className="mt-2 text-lg font-bold">{cert.title}</h3>
            </div>
            <ProgressCircle
              progress={cert.progress}
              color={progressColors[cert.iconColor] || '#22c55e'}
            />
          </div>

          <p className="text-muted-foreground mb-3 text-sm">{cert.description}</p>
          <p className="text-muted-foreground text-xs">Expected: {cert.eta}</p>

          {/* Expandable checklist */}
          <button
            onClick={() => setExpandedCard(expandedCard === i ? null : i)}
            className="text-muted-foreground hover:text-foreground mt-4 flex items-center gap-1 text-xs transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expandedCard === i ? 'rotate-180' : ''}`}
            />
            {expandedCard === i ? 'Hide' : 'Show'} checklist
          </button>

          {expandedCard === i && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 space-y-2"
            >
              {cert.checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${item.done ? 'bg-claw-500 border-claw-500' : 'border-muted-foreground/30'}`}
                  >
                    {item.done && (
                      <svg
                        className="h-2.5 w-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
