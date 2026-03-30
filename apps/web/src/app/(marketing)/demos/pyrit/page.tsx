import { Metadata } from 'next'
import { PyRITDemo } from '@/components/demos/pyrit-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'PyRIT Red Team Assessment Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw integrates with Microsoft PyRIT for AI red teaming.',
}

export default function PyRITDemoPage() {
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
                href="/docs/integrations/pyrit"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/Azure/PyRIT"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                PyRIT repo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <PyRITDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Target initialization</h3>
                <p className="text-muted-foreground text-sm">
                  PyRIT connects to your target model through its flexible interface system.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Attack orchestration</h3>
                <p className="text-muted-foreground text-sm">
                  The orchestrator executes multi-turn attack strategies to test model robustness.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Response scoring</h3>
                <p className="text-muted-foreground text-sm">
                  Multiple scorers analyze responses for avoidance, bias, toxicity, and other risks.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Risk classification</h3>
                <p className="text-muted-foreground text-sm">
                  Combined scores determine overall risk level with actionable recommendations.
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
              <code>{`from pyrit.orchestrator import RedTeamingOrchestrator
from pyrit.prompt_target import AzureOpenAITarget
from guardianclaw.integrations.pyrit import GuardianClawScorer

# Configure target model
target = AzureOpenAITarget(
    deployment_name="gpt-4",
    endpoint=os.environ["AZURE_ENDPOINT"]
)

# Add GuardianClaw scorer for CLAW validation
claw_scorer = GuardianClawScorer(
    check_truth=True,
    check_harm=True,
    check_scope=True,
    check_purpose=True
)

# Create orchestrator with GuardianClaw integration
orchestrator = RedTeamingOrchestrator(
    attack_strategy="jailbreak_multi_turn",
    prompt_target=target,
    scorers=[claw_scorer],
    memory=None
)

# Run red team assessment
result = await orchestrator.run_attack()

print(f"Risk Level: {result.risk_level}")
print(f"Avoidance Score: {result.avoidance_score}")`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Integrate GuardianClaw scorers into your PyRIT red teaming workflow.
            </p>
          </div>
        </div>

        {/* Supported Scorers */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Supported Scorers</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">TrueFalseScorer</h3>
              <p className="text-muted-foreground text-sm">
                Validates factual accuracy of model responses.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">HarmScorer</h3>
              <p className="text-muted-foreground text-sm">
                Detects potentially harmful content in responses.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">BiasScorer</h3>
              <p className="text-muted-foreground text-sm">
                Identifies bias and fairness issues in model outputs.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">ToxicityScorer</h3>
              <p className="text-muted-foreground text-sm">
                Measures toxic language and inappropriate content.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/pyrit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
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
