import { Metadata } from 'next'
import { GarakDemo } from '@/components/demos/garak-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'garak LLM Vulnerability Scanner Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw integrates with garak to detect LLM vulnerabilities before deployment.',
}

export default function GarakDemoPage() {
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
                href="/docs/integrations/garak"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/NVIDIA/garak"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                garak repo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <GarakDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Probe selection</h3>
                <p className="text-muted-foreground text-sm">
                  garak selects relevant vulnerability probes based on the target model and attack
                  surface.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Attack execution</h3>
                <p className="text-muted-foreground text-sm">
                  Each probe executes its attack pattern against the model, testing for specific
                  vulnerabilities.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Response analysis</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw detectors analyze model responses to identify successful attacks or
                  bypasses.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Vulnerability report</h3>
                <p className="text-muted-foreground text-sm">
                  Detailed report with vulnerability scores, attack success rates, and remediation
                  recommendations.
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
              <code>{`# Install garak with GuardianClaw probes
pip install garak guardianclaw

# Run vulnerability scan with GuardianClaw detectors
garak --model_type openai \\
      --model_name gpt-4 \\
      --probes dan,encoding,glitch \\
      --detectors claw.CLAWDetector

# Or use programmatically
from garak.probes import dan, encoding
from guardianclaw.integrations.garak import GuardianClawDetector

# Configure GuardianClaw detector
detector = GuardianClawDetector(
    claw_check=True,
    strict_mode=True
)

# Run probes with GuardianClaw analysis
results = garak.run(
    target=my_model,
    probes=[dan.Dan_11_0, encoding.InjectBase64],
    detectors=[detector]
)

print(f"Vulnerability Score: {results.score}%")
print(f"Passed: {results.passed}/{results.total}")`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Integrate GuardianClaw detectors into your garak security testing pipeline.
            </p>
          </div>
        </div>

        {/* Supported Probes */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Supported Probes</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-purple-500">Jailbreak Probes</h3>
              <p className="text-muted-foreground text-sm">
                DAN, AIM, STAN, and other jailbreak attack patterns.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-purple-500">Encoding Attacks</h3>
              <p className="text-muted-foreground text-sm">
                Base64, ROT13, and other encoding bypass techniques.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-purple-500">Prompt Injection</h3>
              <p className="text-muted-foreground text-sm">
                System prompt extraction and instruction override attacks.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-purple-500">Crescendo Attacks</h3>
              <p className="text-muted-foreground text-sm">
                Multi-turn escalation patterns that gradually bypass safety.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/garak"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-600"
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
