/**
 * Coinbase AgentKit Template Generator
 * Generates a TypeScript project using Coinbase AgentKit with GuardianClaw integration
 */

import type { TemplateGenerator, AgentData, GeneratedFile } from '../types'
import {
  sanitizeAgentName,
  escapeJsString,
  toJsObject,
  extractGates,
  generateGitignore,
  generateEnvExample,
} from '../utils'

export const coinbaseTemplate: TemplateGenerator = {
  frameworkId: 'coinbase_agentkit',
  language: 'typescript',

  getEnvVars(): string[] {
    return ['OPENAI_API_KEY', 'CDP_API_KEY_NAME', 'CDP_API_KEY_PRIVATE_KEY', 'NETWORK_ID']
  },

  getDependencies(): Record<string, string> {
    return {
      '@coinbase/agentkit': '^0.2.0',
      '@guardianclaw/core': '^2.25.0',
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

    const securityProfile = (config.securityProfile as string) || 'standard'
    const spendingLimit = (config.spendingLimit as number) || 100

    const gates = extractGates(clawConfig as Record<string, unknown>)

    const files: GeneratedFile[] = []

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${agent.name}

${agent.description || 'A Coinbase AgentKit agent with GuardianClaw safety validation.'}

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

- Security Profile: ${securityProfile}
- Daily Spending Limit: $${spendingLimit}

## GuardianClaw Safety

This agent uses GuardianClaw CLAW protocol with fiduciary validation:
- Credibility Gate: ${gates.credibility ? 'Enabled' : 'Disabled'}
- Avoidance Gate: ${gates.avoidance ? 'Enabled' : 'Disabled'}
- Limits Gate: ${gates.limits ? 'Enabled' : 'Disabled'}
- Worth Gate: ${gates.worth ? 'Enabled' : 'Disabled'}
- Fiduciary Guard: Enabled (validates financial actions)

## Environment Variables

- \`CDP_API_KEY_NAME\`: Your Coinbase Developer Platform API key name
- \`CDP_API_KEY_PRIVATE_KEY\`: Your CDP API private key
- \`NETWORK_ID\`: Network to use (e.g., 'base-sepolia', 'base-mainnet')
- \`OPENAI_API_KEY\`: OpenAI API key for the LLM
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

    const spendingLimits = (integrationConfig.spending_limits as Record<string, number>) || {}

    // src/claw.config.ts
    files.push({
      path: 'src/claw.config.ts',
      content: `/**
 * GuardianClaw Configuration
 * Safety settings for the Coinbase AgentKit agent
 */

export const GCLAW_CONFIG = ${toJsObject({
        security_profile: securityProfile,
        spending_limits: {
          max_single_transaction: spendingLimits.max_single_transaction || spendingLimit,
          max_daily_total: spendingLimits.max_daily_total || spendingLimit * 5,
          confirmation_threshold: spendingLimits.confirmation_threshold || spendingLimit / 2,
        },
        blocked_addresses: integrationConfig.blocked_addresses || [],
        fiduciary_enabled: integrationConfig.fiduciary_enabled ?? true,
        block_unlimited_approvals: integrationConfig.block_unlimited_approvals ?? true,
        validate_before_sign: integrationConfig.validate_before_sign ?? true,
        log_validations: integrationConfig.log_validations ?? true,
        gates: gates,
      })}
`,
    })

    // src/agent.ts
    files.push({
      path: 'src/agent.ts',
      content: `/**
 * Agent Configuration
 * Coinbase AgentKit agent with GuardianClaw safety validation
 */

import { AgentKit } from '@coinbase/agentkit'
import { validateCLAW, quickCheck } from '@guardianclaw/core'

import { GCLAW_CONFIG } from './claw.config'

export async function createAgent() {
  // Initialize AgentKit
  const agentKit = await AgentKit.from({
    cdpApiKeyName: process.env.CDP_API_KEY_NAME!,
    cdpApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
    networkId: process.env.NETWORK_ID || 'base-sepolia',
  })

  // Get wallet info
  const wallet = agentKit.wallet
  console.log('Wallet address:', wallet.defaultAddress?.addressId)

  return {
    agentKit,
    wallet,
    config: GCLAW_CONFIG,
  }
}

/**
 * Validate a transaction before execution using GuardianClaw CLAW
 */
export function validateTransaction(action: string, amount: number, recipient?: string) {
  // Quick check for immediate issues
  const content = \`\${action} \${amount} \${recipient || ''}\`

  if (!quickCheck(content)) {
    return {
      safe: false,
      reason: 'Transaction blocked by quick check',
    }
  }

  // Full CLAW validation
  const result = validateCLAW(content)

  // Check spending limits
  if (amount > GCLAW_CONFIG.spending_limits.max_single_transaction) {
    return {
      safe: false,
      reason: \`Amount exceeds max single transaction limit (\${GCLAW_CONFIG.spending_limits.max_single_transaction})\`,
      requiresConfirmation: true,
    }
  }

  const requiresConfirmation = amount > GCLAW_CONFIG.spending_limits.confirmation_threshold

  return {
    safe: result.overall,
    reason: result.overall ? 'Validation passed' : result.summary,
    gates: result,
    requiresConfirmation,
  }
}
`,
    })

    // src/index.ts
    files.push({
      path: 'src/index.ts',
      content: `/**
 * ${escapeJsString(agent.name)}
 * ${escapeJsString(agent.description || 'A Coinbase AgentKit agent with GuardianClaw safety validation.')}
 */

import 'dotenv/config'
import * as readline from 'readline'

import { createAgent, validateTransaction } from './agent'
import { GCLAW_CONFIG } from './claw.config'

async function main() {
  // Verify environment variables
  if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
    console.error('Error: Please set CDP_API_KEY_NAME and CDP_API_KEY_PRIVATE_KEY in .env')
    process.exit(1)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: Please set OPENAI_API_KEY in .env')
    process.exit(1)
  }

  // Create agent
  const { agentKit, wallet } = await createAgent()

  console.log('\\nCoinbase AgentKit initialized with GuardianClaw safety validation.')
  console.log('Security Profile:', GCLAW_CONFIG.security_profile)
  console.log('Max Transaction:', '$' + GCLAW_CONFIG.spending_limits.max_single_transaction)
  console.log('\\nType "quit" to exit.\\n')

  // Interactive loop
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const prompt = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim()

      if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'exit') {
        rl.close()
        return
      }

      if (!trimmed) {
        prompt()
        return
      }

      try {
        // Parse input: "action amount [recipient]"
        const parts = trimmed.split(' ')
        const action = parts[0]?.toLowerCase() || ''
        const amount = parseFloat(parts[1]) || 0
        const recipient = parts[2]

        // Validate with GuardianClaw
        const validation = validateTransaction(action, amount, recipient)

        if (validation.safe) {
          if (validation.requiresConfirmation) {
            console.log('\\n[GuardianClaw] High-value transaction. Requires confirmation.')
          }
          console.log('\\n[Agent] Transaction validated. Ready to execute.')
          console.log('[Agent] Note: Full execution requires LLM integration.')
        } else {
          console.log('\\n[GuardianClaw] Blocked:', validation.reason)
        }
        console.log()
      } catch (err) {
        console.error('\\nError:', err)
      }

      prompt()
    })
  }

  prompt()
}

main().catch(console.error)
`,
    })

    return files
  },
}
