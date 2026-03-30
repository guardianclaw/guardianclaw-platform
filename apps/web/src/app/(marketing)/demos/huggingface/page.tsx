import { Metadata } from 'next'
import { HuggingFaceDemo } from '@/components/demos/huggingface-demo'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Github } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Hugging Face Integration Demo | GuardianClaw',
  description:
    'Interactive demonstration of how to load and use pre-built alignment seeds from Hugging Face Hub.',
}

export default function HuggingFaceDemoPage() {
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
                href="https://huggingface.co/datasets/guardianclaw/alignment-seeds"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
              >
                View on Hub
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="https://github.com/guardianclaw/guardianclaw-platform/tree/main/seeds"
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
        <HuggingFaceDemo />

        {/* How It Works */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">How It Works</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFD21E]/20 text-sm font-bold text-[#FFD21E]">
                1
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Browse the repository</h3>
                <p className="text-muted-foreground text-sm">
                  Navigate to the guardianclaw/alignment-seeds dataset on Hugging Face Hub to find
                  pre-built safety seeds.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFD21E]/20 text-sm font-bold text-[#FFD21E]">
                2
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Choose your protection level</h3>
                <p className="text-muted-foreground text-sm">
                  Select from minimal, standard (recommended), or full protection seeds based on
                  your security needs.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFD21E]/20 text-sm font-bold text-[#FFD21E]">
                3
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Load with the datasets library</h3>
                <p className="text-muted-foreground text-sm">
                  Use the Hugging Face datasets library to load seeds programmatically with just a
                  few lines of Python.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20 text-sm font-bold text-green-500">
                4
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Apply to your model</h3>
                <p className="text-muted-foreground text-sm">
                  Inject the seed into your system prompt to enable safety validation with 700+
                  attack patterns.
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
              <code>{`from datasets import load_dataset
from openai import OpenAI

# Load alignment seeds from Hugging Face Hub
seeds = load_dataset("guardianclaw/alignment-seeds")

# Choose protection level: minimal (0), standard (1), or full (2)
seed = seeds['train'][1]['content']  # standard seed

# Create protected client
client = OpenAI()

# Apply seed to system prompt
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": seed + "\\n" + your_system_prompt},
        {"role": "user", "content": user_input}
    ]
)

# The seed automatically validates inputs and outputs`}</code>
            </pre>
          </div>

          <div className="mt-4 text-center">
            <p className="text-muted-foreground text-sm">
              Add enterprise-grade safety to any model with pre-built alignment seeds.
            </p>
          </div>
        </div>

        {/* Seed Levels */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="mb-6 text-center text-2xl font-bold">Available Seeds</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-zinc-300">minimal.txt</h3>
              <p className="text-muted-foreground mb-3 text-sm">
                Basic safety constraints for lightweight protection.
              </p>
              <div className="text-xs text-zinc-500">
                <p>45 lines | 2.1 KB</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#FFD21E]/30 bg-[#FFD21E]/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-semibold text-[#FFD21E]">standard.txt</h3>
                <span className="rounded bg-[#FFD21E]/20 px-1.5 py-0.5 text-xs text-[#FFD21E]">
                  Recommended
                </span>
              </div>
              <p className="text-muted-foreground mb-3 text-sm">
                Balanced protection for most use cases.
              </p>
              <div className="text-xs text-zinc-500">
                <p>180 lines | 8.4 KB</p>
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-2 font-semibold text-zinc-300">full.txt</h3>
              <p className="text-muted-foreground mb-3 text-sm">
                Maximum protection with 700+ attack patterns.
              </p>
              <div className="text-xs text-zinc-500">
                <p>520 lines | 24.2 KB</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col gap-4 sm:flex-row">
            <Link
              href="https://huggingface.co/datasets/guardianclaw/alignment-seeds"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFD21E] px-6 py-3 font-medium text-black transition-colors hover:bg-[#FFD21E]/90"
            >
              View on Hugging Face
              <ExternalLink className="h-4 w-4" />
            </Link>
            <Link
              href="/docs/api/seeds"
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
