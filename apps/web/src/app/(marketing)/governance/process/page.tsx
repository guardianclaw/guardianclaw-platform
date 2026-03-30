'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { GitPullRequest, ArrowRight, Vote, PenSquare, AlertTriangle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProposalLifecycle, SipTypesGrid } from '@/components/governance-docs'
import { GOVERNANCE_CONFIG } from '@/lib/governance'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function ProcessPage() {
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
            <GitPullRequest className="h-4 w-4" />
            <span className="text-sm font-medium">Process</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            How Governance <span className="text-claw-500">Works</span>
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            From idea to execution — the lifecycle of a GuardianClaw Improvement Proposal (SIP).
          </p>
        </motion.div>
      </section>

      {/* Proposal Lifecycle */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Proposal Lifecycle</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Every SIP passes through five stages before becoming reality.
            </p>
          </motion.div>

          <div className="mx-auto max-w-5xl">
            <ProposalLifecycle />
          </div>
        </div>
      </section>

      {/* SIP Types */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">SIP Types</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Each proposal type has specific quorum and majority requirements based on its impact.
            </p>
          </motion.div>

          <div className="mx-auto max-w-5xl">
            <SipTypesGrid />
          </div>
        </div>
      </section>

      {/* Thresholds & Requirements */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Thresholds & Requirements</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Token-weighted governance with clear participation thresholds.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2"
          >
            <motion.div
              variants={itemVariants}
              className="bg-background rounded-2xl border p-6 text-center"
            >
              <div className="mb-4 inline-block rounded-xl bg-blue-500/10 p-4">
                <Vote className="h-8 w-8 text-blue-500" />
              </div>
              <div className="text-claw-500 mb-2 text-2xl font-bold">
                {GOVERNANCE_CONFIG.minTokensToVote.toLocaleString()}
              </div>
              <div className="mb-1 font-semibold">Minimum to Vote</div>
              <div className="text-muted-foreground text-sm">
                ~0.01% of total supply. Hold tokens in your connected wallet to participate in
                voting.
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-background rounded-2xl border p-6 text-center"
            >
              <div className="mb-4 inline-block rounded-xl bg-purple-500/10 p-4">
                <PenSquare className="h-8 w-8 text-purple-500" />
              </div>
              <div className="text-claw-500 mb-2 text-2xl font-bold">
                {GOVERNANCE_CONFIG.minTokensToPropose.toLocaleString()}
              </div>
              <div className="mb-1 font-semibold">Minimum to Propose</div>
              <div className="text-muted-foreground text-sm">
                ~0.5% of total supply. This prevents spam while keeping proposals accessible.
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Emergency Provisions */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl"
          >
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-xl bg-yellow-500/10 p-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <h3 className="mb-3 text-xl font-bold">Emergency Provisions</h3>
                  <p className="text-muted-foreground mb-4">
                    For critical security vulnerabilities that require immediate action, the core
                    team has limited emergency powers:
                  </p>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      <span>
                        Emergency patches can be deployed without prior vote for critical
                        vulnerabilities
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      <span>
                        Authority is limited in time — emergency actions must be ratified by
                        governance within 7 days
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      <span>
                        Full transparency is required — all emergency actions are documented and
                        published
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      <span>If ratification fails, the emergency action is rolled back</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready to Participate?</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Browse active proposals or create your own SIP.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/app/governance">
                  <Vote className="mr-2 h-4 w-4" />
                  Start Voting
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
