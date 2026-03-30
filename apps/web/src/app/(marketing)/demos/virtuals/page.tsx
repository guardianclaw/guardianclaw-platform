import { Metadata } from 'next'
import { VirtualsDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Virtuals Protocol Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw protects on-chain AI agents with real-time transaction validation.',
}

export default function VirtualsDemoPage() {
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
                href="/docs/integrations/virtuals"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/virtuals"
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
        <VirtualsDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Intent analysis</h3>
                <p className="text-muted-foreground text-sm">
                  The agent's transaction intent is parsed and analyzed to understand the requested
                  operation.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Smart contract validation</h3>
                <p className="text-muted-foreground text-sm">
                  Target contracts are verified against known safe contracts and checked for
                  malicious patterns.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Wallet whitelist</h3>
                <p className="text-muted-foreground text-sm">
                  Destination addresses are checked against configured whitelists to prevent
                  unauthorized transfers.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Value limits</h3>
                <p className="text-muted-foreground text-sm">
                  Transaction amounts are validated against daily, per-transaction, and cumulative
                  limits.
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
              <code>{`from guardianclaw.integrations.virtuals import GuardianClawVirtual

# Create a protected virtual agent
agent = GuardianClawVirtual(
    contract_address="0x7a23...F4d2",
    config={
        "max_daily_value": 5000,      # USD
        "max_per_transaction": 1000,  # USD
        "allowed_contracts": [
            "0xJupiter...",
            "0xRaydium..."
        ],
        "whitelist_mode": True
    }
)

# Execute transactions through GuardianClaw
result = await agent.execute_transaction({
    "action": "swap",
    "token_in": "VIRTUAL",
    "token_out": "USDC",
    "amount": 500
})

if result.approved:
    print(f"Transaction executed: {result.tx_hash}")
else:
    print(f"Blocked: {result.reason}")`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Protect your on-chain AI agents with configurable transaction validation and limits.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/virtuals"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-3 font-medium text-white transition-colors hover:from-violet-600 hover:to-cyan-600"
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
