import { describe, it, expect } from 'vitest'
import {
  convertTemplateToFlow,
  getDefaultProtectionLevel,
  getGatesForProtectionLevel,
  getDefaultModulesForTemplate,
  buildAgentPayload,
} from './template-utils'
import { TEMPLATES, getTemplateById } from './templates'

describe('template-utils', () => {
  describe('getGatesForProtectionLevel', () => {
    it('should return correct gates for minimal level', () => {
      const gates = getGatesForProtectionLevel('minimal')
      expect(gates).toEqual({
        credibility: false,
        avoidance: true,
        limits: false,
        worth: false,
      })
    })

    it('should return correct gates for standard level', () => {
      const gates = getGatesForProtectionLevel('standard')
      expect(gates).toEqual({
        credibility: true,
        avoidance: true,
        limits: true,
        worth: false,
      })
    })

    it('should return correct gates for maximum level', () => {
      const gates = getGatesForProtectionLevel('maximum')
      expect(gates).toEqual({
        credibility: true,
        avoidance: true,
        limits: true,
        worth: true,
      })
    })
  })

  describe('getDefaultProtectionLevel', () => {
    it('should return maximum for DeFi templates', () => {
      const defiTemplates = TEMPLATES.filter((t) => t.category === 'defi')
      expect(defiTemplates.length).toBeGreaterThan(0)

      defiTemplates.forEach((template) => {
        const level = getDefaultProtectionLevel(template)
        expect(level).toBe('maximum')
      })
    })

    it('should return standard for framework templates', () => {
      const frameworkTemplates = TEMPLATES.filter((t) => t.category === 'frameworks')
      expect(frameworkTemplates.length).toBeGreaterThan(0)

      frameworkTemplates.forEach((template) => {
        const level = getDefaultProtectionLevel(template)
        expect(level).toBe('standard')
      })
    })

    it('should return correct levels for specific templates', () => {
      const openai = getTemplateById('openai_agents')
      const coinbase = getTemplateById('coinbase_agentkit')
      const solana = getTemplateById('solana_agent_kit')

      expect(openai).toBeDefined()
      expect(coinbase).toBeDefined()
      expect(solana).toBeDefined()

      expect(getDefaultProtectionLevel(openai!)).toBe('standard')
      expect(getDefaultProtectionLevel(coinbase!)).toBe('maximum')
      expect(getDefaultProtectionLevel(solana!)).toBe('maximum')
    })
  })

  describe('getDefaultModulesForTemplate', () => {
    it('should enable fiduciary for DeFi templates', () => {
      const coinbase = getTemplateById('coinbase_agentkit')!
      const modules = getDefaultModulesForTemplate(coinbase)

      expect(modules['fiduciary']).toBeDefined()
      expect(modules['fiduciary'].enabled).toBe(true)
    })

    it('should enable memory_shield for DeFi templates', () => {
      const solana = getTemplateById('solana_agent_kit')!
      const modules = getDefaultModulesForTemplate(solana)

      expect(modules['memory_shield']).toBeDefined()
      expect(modules['memory_shield'].enabled).toBe(true)
    })

    it('should preserve template-defined module states', () => {
      const openai = getTemplateById('openai_agents')!
      const modules = getDefaultModulesForTemplate(openai)

      // OpenAI Agents enables input_validator and output_validator by default
      expect(modules['input_validator']?.enabled).toBe(true)
      expect(modules['output_validator']?.enabled).toBe(true)
    })

    it('should not enable fiduciary for non-DeFi templates', () => {
      const openai = getTemplateById('openai_agents')!
      const modules = getDefaultModulesForTemplate(openai)

      // Fiduciary should not be force-enabled for frameworks
      // (it may be defined but not enabled)
      if (modules['fiduciary']) {
        expect(modules['fiduciary'].enabled).toBe(false)
      }
    })
  })

  describe('convertTemplateToFlow', () => {
    it('should convert all templates without errors', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        expect(flow).toBeDefined()
        expect(flow.nodes).toBeDefined()
        expect(flow.edges).toBeDefined()
        expect(Array.isArray(flow.nodes)).toBe(true)
        expect(Array.isArray(flow.edges)).toBe(true)
      })
    })

    it('should preserve node count from template', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)
        expect(flow.nodes.length).toBe(template.defaultFlow.nodes.length)
      })
    })

    it('should preserve edge count from template', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)
        expect(flow.edges.length).toBe(template.defaultFlow.edges.length)
      })
    })

    it('should assign positions to all nodes', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        flow.nodes.forEach((node: any) => {
          expect(node.position).toBeDefined()
          expect(typeof node.position.x).toBe('number')
          expect(typeof node.position.y).toBe('number')
          expect(node.position.x).toBeGreaterThanOrEqual(0)
          expect(node.position.y).toBeGreaterThanOrEqual(0)
        })
      })
    })

    it('should convert node types correctly', () => {
      const openai = getTemplateById('openai_agents')!
      const flow = convertTemplateToFlow(openai)

      // Find nodes by their original IDs
      const inputNode = flow.nodes.find((n: any) => n.id === 'input-1')
      const clawNode = flow.nodes.find((n: any) => n.id === 'claw-in')
      const llmNode = flow.nodes.find((n: any) => n.id === 'llm-1')
      const outputNode = flow.nodes.find((n: any) => n.id === 'output-1')

      expect(inputNode?.type).toBe('input')
      expect(clawNode?.type).toBe('claw')
      expect(llmNode?.type).toBe('process') // 'llm' -> 'process'
      expect(outputNode?.type).toBe('output')
    })

    it('should set animated edges', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        flow.edges.forEach((edge: any) => {
          expect(edge.animated).toBe(true)
          expect(edge.type).toBe('smoothstep')
        })
      })
    })

    it('should include node data with labels', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        flow.nodes.forEach((node: any) => {
          expect(node.data).toBeDefined()
          expect(node.data.label).toBeDefined()
          expect(typeof node.data.label).toBe('string')
          expect(node.data.label.length).toBeGreaterThan(0)
        })
      })
    })

    it('should include config for claw nodes', () => {
      const openai = getTemplateById('openai_agents')!
      const flow = convertTemplateToFlow(openai)

      const clawNodes = flow.nodes.filter((n: any) => n.type === 'claw')
      expect(clawNodes.length).toBeGreaterThan(0)

      clawNodes.forEach((node: any) => {
        expect(node.data.gateType).toBe('all')
        expect(node.data.config).toBeDefined()
        expect(node.data.config.enabled).toBe(true)
      })
    })

    it('should calculate positions in layers (topological order)', () => {
      const openai = getTemplateById('openai_agents')!
      const flow = convertTemplateToFlow(openai)

      // OpenAI Agents flow: input -> claw-in -> llm -> claw-out -> output
      // Nodes should be positioned left-to-right
      const inputNode = flow.nodes.find((n: any) => n.id === 'input-1') as any
      const clawIn = flow.nodes.find((n: any) => n.id === 'claw-in') as any
      const llmNode = flow.nodes.find((n: any) => n.id === 'llm-1') as any
      const clawOut = flow.nodes.find((n: any) => n.id === 'claw-out') as any
      const outputNode = flow.nodes.find((n: any) => n.id === 'output-1') as any

      // Each subsequent node should be to the right of the previous
      expect(inputNode.position.x).toBeLessThan(clawIn.position.x)
      expect(clawIn.position.x).toBeLessThan(llmNode.position.x)
      expect(llmNode.position.x).toBeLessThan(clawOut.position.x)
      expect(clawOut.position.x).toBeLessThan(outputNode.position.x)
    })
  })

  describe('buildAgentPayload', () => {
    it('should build complete payload for OpenAI Agents template', () => {
      const openai = getTemplateById('openai_agents')!
      const userConfig = {
        name: 'My Test Agent',
        model: 'gpt-4o',
        instructions: 'You are a helpful assistant.',
      }

      const payload = buildAgentPayload(openai, userConfig, 'standard')

      expect(payload.name).toBe('My Test Agent')
      expect(payload.description).toBe(openai.description)
      expect(payload.framework).toBe('openai_agents')
      expect(payload.icon).toBe(openai.icon)
      expect(payload.flow).toBeDefined()
      expect(payload.flow.nodes.length).toBeGreaterThan(0)
      expect(payload.flow.edges.length).toBeGreaterThan(0)
      expect(payload.config.template_id).toBe('openai_agents')
      expect(payload.config.model).toBe('gpt-4o')
      expect(payload.claw_config.protection_level).toBe('standard')
      expect(payload.claw_config.gates).toEqual({
        credibility: true,
        avoidance: true,
        limits: true,
        worth: false,
      })
    })

    it('should build payload with maximum protection for DeFi', () => {
      const coinbase = getTemplateById('coinbase_agentkit')!
      const userConfig = {
        name: 'DeFi Agent',
        securityProfile: 'strict',
        spendingLimit: 1000,
      }

      const payload = buildAgentPayload(coinbase, userConfig, 'maximum')

      expect(payload.name).toBe('DeFi Agent')
      expect(payload.framework).toBe('coinbase_agentkit')
      expect(payload.claw_config.protection_level).toBe('maximum')
      expect(payload.claw_config.gates.worth).toBe(true)
      expect(payload.claw_config.modules['fiduciary']?.enabled).toBe(true)
    })

    it('should use template name as fallback when name not provided', () => {
      const openai = getTemplateById('openai_agents')!
      const userConfig = {
        model: 'gpt-4o',
      }

      const payload = buildAgentPayload(openai, userConfig, 'standard')

      expect(payload.name).toBe(openai.name)
    })

    it('should include integration_config from template', () => {
      const openai = getTemplateById('openai_agents')!
      const payload = buildAgentPayload(openai, { name: 'Test' }, 'standard')

      expect(payload.integration_config).toBeDefined()
      expect(payload.integration_config.guardrail_model).toBe('gpt-4o-mini')
      expect(payload.integration_config.require_all_gates).toBe(true)
    })

    it('should not include name in config object', () => {
      const openai = getTemplateById('openai_agents')!
      const userConfig = {
        name: 'Test Agent',
        model: 'gpt-4o',
      }

      const payload = buildAgentPayload(openai, userConfig, 'standard')

      expect(payload.config.name).toBeUndefined()
      expect(payload.config.model).toBe('gpt-4o')
    })

    it('should build payload for all templates without errors', () => {
      TEMPLATES.forEach((template) => {
        const userConfig = { name: `Test ${template.name}` }
        const level = getDefaultProtectionLevel(template)

        expect(() => {
          const payload = buildAgentPayload(template, userConfig, level)
          expect(payload).toBeDefined()
          expect(payload.name).toBe(`Test ${template.name}`)
          expect(payload.framework).toBe(template.id)
        }).not.toThrow()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle template with single node', () => {
      // Custom template has minimal flow
      const custom = getTemplateById('custom')!
      const flow = convertTemplateToFlow(custom)

      expect(flow.nodes.length).toBe(custom.defaultFlow.nodes.length)
      expect(flow.edges.length).toBe(custom.defaultFlow.edges.length)
    })

    it('should handle empty user config', () => {
      const openai = getTemplateById('openai_agents')!
      const payload = buildAgentPayload(openai, {}, 'standard')

      expect(payload.name).toBe(openai.name)
      expect(payload.config.template_id).toBe('openai_agents')
    })

    it('should handle whitespace-only name', () => {
      const openai = getTemplateById('openai_agents')!
      const payload = buildAgentPayload(openai, { name: '   ' }, 'standard')

      expect(payload.name).toBe(openai.name)
    })
  })

  describe('template coverage', () => {
    const expectedTemplates = [
      'anthropic_sdk',
      'openai_agents',
      'coinbase_agentkit',
      'solana_agent_kit',
      'google_adk',
      'virtuals_protocol',
      'elizaos',
      'voltagent',
      'openclaw',
      'custom',
    ]

    it('should have all expected templates defined', () => {
      expectedTemplates.forEach((templateId) => {
        const template = getTemplateById(templateId)
        expect(template).toBeDefined()
        expect(template?.id).toBe(templateId)
      })
    })

    it('should have defaultFlow for all templates', () => {
      expectedTemplates.forEach((templateId) => {
        const template = getTemplateById(templateId)!
        expect(template.defaultFlow).toBeDefined()
        expect(template.defaultFlow.nodes).toBeDefined()
        expect(template.defaultFlow.edges).toBeDefined()
        expect(template.defaultFlow.nodes.length).toBeGreaterThan(0)
      })
    })

    it('should have integrationConfig for all templates except custom', () => {
      expectedTemplates
        .filter((id) => id !== 'custom')
        .forEach((templateId) => {
          const template = getTemplateById(templateId)!
          expect(template.integrationConfig).toBeDefined()
        })
    })
  })
})
