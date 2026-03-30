'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Coins,
  Vote,
  Zap,
  ArrowRight,
  ExternalLink,
  Shield,
  CheckCircle2,
  Flame,
  TrendingUp,
  Percent,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PROPOSAL_TYPES, GOVERNANCE_RULES } from '@/lib/governance'

const tokenomics = [
  { label: 'Total Supply', value: '1,000,000,000', subtext: '1 Billion $GCLAW' },
  { label: 'Decimals', value: '6', subtext: 'SPL Token Standard' },
]

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GCLAW_MINT || ''
const JUPITER_URL = `https://jup.ag/tokens/${CONTRACT_ADDRESS}`

const creditPackages = [
  { deposit: '$3 USDC', credits: '$3.00', executions: '~1,000' },
  { deposit: '$15 USDC', credits: '$15.00', executions: '~5,000' },
  { deposit: '$70 USDC', credits: '$70.00', executions: '~23,333' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function TokenPage() {
  return (
    <div className="py-16 lg:py-24">
      {/* Hero Section */}
      <section className="container mx-auto mb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Coins className="h-4 w-4" />
            <span className="text-sm font-medium">$GCLAW Token</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Govern the Future of
            <br />
            <span className="text-claw-500">AI Safety</span>
          </h1>

          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            $GCLAW is the governance token for the GuardianClaw protocol. Hold tokens to vote on
            proposals, access premium features, and shape the direction of AI alignment.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/app/governance">
                <Vote className="mr-2 h-4 w-4" />
                Go to Governance
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={JUPITER_URL} target="_blank" rel="noopener noreferrer">
                Buy on Jupiter Exchange
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Token Parameters */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Token Parameters</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Built on Solana for fast, low-cost governance operations.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mx-auto mb-12 grid max-w-xl gap-6 sm:grid-cols-2"
          >
            {tokenomics.map((item) => (
              <motion.div
                key={item.label}
                variants={itemVariants}
                className="bg-background rounded-2xl border p-6 text-center"
              >
                <div className="text-claw-500 mb-2 text-3xl font-bold">{item.value}</div>
                <div className="mb-1 font-semibold">{item.label}</div>
                <div className="text-muted-foreground text-sm">{item.subtext}</div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="bg-background mx-auto max-w-3xl rounded-2xl border p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <Shield className="text-claw-500 h-6 w-6" />
              <h3 className="font-semibold">Blockchain Details</h3>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <span className="text-muted-foreground mb-1 block">Contract Address</span>
                <code className="break-all font-mono text-xs">{CONTRACT_ADDRESS}</code>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-muted/50 flex justify-between rounded-lg p-3">
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-medium">Solana (SPL Token)</span>
                </div>
                <div className="bg-muted/50 flex justify-between rounded-lg p-3">
                  <span className="text-muted-foreground">Standard</span>
                  <span className="font-medium">SPL Token 2022</span>
                </div>
                <div className="bg-muted/50 flex justify-between rounded-lg p-3">
                  <span className="text-muted-foreground">Governance Platform</span>
                  <span className="font-medium">Realms</span>
                </div>
                <div className="bg-muted/50 flex justify-between rounded-lg p-3">
                  <span className="text-muted-foreground">Voting Power</span>
                  <span className="font-medium">1M tokens = 1 vote</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Token Utility */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Token Utility</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Three core utilities that create real demand for $GCLAW tokens.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-16 grid gap-8 md:grid-cols-3"
          >
            <motion.div variants={itemVariants} className="bg-background rounded-2xl border p-8">
              <div className="mb-6 inline-block rounded-xl bg-blue-500/10 p-4">
                <Vote className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="mb-4 text-xl font-bold">Governance</h3>
              <p className="text-muted-foreground mb-6">
                Vote on protocol changes, new features, partnerships, and CLAW seed modifications.
                Your tokens are your voice.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Vote on all proposal types</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Create proposals (5M+ tokens)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Participate in discussions</span>
                </li>
              </ul>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-background rounded-2xl border p-8">
              <div className="bg-claw-500/10 mb-6 inline-block rounded-xl p-4">
                <Percent className="text-claw-500 h-8 w-8" />
              </div>
              <h3 className="mb-4 text-xl font-bold">+20% Credit Bonus</h3>
              <p className="text-muted-foreground mb-6">
                Deposit $GCLAW tokens to add credits and receive a 20% bonus. Pay less for the same
                amount of executions.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>20% more credits per deposit</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Also accepts SOL and USDC</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Instant credit conversion</span>
                </li>
              </ul>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-background rounded-2xl border p-8">
              <div className="mb-6 inline-block rounded-xl bg-purple-500/10 p-4">
                <Zap className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="mb-4 text-xl font-bold">Early Access</h3>
              <p className="text-muted-foreground mb-6">
                Token holders get early access to new features, integrations, and platform updates
                before public release.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Beta features access</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>New integrations preview</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="text-claw-500 h-4 w-4" />
                  <span>Priority feedback channel</span>
                </li>
              </ul>
            </motion.div>
          </motion.div>

          {/* Buyback & Burn */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-orange-500/10 p-3">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Buyback & Burn Program</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  20% of protocol revenue is allocated to token buyback. Purchased tokens are
                  permanently burned, reducing supply over time.
                </p>
                <ul className="flex flex-wrap gap-4 text-sm">
                  <li className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    <span>Monthly buybacks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    <span>On-chain verifiable</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-orange-500" />
                    <span>Transparent reporting</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Credit System */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Pay-per-Use Credits</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Simple, transparent pricing. Deposit credits and pay only for what you use. Each agent
              execution costs just $0.003.
            </p>
          </motion.div>

          <div className="mx-auto max-w-4xl">
            {/* How it works */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mb-12 grid gap-6 sm:grid-cols-3"
            >
              <div className="p-6 text-center">
                <div className="bg-claw-500/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-claw-500 text-xl font-bold">1</span>
                </div>
                <h3 className="mb-2 font-semibold">Connect Wallet</h3>
                <p className="text-muted-foreground text-sm">
                  Connect your Solana wallet to get started
                </p>
              </div>
              <div className="p-6 text-center">
                <div className="bg-claw-500/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-claw-500 text-xl font-bold">2</span>
                </div>
                <h3 className="mb-2 font-semibold">Deposit Credits</h3>
                <p className="text-muted-foreground text-sm">
                  Add credits using SOL, USDC, or $GCLAW
                </p>
              </div>
              <div className="p-6 text-center">
                <div className="bg-claw-500/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <span className="text-claw-500 text-xl font-bold">3</span>
                </div>
                <h3 className="mb-2 font-semibold">Run Agents</h3>
                <p className="text-muted-foreground text-sm">
                  Each execution deducts $0.003 from your balance
                </p>
              </div>
            </motion.div>

            {/* Credit packages */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="bg-background rounded-2xl border p-6"
            >
              <h3 className="mb-6 font-semibold">Credit Packages</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                        Deposit
                      </th>
                      <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                        Credits
                      </th>
                      <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                        Executions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditPackages.map((pkg) => (
                      <tr key={pkg.deposit} className="border-b last:border-0">
                        <td className="px-4 py-3">{pkg.deposit}</td>
                        <td className="px-4 py-3 font-medium">{pkg.credits}</td>
                        <td className="text-muted-foreground px-4 py-3">{pkg.executions}</td>
                      </tr>
                    ))}
                    <tr className="bg-claw-500/5">
                      <td className="text-claw-600 dark:text-claw-400 px-4 py-3">
                        $2.50 in $GCLAW
                      </td>
                      <td className="text-claw-600 dark:text-claw-400 px-4 py-3 font-medium">
                        $3.00 (+20%)
                      </td>
                      <td className="text-muted-foreground px-4 py-3">~1,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground mt-4 text-xs">
                * Deposits in $GCLAW receive a 20% bonus in credits
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Governance Rules */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Governance Rules</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                Democratic, transparent, and on-chain governance for protocol decisions.
              </p>
            </div>

            {/* Voting Rules */}
            <div className="mb-12 grid gap-6 sm:grid-cols-2">
              {GOVERNANCE_RULES.map((item) => (
                <div key={item.label} className="bg-background rounded-2xl border p-6">
                  <div className="text-claw-500 mb-2 text-2xl font-bold">{item.value}</div>
                  <div className="mb-1 font-semibold">{item.label}</div>
                  <div className="text-muted-foreground text-sm">{item.detail}</div>
                </div>
              ))}
            </div>

            {/* Proposal Types */}
            <div className="bg-background rounded-2xl border p-6">
              <h3 className="mb-6 font-semibold">Proposal Types (SIPs)</h3>
              <div className="space-y-4">
                {PROPOSAL_TYPES.map((item) => (
                  <div
                    key={item.type}
                    className="bg-muted/50 flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
                  >
                    <div className="min-w-[200px] flex-1">
                      <div className="text-claw-500 mb-1 font-mono text-sm">{item.type}</div>
                      <div className="text-muted-foreground text-sm">{item.description}</div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Quorum: </span>
                        <span className="font-medium">{item.quorum}%</span>
                      </div>
                      {item.majority > 50 && (
                        <div>
                          <span className="text-muted-foreground">Majority: </span>
                          <span className="font-medium">{item.majority}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
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
              Join the community shaping the future of AI safety.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/app/governance">
                  <Vote className="mr-2 h-4 w-4" />
                  View Proposals
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href={JUPITER_URL} target="_blank" rel="noopener noreferrer">
                  Get $GCLAW
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/governance">
                  Governance Docs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
