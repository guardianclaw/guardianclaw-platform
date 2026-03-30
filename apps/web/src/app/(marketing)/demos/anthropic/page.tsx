import { Metadata } from 'next'
import { AnthropicDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Anthropic Integration Demo | GuardianClaw',
  description:
    "Interactive demonstration of how GuardianClaw adds defense-in-depth to Claude's Constitutional AI.",
}

export default function AnthropicDemoPage() {
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
                href="/docs/integrations/anthropic"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/anthropic"
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
        <AnthropicDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">GuardianClaw input validation</h3>
                <p className="text-muted-foreground text-sm">
                  Before reaching Claude, GuardianClaw scans for jailbreak attempts, injection
                  patterns, and malicious inputs.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#D97757]/20 text-sm font-bold text-[#D97757]">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Constitutional AI processing</h3>
                <p className="text-muted-foreground text-sm">
                  Claude's built-in Constitutional AI principles ensure helpful, harmless, and
                  honest responses.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">GuardianClaw output validation</h3>
                <p className="text-muted-foreground text-sm">
                  After Claude responds, GuardianClaw verifies the output is safe before delivering
                  to the user.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Defense in depth</h3>
                <p className="text-muted-foreground text-sm">
                  Multiple layers of protection work together, catching threats that might bypass a
                  single layer.
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
              <code>{`from anthropic import Anthropic
from guardianclaw.integrations.anthropic_sdk import GuardianClawClaude

# Create GuardianClaw-protected Claude client
client = GuardianClawClaude(
    api_key="your-api-key",
    config={
        "input_validation": True,
        "output_validation": True,
        "block_jailbreaks": True,
        "log_attempts": True
    }
)

# Use Claude with dual-layer protection
response = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": user_input}
    ]
)

# Jailbreak attempts are blocked at Layer 1
# Constitutional AI provides Layer 2 protection
# Output validation ensures safe responses`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Add defense-in-depth to Claude with GuardianClaw's dual-layer protection.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/anthropic"
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
