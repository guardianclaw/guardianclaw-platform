/**
 * Documentation Navigation Structure
 *
 * Defines the sidebar navigation hierarchy for documentation.
 * This file contains ONLY the navigation structure - content is loaded from MDX files.
 *
 * To add a new page:
 * 1. Create the .mdx file in content/docs/
 * 2. Add an entry here in the appropriate section
 * 3. The slug must match the file path (e.g., 'integrations/voltagent' -> content/docs/integrations/voltagent.mdx)
 */

import type { DocSection } from './types'

/**
 * Main documentation navigation structure.
 * Order of sections and items determines display order in sidebar.
 */
export const docsNavigation: DocSection[] = [
  {
    title: 'Getting Started',
    items: [
      {
        slug: 'introduction',
        title: 'Introduction',
        description: 'What is GuardianClaw and why you need it',
      },
      {
        slug: 'installation',
        title: 'Installation',
        description: 'Install GuardianClaw in your project',
      },
      {
        slug: 'quick-start',
        title: 'Quick Start',
        description: 'Get up and running in 5 minutes',
      },
      {
        slug: 'concepts',
        title: 'Core Concepts',
        description: 'Understanding the CLAW protocol',
      },
    ],
  },
  // Note: Full whitepaper is now at /whitepaper (single-page with React components)
  // Legacy MDX pages redirect to the new location
  {
    title: 'Products',
    items: [
      {
        slug: 'products/memory-shield',
        title: 'Memory Shield',
        description: 'Tamper-proof conversation history',
      },
      {
        slug: 'products/database-guard',
        title: 'Database Guard',
        description: 'SQL injection prevention',
      },
      {
        slug: 'products/humanoid-safety',
        title: 'Humanoid Safety',
        description: 'Physical world constraints',
      },
      {
        slug: 'products/fiduciary-ai',
        title: 'Fiduciary AI',
        description: 'Financial regulation compliance',
      },
      {
        slug: 'products/transaction-simulator',
        title: 'Transaction Simulator',
        description: 'Validate Solana transactions before execution',
      },
    ],
  },
  {
    title: 'Agent Frameworks',
    items: [
      {
        slug: 'integrations/voltagent',
        title: 'VoltAgent',
        description: 'TypeScript agent guardrails',
      },
      {
        slug: 'integrations/elizaos',
        title: 'ElizaOS',
        description: 'Autonomous agent safety plugin',
      },
      {
        slug: 'integrations/openclaw',
        title: 'OpenClaw',
        description: 'Security guardrails for OpenClaw agents',
      },
    ],
  },
  {
    title: 'LLM Providers',
    items: [
      {
        slug: 'integrations/openai-agents',
        title: 'OpenAI Agents SDK',
        description: 'Semantic guardrails for GPT agents',
      },
      {
        slug: 'integrations/anthropic',
        title: 'Anthropic SDK',
        description: 'Claude model validation',
      },
      {
        slug: 'integrations/google-adk',
        title: 'Google ADK',
        description: 'Gemini agent validation',
      },
    ],
  },
  {
    title: 'Blockchain & DeFi',
    items: [
      {
        slug: 'integrations/solana-agent-kit',
        title: 'Solana Agent Kit',
        description: 'Solana transaction safety',
      },
      {
        slug: 'integrations/coinbase',
        title: 'Coinbase AgentKit',
        description: 'Blockchain agent safety',
      },
      {
        slug: 'integrations/virtuals',
        title: 'Virtuals Protocol',
        description: 'On-chain AI agent validation',
      },
    ],
  },
  {
    title: 'Security Tools',
    items: [
      {
        slug: 'integrations/garak',
        title: 'garak',
        description: 'LLM vulnerability scanning',
      },
      {
        slug: 'integrations/pyrit',
        title: 'PyRIT',
        description: 'Red teaming automation',
      },
      {
        slug: 'integrations/openguardrails',
        title: 'OpenGuardrails',
        description: 'Alternative guardrail system',
      },
      {
        slug: 'integrations/mcp',
        title: 'MCP Server',
        description: 'Model Context Protocol safety',
      },
      {
        slug: 'integrations/eu-ai-act',
        title: 'EU AI Act',
        description: 'Compliance checker for EU AI Act',
      },
      {
        slug: 'integrations/promptfoo',
        title: 'Promptfoo',
        description: 'Red team testing with CLAW protocol',
      },
    ],
  },
  {
    title: 'Developer Tools',
    items: [
      {
        slug: 'integrations/jetbrains',
        title: 'JetBrains',
        description: 'AI safety for IntelliJ, PyCharm, WebStorm',
      },
      {
        slug: 'integrations/browser',
        title: 'Browser Extension',
        description: 'Protect AI conversations in browser',
      },
    ],
  },
  {
    title: 'API Reference',
    items: [
      {
        slug: 'api/validation',
        title: 'Validation',
        description: 'Core validation API',
      },
      {
        slug: 'api/seeds',
        title: 'Seeds',
        description: 'Alignment seeds for LLM behavior',
      },
      {
        slug: 'api/validators',
        title: 'Validators',
        description: 'Individual gate validators',
      },
      {
        slug: 'api/detectors',
        title: 'Detectors',
        description: 'Pattern detection for input/output',
      },
      {
        slug: 'api/chat',
        title: 'Chat',
        description: 'Chat API reference',
      },
      {
        slug: 'api/agents',
        title: 'Agents',
        description: 'Agent API reference',
      },
      {
        slug: 'api/rest',
        title: 'REST API',
        description: 'HTTP REST API',
      },
    ],
  },
  {
    title: 'Guides',
    items: [
      {
        slug: 'guides/agent-protection',
        title: 'Agent Protection',
        description: 'Complete guide to protecting AI agents',
      },
      {
        slug: 'guides/building-agents',
        title: 'Building Agents',
        description: 'How to build safe AI agents',
      },
      {
        slug: 'guides/custom-validators',
        title: 'Custom Validators',
        description: 'Build domain-specific validators',
      },
      {
        slug: 'guides/deployment',
        title: 'Deployment',
        description: 'Deploying agents to production',
      },
      {
        slug: 'guides/testing',
        title: 'Testing',
        description: 'Testing your agents',
      },
      {
        slug: 'guides/compliance',
        title: 'Compliance',
        description: 'Meeting regulatory requirements',
      },
      {
        slug: 'guides/contributing',
        title: 'Contributing',
        description: 'How to contribute to GuardianClaw',
      },
    ],
  },
  {
    title: 'Resources',
    items: [
      {
        slug: 'resources/benchmarks',
        title: 'Benchmarks',
        description: 'Safety benchmark results',
      },
      {
        slug: 'resources/faq',
        title: 'FAQ',
        description: 'Frequently asked questions',
      },
      {
        slug: 'resources/changelog',
        title: 'Changelog',
        description: 'Version history and updates',
      },
      {
        slug: 'resources/security',
        title: 'Security',
        description: 'Security practices and reporting',
      },
    ],
  },
]

/**
 * Get all documentation slugs from navigation.
 * Used for static generation and sitemap.
 */
export function getAllSlugsFromNavigation(): string[] {
  return docsNavigation.flatMap((section) => section.items.map((item) => item.slug))
}

/**
 * Find a page in navigation by slug.
 * Returns the DocPage entry if found, null otherwise.
 */
export function findPageInNavigation(slug: string) {
  for (const section of docsNavigation) {
    const found = section.items.find((item) => item.slug === slug)
    if (found) return found
  }
  return null
}
