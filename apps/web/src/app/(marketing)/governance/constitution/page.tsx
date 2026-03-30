'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ScrollText, ArrowRight, Info, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConstitutionArticles } from '@/components/governance-docs'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function ConstitutionPage() {
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
            <ScrollText className="h-4 w-4" />
            <span className="text-sm font-medium">Constitution</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            The GuardianClaw <span className="text-claw-500">Constitution</span>
          </h1>

          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Binding governance principles for the GuardianClaw protocol. These articles define how
            decisions are made and what values guide the community.
          </p>
        </motion.div>
      </section>

      {/* Preamble */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl"
          >
            <h2 className="mb-6 text-center text-3xl font-bold sm:text-4xl">Preamble</h2>
            <div className="text-muted-foreground space-y-4">
              <p>
                The GuardianClaw protocol exists to protect AI agent behavior through the CLAW
                (Credibility-Limits-Avoidance-Worth) validation framework. As a community-governed
                protocol, we recognize that safety decisions must be made collectively,
                transparently, and with the highest standards of integrity.
              </p>
              <p>
                This constitution establishes the foundational principles that all governance
                participants agree to uphold. It defines boundaries that no proposal may cross,
                ensures transparency in all operations, and creates a framework for evolving the
                protocol responsibly.
              </p>
            </div>

            <div className="bg-claw-500/10 border-claw-500/20 mt-8 flex items-start gap-3 rounded-xl border p-4">
              <Info className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                This is a living document. Constitutional amendments require a SIP-GOV proposal with
                10% quorum and 66% supermajority approval, plus an extended 10-day voting period.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Articles</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Six foundational articles that define the governance of the GuardianClaw protocol.
            </p>
          </motion.div>

          <div className="mx-auto max-w-3xl">
            <ConstitutionArticles />
          </div>
        </div>
      </section>

      {/* Ratification */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl"
          >
            <h2 className="mb-8 text-center text-3xl font-bold sm:text-4xl">Ratification</h2>

            <div className="bg-background rounded-2xl border p-6">
              <div className="grid gap-6 text-center sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground mb-1 text-sm">Version</div>
                  <div className="font-semibold">1.0</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 text-sm">Status</div>
                  <div className="text-claw-500 font-semibold">Active</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 text-sm">On-Chain Hash</div>
                  <div className="text-muted-foreground font-mono text-xs">
                    Pending SIP ratification
                  </div>
                </div>
              </div>
            </div>
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
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Questions?</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Reach out to the GuardianClaw Team or discuss in the governance forum.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Us
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
