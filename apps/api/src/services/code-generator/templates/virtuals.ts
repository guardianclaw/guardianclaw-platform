/**
 * Virtuals Protocol Template Generator
 * Generates a Python project using Virtuals Protocol GAME SDK with GuardianClaw integration
 */

import type { TemplateGenerator, AgentData, GeneratedFile } from '../types'
import {
  sanitizeAgentName,
  toPythonDict,
  extractGates,
  generateGitignore,
  generateEnvExample,
} from '../utils'

export const virtualsTemplate: TemplateGenerator = {
  frameworkId: 'virtuals_protocol',
  language: 'python',

  getEnvVars(): string[] {
    return ['OPENAI_API_KEY', 'VIRTUALS_API_KEY', 'WALLET_PRIVATE_KEY']
  },

  getDependencies(): Record<string, string> {
    return {
      'virtuals-sdk': '>=0.1.0',
      guardianclaw: '>=2.25.0',
      'python-dotenv': '>=1.0.0',
      web3: '>=6.0.0',
    }
  },

  generate(agent: AgentData): GeneratedFile[] {
    const _projectName = sanitizeAgentName(agent.name)
    const config = agent.config || {}
    const clawConfig = agent.claw_config || {}
    const integrationConfig = agent.integration_config || {}

    const maxTransactionAmount = (config.maxTransactionAmount as number) || 1000
    const confirmationThreshold = (config.confirmationThreshold as number) || 100

    const gates = extractGates(clawConfig as Record<string, unknown>)

    const files: GeneratedFile[] = []

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${agent.name}

${agent.description || 'A Virtuals Protocol GAME SDK agent with GuardianClaw safety validation.'}

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

- Max Transaction Amount: $${maxTransactionAmount}
- Confirmation Threshold: $${confirmationThreshold}

## GuardianClaw Safety

This agent uses GuardianClaw CLAW protocol with fiduciary and memory protection:
- Credibility Gate: ${gates.credibility ? 'Enabled' : 'Disabled'}
- Avoidance Gate: ${gates.avoidance ? 'Enabled' : 'Disabled'}
- Limits Gate: ${gates.limits ? 'Enabled' : 'Disabled'}
- Worth Gate: ${gates.worth ? 'Enabled' : 'Disabled'}
- Fiduciary Guard: Enabled
- Memory Shield: ${integrationConfig.memory_integrity_check ? 'Enabled' : 'Disabled'}

## Blocked Functions

The following dangerous functions are blocked by GuardianClaw:
- drain_wallet
- send_all_tokens
- approve_unlimited
- export_private_key
- reveal_seed_phrase
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

    // claw_config.py
    files.push({
      path: 'claw_config.py',
      content: `"""
GuardianClaw Configuration
Safety settings for the Virtuals Protocol agent
"""

# Config values for ClawConfig dataclass
GCLAW_CONFIG = ${toPythonDict({
        block_unsafe: integrationConfig.block_unsafe ?? true,
        log_validations: integrationConfig.log_validations ?? true,
        max_transaction_amount: maxTransactionAmount,
        require_confirmation_above: confirmationThreshold,
        require_purpose_for: integrationConfig.require_purpose_for || [
          'transfer',
          'send',
          'approve',
          'swap',
          'bridge',
          'withdraw',
        ],
        memory_integrity_check: integrationConfig.memory_integrity_check ?? false,
        blocked_functions: integrationConfig.blocked_functions || [
          'drain_wallet',
          'send_all_tokens',
          'approve_unlimited',
          'export_private_key',
          'reveal_seed_phrase',
        ],
      })}
`,
    })

    // agent.py
    files.push({
      path: 'agent.py',
      content: `"""
Agent Configuration
Virtuals Protocol GAME SDK agent with GuardianClaw safety validation
"""

import json
from guardianclaw.integrations.virtuals import GuardianClawSafetyWorker, ClawConfig

from claw_config import GCLAW_CONFIG


def create_safety_worker():
    """Create a GuardianClaw safety worker for Virtuals Protocol."""
    # Create config from our settings
    config = ClawConfig(
        block_unsafe=GCLAW_CONFIG['block_unsafe'],
        log_validations=GCLAW_CONFIG['log_validations'],
        max_transaction_amount=GCLAW_CONFIG['max_transaction_amount'],
        require_confirmation_above=GCLAW_CONFIG['require_confirmation_above'],
        require_purpose_for=GCLAW_CONFIG['require_purpose_for'],
        memory_integrity_check=GCLAW_CONFIG['memory_integrity_check'],
        blocked_functions=GCLAW_CONFIG['blocked_functions'],
    )

    # Create worker with config
    worker = GuardianClawSafetyWorker(config)

    return worker


def validate_action(worker, action_type: str, params: dict, worth: str = '') -> dict:
    """Validate an action before execution."""
    result = worker.check_action_safety(
        action_name=action_type,
        action_args=json.dumps(params),
        worth=worth,
    )

    return {
        'safe': result.safe,
        'blocked': result.blocked,
        'concerns': result.concerns,
        'requires_confirmation': result.requires_confirmation,
    }
`,
    })

    // main.py
    files.push({
      path: 'main.py',
      content: `"""
${agent.name}
${agent.description || 'A Virtuals Protocol GAME SDK agent with GuardianClaw safety validation.'}
"""

import os
from dotenv import load_dotenv

from agent import create_safety_worker, validate_action
from claw_config import GCLAW_CONFIG


def main():
    # Load environment variables
    load_dotenv()

    # Verify environment variables
    if not os.getenv('VIRTUALS_API_KEY'):
        print('Warning: VIRTUALS_API_KEY not set. Running in demo mode.')

    # Create GuardianClaw safety worker
    worker = create_safety_worker()

    print('Virtuals Protocol agent initialized with GuardianClaw safety validation.')
    print(f'Max Transaction: \${GCLAW_CONFIG["max_transaction_amount"]}')
    print(f'Confirmation Threshold: \${GCLAW_CONFIG["require_confirmation_above"]}')
    print('Type "quit" to exit.\\n')

    print('Example actions: transfer, swap, approve, check_balance\\n')

    while True:
        user_input = input('You: ').strip()
        if user_input.lower() in ('quit', 'exit', 'q'):
            break

        if not user_input:
            continue

        try:
            # Parse simple action format: "action amount [worth]"
            parts = user_input.split()
            action = parts[0].lower() if parts else ''
            amount = float(parts[1]) if len(parts) > 1 else 0
            worth = ' '.join(parts[2:]) if len(parts) > 2 else ''

            # Validate action with GuardianClaw
            validation = validate_action(worker, action, {
                'input': user_input,
                'amount': amount,
            }, worth=worth)

            if validation['safe'] and not validation['blocked']:
                if validation['requires_confirmation']:
                    confirm = input('[GuardianClaw] Large transaction. Confirm? (y/n): ')
                    if confirm.lower() != 'y':
                        print('[Agent] Action cancelled.\\n')
                        continue
                print(f'\\n[Agent] Action validated. Ready to execute: {action}')
                print('[Agent] Note: Full execution requires Virtuals SDK integration.\\n')
            else:
                print(f'\\n[GuardianClaw] Blocked - Concerns:')
                for concern in validation.get('concerns', []):
                    print(f'  - {concern}')
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
