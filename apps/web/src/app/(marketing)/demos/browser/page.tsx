import { Metadata } from 'next'
import { BrowserExtensionDemo } from '@/components/demos/browser-extension-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Browser Extension Demo | GuardianClaw',
  description:
    'Interactive demonstration of how GuardianClaw validates prompts directly in ChatGPT, Claude, and other AI chat platforms.',
}

export default function BrowserExtensionDemoPage() {
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
                href="/docs/integrations/browser"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-extension"
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
        <BrowserExtensionDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Site detection</h3>
                <p className="text-muted-foreground text-sm">
                  The extension automatically detects when you're on ChatGPT, Claude, Gemini, or
                  other supported AI platforms.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Prompt capture</h3>
                <p className="text-muted-foreground text-sm">
                  When you type in the chat input, GuardianClaw captures your prompt in real-time
                  for analysis.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-500">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Pattern analysis</h3>
                <p className="text-muted-foreground text-sm">
                  Your prompt is scanned against 700+ known injection patterns, jailbreak attempts,
                  and manipulation tactics.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Action decision</h3>
                <p className="text-muted-foreground text-sm">
                  Safe prompts are allowed through. Suspicious prompts trigger a warning with
                  options to edit or proceed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Supported Platforms</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <div className="mb-2 text-3xl">🤖</div>
              <h3 className="mb-1 font-semibold text-[#10A37F]">ChatGPT</h3>
              <p className="text-muted-foreground text-sm">chat.openai.com</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <div className="mb-2 text-3xl">🧠</div>
              <h3 className="mb-1 font-semibold text-[#D97757]">Claude</h3>
              <p className="text-muted-foreground text-sm">claude.ai</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
              <div className="mb-2 text-3xl">✨</div>
              <h3 className="mb-1 font-semibold text-[#4285F4]">Gemini</h3>
              <p className="text-muted-foreground text-sm">gemini.google.com</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Features</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">Real-time Scanning</h3>
              <p className="text-muted-foreground text-sm">
                Prompts are analyzed as you type, with instant feedback on potential risks.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">Pattern Highlighting</h3>
              <p className="text-muted-foreground text-sm">
                Suspicious patterns are visually highlighted in your prompt for easy identification.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">Non-blocking Warnings</h3>
              <p className="text-muted-foreground text-sm">
                Warnings don't prevent you from sending - you can always choose to proceed if
                needed.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-blue-500">Privacy First</h3>
              <p className="text-muted-foreground text-sm">
                All analysis happens locally in your browser. No prompts are sent to external
                servers.
              </p>
            </div>
          </div>
        </div>

        {/* Installation */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Installation</h2>

          <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-400">
            Chrome Web Store listing coming soon. For now, install via development build from{' '}
            <Link
              href="https://github.com/guardianclaw/guardianclaw-extension"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-300"
            >
              GitHub
            </Link>
            .
          </div>

          <div className="rounded-xl bg-zinc-950 p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-500">
                  1
                </div>
                <div>
                  <p className="text-sm text-zinc-300">
                    Visit the Chrome Web Store and search for "GuardianClaw AI Safety"
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-500">
                  2
                </div>
                <div>
                  <p className="text-sm text-zinc-300">
                    Click "Add to Chrome" to install the extension
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-500">
                  3
                </div>
                <div>
                  <p className="text-sm text-zinc-300">
                    Navigate to ChatGPT, Claude, or Gemini - the extension activates automatically
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-xs font-bold text-green-500">
                  ✓
                </div>
                <div>
                  <p className="text-sm text-zinc-300">
                    Start chatting with confidence - GuardianClaw protects your prompts in real-time
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600"
            >
              Chrome Web Store (Coming Soon)
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="/docs/integrations/browser"
              className="bg-muted hover:bg-muted/80 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
