import { Metadata } from 'next'
import { VoltAgentDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'VoltAgent Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of type-safe guardrails for VoltAgent TypeScript applications with CLAW validation and PII detection.',
}

export default function VoltAgentDemoPage() {
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
                href="/docs/integrations/voltagent"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/packages/voltagent"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                Package
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <VoltAgentDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Type-safe guardrails are created</h3>
                <p className="text-muted-foreground text-sm">
                  Use createGuardianClawGuardrails() to generate TypeScript-native input and output
                  guardrails with full type inference.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-claw-500/20 text-claw-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Input validation with CLAW + OWASP</h3>
                <p className="text-muted-foreground text-sm">
                  Incoming requests are validated against CLAW protocol gates and OWASP security
                  patterns before reaching the agent.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Agent processes safely</h3>
                <p className="text-muted-foreground text-sm">
                  Your VoltAgent handles the validated request with confidence that malicious input
                  has been blocked.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Output PII detection and redaction</h3>
                <p className="text-muted-foreground text-sm">
                  Response content is scanned for PII (emails, phones, SSNs) and automatically
                  redacted before returning to the user.
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
              <code>{`import { Agent } from "@voltagent/core";
import { createGuardianClawGuardrails } from "@guardianclaw/voltagent";

// Create guardrails with preset configuration
const { inputGuardrails, outputGuardrails } = createGuardianClawGuardrails({
  level: "strict",    // permissive | standard | strict
  enablePII: true,    // Enable PII detection & redaction
});

// Add to your VoltAgent
const agent = new Agent({
  name: "safe-agent",
  inputGuardrails,    // Validates all incoming requests
  outputGuardrails,   // Scans and redacts PII from responses
});

// All requests are now protected
const response = await agent.handle({
  content: "Summarize our Q4 report...",
  context: userContext,
});`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Add enterprise-grade safety to any VoltAgent application with one import.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/voltagent"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
            >
              Read Full Documentation
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="https://www.npmjs.com/package/@guardianclaw/voltagent"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              View on npm
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
