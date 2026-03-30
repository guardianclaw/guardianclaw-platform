'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen, ArrowRight, Vote, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParticipationSteps } from '@/components/governance-docs'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const faq = [
  {
    question: 'What is $GCLAW?',
    answer:
      'The governance token for the GuardianClaw protocol, built on Solana as an SPL token. Total supply is 1 billion tokens. Holding $GCLAW gives you voting power in the DAO and access to holder benefits.',
  },
  {
    question: 'How many tokens do I need to vote?',
    answer:
      'You need at least 1,000,000 $GCLAW (1M tokens = 1 vote) to vote on proposals. To create a new proposal, you need 10,000,000 tokens (10M = 10 votes minimum).',
  },
  {
    question: 'What is a SIP?',
    answer:
      'A GuardianClaw Improvement Proposal (SIP) is the formal mechanism for making changes to the protocol. There are 6 types: SIP-FEATURE, SIP-GOV, SIP-SEED, SIP-DOCS, SIP-PARTNER, and SIP-META, each with specific quorum and majority requirements.',
  },
  {
    question: 'Can I delegate my vote?',
    answer:
      'Vote delegation is planned as a future feature. Currently, you must vote directly using your connected wallet. Follow governance updates for announcements on delegation support.',
  },
  {
    question: 'How are votes counted?',
    answer:
      'Votes are token-weighted: 1M tokens = 1 vote. Your voting power equals the $GCLAW balance in your connected wallet at the time of voting. Votes are recorded on-chain for transparency.',
  },
  {
    question: 'What happens after a proposal passes?',
    answer:
      'Passed proposals move to the Execution stage. The GuardianClaw Team implements the changes as specified in the SIP. Progress is tracked publicly and the community can verify completion.',
  },
]

const glossary = [
  {
    term: 'SIP',
    definition: 'GuardianClaw Improvement Proposal — the formal governance mechanism',
  },
  {
    term: 'CLAW',
    definition: 'Credibility-Limits-Avoidance-Worth — the 4-gate validation protocol',
  },
  { term: 'Quorum', definition: 'Minimum participation required for a vote to be valid' },
  { term: 'Supermajority', definition: 'A threshold higher than simple majority (typically 66%)' },
  { term: 'Seed', definition: 'A prompt that modifies LLM behavior for safety alignment' },
  { term: 'Gate', definition: 'A logical checkpoint in the CLAW validation flow' },
  { term: 'Layer', definition: 'One of the 4 validation stages (L1 Input through L4 Observer)' },
  { term: 'Observer', definition: 'An LLM that analyzes transcripts for safety violations' },
  {
    term: 'DAO',
    definition: 'Decentralized Autonomous Organization — community governance structure',
  },
  {
    term: 'Token-weighted',
    definition: 'Voting power proportional to token holdings (1M tokens = 1 vote)',
  },
]

export default function GuidePage() {
  return (
    <div className="py-16 lg:py-24">
      {/* Hero */}
      <section className="container mx-auto mb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm font-medium">Getting Started</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Participation <span className="text-claw-500">Guide</span>
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Everything you need to start participating in GuardianClaw governance.
          </p>
        </motion.div>
      </section>

      {/* Step-by-Step */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Step by Step</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              From wallet setup to your first vote — follow these steps to get started.
            </p>
          </motion.div>

          <div className="mx-auto max-w-2xl">
            <ParticipationSteps />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Frequently Asked Questions</h2>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2"
          >
            {faq.map((item) => (
              <motion.div
                key={item.question}
                variants={itemVariants}
                className="bg-background rounded-2xl border p-6"
              >
                <h4 className="mb-2 font-semibold">{item.question}</h4>
                <p className="text-muted-foreground text-sm">{item.answer}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Glossary */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Glossary</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Key terms used throughout the governance documentation.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2"
          >
            {glossary.map((item) => (
              <motion.div
                key={item.term}
                variants={itemVariants}
                className="bg-background rounded-xl border p-4"
              >
                <span className="text-claw-500 text-sm font-semibold">{item.term}</span>
                <p className="text-muted-foreground mt-1 text-sm">{item.definition}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Start Participating</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Connect your wallet and join the community shaping AI safety.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/holder">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Your Wallet
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/app/governance">
                  <Vote className="mr-2 h-4 w-4" />
                  Go to Governance App
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/governance">
                  Back to Governance <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
