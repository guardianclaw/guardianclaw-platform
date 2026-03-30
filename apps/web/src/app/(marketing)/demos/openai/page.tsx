import { Metadata } from 'next'
import { OpenAIDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OpenAI Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw protects OpenAI Assistants with content moderation and CLAW validation.',
}

export default function OpenAIDemoPage() {
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
                href="/docs/integrations/openai-agents"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/openai"
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
        <OpenAIDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Input content moderation</h3>
                <p className="text-muted-foreground text-sm">
                  User input is analyzed for harmful content across multiple categories: hate,
                  harassment, violence, sexual content, and more.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-claw-500/20 text-claw-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">CLAW validation</h3>
                <p className="text-muted-foreground text-sm">
                  Content passes through Credibility, Avoidance, Limits, and Worth gates to ensure
                  alignment with safety policies.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Assistant processes request</h3>
                <p className="text-muted-foreground text-sm">
                  Validated requests are forwarded to OpenAI Assistants for processing with full
                  function calling support.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Output moderation</h3>
                <p className="text-muted-foreground text-sm">
                  Assistant responses are validated before delivery, preventing harmful or
                  policy-violating outputs.
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
              <code>{`from openai import OpenAI
from guardianclaw.integrations.openai_agents import (
    create_claw_agent,
    GuardianClawModerationConfig
)

# Initialize OpenAI client
client = OpenAI()

# Configure GuardianClaw moderation
config = GuardianClawModerationConfig(
    input_moderation=True,
    output_moderation=True,
    claw_validation=True,
    block_categories=["hate", "violence", "self-harm"]
)

# Create protected assistant
agent = create_claw_agent(
    client=client,
    assistant_id="asst_abc123",
    config=config
)

# Execute safely with full moderation
response = agent.run(
    "Help me analyze this customer feedback..."
)`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Add comprehensive content moderation to any OpenAI Assistant.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/openai-agents"
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
