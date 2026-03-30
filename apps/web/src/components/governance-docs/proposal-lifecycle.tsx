'use client'

import { motion } from 'framer-motion'
import { CircleDotDashed, MessageSquare, Clock, CheckCircle, Zap } from 'lucide-react'

const stages = [
  {
    number: 1,
    label: 'Draft',
    icon: CircleDotDashed,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/30',
    duration: 'No time limit',
    description:
      'Author writes proposal, gathers feedback, and refines the SIP before formal submission.',
  },
  {
    number: 2,
    label: 'Discussion',
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    duration: '5 days',
    description:
      'Community reviews and debates the proposal. Author can make revisions based on feedback.',
  },
  {
    number: 3,
    label: 'Voting',
    icon: Clock,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    duration: '5 days',
    description:
      'Token-weighted voting opens. Each token equals one vote. Quorum must be met for validity.',
  },
  {
    number: 4,
    label: 'Outcome',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    duration: 'Immediate',
    description:
      'Proposal passes or fails based on quorum and majority thresholds for its SIP type.',
  },
  {
    number: 5,
    label: 'Execution',
    icon: Zap,
    color: 'text-claw-500',
    bgColor: 'bg-claw-500/10',
    borderColor: 'border-claw-500/30',
    duration: 'Variable',
    description:
      'Approved proposals are implemented by the GuardianClaw Team. Progress is tracked on-chain.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function ProposalLifecycle() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {/* Desktop: horizontal timeline */}
      <div className="hidden gap-4 md:grid md:grid-cols-5">
        {stages.map((stage, index) => {
          const Icon = stage.icon
          return (
            <motion.div key={stage.label} variants={itemVariants} className="relative">
              {/* Connector line */}
              {index < stages.length - 1 && (
                <div className="bg-border absolute left-[calc(50%+24px)] right-0 top-6 z-0 h-px" />
              )}

              <div
                className={`relative z-10 rounded-2xl border p-4 ${stage.borderColor} bg-background text-center`}
              >
                <div className={`inline-flex rounded-xl p-3 ${stage.bgColor} mb-3`}>
                  <Icon className={`h-5 w-5 ${stage.color}`} />
                </div>
                <h4 className="mb-1 text-sm font-semibold">{stage.label}</h4>
                <p className="text-muted-foreground mb-2 text-xs">{stage.duration}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{stage.description}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Mobile: vertical timeline */}
      <div className="space-y-4 md:hidden">
        {stages.map((stage) => {
          const Icon = stage.icon
          return (
            <motion.div
              key={stage.label}
              variants={itemVariants}
              className={`flex items-start gap-4 rounded-2xl border p-4 ${stage.borderColor} bg-background`}
            >
              <div className={`rounded-xl p-3 ${stage.bgColor} flex-shrink-0`}>
                <Icon className={`h-5 w-5 ${stage.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-2">
                  <h4 className="text-sm font-semibold">{stage.label}</h4>
                  <span className="text-muted-foreground text-xs">{stage.duration}</span>
                </div>
                <p className="text-muted-foreground text-sm">{stage.description}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
