'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Vote,
  ScrollText,
  GitPullRequest,
  BookOpen,
  ArrowRight,
  Coins,
  Shield,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SipTypesGrid } from '@/components/governance-docs'
import { GOVERNANCE_RULES } from '@/lib/governance'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const quickNav = [
  {
    icon: ScrollText,
    title: 'Constitution',
    description:
      'The binding governance principles that define how the GuardianClaw protocol operates.',
    href: '/governance/constitution',
  },
  {
    icon: GitPullRequest,
    title: 'Proposal Process',
    description: 'How SIPs move from idea to execution — lifecycle, types, and voting thresholds.',
    href: '/governance/process',
  },
  {
    icon: BookOpen,
    title: 'Participation Guide',
    description:
      'Everything you need to start voting and creating proposals in the GuardianClaw DAO.',
    href: '/governance/guide',
  },
]

const corePrinciples = [
  { number: 1, title: 'Safety-First Governance', summary: 'All decisions preserve CLAW integrity' },
  { number: 2, title: 'Open & Transparent', summary: 'Open-source code, on-chain votes' },
  { number: 3, title: 'Anti-Self-Preservation', summary: 'Corrigibility over system continuity' },
  {
    number: 4,
    title: 'Community-Driven Security',
    summary: 'Collective security decisions via SIPs',
  },
  { number: 5, title: 'Treasury Worth', summary: 'Funds for research, dev, and audits only' },
  { number: 6, title: 'Amendment Process', summary: 'Supermajority required for changes' },
]

const metrics = [
  { label: '6 SIP Types', detail: 'Proposal categories' },
  { label: '100K Threshold', detail: 'Minimum to vote' },
  { label: '5-Day Periods', detail: 'Discussion & voting' },
  { label: '10% Quorum', detail: 'For governance changes' },
]

export default function GovernanceDocsPage() {
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
            <Vote className="h-4 w-4" />
            <span className="text-sm font-medium">Governance</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Governance at <span className="text-claw-500">GuardianClaw</span>
          </h1>

          <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-xl">
            Decentralized decision-making for AI agent safety. Every protocol change goes through
            community governance.
          </p>

          {/* Metrics bar */}
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="bg-background rounded-xl border p-3">
                <div className="text-claw-500 text-sm font-bold">{m.label}</div>
                <div className="text-muted-foreground text-xs">{m.detail}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Quick Nav Cards */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3"
          >
            {quickNav.map((item) => {
              const Icon = item.icon
              return (
                <motion.div key={item.title} variants={itemVariants}>
                  <Link
                    href={item.href}
                    className="bg-background hover:border-claw-500/30 group block h-full rounded-2xl border p-6 transition-all"
                  >
                    <Icon className="text-claw-500 mb-3 h-6 w-6" />
                    <h3 className="mb-2 font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground mb-4 text-sm">{item.description}</p>
                    <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                      Learn more <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Core Principles</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Six foundational articles that govern the GuardianClaw protocol.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto mb-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {corePrinciples.map((article) => (
              <motion.div key={article.number} variants={itemVariants}>
                <Link
                  href={`/governance/constitution#article-${article.number}`}
                  className="bg-background hover:border-claw-500/30 group block rounded-2xl border p-5 transition-all"
                >
                  <span className="text-claw-500 mb-2 block text-2xl font-bold">
                    {String(article.number).padStart(2, '0')}
                  </span>
                  <h4 className="mb-1 text-sm font-semibold">{article.title}</h4>
                  <p className="text-muted-foreground text-xs">{article.summary}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center">
            <Button variant="outline" asChild>
              <Link href="/governance/constitution">
                Read full Constitution <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Governance at a Glance */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Governance at a Glance</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Six proposal types, each with specific quorum and majority requirements.
            </p>
          </motion.div>

          <div className="mx-auto mb-12 max-w-5xl">
            <SipTypesGrid />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {GOVERNANCE_RULES.map((rule) => (
              <motion.div
                key={rule.label}
                variants={itemVariants}
                className="bg-background rounded-2xl border p-5 text-center"
              >
                <div className="text-claw-500 mb-1 text-lg font-bold">{rule.value}</div>
                <div className="mb-1 text-sm font-semibold">{rule.label}</div>
                <div className="text-muted-foreground text-xs">{rule.detail}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Cross-Links */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Get Involved</h2>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 sm:grid-cols-3">
              <Link
                href="/token"
                className="bg-background hover:border-claw-500/30 group rounded-2xl border p-6 transition-all"
              >
                <Coins className="text-claw-500 mb-3 h-6 w-6" />
                <h3 className="mb-1 font-semibold">Token Overview</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Tokenomics, utility, and parameters
                </p>
                <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                  View details <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <Link
                href="/holder"
                className="bg-background hover:border-claw-500/30 group rounded-2xl border p-6 transition-all"
              >
                <Shield className="text-claw-500 mb-3 h-6 w-6" />
                <h3 className="mb-1 font-semibold">Holder Area</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Connect wallet, check balance, access benefits
                </p>
                <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                  Go to area <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <Link
                href="/app/governance"
                className="bg-background hover:border-claw-500/30 group rounded-2xl border p-6 transition-all"
              >
                <Vote className="text-claw-500 mb-3 h-6 w-6" />
                <h3 className="mb-1 font-semibold">Governance App</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Browse proposals, vote, and create SIPs
                </p>
                <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                  Launch app <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
