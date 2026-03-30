/**
 * Whitepaper Page - Single-page technical whitepaper
 *
 * Presents the GuardianClaw Whitepaper v2.0 in a unified, scrollable format
 * with interactive navigation and animated diagrams.
 *
 * This Server Component handles metadata/SEO only.
 * All interactive content is rendered by WhitepaperPageContent (Client Component).
 */

import type { Metadata } from 'next'
import { WhitepaperPageContent } from '@/components/whitepaper'

/**
 * Base URL for metadata
 */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://guardianclaw.org'

/**
 * Page metadata for SEO
 */
export const metadata: Metadata = {
  title: 'Whitepaper v2.0 | GuardianClaw - The Decision Firewall for AI Agents',
  description:
    "Technical whitepaper detailing GuardianClaw's 4-layer validation architecture, CLAW protocol, Memory Shield v2.0, and comprehensive security framework for autonomous AI systems. 97.6% safety rate across 6+ models.",
  keywords: [
    'AI safety',
    'AI security',
    'autonomous agents',
    'decision firewall',
    'CLAW protocol',
    'GuardianClaw',
    'LLM security',
    'AI alignment',
    'memory injection',
    'prompt injection',
    'AI guardrails',
    'agent safety',
  ],
  authors: [{ name: 'GuardianClaw Team', url: 'https://guardianclaw.org' }],
  creator: 'GuardianClaw Team',
  publisher: 'GuardianClaw',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: `${BASE_URL}/whitepaper`,
  },
  openGraph: {
    title: 'GuardianClaw Whitepaper v2.0 - The Decision Firewall for AI Agents',
    description:
      'Comprehensive technical whitepaper on AI agent security. 4-layer architecture, CLAW protocol, Memory Shield v2.0, 97.6% validated safety rate.',
    type: 'article',
    url: `${BASE_URL}/whitepaper`,
    siteName: 'GuardianClaw',
    locale: 'en_US',
    publishedTime: '2026-01-26T00:00:00.000Z',
    modifiedTime: '2026-01-26T00:00:00.000Z',
    section: 'Technology',
    tags: ['AI Safety', 'AI Security', 'Autonomous Agents', 'LLM Security', 'CLAW Protocol'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuardianClaw Whitepaper v2.0',
    description: 'The Decision Firewall for AI Agents - Technical Whitepaper',
    site: '@guardianclaw_',
    creator: '@guardianclaw_',
  },
}

/**
 * JSON-LD structured data for SEO
 * Note: This is safe static content, not user input
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'GuardianClaw Whitepaper v2.0 - The Decision Firewall for AI Agents',
  description:
    "Technical whitepaper detailing GuardianClaw's 4-layer validation architecture, CLAW protocol, and comprehensive security framework for autonomous AI systems.",
  author: {
    '@type': 'Organization',
    name: 'GuardianClaw Team',
    url: 'https://guardianclaw.org',
  },
  publisher: {
    '@type': 'Organization',
    name: 'GuardianClaw',
    url: 'https://guardianclaw.org',
  },
  datePublished: '2026-01-26',
  dateModified: '2026-01-26',
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': `${BASE_URL}/whitepaper`,
  },
  articleSection: 'Technology',
  keywords:
    'AI safety, AI security, autonomous agents, decision firewall, CLAW protocol, LLM security',
  about: [
    { '@type': 'Thing', name: 'Artificial Intelligence Safety' },
    { '@type': 'Thing', name: 'AI Security' },
    { '@type': 'Thing', name: 'Autonomous Agents' },
  ],
  proficiencyLevel: 'Expert',
  technicalAudience: 'Developers, AI Engineers, Security Researchers',
}

/**
 * Whitepaper Page Component
 *
 * Server Component that provides metadata and renders the client component.
 * All navigation and section data is handled within WhitepaperPageContent.
 */
export default function WhitepaperPage() {
  return (
    <>
      {/* JSON-LD Structured Data - static content, safe to use */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Client component handles all interactive content */}
      <WhitepaperPageContent />
    </>
  )
}
