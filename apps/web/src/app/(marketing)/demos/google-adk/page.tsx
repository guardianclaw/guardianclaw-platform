import { Metadata } from 'next'
import { GoogleADKDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Google ADK Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw protects Google Agent Development Kit agents with resource access validation.',
}

export default function GoogleADKDemoPage() {
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
                href="/docs/integrations/google-adk"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/examples/google-adk"
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
        <GoogleADKDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#4285F4]/20 text-sm font-bold text-[#4285F4]">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Request analysis</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw parses the agent request to understand the intended action and
                  required resources.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FBBC05]/20 text-sm font-bold text-[#FBBC05]">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Authentication check</h3>
                <p className="text-muted-foreground text-sm">
                  Agent credentials are verified against the service account and IAM permissions.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#EA4335]/20 text-sm font-bold text-[#EA4335]">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Limits validation</h3>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw enforces permission boundaries, blocking access to unauthorized
                  resources.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#34A853]/20 text-sm font-bold text-[#34A853]">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Safe execution</h3>
                <p className="text-muted-foreground text-sm">
                  Only validated requests with proper permissions are executed. All access is logged
                  for audit.
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
              <code>{`from google.adk import Agent
from guardianclaw.integrations.google_adk import GuardianClawADK

# Create GuardianClaw-protected ADK agent
agent = GuardianClawADK(
    project_id="your-project",
    config={
        "validate_requests": True,
        "enforce_scopes": True,
        "audit_logging": True,
        "resource_whitelist": [
            "bigquery.datasets.get",
            "storage.objects.list"
        ]
    }
)

# Execute tasks with permission validation
result = agent.execute(
    task="Analyze Q4 sales data and generate report",
    resources=["sales-dataset", "report-templates"]
)

# Unauthorized resource access is blocked
# All actions are logged for compliance
# Privilege escalation attempts are detected`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Protect Google ADK agents with enterprise-grade access control and audit logging.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/google-adk"
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
