'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { integrations, categories, type IntegrationCategory } from '@/lib/integrations'
import { cn } from '@/lib/utils'

// Get a representative set of integrations for the carousel
const featuredIntegrations = [
  'openai',
  'anthropic',
  'solana-agent-kit',
  'mcp',
  'elizaos',
  'coinbase',
  'garak',
  'jetbrains',
  'huggingface',
  'google-adk',
  'virtuals',
  'openguardrails',
]

const integrationLogos = featuredIntegrations
  .map((slug) => integrations.find((i) => i.slug === slug))
  .filter(Boolean)

// Duplicate for infinite scroll effect
const duplicatedLogos = [...integrationLogos, ...integrationLogos]

export function IntegrationsCarousel() {
  return (
    <section className="overflow-hidden py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Works With Your Stack</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            17 integrations with popular frameworks, LLM providers, and platforms. Add safety to any
            AI system in minutes.
          </p>
        </motion.div>

        {/* Scrolling Logo Carousel */}
        <div className="relative">
          {/* Gradient masks */}
          <div className="from-background absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r to-transparent" />
          <div className="from-background absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l to-transparent" />

          {/* Scrolling container */}
          <motion.div
            className="flex gap-8 py-8"
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              duration: 30,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {duplicatedLogos.map((integration, index) => (
              <div
                key={`${integration?.slug}-${index}`}
                className="bg-background hover:border-claw-500/30 group flex h-28 w-40 flex-shrink-0 items-center justify-center rounded-xl border p-4 transition-colors"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  {integration?.logoUrl && (
                    <Image
                      src={integration.logoUrl}
                      alt={integration.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                      loading="lazy"
                      unoptimized
                    />
                  )}
                  <div>
                    <div className="group-hover:text-claw-500 text-sm font-medium transition-colors">
                      {integration?.name}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {getCategoryLabel(integration?.category as IntegrationCategory)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Category Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 flex flex-wrap justify-center gap-3"
        >
          {categories.map((category) => {
            const count = integrations.filter((i) => i.category === category.id).length
            return (
              <Link
                key={category.id}
                href={`/integrations?category=${category.id}`}
                className="bg-background hover:bg-muted inline-flex items-center gap-2 rounded-full border px-4 py-2 transition-colors"
              >
                <span className="text-sm font-medium">{category.name}</span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                  {count}
                </span>
              </Link>
            )
          })}
        </motion.div>

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <Link
            href="/integrations"
            className="bg-muted hover:bg-muted/80 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            Explore all integrations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

function getCategoryLabel(category: IntegrationCategory): string {
  const labels: Record<IntegrationCategory, string> = {
    frameworks: 'Framework',
    'llm-providers': 'LLM Provider',
    crypto: 'Crypto',
    security: 'Security',
    ides: 'IDE',
    platforms: 'Platform',
  }
  return labels[category] || category
}
