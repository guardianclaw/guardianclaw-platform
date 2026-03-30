import { Metadata } from 'next'
import { JetBrainsDemo } from '@/components/demos/jetbrains-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'JetBrains Plugin Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw inspections detect prompt vulnerabilities in IntelliJ-based IDEs.',
}

export default function JetBrainsDemoPage() {
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
                href="/docs/integrations/jetbrains"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-intellij"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                <Github className="h-4 w-4" />
                Plugin repo
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Demo */}
        <JetBrainsDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">PSI tree analysis</h3>
                <p className="text-muted-foreground text-sm">
                  The plugin uses JetBrains PSI (Program Structure Interface) to understand your
                  code structure.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Inspection engine</h3>
                <p className="text-muted-foreground text-sm">
                  Custom GuardianClaw inspections run alongside JetBrains built-in inspections for
                  comprehensive analysis.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Highlight and annotate</h3>
                <p className="text-muted-foreground text-sm">
                  Vulnerabilities are highlighted with the familiar yellow/red backgrounds and
                  gutter icons.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Intent actions</h3>
                <p className="text-muted-foreground text-sm">
                  Press Alt+Enter on highlighted code to see quick fixes and apply them instantly.
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
              <code>{`// Install from JetBrains Marketplace:
// Settings > Plugins > Marketplace > Search "GuardianClaw AI Safety"

// Or install manually:
// 1. Download from: plugins.jetbrains.com/plugin/claw-ai-safety
// 2. Settings > Plugins > Install Plugin from Disk

// The plugin supports:
// - IntelliJ IDEA (Ultimate & Community)
// - PyCharm (Professional & Community)
// - WebStorm
// - Android Studio
// - All other IntelliJ-based IDEs

// Configuration (Settings > Tools > GuardianClaw):
// - Enable/disable inspections
// - Set severity levels
// - Configure inspection profiles
// - Customize quick fix behavior`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Native IntelliJ integration with the inspection system you know and love.
            </p>
          </div>
        </div>

        {/* Supported IDEs */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Supported IDEs</h2>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <p className="font-semibold text-orange-500">IntelliJ IDEA</p>
              <p className="text-muted-foreground mt-1 text-xs">Java, Kotlin, Scala</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <p className="font-semibold text-orange-500">PyCharm</p>
              <p className="text-muted-foreground mt-1 text-xs">Python</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <p className="font-semibold text-orange-500">WebStorm</p>
              <p className="text-muted-foreground mt-1 text-xs">JavaScript, TypeScript</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <p className="font-semibold text-orange-500">Android Studio</p>
              <p className="text-muted-foreground mt-1 text-xs">Android, Kotlin</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Features</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">Native Inspections</h3>
              <p className="text-muted-foreground text-sm">
                Integrates with JetBrains inspection system for consistent experience.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">Lightbulb Actions</h3>
              <p className="text-muted-foreground text-sm">
                Quick fixes appear in the familiar lightbulb menu (Alt+Enter).
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">Inspection Profiles</h3>
              <p className="text-muted-foreground text-sm">
                Configure severity and limits using standard inspection profiles.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-orange-500">Multi-language</h3>
              <p className="text-muted-foreground text-sm">
                Supports Kotlin, Java, Python, JavaScript, and TypeScript.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="/docs/integrations/jetbrains"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 font-medium text-white transition-colors hover:bg-orange-600"
            >
              Read Full Documentation
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="https://plugins.jetbrains.com/plugin/claw-ai-safety"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Install Plugin
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
