'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Wallet,
  Coins,
  Link2,
  CheckCircle2,
  Vote,
  PenSquare,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Get a Solana Wallet',
    description:
      'Download Phantom, Solflare, or any Solana-compatible wallet to manage your tokens and interact with governance.',
    icon: Wallet,
    link: { label: 'Get Phantom', href: 'https://phantom.app', external: true },
  },
  {
    number: 2,
    title: 'Acquire $GCLAW',
    description:
      'Purchase $GCLAW tokens on Jupiter Exchange or PumpFun. These tokens represent your voting power in the DAO.',
    icon: Coins,
    link: {
      label: 'Buy on Jupiter',
      href: 'https://jup.ag/swap/SOL-GCLAW',
      external: true,
    },
  },
  {
    number: 3,
    title: 'Connect Your Wallet',
    description:
      'Visit the Holder Area and connect your wallet to verify your token balance and unlock governance features.',
    icon: Link2,
    link: { label: 'Go to Holder Area', href: '/holder', external: false },
  },
  {
    number: 4,
    title: 'Check Eligibility',
    description:
      'You need at least 1,000,000 $GCLAW to vote (1M = 1 vote), and 10,000,000 to create new proposals.',
    icon: CheckCircle2,
    link: { label: 'Check Balance', href: '/holder', external: false },
  },
  {
    number: 5,
    title: 'Browse & Vote',
    description:
      'Explore active proposals in the Governance App. Read discussions, review details, and cast your vote.',
    icon: Vote,
    link: { label: 'View Proposals', href: '/app/governance', external: false },
  },
  {
    number: 6,
    title: 'Create a Proposal',
    description:
      'Have an idea? Write a GuardianClaw Improvement Proposal (SIP) and submit it for community review and voting.',
    icon: PenSquare,
    link: { label: 'Create SIP', href: '/app/governance/create', external: false },
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
}

export function ParticipationSteps() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="space-y-0"
    >
      {steps.map((step, index) => {
        const Icon = step.icon
        const isLast = index === steps.length - 1

        return (
          <motion.div
            key={step.number}
            variants={itemVariants}
            className="relative flex gap-4 sm:gap-6"
          >
            {/* Vertical connector */}
            <div className="flex flex-col items-center">
              <div className="bg-claw-500/10 border-claw-500/30 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2">
                <span className="text-claw-500 text-sm font-bold">{step.number}</span>
              </div>
              {!isLast && <div className="bg-border my-2 w-px flex-1" />}
            </div>

            {/* Content */}
            <div className={`pb-8 ${isLast ? 'pb-0' : ''} min-w-0 flex-1`}>
              <div className="bg-background hover:border-claw-500/30 rounded-xl border p-4 transition-all">
                <div className="flex items-start gap-3">
                  <Icon className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="mb-1 font-semibold">{step.title}</h4>
                    <p className="text-muted-foreground mb-3 text-sm">{step.description}</p>
                    {step.link.external ? (
                      <a
                        href={step.link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-claw-500 hover:text-claw-400 inline-flex items-center gap-1 text-sm transition-colors"
                      >
                        {step.link.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        href={step.link.href}
                        className="text-claw-500 hover:text-claw-400 inline-flex items-center gap-1 text-sm transition-colors"
                      >
                        {step.link.label}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
