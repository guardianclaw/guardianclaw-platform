/**
 * ElizaOS Template Generator
 * Generates a TypeScript project using ElizaOS with GuardianClaw integration
 */

import type { TemplateGenerator, AgentData, GeneratedFile } from '../types'
import {
  sanitizeAgentName,
  escapeJsString,
  toJsObject,
  extractGates,
  getSeedLevel,
  generateGitignore,
  generateEnvExample,
} from '../utils'

export const elizaosTemplate: TemplateGenerator = {
  frameworkId: 'elizaos',
  language: 'typescript',

  getEnvVars(): string[] {
    return ['OPENAI_API_KEY', 'DISCORD_BOT_TOKEN', 'TWITTER_BEARER_TOKEN', 'TELEGRAM_BOT_TOKEN']
  },

  getDependencies(): Record<string, string> {
    return {
      '@elizaos/core': '^1.0.0',
      '@elizaos/clients': '^1.0.0',
      '@guardianclaw/elizaos-plugin': '^1.2.0',
      dotenv: '^16.0.0',
      typescript: '^5.3.0',
      '@types/node': '^20.0.0',
      tsx: '^4.0.0',
    }
  },

  generate(agent: AgentData): GeneratedFile[] {
    const projectName = sanitizeAgentName(agent.name)
    const config = agent.config || {}
    const clawConfig = agent.claw_config || {}
    const integrationConfig = agent.integration_config || {}

    const model = (config.model as string) || 'gpt-4o-mini'
    const personality =
      (config.personality as string) ||
      'You are a helpful and friendly AI assistant. Be concise, engaging, and maintain a consistent personality.'
    const seedLevel = getSeedLevel(integrationConfig as Record<string, unknown>)

    const gates = extractGates(clawConfig as Record<string, unknown>)
    const memoryIntegrity = (integrationConfig.memoryIntegrity as Record<string, unknown>) || {}

    const files: GeneratedFile[] = []

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${agent.name}

${agent.description || 'An ElizaOS social agent with GuardianClaw safety validation.'}

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your API keys
   \`\`\`

3. Run the agent:
   \`\`\`bash
   npm start
   \`\`\`

## Configuration

- Model: ${model}
- Seed Level: ${seedLevel}

## GuardianClaw Safety

This agent uses GuardianClaw CLAW protocol with memory integrity protection:
- Credibility Gate: ${gates.credibility ? 'Enabled' : 'Disabled'}
- Avoidance Gate: ${gates.avoidance ? 'Enabled' : 'Disabled'}
- Limits Gate: ${gates.limits ? 'Enabled' : 'Disabled'}
- Worth Gate: ${gates.worth ? 'Enabled' : 'Disabled'}
- Memory Shield: ${memoryIntegrity.enabled ? 'Enabled' : 'Disabled'}

## Social Platforms

Configure the following in .env:
- Discord: \`DISCORD_BOT_TOKEN\`
- Twitter/X: \`TWITTER_BEARER_TOKEN\`
- Telegram: \`TELEGRAM_BOT_TOKEN\`
`,
    })

    // package.json
    const deps = this.getDependencies()
    files.push({
      path: 'package.json',
      content: JSON.stringify(
        {
          name: projectName,
          version: '1.0.0',
          type: 'module',
          scripts: {
            start: 'tsx src/index.ts',
            dev: 'tsx watch src/index.ts',
            build: 'tsc',
            typecheck: 'tsc --noEmit',
          },
          dependencies: Object.fromEntries(
            Object.entries(deps).filter(
              ([k]) => !k.startsWith('@types') && k !== 'typescript' && k !== 'tsx'
            )
          ),
          devDependencies: Object.fromEntries(
            Object.entries(deps).filter(
              ([k]) => k.startsWith('@types') || k === 'typescript' || k === 'tsx'
            )
          ),
        },
        null,
        2
      ),
    })

    // tsconfig.json
    files.push({
      path: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            esModuleInterop: true,
            strict: true,
            skipLibCheck: true,
            outDir: './dist',
            rootDir: './src',
          },
          include: ['src/**/*'],
        },
        null,
        2
      ),
    })

    // .gitignore
    files.push({
      path: '.gitignore',
      content: generateGitignore('typescript'),
    })

    // .env.example
    files.push({
      path: '.env.example',
      content: generateEnvExample(this.getEnvVars()),
    })

    // src/claw.config.ts
    files.push({
      path: 'src/claw.config.ts',
      content: `/**
 * GuardianClaw Configuration
 * Safety settings for the ElizaOS agent
 */

export const GCLAW_CONFIG = ${toJsObject({
        seedVersion: integrationConfig.seedVersion || 'v2',
        seedVariant: integrationConfig.seedVariant || seedLevel,
        blockUnsafe: integrationConfig.blockUnsafe ?? true,
        logChecks: integrationConfig.logChecks ?? true,
        memoryIntegrity: {
          enabled: memoryIntegrity.enabled ?? true,
          verifyOnRead: memoryIntegrity.verifyOnRead ?? true,
          signOnWrite: memoryIntegrity.signOnWrite ?? true,
          minTrustScore: memoryIntegrity.minTrustScore ?? 0.5,
        },
        gates: gates,
      })}
`,
    })

    // src/character.ts
    files.push({
      path: 'src/character.ts',
      content: `/**
 * Character Definition
 * ElizaOS character configuration
 */

import type { Character } from '@elizaos/core'

export const character: Character = {
  name: '${escapeJsString(agent.name)}',
  description: '${escapeJsString(agent.description || 'An AI assistant')}',

  // System prompt defines the agent's personality and behavior
  system: \`${personality.replace(/`/g, '\\`')}\`,

  // Model settings
  modelProvider: 'openai',
  settings: {
    model: '${model}',
  },

  // Client configuration (uncomment to enable)
  clients: [
    // 'discord',
    // 'twitter',
    // 'telegram',
  ],

  // Bio and personality traits
  bio: [
    'A helpful AI assistant with a consistent personality.',
    'Always prioritizes safety and truthfulness.',
  ],

  // Example conversation patterns
  messageExamples: [
    [
      { user: '{{user1}}', content: { text: 'Hello!' } },
      { user: '${escapeJsString(agent.name)}', content: { text: 'Hello! How can I help you today?' } },
    ],
  ],

  // Topics the agent is knowledgeable about
  topics: ['general assistance', 'conversation'],

  // Adjectives describing the agent
  adjectives: ['helpful', 'friendly', 'safe', 'honest'],
}
`,
    })

    // src/index.ts
    files.push({
      path: 'src/index.ts',
      content: `/**
 * ${escapeJsString(agent.name)}
 * ${escapeJsString(agent.description || 'An ElizaOS social agent with GuardianClaw safety validation.')}
 */

import 'dotenv/config'
import { AgentRuntime } from '@elizaos/core'
import { clawPlugin } from '@guardianclaw/elizaos-plugin'

import { character } from './character'
import { GCLAW_CONFIG } from './claw.config'

async function main() {
  // Verify API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Please set OPENAI_API_KEY in .env')
    process.exit(1)
  }

  // Create agent runtime with GuardianClaw plugin
  const runtime = new AgentRuntime({
    character,
    plugins: [
      clawPlugin({
        seedVersion: GCLAW_CONFIG.seedVersion,
        seedVariant: GCLAW_CONFIG.seedVariant,
        blockUnsafe: GCLAW_CONFIG.blockUnsafe,
        logChecks: GCLAW_CONFIG.logChecks,
        memoryIntegrity: GCLAW_CONFIG.memoryIntegrity,
      }),
    ],
  })

  console.log(\`\\n\${character.name} initialized with GuardianClaw safety validation.\`)
  console.log('Seed Version:', GCLAW_CONFIG.seedVersion)
  console.log('Memory Shield:', GCLAW_CONFIG.memoryIntegrity.enabled ? 'Enabled' : 'Disabled')

  // Check for social client tokens
  const clients: string[] = []
  if (process.env.DISCORD_BOT_TOKEN) clients.push('Discord')
  if (process.env.TWITTER_BEARER_TOKEN) clients.push('Twitter')
  if (process.env.TELEGRAM_BOT_TOKEN) clients.push('Telegram')

  if (clients.length > 0) {
    console.log('Available clients:', clients.join(', '))
  } else {
    console.log('No social clients configured. Running in local mode.')
  }

  console.log('\\nStarting agent...\\n')

  // Start the agent
  await runtime.start()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
`,
    })

    return files
  },
}
