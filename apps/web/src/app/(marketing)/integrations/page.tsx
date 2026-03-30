'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, X, ExternalLink, Check, Copy, Play } from 'lucide-react'
import {
  integrations,
  categories,
  type IntegrationCategory,
  type Integration,
} from '@/lib/integrations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export default function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all')
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const filteredIntegrations = useMemo(() => {
    return integrations.filter((integration) => {
      const matchesSearch =
        searchQuery === '' ||
        integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        integration.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory =
        selectedCategory === 'all' || integration.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [searchQuery, selectedCategory])

  const handleCopyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(true)
    setTimeout(() => setCopiedCommand(false), 2000)
  }

  return (
    <div className="py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-6 text-4xl font-bold sm:text-5xl">Integrations</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Add AI safety to your stack in minutes. 17 integrations with popular frameworks, LLM
            providers, and platforms.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mx-auto mb-12 max-w-4xl">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="text-muted-foreground absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background focus:ring-claw-500 w-full rounded-xl border py-4 pl-12 pr-12 text-lg focus:border-transparent focus:outline-none focus:ring-2"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="hover:bg-muted absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1"
              >
                <X className="text-muted-foreground h-5 w-5" />
              </button>
            )}
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                selectedCategory === 'all'
                  ? 'bg-claw-600 text-white'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              )}
            >
              All ({integrations.length})
            </button>
            {categories.map((category) => {
              const count = integrations.filter((i) => i.category === category.id).length
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    selectedCategory === category.id
                      ? 'bg-claw-600 text-white'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  )}
                >
                  {category.name} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="text-muted-foreground mb-8 text-center text-sm">
          Showing {filteredIntegrations.length} of {integrations.length} integrations
        </div>

        {/* Integrations Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredIntegrations.map((integration) => (
            <button
              key={integration.slug}
              onClick={() => setSelectedIntegration(integration)}
              className="bg-background hover:border-claw-500/30 group rounded-xl border p-6 text-left transition-all hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {integration.logoUrl && (
                    <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <Image
                        src={integration.logoUrl}
                        alt={integration.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                        style={{ filter: 'brightness(0) invert(0.7)' }}
                        loading="lazy"
                        unoptimized
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="group-hover:text-claw-500 font-semibold transition-colors">
                      {integration.name}
                    </h3>
                    <span
                      className={cn(
                        'mt-1 inline-block rounded-full px-2 py-0.5 text-xs',
                        integration.status === 'stable' &&
                          'bg-claw-500/10 text-claw-600 dark:text-claw-400',
                        integration.status === 'beta' &&
                          'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                        integration.status === 'coming' &&
                          'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                      )}
                    >
                      {integration.status}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {integration.description}
              </p>
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredIntegrations.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-muted-foreground mb-4 text-lg">
              No integrations found matching your criteria.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
              }}
            >
              Clear filters
            </Button>
          </div>
        )}

        {/* Integration Detail Modal */}
        <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
          <DialogContent className="max-w-2xl">
            {selectedIntegration && (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {selectedIntegration.logoUrl && (
                        <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                          <Image
                            src={selectedIntegration.logoUrl}
                            alt={selectedIntegration.name}
                            width={28}
                            height={28}
                            className="h-7 w-7 object-contain"
                            style={{ filter: 'brightness(0) invert(0.7)' }}
                            unoptimized
                          />
                        </div>
                      )}
                      <div>
                        <DialogTitle className="mb-2 text-2xl">
                          {selectedIntegration.name}
                        </DialogTitle>
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs',
                            selectedIntegration.status === 'stable' &&
                              'bg-claw-500/10 text-claw-600',
                            selectedIntegration.status === 'beta' &&
                              'bg-yellow-500/10 text-yellow-600',
                            selectedIntegration.status === 'coming' &&
                              'bg-gray-500/10 text-gray-600'
                          )}
                        >
                          {selectedIntegration.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Description */}
                  <p className="text-muted-foreground">{selectedIntegration.description}</p>

                  {/* Install Command */}
                  {selectedIntegration.installCommand && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">Installation</h4>
                      <div className="flex items-center gap-2 rounded-lg bg-gray-950 p-3 font-mono text-sm">
                        <code className="flex-1 text-gray-300">
                          {selectedIntegration.installCommand}
                        </code>
                        <button
                          onClick={() => handleCopyCommand(selectedIntegration.installCommand!)}
                          className="rounded p-2 transition-colors hover:bg-gray-800"
                        >
                          {copiedCommand ? (
                            <Check className="text-claw-500 h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Start */}
                  {selectedIntegration.quickStart && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">Quick Start</h4>
                      <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4">
                        <code className="whitespace-pre font-mono text-sm text-gray-300">
                          {selectedIntegration.quickStart}
                        </code>
                      </pre>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    {selectedIntegration.demoUrl && (
                      <Button asChild className="bg-amber-500 hover:bg-amber-600">
                        <Link href={selectedIntegration.demoUrl}>
                          <Play className="mr-2 h-4 w-4" />
                          View Demo
                        </Link>
                      </Button>
                    )}
                    {selectedIntegration.docsUrl && (
                      <Button asChild variant={selectedIntegration.demoUrl ? 'outline' : 'default'}>
                        <Link href={selectedIntegration.docsUrl}>
                          View Documentation
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setSelectedIntegration(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* CTA */}
        <div className="mt-16 border-t pt-16 text-center">
          <h2 className="mb-4 text-2xl font-bold">Don't see your framework?</h2>
          <p className="text-muted-foreground mx-auto mb-6 max-w-md">
            We're constantly adding new integrations. Request one or contribute your own.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline" asChild>
              <a
                href="https://github.com/guardianclaw/guardianclaw-platform/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Request Integration
              </a>
            </Button>
            <Button asChild>
              <Link href="/docs/guides/contributing">Contribute</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
