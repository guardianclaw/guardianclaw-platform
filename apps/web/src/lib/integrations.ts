export type IntegrationCategory =
  | 'frameworks'
  | 'llm-providers'
  | 'crypto'
  | 'security'
  | 'ides'
  | 'platforms'

export type IntegrationStatus = 'stable' | 'beta' | 'coming'

export interface Integration {
  slug: string
  name: string
  description: string
  category: IntegrationCategory
  status: IntegrationStatus
  logoUrl?: string
  installCommand?: string
  docsUrl?: string
  demoUrl?: string
  quickStart?: string
}

export const integrations: Integration[] = [
  // Frameworks
  {
    slug: 'elizaos',
    name: 'ElizaOS',
    description:
      'Build personality-driven social agents for Twitter, Discord, and Telegram with CLAW validation and memory integrity.',
    category: 'frameworks',
    status: 'stable',
    logoUrl: '/images/ecosystem/elizaos.svg',
    installCommand: 'npm install @guardianclaw/elizaos-plugin',
    docsUrl: '/docs/integrations/elizaos',
    demoUrl: '/demos/elizaos',
    quickStart: `import { clawPlugin } from '@guardianclaw/elizaos-plugin'

const agent = new AgentRuntime({
  character,
  plugins: [clawPlugin({ blockUnsafe: true, logChecks: true })]
})`,
  },
  {
    slug: 'voltagent',
    name: 'VoltAgent',
    description: 'Agentic AI framework integration with built-in safety.',
    category: 'frameworks',
    status: 'stable',
    logoUrl: '/images/ecosystem/voltagent.svg',
    installCommand: 'npm install @guardianclaw/voltagent',
    docsUrl: '/docs/integrations/voltagent',
    demoUrl: '/demos/voltagent',
    quickStart: `import { createGuardianClawGuardrails } from '@guardianclaw/voltagent'

const { inputGuardrails, outputGuardrails } = createGuardianClawGuardrails({ level: 'strict' })`,
  },
  {
    slug: 'moltbot',
    name: 'Moltbot',
    description:
      'Security guardrails for Moltbot agents with real-time validation, data leak prevention, and threat detection.',
    category: 'frameworks',
    status: 'stable',
    logoUrl: '/images/ecosystem/moltbot.svg',
    installCommand: 'npm install @guardianclaw/moltbot',
    docsUrl: '/docs/integrations/moltbot',
    demoUrl: '/demos/moltbot',
    quickStart: `// moltbot.config.json
{
  "plugins": {
    "claw": {
      "level": "watch"
    }
  }
}`,
  },

  // LLM Providers
  {
    slug: 'openai',
    name: 'OpenAI',
    description: 'Direct integration with OpenAI API and Agents SDK.',
    category: 'llm-providers',
    status: 'stable',
    logoUrl: '/images/ecosystem/openai.svg',
    installCommand: 'pip install guardianclaw',
    docsUrl: '/docs/integrations/openai-agents',
    demoUrl: '/demos/openai',
    quickStart: `from guardianclaw.integrations.openai_agents import create_claw_agent

agent = create_claw_agent(client, assistant_id)`,
  },
  {
    slug: 'anthropic',
    name: 'Anthropic',
    description: 'Validated Claude conversations with constitutional AI principles.',
    category: 'llm-providers',
    status: 'stable',
    logoUrl: '/images/ecosystem/anthropic.svg',
    installCommand: 'pip install guardianclaw[anthropic]',
    docsUrl: '/docs/integrations/anthropic',
    demoUrl: '/demos/anthropic',
    quickStart: `from guardianclaw.integrations.anthropic_sdk import GuardianClawClaude

claude = GuardianClawClaude()`,
  },
  {
    slug: 'google-adk',
    name: 'Google ADK',
    description: 'Safety integration with Google Agent Development Kit.',
    category: 'llm-providers',
    status: 'stable',
    logoUrl: '/images/ecosystem/google-adk.svg',
    installCommand: 'pip install guardianclaw[google-adk]',
    docsUrl: '/docs/integrations/google-adk',
    demoUrl: '/demos/google-adk',
    quickStart: `from guardianclaw.integrations.google_adk import GuardianClawADK

adk = GuardianClawADK()`,
  },

  // Crypto
  {
    slug: 'solana-agent-kit',
    name: 'Solana Agent Kit',
    description: 'Secure blockchain interactions for Solana-based agents.',
    category: 'crypto',
    status: 'stable',
    logoUrl: '/images/ecosystem/solana.svg',
    installCommand: 'pip install guardianclaw[solana]',
    docsUrl: '/docs/integrations/solana-agent-kit',
    demoUrl: '/demos/solana',
    quickStart: `from guardianclaw.integrations.solana_agent_kit import create_solana_tools

tools = create_solana_tools(wallet)`,
  },
  {
    slug: 'coinbase',
    name: 'Coinbase AgentKit',
    description: 'Validated cryptocurrency operations with spending limits.',
    category: 'crypto',
    status: 'stable',
    logoUrl: '/images/ecosystem/coinbase.svg',
    installCommand: 'pip install guardianclaw[coinbase]',
    docsUrl: '/docs/integrations/coinbase',
    demoUrl: '/demos/coinbase',
    quickStart: `from guardianclaw.integrations.coinbase import GuardianClawAgentKit

kit = GuardianClawAgentKit(max_transaction=1000)`,
  },
  {
    slug: 'virtuals',
    name: 'Virtuals Protocol',
    description: 'Safety layer for on-chain AI agents on Virtuals.',
    category: 'crypto',
    status: 'stable',
    logoUrl: '/images/ecosystem/virtuals.svg',
    installCommand: 'pip install guardianclaw[virtuals]',
    docsUrl: '/docs/integrations/virtuals',
    demoUrl: '/demos/virtuals',
    quickStart: `from guardianclaw.integrations.virtuals import GuardianClawVirtual

agent = GuardianClawVirtual(contract_address)`,
  },

  // Security/Testing
  {
    slug: 'garak',
    name: 'garak',
    description: 'LLM vulnerability scanner integration for security testing.',
    category: 'security',
    status: 'stable',
    logoUrl: '/images/ecosystem/garak.svg',
    installCommand: 'pip install garak guardianclaw',
    docsUrl: '/docs/integrations/garak',
    demoUrl: '/demos/garak',
    quickStart: `# Use GuardianClaw probes in garak
garak --probes claw.CLAWProbe`,
  },
  {
    slug: 'pyrit',
    name: 'PyRIT',
    description: 'Microsoft red-teaming toolkit with GuardianClaw detectors.',
    category: 'security',
    status: 'stable',
    logoUrl: '/images/ecosystem/pyrit.svg',
    installCommand: 'pip install pyrit guardianclaw',
    docsUrl: '/docs/integrations/pyrit',
    demoUrl: '/demos/pyrit',
    quickStart: `from guardianclaw.integrations.pyrit import GuardianClawScorer

scorer = GuardianClawScorer()`,
  },
  {
    slug: 'promptfoo',
    name: 'Promptfoo',
    description: 'LLM evaluation with GuardianClaw safety assertions.',
    category: 'security',
    status: 'stable',
    logoUrl: '/images/ecosystem/promptfoo.svg',
    installCommand: 'npm install promptfoo @guardianclaw/promptfoo',
    docsUrl: '/docs/integrations/promptfoo',
    demoUrl: '/demos/promptfoo',
    quickStart: `# promptfoo.yaml
providers:
  - claw:validate`,
  },
  {
    slug: 'openguardrails',
    name: 'OpenGuardrails',
    description: 'Combined validation with NeMo and GuardianClaw guardrails.',
    category: 'security',
    status: 'stable',
    logoUrl: '/images/ecosystem/openguardrails.svg',
    installCommand: 'pip install guardianclaw[nemo]',
    docsUrl: '/docs/integrations/openguardrails',
    demoUrl: '/demos/openguardrails',
    quickStart: `from guardianclaw.integrations.openguardrails import combined_guard

guard = combined_guard(claw=True, nemo=True)`,
  },

  // IDEs
  {
    slug: 'jetbrains',
    name: 'JetBrains',
    description: 'IntelliJ-based IDE plugin for prompt safety checking.',
    category: 'ides',
    status: 'stable',
    logoUrl: '/images/ecosystem/jetbrains.svg',
    installCommand: 'Install from JetBrains Marketplace',
    docsUrl: '/docs/integrations/jetbrains',
    demoUrl: '/demos/jetbrains',
  },

  // Platforms
  {
    slug: 'mcp',
    name: 'Model Context Protocol',
    description: 'MCP server for Claude Desktop and compatible clients.',
    category: 'platforms',
    status: 'stable',
    logoUrl: '/images/ecosystem/mcp.svg',
    installCommand: 'npx @guardianclaw/mcp-server',
    docsUrl: '/docs/integrations/mcp',
    demoUrl: '/demos/mcp',
    quickStart: `// claude_desktop_config.json
{
  "mcpServers": {
    "claw": {
      "command": "npx",
      "args": ["@guardianclaw/mcp-server"]
    }
  }
}`,
  },
  {
    slug: 'huggingface',
    name: 'Hugging Face',
    description: 'Pre-built seeds available on Hugging Face Hub.',
    category: 'platforms',
    status: 'stable',
    logoUrl: '/images/ecosystem/huggingface.svg',
    docsUrl: 'https://huggingface.co/datasets/guardianclaw/alignment-seeds',
    demoUrl: '/demos/huggingface',
    quickStart: `from datasets import load_dataset

seeds = load_dataset("guardianclaw/alignment-seeds")`,
  },
  {
    slug: 'browser',
    name: 'Browser Extension',
    description: 'Validate prompts directly in ChatGPT, Claude, and more.',
    category: 'platforms',
    status: 'stable',
    logoUrl: '/images/ecosystem/chrome.svg',
    installCommand: 'Install from Chrome Web Store',
    docsUrl: '/docs/integrations/browser',
    demoUrl: '/demos/browser',
  },
]

export const categories: { id: IntegrationCategory; name: string; description: string }[] = [
  {
    id: 'frameworks',
    name: 'Agent Frameworks',
    description: 'Build safer AI agents with popular frameworks',
  },
  {
    id: 'llm-providers',
    name: 'LLM Providers',
    description: 'Direct integrations with AI model providers',
  },
  { id: 'crypto', name: 'Crypto & DeFi', description: 'Secure blockchain and financial AI agents' },
  {
    id: 'security',
    name: 'Security Testing',
    description: 'Red-teaming and vulnerability scanning',
  },
  { id: 'ides', name: 'IDEs & Editors', description: 'Real-time validation in your editor' },
  { id: 'platforms', name: 'Platforms', description: 'Platform integrations and deployments' },
]

export function getIntegration(slug: string): Integration | undefined {
  return integrations.find((i) => i.slug === slug)
}

export function getIntegrationsByCategory(category: IntegrationCategory): Integration[] {
  return integrations.filter((i) => i.category === category)
}

export function searchIntegrations(query: string): Integration[] {
  const q = query.toLowerCase()
  return integrations.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.category.includes(q)
  )
}
