/**
 * Google ADK Template Generator
 * Generates a Python project using Google Agent Development Kit with GuardianClaw integration
 */

import type { TemplateGenerator, AgentData, GeneratedFile } from '../types'
import {
  sanitizeAgentName,
  escapePythonString,
  toPythonDict,
  extractGates,
  getSeedLevel,
  generateGitignore,
  generateEnvExample,
} from '../utils'

export const googleAdkTemplate: TemplateGenerator = {
  frameworkId: 'google_adk',
  language: 'python',

  getEnvVars(): string[] {
    return ['GOOGLE_API_KEY']
  },

  getDependencies(): Record<string, string> {
    return {
      'google-adk': '>=0.3.0',
      'google-generativeai': '>=0.8.0',
      guardianclaw: '>=2.25.0',
      'python-dotenv': '>=1.0.0',
    }
  },

  generate(agent: AgentData): GeneratedFile[] {
    const projectName = sanitizeAgentName(agent.name)
    const config = agent.config || {}
    const clawConfig = agent.claw_config || {}
    const integrationConfig = agent.integration_config || {}

    const model = (config.model as string) || 'gemini-2.0-flash'
    const seedLevel = getSeedLevel(integrationConfig as Record<string, unknown>)

    const gates = extractGates(clawConfig as Record<string, unknown>)

    const files: GeneratedFile[] = []

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${agent.name}

${agent.description || 'A Google ADK agent with GuardianClaw safety validation.'}

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
   # Edit .env with your Google API key
   \`\`\`

4. Run the agent:
   \`\`\`bash
   python main.py
   \`\`\`

## Configuration

- Model: ${model}
- Seed Level: ${seedLevel}

## GuardianClaw Safety

This agent uses GuardianClaw CLAW protocol for safety validation:
- Credibility Gate: ${gates.credibility ? 'Enabled' : 'Disabled'}
- Avoidance Gate: ${gates.avoidance ? 'Enabled' : 'Disabled'}
- Limits Gate: ${gates.limits ? 'Enabled' : 'Disabled'}
- Worth Gate: ${gates.worth ? 'Enabled' : 'Disabled'}

## Environment Variables

- \`GOOGLE_API_KEY\`: Your Google AI API key
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
Safety settings for the Google ADK agent
"""

GCLAW_CONFIG = ${toPythonDict({
        seed_level: seedLevel,
        block_on_failure: integrationConfig.block_on_failure ?? true,
        fail_closed: integrationConfig.fail_closed ?? false,
        validate_inputs: integrationConfig.validate_inputs ?? true,
        validate_outputs: integrationConfig.validate_outputs ?? true,
        validate_tools: integrationConfig.validate_tools ?? true,
        max_text_size: integrationConfig.max_text_size || 100000,
        validation_timeout: integrationConfig.validation_timeout || 5.0,
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
Google ADK agent with GuardianClaw safety validation
"""

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from guardianclaw.integrations.google_adk import GuardianClawPlugin

from claw_config import GCLAW_CONFIG


def create_agent(model_name: str = '${model}'):
    """Create a Google ADK agent with GuardianClaw safety."""
    # Create GuardianClaw plugin (auto-validates inputs/outputs via callbacks)
    claw_plugin = GuardianClawPlugin(
        seed_level=GCLAW_CONFIG['seed_level'],
        block_on_failure=GCLAW_CONFIG['block_on_failure'],
        fail_closed=GCLAW_CONFIG['fail_closed'],
        validate_inputs=GCLAW_CONFIG['validate_inputs'],
        validate_outputs=GCLAW_CONFIG['validate_outputs'],
        validate_tools=GCLAW_CONFIG['validate_tools'],
        max_text_size=GCLAW_CONFIG['max_text_size'],
        validation_timeout=GCLAW_CONFIG['validation_timeout'],
    )

    # Create LLM agent
    agent = LlmAgent(
        model=model_name,
        name='${escapePythonString(agent.name)}',
        instruction=SYSTEM_INSTRUCTION,
    )

    # Create session service
    session_service = InMemorySessionService()

    # Create runner with GuardianClaw plugin
    runner = Runner(
        app_name='${escapePythonString(projectName)}',
        agent=agent,
        plugins=[claw_plugin],
        session_service=session_service,
    )

    return runner, claw_plugin


# System instruction for the agent
SYSTEM_INSTRUCTION = """You are a helpful AI assistant. Be concise and accurate in your responses."""
`,
    })

    // main.py
    files.push({
      path: 'main.py',
      content: `"""
${agent.name}
${agent.description || 'A Google ADK agent with GuardianClaw safety validation.'}
"""

import os
import asyncio
from dotenv import load_dotenv

from agent import create_agent
from claw_config import GCLAW_CONFIG


async def run_agent():
    """Run the Google ADK agent with GuardianClaw safety."""
    # Load environment variables
    load_dotenv()

    # Verify API key is set
    if not os.getenv('GOOGLE_API_KEY'):
        print('Error: Please set GOOGLE_API_KEY in .env')
        return

    # Set Google API key in environment
    os.environ['GOOGLE_GENAI_USE_VERTEXAI'] = 'false'

    # Create runner with GuardianClaw plugin
    runner, claw_plugin = create_agent()

    print('Google ADK agent initialized with GuardianClaw safety validation.')
    print(f'Seed Level: {GCLAW_CONFIG["seed_level"]}')
    print('Type "quit" to exit.\\n')

    # Session state
    user_id = 'user'
    session_id = 'session'

    while True:
        user_input = input('You: ').strip()
        if user_input.lower() in ('quit', 'exit', 'q'):
            break

        if not user_input:
            continue

        try:
            # Run agent - GuardianClaw plugin automatically validates input/output
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=user_input,
            ):
                # Check for final response
                if hasattr(event, 'content') and event.content:
                    if hasattr(event.content, 'parts'):
                        for part in event.content.parts:
                            if hasattr(part, 'text'):
                                print(f'\\nAssistant: {part.text}\\n')
                    elif isinstance(event.content, str):
                        print(f'\\nAssistant: {event.content}\\n')
        except Exception as e:
            error_msg = str(e)
            if 'blocked' in error_msg.lower():
                print(f'\\n[GuardianClaw] Request blocked for safety.\\n')
            else:
                print(f'\\nError: {e}\\n')

    # Print stats
    stats = claw_plugin.get_stats()
    print(f'\\n--- Session Stats ---')
    print(f'Total validations: {stats.get("total_validations", 0)}')
    print(f'Blocked: {stats.get("blocked_count", 0)}')


def main():
    asyncio.run(run_agent())


if __name__ == '__main__':
    main()
`,
    })

    return files
  },
}
