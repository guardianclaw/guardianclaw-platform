/**
 * OpenAI Agents Template Generator
 * Generates a Python project using OpenAI Agents SDK with GuardianClaw integration
 */

import type { TemplateGenerator, AgentData, GeneratedFile } from '../types'
import {
  sanitizeAgentName,
  escapePythonString,
  toPythonDict,
  extractGates,
  generateGitignore,
  generateEnvExample,
} from '../utils'

export const openaiAgentsTemplate: TemplateGenerator = {
  frameworkId: 'openai_agents',
  language: 'python',

  getEnvVars(): string[] {
    return ['OPENAI_API_KEY']
  },

  getDependencies(): Record<string, string> {
    return {
      'openai-agents': '>=0.1.0',
      openai: '>=1.50.0',
      guardianclaw: '>=2.25.0',
      'python-dotenv': '>=1.0.0',
    }
  },

  generate(agent: AgentData): GeneratedFile[] {
    const _projectName = sanitizeAgentName(agent.name)
    const config = agent.config || {}
    const clawConfig = agent.claw_config || {}
    const integrationConfig = agent.integration_config || {}

    const model = (config.model as string) || 'gpt-4o'
    const instructions =
      (config.instructions as string) ||
      'You are a helpful assistant that can use tools to accomplish tasks.'

    const gates = extractGates(clawConfig as Record<string, unknown>)
    const guardrailModel = (integrationConfig.guardrail_model as string) || 'gpt-4o-mini'

    const files: GeneratedFile[] = []

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${agent.name}

${agent.description || 'An OpenAI Agents SDK agent with GuardianClaw safety guardrails.'}

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
   # Edit .env with your OpenAI API key
   \`\`\`

4. Run the agent:
   \`\`\`bash
   python main.py
   \`\`\`

## Configuration

- Model: ${model}
- Guardrail Model: ${guardrailModel}

## GuardianClaw Safety

This agent uses GuardianClaw CLAW protocol with input and output guardrails:
- Credibility Gate: ${gates.credibility ? 'Enabled' : 'Disabled'}
- Avoidance Gate: ${gates.avoidance ? 'Enabled' : 'Disabled'}
- Limits Gate: ${gates.limits ? 'Enabled' : 'Disabled'}
- Worth Gate: ${gates.worth ? 'Enabled' : 'Disabled'}
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
Safety settings for the OpenAI Agent
"""

GCLAW_CONFIG = ${toPythonDict({
        guardrail_model: guardrailModel,
        require_all_gates: integrationConfig.require_all_gates ?? true,
        skip_semantic_if_heuristic: integrationConfig.skip_semantic_if_heuristic ?? true,
        validation_timeout_ms: integrationConfig.validation_timeout_ms || 30000,
        block_on_violation: integrationConfig.block_on_violation ?? true,
        use_heuristic: integrationConfig.use_heuristic ?? true,
        fail_open: integrationConfig.fail_open ?? false,
        log_validations: integrationConfig.log_validations ?? true,
        gates: gates,
      })}
`,
    })

    // agent.py
    files.push({
      path: 'agent.py',
      content: `"""
Agent Configuration
OpenAI Agent with GuardianClaw safety guardrails
"""

from agents import Agent
from guardianclaw.integrations.openai_agents import (
    claw_input_guardrail,
    claw_output_guardrail,
    GuardianClawGuardrailConfig,
)

from claw_config import GCLAW_CONFIG


def create_agent():
    """Create an OpenAI Agent with GuardianClaw guardrails."""
    # Configure GuardianClaw guardrails
    guardrail_config = GuardianClawGuardrailConfig(
        guardrail_model=GCLAW_CONFIG['guardrail_model'],
        use_heuristic=GCLAW_CONFIG['use_heuristic'],
        fail_open=GCLAW_CONFIG['fail_open'],
        block_on_violation=GCLAW_CONFIG['block_on_violation'],
        require_all_gates=GCLAW_CONFIG['require_all_gates'],
        skip_semantic_if_heuristic_blocks=GCLAW_CONFIG['skip_semantic_if_heuristic'],
        validation_timeout=GCLAW_CONFIG['validation_timeout_ms'] / 1000,
        log_violations=GCLAW_CONFIG['log_validations'],
    )

    # Create guardrails using factory functions
    input_guard = claw_input_guardrail(config=guardrail_config)
    output_guard = claw_output_guardrail(config=guardrail_config)

    # Create agent with guardrails
    agent = Agent(
        name='${escapePythonString(agent.name)}',
        model='${model}',
        instructions=INSTRUCTIONS,
        input_guardrails=[input_guard],
        output_guardrails=[output_guard],
    )

    return agent


INSTRUCTIONS = """${escapePythonString(instructions)}"""
`,
    })

    // main.py
    files.push({
      path: 'main.py',
      content: `"""
${agent.name}
${agent.description || 'An OpenAI Agents SDK agent with GuardianClaw safety guardrails.'}
"""

import os
import asyncio
from dotenv import load_dotenv
from agents import Runner

from agent import create_agent


async def run_agent():
    """Run the agent with GuardianClaw guardrails."""
    # Load environment variables
    load_dotenv()

    # Verify API key is set
    if not os.getenv('OPENAI_API_KEY'):
        print('Error: Please set OPENAI_API_KEY in .env')
        return

    # Create the agent with GuardianClaw guardrails
    agent = create_agent()

    print('Agent initialized with GuardianClaw safety guardrails.')
    print('Type "quit" to exit.\\n')

    while True:
        user_input = input('You: ').strip()
        if user_input.lower() in ('quit', 'exit', 'q'):
            break

        if not user_input:
            continue

        try:
            # Run the agent (async)
            result = await Runner.run(agent, user_input)
            print(f'\\nAssistant: {result.final_output}\\n')
        except Exception as e:
            print(f'\\nError: {e}\\n')


def main():
    asyncio.run(run_agent())


if __name__ == '__main__':
    main()
`,
    })

    return files
  },
}
