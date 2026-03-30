import { Metadata } from 'next'
import { MoltbotDemo } from '@/components/demos'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github, Package } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Moltbot Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw provides security guardrails for Moltbot agents with real-time validation, data leak prevention, and threat detection.',
}

export default function MoltbotDemoPage() {
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
                href="/docs/integrations/moltbot"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://www.npmjs.com/package/@guardianclaw/moltbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Package className="h-4 w-4" />
                npm
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/packages/moltbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                Source
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <MoltbotDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-sm font-bold text-purple-500">
                L1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Input Validation</h3>
                <p className="text-muted-foreground text-sm">
                  Every message is scanned for 700+ attack patterns including prompt injection,
                  jailbreaks, and role manipulation before reaching the AI.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                L2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Safety Seed Injection</h3>
                <p className="text-muted-foreground text-sm">
                  An alignment seed is injected into the system prompt to reinforce safe behavior
                  and prevent context manipulation.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-500">
                L3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Output Validation</h3>
                <p className="text-muted-foreground text-sm">
                  Responses are scanned for sensitive data including API keys, passwords, credit
                  cards, SSNs, and PII before delivery.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="bg-claw-500/20 text-claw-500 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                L4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Tool Call Validation</h3>
                <p className="text-muted-foreground text-sm">
                  Tool calls are intercepted and validated before execution. Destructive commands,
                  system path access, and privilege escalation are blocked.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Protection Levels */}
        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Protection Levels</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-zinc-500/30 bg-zinc-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-zinc-500" />
                <span className="font-semibold text-zinc-400">Off</span>
              </div>
              <p className="text-muted-foreground text-xs">GuardianClaw disabled. No protection.</p>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="font-semibold text-blue-400">Watch</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Monitor only. Alerts on all threats but no blocking.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="font-semibold text-amber-400">Guard</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Block critical threats. Alerts on high+ severity.
              </p>
            </div>

            <div className="bg-claw-500/10 border-claw-500/30 rounded-xl border p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="bg-claw-500 h-2 w-2 rounded-full" />
                <span className="text-claw-400 font-semibold">Shield</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Maximum protection. Block all threats with full alerting.
              </p>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Quick Start</h2>

          <div className="overflow-x-auto rounded-xl bg-zinc-950 p-6">
            <pre className="text-sm text-zinc-100">
              <code>{`// Install the package
npm install @guardianclaw/moltbot

// Add to your moltbot.config.json
{
  "plugins": {
    "claw": {
      "level": "guard"
    }
  }
}

// Or use the programmatic API
import { createGuardianClawHooks } from '@guardianclaw/moltbot';

const hooks = createGuardianClawHooks({
  level: 'guard',
  alerts: {
    enabled: true,
    webhook: 'https://your-webhook.com/claw'
  }
});

export const moltbot_hooks = {
  message_received: hooks.messageReceived,
  before_agent_start: hooks.beforeAgentStart,
  message_sending: hooks.messageSending,
  before_tool_call: hooks.beforeToolCall,
  agent_end: hooks.agentEnd,
};`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Just add to your config for instant protection with sensible defaults.
            </p>
          </div>
        </div>

        {/* Escape Hatches */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Escape Hatches</h2>
          <p className="text-muted-foreground mb-6 text-center">
            When you need to bypass protection temporarily, GuardianClaw provides safe escape
            hatches.
          </p>

          <div className="overflow-x-auto rounded-xl bg-zinc-950 p-6">
            <pre className="text-sm text-zinc-100">
              <code>{`/claw pause 5m          # Pause for 5 minutes
/claw allow-once        # Allow next action
/claw trust bash        # Trust a tool for the session
/claw resume            # Resume protection`}</code>
            </pre>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/moltbot"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-medium text-white transition-colors hover:bg-orange-600"
            >
              Read Full Documentation
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="https://www.npmjs.com/package/@guardianclaw/moltbot"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              <Package className="h-4 w-4" />
              View on npm
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
