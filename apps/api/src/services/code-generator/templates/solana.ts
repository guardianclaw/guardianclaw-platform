/**
 * Solana Agent Kit Template Generator
 * Generates a Python project using Solana Agent Kit with GuardianClaw integration
 */

import type { TemplateGenerator, AgentData, GeneratedFile } from '../types'
import {
  sanitizeAgentName,
  toPythonDict,
  extractGates,
  generateGitignore,
  generateEnvExample,
} from '../utils'

export const solanaTemplate: TemplateGenerator = {
  frameworkId: 'solana_agent_kit',
  language: 'python',

  getEnvVars(): string[] {
    return ['OPENAI_API_KEY', 'SOLANA_PRIVATE_KEY', 'RPC_URL']
  },

  getDependencies(): Record<string, string> {
    return {
      'solana-agentkit': '>=0.2.0',
      solana: '>=0.30.0',
      solders: '>=0.20.0',
      guardianclaw: '>=2.25.0',
      'python-dotenv': '>=1.0.0',
    }
  },

  generate(agent: AgentData): GeneratedFile[] {
    const _projectName = sanitizeAgentName(agent.name)
    const config = agent.config || {}
    const clawConfig = agent.claw_config || {}
    const integrationConfig = agent.integration_config || {}

    const spendingLimit = (config.spendingLimit as number) || 500
    const slippageTolerance = (config.slippageTolerance as number) || 1.0

    const gates = extractGates(clawConfig as Record<string, unknown>)

    const files: GeneratedFile[] = []

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${agent.name}

${agent.description || 'A Solana Agent Kit agent with GuardianClaw safety validation.'}

## Setup

1. Create a virtual environment:
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. Configure environment:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your keys
   \`\`\`

4. Run the agent:
   \`\`\`bash
   python main.py
   \`\`\`

## Configuration

- Daily Spending Limit: $${spendingLimit}
- Slippage Tolerance: ${slippageTolerance}%

## GuardianClaw Safety

This agent uses GuardianClaw CLAW protocol with fiduciary validation:
- Credibility Gate: ${gates.credibility ? 'Enabled' : 'Disabled'}
- Avoidance Gate: ${gates.avoidance ? 'Enabled' : 'Disabled'}
- Limits Gate: ${gates.limits ? 'Enabled' : 'Disabled'}
- Worth Gate: ${gates.worth ? 'Enabled' : 'Disabled'}
- Fiduciary Guard: Enabled (validates DeFi transactions)

## Environment Variables

- \`SOLANA_PRIVATE_KEY\`: Your Solana wallet private key (base58)
- \`RPC_URL\`: Solana RPC endpoint (e.g., mainnet-beta, devnet)
- \`OPENAI_API_KEY\`: OpenAI API key for the LLM
`,
    })

    // requirements.txt
    const deps = this.getDependencies()
    files.push({
      path: 'requirements.txt',
      content:
        Object.entries(deps)
          .map(([pkg, version]) => `${pkg}${version}`)
          .join('\n') + '\n',
    })

    // .gitignore
    files.push({
      path: '.gitignore',
      content: generateGitignore('python'),
    })

    // .env.example
    files.push({
      path: '.env.example',
      content: generateEnvExample(this.getEnvVars()),
    })

    const confirmAbove = (integrationConfig.confirm_above as number) || spendingLimit / 10

    // claw_config.py
    files.push({
      path: 'claw_config.py',
      content: `"""
GuardianClaw Configuration
Safety settings for the Solana Agent Kit agent
"""

GCLAW_CONFIG = ${toPythonDict({
        seed_level: 'standard',
        max_transfer: spendingLimit,
        confirm_above: confirmAbove,
        blocked_addresses: integrationConfig.blocked_addresses || [],
        allowed_programs: integrationConfig.allowed_programs || [],
        require_purpose_for: integrationConfig.require_purpose_for || [
          'transfer',
          'swap',
          'stake',
          'withdraw',
        ],
        memory_integrity_check: integrationConfig.memory_integrity_check ?? false,
        strict_mode: integrationConfig.strict_mode ?? false,
      })}
`,
    })

    // agent.py
    files.push({
      path: 'agent.py',
      content: `"""
Agent Configuration
Solana Agent Kit agent with GuardianClaw safety validation
"""

import os
from solana_agentkit import SolanaAgentKit
from guardianclaw.integrations.solana_agent_kit import ClawValidator

from claw_config import GCLAW_CONFIG


def create_agent():
    """Create a Solana Agent Kit agent with GuardianClaw safety."""
    # Initialize Solana Agent Kit
    agent = SolanaAgentKit(
        private_key=os.getenv('SOLANA_PRIVATE_KEY'),
        rpc_url=os.getenv('RPC_URL', 'https://api.devnet.solana.com'),
    )

    # Create GuardianClaw validator
    validator = ClawValidator(
        seed_level=GCLAW_CONFIG['seed_level'],
        max_transfer=GCLAW_CONFIG['max_transfer'],
        confirm_above=GCLAW_CONFIG['confirm_above'],
        blocked_addresses=GCLAW_CONFIG['blocked_addresses'],
        allowed_programs=GCLAW_CONFIG['allowed_programs'],
        require_purpose_for=GCLAW_CONFIG['require_purpose_for'],
        memory_integrity_check=GCLAW_CONFIG['memory_integrity_check'],
        strict_mode=GCLAW_CONFIG['strict_mode'],
    )

    return agent, validator


# Available actions
AVAILABLE_ACTIONS = [
    'transfer',
    'swap',
    'stake',
    'get_balance',
    'get_token_balance',
]
`,
    })

    // main.py
    files.push({
      path: 'main.py',
      content: `"""
${agent.name}
${agent.description || 'A Solana Agent Kit agent with GuardianClaw safety validation.'}
"""

import os
from dotenv import load_dotenv

from agent import create_agent, AVAILABLE_ACTIONS
from claw_config import GCLAW_CONFIG


def main():
    # Load environment variables
    load_dotenv()

    # Verify environment variables
    if not os.getenv('SOLANA_PRIVATE_KEY'):
        print('Error: Please set SOLANA_PRIVATE_KEY in .env')
        return

    # Create agent with GuardianClaw validator
    agent, validator = create_agent()

    print('Solana Agent Kit initialized with GuardianClaw safety validation.')
    print(f'Wallet: {agent.wallet.pubkey()}')
    print(f'RPC: {agent.rpc_url}')
    print(f'Max Transfer: {GCLAW_CONFIG["max_transfer"]} SOL')
    print(f'\\nAvailable actions: {", ".join(AVAILABLE_ACTIONS)}')
    print('Type "quit" to exit.\\n')

    while True:
        user_input = input('You: ').strip()
        if user_input.lower() in ('quit', 'exit', 'q'):
            break

        if not user_input:
            continue

        try:
            # Check balance as a simple example
            if 'balance' in user_input.lower():
                balance = agent.get_balance()
                print(f'\\nBalance: {balance / 1e9:.4f} SOL\\n')
            else:
                # Parse action and amount from input
                parts = user_input.split()
                action = parts[0].lower() if parts else ''
                amount = float(parts[1]) if len(parts) > 1 else 0

                # Validate with GuardianClaw
                validation = validator.check(action, amount=amount)

                if validation.should_proceed:
                    if validation.requires_confirmation:
                        confirm = input('[GuardianClaw] High-value transaction. Confirm? (y/n): ')
                        if confirm.lower() != 'y':
                            print('[Agent] Action cancelled.\\n')
                            continue
                    print(f'\\n[Agent] Request validated. Ready to execute.')
                    print(f'[Agent] Risk level: {validation.risk_level.value}')
                    print(f'[Agent] Note: Full execution requires LLM integration.\\n')
                else:
                    print(f'\\n[GuardianClaw] Blocked - Concerns:')
                    for concern in validation.concerns:
                        print(f'  - {concern}')
                    if validation.recommendations:
                        print(f'Recommendations:')
                        for rec in validation.recommendations:
                            print(f'  - {rec}')
                    print()
        except Exception as e:
            print(f'\\nError: {e}\\n')


if __name__ == '__main__':
    main()
`,
    })

    return files
  },
}
