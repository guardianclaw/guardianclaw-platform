import type { Metadata } from 'next'
import Link from 'next/link'
import { Rocket, Shield, Zap, Package, Bug, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Version history and release notes for GuardianClaw Platform',
}

interface Release {
  version: string
  date: string
  tag: 'latest' | 'beta' | 'alpha' | 'security'
  title: string
  description: string
  changes: Array<{
    type: 'added' | 'improved' | 'fixed' | 'security' | 'breaking'
    description: string
  }>
}

const RELEASES: Release[] = [
  {
    version: '1.0.0',
    date: '2026-01-06',
    tag: 'latest',
    title: 'Platform Launch',
    description: 'The official launch of GuardianClaw Platform with full feature set.',
    changes: [
      { type: 'added', description: 'Visual agent builder with drag-and-drop canvas' },
      { type: 'added', description: 'Node types: Trigger, LLM, GuardianClaw, Tool, Output' },
      { type: 'added', description: 'One-click deployment to cloud runtime' },
      { type: 'added', description: 'API key management for agent invocation' },
      { type: 'added', description: 'Interactive security demos' },
      { type: 'added', description: 'Governance portal with proposal voting' },
      { type: 'added', description: '17 integrations with popular frameworks' },
      { type: 'added', description: 'Complete documentation site' },
      { type: 'security', description: 'CLAW v2 protocol with Worth gate' },
      { type: 'security', description: 'Memory Shield for conversation integrity' },
      { type: 'security', description: 'Database Guard for SQL injection prevention' },
      { type: 'security', description: 'Wallet-based authentication' },
    ],
  },
  {
    version: '0.9.0',
    date: '2025-12-15',
    tag: 'beta',
    title: 'Public Beta',
    description: 'Beta release for early adopters and community testing.',
    changes: [
      { type: 'added', description: 'Core validation engine' },
      { type: 'added', description: 'Python SDK with OpenAI Agents SDK support' },
      { type: 'added', description: 'Basic API endpoints' },
      { type: 'improved', description: 'Pattern matching performance' },
      { type: 'fixed', description: 'Memory leaks in long-running agents' },
    ],
  },
  {
    version: '0.5.0',
    date: '2025-10-01',
    tag: 'alpha',
    title: 'Alpha Preview',
    description: 'Initial proof of concept for internal testing.',
    changes: [
      { type: 'added', description: 'CLAW v1 protocol implementation' },
      { type: 'added', description: 'Basic pattern matching (200+ patterns)' },
      { type: 'added', description: 'CLI testing tool' },
      { type: 'added', description: 'Initial documentation' },
    ],
  },
]

const tagStyles = {
  latest: 'bg-claw-500/10 text-claw-500 border-claw-500/20',
  beta: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  alpha: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  security: 'bg-red-500/10 text-red-500 border-red-500/20',
}

const changeTypeConfig = {
  added: { icon: Sparkles, color: 'text-claw-500', label: 'Added' },
  improved: { icon: Zap, color: 'text-blue-500', label: 'Improved' },
  fixed: { icon: Bug, color: 'text-yellow-500', label: 'Fixed' },
  security: { icon: Shield, color: 'text-red-500', label: 'Security' },
  breaking: { icon: Package, color: 'text-orange-500', label: 'Breaking' },
}

export default function ChangelogPage() {
  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-border border-b">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="text-claw-500 mb-4 flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            <span className="text-sm font-medium">Release Notes</span>
          </div>
          <h1 className="text-foreground mb-4 text-4xl font-bold">Changelog</h1>
          <p className="text-muted-foreground max-w-2xl text-xl">
            Track the evolution of GuardianClaw Platform. New features, improvements, and fixes in
            every release.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Subscribe */}
        <div className="bg-card/50 border-border mb-12 rounded-lg border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-foreground mb-1 font-medium">Stay up to date</h3>
              <p className="text-muted-foreground text-sm">
                Get notified when we release new versions
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="https://github.com/guardianclaw/guardianclaw-platform/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-muted hover:bg-muted/80 text-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors"
              >
                GitHub Releases
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/docs/changelog"
                className="bg-claw-500 hover:bg-claw-600 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white transition-colors"
              >
                Full Changelog
              </Link>
            </div>
          </div>
        </div>

        {/* Releases timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="bg-border absolute bottom-0 left-4 top-0 w-px sm:left-1/2 sm:-ml-px" />

          {RELEASES.map((release, index) => (
            <div key={release.version} className="relative mb-12 last:mb-0">
              {/* Timeline dot */}
              <div
                className={cn(
                  'bg-background absolute left-4 -ml-2 h-4 w-4 rounded-full border-2',
                  'sm:left-1/2',
                  index === 0 ? 'border-claw-500' : 'border-border'
                )}
              />

              {/* Date badge (visible on large screens) */}
              <div className="absolute left-0 hidden w-[calc(50%-2rem)] pr-8 text-right sm:block">
                <span className="text-muted-foreground text-sm">{release.date}</span>
              </div>

              {/* Content */}
              <div className="ml-12 sm:ml-[calc(50%+2rem)]">
                {/* Version header */}
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <h2 className="text-foreground text-2xl font-bold">v{release.version}</h2>
                  <span
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs font-medium',
                      tagStyles[release.tag]
                    )}
                  >
                    {release.tag.toUpperCase()}
                  </span>
                  <span className="text-muted-foreground text-sm sm:hidden">{release.date}</span>
                </div>

                {/* Title and description */}
                <h3 className="text-foreground mb-2 text-lg font-medium">{release.title}</h3>
                <p className="text-muted-foreground mb-4">{release.description}</p>

                {/* Changes list */}
                <div className="bg-card/50 border-border overflow-hidden rounded-lg border">
                  {release.changes.map((change, changeIndex) => {
                    const config = changeTypeConfig[change.type]
                    const Icon = config.icon

                    return (
                      <div
                        key={changeIndex}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3',
                          changeIndex !== release.changes.length - 1 && 'border-border/50 border-b'
                        )}
                      >
                        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', config.color)} />
                        <div className="min-w-0 flex-1">
                          <span className="text-foreground/90">{change.description}</span>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded px-2 py-0.5 text-xs font-medium',
                            config.color,
                            'bg-current/10'
                          )}
                        >
                          {config.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-border mt-16 border-t pt-8 text-center">
          <p className="text-muted-foreground mb-4">Looking for older releases?</p>
          <a
            href="https://github.com/guardianclaw/guardianclaw-platform/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-claw-500 hover:text-claw-400"
          >
            View all releases on GitHub →
          </a>
        </div>
      </div>
    </div>
  )
}
