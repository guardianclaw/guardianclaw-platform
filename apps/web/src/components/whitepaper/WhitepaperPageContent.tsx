/**
 * WhitepaperPageContent - Client component for whitepaper page rendering
 *
 * This component handles all the client-side rendering of the whitepaper,
 * including the section content which contains React function components.
 *
 * Separated from the page.tsx to allow the page to remain a Server Component
 * for proper metadata handling while this component handles the interactive content.
 *
 * Navigation items and section configs are defined here (not in page.tsx) because
 * they contain Lucide icon components which cannot be serialized across the
 * Server/Client component boundary.
 */

'use client'

import type { ReactNode } from 'react'
import {
  Shield,
  AlertTriangle,
  Layers,
  Package,
  CheckCircle,
  Cpu,
  BarChart3,
  GitFork,
  Trophy,
  Coins,
  Users,
  FlaskConical,
  Heart,
  BookOpen,
  FileText,
} from 'lucide-react'
import {
  WhitepaperLayout,
  WhitepaperHeader,
  WhitepaperSection,
  WhitepaperDivider,
  sectionContent,
} from '@/components/whitepaper'
import type { WhitepaperNavItem, WhitepaperSectionConfig } from '@/components/whitepaper'

/**
 * Navigation items for the table of contents
 */
const NAV_ITEMS: WhitepaperNavItem[] = [
  { id: 'executive-summary', title: 'Executive Summary', level: 1, icon: FileText },
  { id: 'the-problem', title: 'The Problem', level: 1, icon: AlertTriangle },
  { id: 'security-gap', title: 'Security Gap', level: 2 },
  { id: 'attack-vectors', title: 'Attack Vectors', level: 2 },
  { id: 'architecture', title: 'Technical Architecture', level: 1, icon: Layers },
  { id: 'claw-protocol', title: 'CLAW Protocol', level: 2 },
  { id: 'four-layer', title: '4-Layer Validation', level: 2 },
  { id: 'teleological-core', title: 'Teleological Core', level: 2 },
  { id: 'products', title: 'Core Products', level: 1, icon: Package },
  { id: 'memory-shield', title: 'Memory Shield v2', level: 2 },
  { id: 'database-guard', title: 'Database Guard', level: 2 },
  { id: 'transaction-simulator', title: 'Transaction Simulator', level: 2 },
  { id: 'fiduciary-ai', title: 'Fiduciary AI', level: 2 },
  { id: 'compliance', title: 'Universal Compliance', level: 1, icon: CheckCircle },
  { id: 'platform', title: 'GuardianClaw Platform', level: 1, icon: Cpu },
  { id: 'validation', title: 'Validation & Results', level: 1, icon: BarChart3 },
  { id: 'integrations', title: 'Integration Ecosystem', level: 1, icon: GitFork },
  { id: 'competitive', title: 'Competitive Analysis', level: 1, icon: Trophy },
  { id: 'token', title: 'Token Utility', level: 1, icon: Coins },
  { id: 'governance', title: 'Governance', level: 1, icon: Users },
  { id: 'research', title: 'Research Agenda', level: 1, icon: FlaskConical },
  { id: 'team', title: 'Team & Community', level: 1, icon: Heart },
  { id: 'conclusion', title: 'Conclusion', level: 1, icon: Shield },
  { id: 'references', title: 'References', level: 1, icon: BookOpen },
]

/**
 * Section configurations
 */
const SECTIONS: WhitepaperSectionConfig[] = [
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    subtitle: 'Overview of GuardianClaw and key technical innovations',
    icon: FileText,
    order: 1,
  },
  {
    id: 'the-problem',
    title: 'The Problem',
    subtitle: 'Understanding the critical security gap in autonomous AI agents',
    icon: AlertTriangle,
    order: 2,
  },
  {
    id: 'architecture',
    title: 'Technical Architecture',
    subtitle: 'CLAW Protocol and 4-Layer validation system',
    icon: Layers,
    order: 3,
  },
  {
    id: 'products',
    title: 'Core Products',
    subtitle: 'Memory Shield, Database Guard, Transaction Simulator, and more',
    icon: Package,
    order: 4,
  },
  {
    id: 'compliance',
    title: 'Universal Compliance',
    subtitle: 'EU AI Act, OWASP LLM/Agentic, CSA Matrix coverage',
    icon: CheckCircle,
    order: 5,
  },
  {
    id: 'platform',
    title: 'GuardianClaw Platform',
    subtitle: 'Agent Builder, Flow Builder, and Deploy system',
    icon: Cpu,
    order: 6,
  },
  {
    id: 'validation',
    title: 'Validation & Results',
    subtitle: 'Benchmark performance across 6+ models and 4 test suites',
    icon: BarChart3,
    order: 7,
  },
  {
    id: 'integrations',
    title: 'Integration Ecosystem',
    subtitle: '17 framework integrations across all AI domains',
    icon: GitFork,
    order: 8,
  },
  {
    id: 'competitive',
    title: 'Competitive Analysis',
    subtitle: 'Market positioning and differentiation',
    icon: Trophy,
    order: 9,
  },
  {
    id: 'token',
    title: 'Token Utility',
    subtitle: '$GCLAW token governance and platform benefits',
    icon: Coins,
    order: 10,
  },
  {
    id: 'governance',
    title: 'Governance',
    subtitle: 'Decentralized protocol governance',
    icon: Users,
    order: 11,
  },
  {
    id: 'research',
    title: 'Research Agenda',
    subtitle: 'Active research areas and open questions',
    icon: FlaskConical,
    order: 12,
  },
  {
    id: 'team',
    title: 'Team & Community',
    subtitle: 'Open source contributors and community channels',
    icon: Heart,
    order: 13,
  },
  {
    id: 'conclusion',
    title: 'Conclusion',
    subtitle: 'Summary and call to action',
    icon: Shield,
    order: 14,
  },
  {
    id: 'references',
    title: 'References',
    subtitle: 'Citations, standards, and resources',
    icon: BookOpen,
    order: 15,
  },
]

/**
 * Helper to get section content component by id
 */
function getSectionContent(id: string): ReactNode {
  const ContentComponent = sectionContent[id]
  if (ContentComponent) {
    return <ContentComponent />
  }
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center text-zinc-500">
      <p>Content for this section is being prepared.</p>
    </div>
  )
}

/**
 * WhitepaperPageContent - Client-side whitepaper content renderer
 *
 * Uses internally defined NAV_ITEMS and SECTIONS constants.
 * No props needed - all configuration is self-contained.
 */
export function WhitepaperPageContent() {
  return (
    <WhitepaperLayout
      navItems={NAV_ITEMS}
      title="GuardianClaw Whitepaper"
      description="Technical Documentation v2.0"
    >
      {/* Header */}
      <WhitepaperHeader
        title="GCLAW"
        subtitle="The Decision Firewall for AI Agents"
        version="v2.0"
        lastUpdated="January 2026"
      />

      {/* All sections rendered dynamically */}
      {SECTIONS.map((section, index) => (
        <div key={section.id}>
          <WhitepaperSection config={section}>{getSectionContent(section.id)}</WhitepaperSection>
          {index < SECTIONS.length - 1 && <WhitepaperDivider />}
        </div>
      ))}
    </WhitepaperLayout>
  )
}

export default WhitepaperPageContent
