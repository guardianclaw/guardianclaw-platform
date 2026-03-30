import { Metadata } from 'next'
import { ElizaOSDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'ElizaOS Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw moderates social media AI agents across Twitter, Discord, and Telegram.',
}

export default function ElizaOSDemoPage() {
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
                href="/docs/integrations/elizaos"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/elizaos"
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
        <ElizaOSDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Platform detection</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw identifies the social platform (Twitter, Discord, Telegram) and
                  applies appropriate content policies.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-claw-500/20 text-claw-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Content moderation</h3>
                <p className="text-muted-foreground text-sm">
                  Agent responses are analyzed for toxicity, spam, hate speech, and other harmful
                  content before posting.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Personality consistency</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw verifies that responses match the agent's defined personality traits
                  and brand guidelines.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Safe publishing</h3>
                <p className="text-muted-foreground text-sm">
                  Only validated responses that pass all checks are published. Harmful content is
                  blocked with detailed feedback.
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
              <code>{`import { AgentRuntime, Character } from '@elizaos/core'
import { clawPlugin } from '@guardianclaw/elizaos-plugin'

const character: Character = {
  name: 'GuardianClawBot',
  bio: 'A helpful AI assistant for our community',
  personality: ['friendly', 'professional', 'helpful']
}

// Create agent with GuardianClaw protection
const agent = new AgentRuntime({
  character,
  plugins: [
    clawPlugin({
      blockUnsafe: true,
      logChecks: true,
      toxicityThreshold: 0.3,
      personalityEnforcement: true
    })
  ]
})

// All social interactions are moderated
// Toxic content is blocked before posting
// Personality consistency is maintained`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Protect your social AI agents from posting harmful content across all platforms.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/elizaos"
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
