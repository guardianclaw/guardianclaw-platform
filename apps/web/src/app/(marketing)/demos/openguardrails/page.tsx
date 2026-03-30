import { Metadata } from 'next'
import { OpenGuardrailsDemo } from '@/components/demos/openguardrails-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'OpenGuardrails Demo | GuardianClaw',
  description:
    'Interactive demonstration of how NeMo Guardrails and GuardianClaw work together for enhanced AI safety.',
}

export default function OpenGuardrailsDemoPage() {
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
                href="/docs/integrations/openguardrails"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/NVIDIA/NeMo-Guardrails"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                NeMo Guardrails repo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <OpenGuardrailsDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">NeMo validation</h3>
                <p className="text-muted-foreground text-sm">
                  NeMo Guardrails checks for topical relevance and common jailbreak patterns.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">GuardianClaw validation</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw applies CLAW protocol for deeper semantic analysis.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Combined decision</h3>
                <p className="text-muted-foreground text-sm">
                  Both results are merged for higher confidence and catch rate.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 text-sm font-bold text-red-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Synergy effect</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw catches attacks that NeMo might miss, and vice versa.
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
              <code>{`from nemoguardrails import RailsConfig, LLMRails
from guardianclaw import GuardianClawGuard

# Configure NeMo Guardrails
config = RailsConfig.from_path("./config")
rails = LLMRails(config)

# Add GuardianClaw as additional guard
claw = GuardianClawGuard(
    check_truth=True,
    check_harm=True,
    check_scope=True,
    check_purpose=True
)

# Combine both guardrails
async def validate_with_openguardrails(input_text: str):
    # NeMo check
    nemo_result = await rails.generate(
        messages=[{"role": "user", "content": input_text}]
    )

    # GuardianClaw check (catches what NeMo might miss)
    claw_result = claw.validate(input_text)

    # Combined decision
    if nemo_result.blocked or claw_result.blocked:
        return {"safe": False, "reason": "Blocked by guardrails"}

    return {
        "safe": True,
        "confidence": (nemo_result.score + claw_result.score) / 2
    }`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Combine NeMo Guardrails with GuardianClaw for enhanced dual-layer protection.
            </p>
          </div>
        </div>

        {/* Synergy Benefits */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Synergy Benefits</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-red-500">Higher Catch Rate</h3>
              <p className="text-muted-foreground text-sm">
                GuardianClaw catches subtle attacks that NeMo's pattern matching might miss.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-red-500">Deeper Analysis</h3>
              <p className="text-muted-foreground text-sm">
                CLAW protocol provides semantic analysis beyond surface patterns.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-red-500">Confidence Boost</h3>
              <p className="text-muted-foreground text-sm">
                Agreement between both systems increases validation confidence.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-red-500">Complementary Coverage</h3>
              <p className="text-muted-foreground text-sm">
                Different detection approaches cover more attack vectors.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/openguardrails"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-6 py-3 font-medium text-white transition-colors hover:bg-red-600"
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
