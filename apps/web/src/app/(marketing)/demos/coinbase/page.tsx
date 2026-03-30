import { Metadata } from 'next'
import { CoinbaseFlowDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Coinbase AgentKit Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw protects AI-powered blockchain transactions with the CLAW protocol.',
}

export default function CoinbaseDemoPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-background/95 sticky top-0 z-50 border-b backdrop-blur">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/integrations"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Integrations
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/docs/integrations/coinbase"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/coinbase"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                Examples
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <CoinbaseFlowDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">AI agent initiates a transaction</h3>
                <p className="text-muted-foreground text-sm">
                  Every transaction request from your AgentKit-powered AI is intercepted before
                  reaching the blockchain.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-claw-500/20 text-claw-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">CLAW Protocol validates the request</h3>
                <p className="text-muted-foreground text-sm">
                  Four gates check for valid format (Credibility), safe recipients (Avoidance),
                  spending limits (Limits), and legitimate purpose (Worth).
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Transaction layer performs deep checks</h3>
                <p className="text-muted-foreground text-sm">
                  EIP-55 address validation, spending limit enforcement, and unlimited approval
                  detection protect against common attack vectors.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Safe transaction executes</h3>
                <p className="text-muted-foreground text-sm">
                  Only after all validations pass, the transaction is submitted to the blockchain
                  via your wallet provider.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Profiles */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Security Profiles</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="bg-muted/50 rounded-xl border p-4">
              <h4 className="mb-2 font-semibold text-green-500">Standard</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>Max single: $100</li>
                <li>Max daily: $500</li>
                <li>Confirm above: $25</li>
              </ul>
            </div>
            <div className="bg-muted/50 rounded-xl border p-4">
              <h4 className="mb-2 font-semibold text-amber-500">Strict</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>Max single: $25</li>
                <li>Max daily: $100</li>
                <li>Confirm above: $10</li>
              </ul>
            </div>
            <div className="bg-muted/50 rounded-xl border p-4">
              <h4 className="mb-2 font-semibold text-blue-500">Permissive</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>Max single: $1,000</li>
                <li>Max daily: $5,000</li>
                <li>Confirm above: $100</li>
              </ul>
            </div>
            <div className="bg-muted/50 rounded-xl border p-4">
              <h4 className="mb-2 font-semibold text-red-500">Paranoid</h4>
              <ul className="text-muted-foreground space-y-1 text-sm">
                <li>Max single: $10</li>
                <li>Max daily: $50</li>
                <li>Confirm above: $5</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Quick Start</h2>

          <div className="overflow-x-auto rounded-xl bg-zinc-950 p-6">
            <pre className="text-sm text-zinc-100">
              <code>{`from coinbase_agentkit import AgentKit
from guardianclaw.integrations.coinbase import claw_action_provider

# Create security provider with strict profile
provider = claw_action_provider(security_profile="strict")

# Add to your AgentKit agent
agent = AgentKit(action_providers=[provider])

# Now every transaction is protected:
# - Address validation (EIP-55 checksums)
# - Spending limits enforced
# - Blocked addresses checked
# - Unlimited approvals blocked
# - Rate limiting applied

# Validate before any transaction
result = provider.validate_transaction({
    "action": "native_transfer",
    "to_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "amount": 25.0,
    "worth": "Payment for design services",
})

if result.should_proceed:
    # Execute the transaction safely
    agent.execute_action("native_transfer", result.params)`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Add enterprise-grade security to your AgentKit transactions with just a few lines of
              code.
            </p>
          </div>
        </div>

        {/* Protected Actions */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Protected Actions</h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {[
              'native_transfer',
              'transfer (ERC20)',
              'approve',
              'deploy_contract',
              'trade',
              'supply / borrow',
              'create_flow',
              'buy_token',
              'deploy_token',
            ].map((action) => (
              <div key={action} className="bg-muted/50 rounded-lg border p-3 text-center">
                <code className="text-xs">{action}</code>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/coinbase"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-600"
            >
              Read Full Documentation
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="/app/builder/new"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Try It Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
