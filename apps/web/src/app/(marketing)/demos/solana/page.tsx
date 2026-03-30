import { Metadata } from 'next'
import { SolanaAgentKitDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Solana Agent Kit Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw protects AI agents executing blockchain transactions on Solana.',
}

export default function SolanaDemoPage() {
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
                href="/docs/integrations/solana-agent-kit"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/solana"
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
        <SolanaAgentKitDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Agent receives transaction request</h3>
                <p className="text-muted-foreground text-sm">
                  Your AI agent receives a request to execute a blockchain transaction, such as
                  swaps or transfers.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Token and address verification</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw validates token contracts and checks destination addresses against
                  known malicious wallets.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Slippage and MEV protection</h3>
                <p className="text-muted-foreground text-sm">
                  Built-in protection against excessive slippage and MEV attacks ensures fair
                  execution.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Transaction simulation</h3>
                <p className="text-muted-foreground text-sm">
                  Before executing on-chain, GuardianClaw simulates the transaction to preview
                  outcomes and catch errors.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Quick Start</h2>

          <div className="overflow-x-auto rounded-xl bg-zinc-950 p-6">
            <pre className="text-sm text-zinc-100">
              <code>{`from solana_agentkit import SolanaAgent
from guardianclaw.integrations.solana import GuardianClawSolanaGuard

# Initialize GuardianClaw guard for Solana
guard = GuardianClawSolanaGuard(
    api_key="your-claw-api-key",
    config={
        "max_slippage": 0.01,  # 1% max slippage
        "block_suspicious_addresses": True,
        "require_simulation": True
    }
)

# Create your Solana agent
agent = SolanaAgent(
    wallet=your_wallet,
    rpc_url="https://api.mainnet-beta.solana.com"
)

# Wrap with GuardianClaw protection
protected_agent = guard.protect(agent)

# Execute transactions safely
result = await protected_agent.swap(
    from_token="SOL",
    to_token="USDC",
    amount=10
)`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Protect your AI agent's blockchain transactions with enterprise-grade security.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/solana-agent-kit"
              className="bg-claw-500 hover:bg-claw-600 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-colors"
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
