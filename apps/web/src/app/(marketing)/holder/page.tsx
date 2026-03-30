'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Coins,
  Vote,
  Shield,
  ExternalLink,
  Wallet,
  ArrowRight,
  Flame,
  Lock,
  Gift,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTokenBalance } from '@/hooks/use-governance'
import { GOVERNANCE_CONFIG, formatVotingPower } from '@/lib/governance'

const holderBenefits = [
  {
    icon: Vote,
    title: 'Governance Power',
    description:
      'Vote on protocol changes, new features, and the future direction of GuardianClaw.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Lock,
    title: 'Access Tiers',
    description: 'Unlock premium features by holding tokens. Your tokens stay in your wallet.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Gift,
    title: '20% Fee Discount',
    description: 'Pay subscriptions with $GCLAW and get 20% off all platform fees.',
    color: 'text-claw-500',
    bgColor: 'bg-claw-500/10',
  },
  {
    icon: Flame,
    title: 'Buyback & Burn',
    description: '20% of protocol revenue buys back and burns tokens, reducing supply.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
]

const quickActions = [
  {
    icon: Vote,
    title: 'Governance',
    description: 'Vote on proposals and shape the protocol',
    href: '/app/governance',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: Coins,
    title: 'Token Info',
    description: 'Tokenomics, utility, and parameters',
    href: '/token',
    color: 'text-claw-500',
    bgColor: 'bg-claw-500/10',
  },
  {
    icon: ExternalLink,
    title: 'Buy $GCLAW',
    description: 'Buy on Jupiter Exchange',
    href: 'https://jup.ag/swap/SOL-GCLAW',
    external: true,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
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

function EligibilityCard({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  threshold,
  thresholdNote,
  balance,
  loading,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  threshold: number
  thresholdNote: string
  balance: number
  loading: boolean
}) {
  const isEligible = balance >= threshold
  const tokensNeeded = threshold - balance

  return (
    <div className="bg-background rounded-2xl border p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className={`rounded-lg p-2 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <h3 className="font-bold">{title}</h3>
      </div>
      <div className="text-claw-500 mb-2 text-3xl font-bold">{threshold.toLocaleString()}</div>
      <p className="text-muted-foreground mb-4 text-sm">Minimum tokens required</p>
      <div className="border-t pt-4">
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking eligibility...
          </div>
        ) : isEligible ? (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            You are eligible
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <XCircle className="h-4 w-4" />
              Not eligible yet
            </div>
            <p className="text-muted-foreground pl-6 text-xs">
              Need {tokensNeeded.toLocaleString()} more tokens
            </p>
          </div>
        )}
        <p className="text-muted-foreground mt-2 text-xs">{thresholdNote}</p>
      </div>
    </div>
  )
}

export default function HolderPage() {
  const { connected, publicKey } = useWallet()
  const { balance, loading, error, refetch } = useTokenBalance()

  // Convert raw balance (with decimals) to display balance
  const displayBalance = balance / Math.pow(10, GOVERNANCE_CONFIG.tokenDecimals)

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : null

  const canVote = displayBalance >= GOVERNANCE_CONFIG.minTokensToVote
  const canPropose = displayBalance >= GOVERNANCE_CONFIG.minTokensToPropose

  return (
    <div className="py-16 lg:py-24">
      {/* Hero Section */}
      <section className="container mx-auto mb-16 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">$GCLAW Holder Area</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Welcome,
            <br />
            <span className="text-claw-500">Token Holder</span>
          </h1>

          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            Your hub for governance, voting, and holder benefits. Shape the future of AI safety with
            your $GCLAW tokens.
          </p>

          {!connected ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-muted-foreground">Connect your wallet to access holder features</p>
              <WalletMultiButton />
            </div>
          ) : (
            <div className="bg-background inline-flex flex-col items-center gap-4 rounded-2xl border px-6 py-5 sm:flex-row">
              <div className="flex items-center gap-4">
                <div className="bg-claw-500/10 rounded-xl p-3">
                  <Wallet className="text-claw-500 h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="text-muted-foreground text-sm">Connected Wallet</div>
                  <div className="text-muted-foreground font-mono text-sm">{shortAddress}</div>
                </div>
              </div>

              <div className="bg-border h-px w-full sm:h-12 sm:w-px" />

              <div className="flex items-center gap-4">
                <div className="bg-claw-500/10 rounded-xl p-3">
                  <Coins className="text-claw-500 h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="text-muted-foreground text-sm">Token Balance</div>
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading...</span>
                    </div>
                  ) : error ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-400">Error loading balance</span>
                      <button
                        onClick={() => refetch()}
                        className="hover:bg-muted rounded p-1 transition-colors"
                        title="Retry"
                      >
                        <RefreshCw className="text-muted-foreground h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">{formatVotingPower(displayBalance)}</span>
                      <span className="text-claw-500 font-medium">$GCLAW</span>
                      <button
                        onClick={() => refetch()}
                        className="hover:bg-muted rounded p-1 transition-colors"
                        title="Refresh balance"
                      >
                        <RefreshCw className="text-muted-foreground h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {!loading && !error && (canVote || canPropose) && (
                <>
                  <div className="bg-border h-px w-full sm:h-12 sm:w-px" />
                  <div className="flex gap-2">
                    {canVote && (
                      <div className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-500">
                        Can Vote
                      </div>
                    )}
                    {canPropose && (
                      <div className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-500">
                        Can Propose
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </section>

      {/* Quick Actions */}
      <section className="container mx-auto mb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3"
        >
          {quickActions.map((action) => (
            <motion.div key={action.title} variants={itemVariants}>
              {action.external ? (
                <a
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-background hover:border-claw-500/50 group block rounded-2xl border p-6 transition-colors"
                >
                  <div className={`rounded-xl p-3 ${action.bgColor} mb-4 inline-block`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
                    {action.title}
                    <ExternalLink className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                  </h3>
                  <p className="text-muted-foreground text-sm">{action.description}</p>
                </a>
              ) : (
                <Link
                  href={action.href}
                  className="bg-background hover:border-claw-500/50 group block rounded-2xl border p-6 transition-colors"
                >
                  <div className={`rounded-xl p-3 ${action.bgColor} mb-4 inline-block`}>
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <h3 className="mb-2 flex items-center gap-2 text-lg font-bold">
                    {action.title}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <p className="text-muted-foreground text-sm">{action.description}</p>
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Holder Benefits */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Holder Benefits</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Your $GCLAW tokens unlock exclusive benefits and governance power.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {holderBenefits.map((benefit) => (
              <motion.div
                key={benefit.title}
                variants={itemVariants}
                className="bg-background rounded-2xl border p-6"
              >
                <div className={`rounded-xl p-3 ${benefit.bgColor} mb-4 inline-block`}>
                  <benefit.icon className={`h-6 w-6 ${benefit.color}`} />
                </div>
                <h3 className="mb-2 text-lg font-bold">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Governance Thresholds */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Governance Thresholds</h2>
              <p className="text-muted-foreground text-lg">
                Token requirements for governance participation.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <EligibilityCard
                title="Vote on Proposals"
                icon={Vote}
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
                threshold={GOVERNANCE_CONFIG.minTokensToVote}
                thresholdNote={`~${((GOVERNANCE_CONFIG.minTokensToVote / 1_000_000_000) * 100).toFixed(2)}% of total supply`}
                balance={displayBalance}
                loading={loading || !connected}
              />

              <EligibilityCard
                title="Create Proposals"
                icon={Zap}
                iconColor="text-purple-500"
                iconBg="bg-purple-500/10"
                threshold={GOVERNANCE_CONFIG.minTokensToPropose}
                thresholdNote={`~${((GOVERNANCE_CONFIG.minTokensToPropose / 1_000_000_000) * 100).toFixed(1)}% of total supply`}
                balance={displayBalance}
                loading={loading || !connected}
              />
            </div>

            {connected && !loading && !error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-muted/50 mt-8 rounded-xl p-4 text-center"
              >
                <p className="text-muted-foreground text-sm">
                  Your balance:{' '}
                  <span className="text-foreground font-bold">
                    {displayBalance.toLocaleString()}
                  </span>{' '}
                  $GCLAW
                  {canVote && (
                    <span className="ml-2 text-green-500">
                      ({canPropose ? 'Full governance access' : 'Voting enabled'})
                    </span>
                  )}
                </p>
              </motion.div>
            )}
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
              Join active governance and help shape the future of AI safety.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/app/governance">
                  <Vote className="mr-2 h-4 w-4" />
                  View Proposals
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/token">
                  <Coins className="mr-2 h-4 w-4" />
                  Token Details
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
