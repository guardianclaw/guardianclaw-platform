/**
 * Integration tests for template-utils
 *
 * These tests verify that the template conversion works correctly
 * with the actual templates defined in templates.ts
 */

import { describe, it, expect } from 'vitest'
import {
  convertTemplateToFlow,
  buildAgentPayload,
  getDefaultProtectionLevel,
  getDefaultModulesForTemplate,
} from './template-utils'
import { getTemplateById, TEMPLATES } from './templates'

describe('template-utils integration tests', () => {
  describe('DeFi templates have maximum protection', () => {
    const defiTemplateIds = ['coinbase_agentkit', 'solana_agent_kit', 'virtuals_protocol']

    defiTemplateIds.forEach((templateId) => {
      it(`${templateId} should have maximum protection and fiduciary enabled`, () => {
        const template = getTemplateById(templateId)
        expect(template).toBeDefined()
        expect(template!.category).toBe('defi')

        const payload = buildAgentPayload(template!, { name: 'Test' }, 'maximum')

        // Verify protection level
        expect(payload.claw_config.protection_level).toBe('maximum')

        // Verify all gates enabled
        expect(payload.claw_config.gates.credibility).toBe(true)
        expect(payload.claw_config.gates.avoidance).toBe(true)
        expect(payload.claw_config.gates.limits).toBe(true)
        expect(payload.claw_config.gates.worth).toBe(true)

        // Verify fiduciary module enabled
        expect(payload.claw_config.modules['fiduciary']?.enabled).toBe(true)
        expect(payload.claw_config.modules['memory_shield']?.enabled).toBe(true)
      })
    })
  })

  describe('Framework templates have standard protection', () => {
    const frameworkTemplateIds = [
      'anthropic_sdk',
      'openai_agents',
      'google_adk',
      'elizaos',
      'voltagent',
      'moltbot',
    ]

    frameworkTemplateIds.forEach((templateId) => {
      it(`${templateId} should have standard protection`, () => {
        const template = getTemplateById(templateId)
        expect(template).toBeDefined()
        expect(template!.category).toBe('frameworks')

        const level = getDefaultProtectionLevel(template!)
        expect(level).toBe('standard')

        const payload = buildAgentPayload(template!, { name: 'Test' }, level)

        // Verify standard gates (no worth)
        expect(payload.claw_config.gates.credibility).toBe(true)
        expect(payload.claw_config.gates.avoidance).toBe(true)
        expect(payload.claw_config.gates.limits).toBe(true)
        expect(payload.claw_config.gates.worth).toBe(false)
      })
    })
  })

  describe('Flow conversion produces valid canvas format', () => {
    it('Coinbase flow should have 6 nodes including fiduciary module', () => {
      const template = getTemplateById('coinbase_agentkit')!
      const flow = convertTemplateToFlow(template)

      expect(flow.nodes.length).toBe(6)
      expect(flow.edges.length).toBe(5)

      // Should have a tool node for fiduciary
      const toolNode = flow.nodes.find((n: any) => n.type === 'tool')
      expect(toolNode).toBeDefined()
      expect(toolNode!.data.label).toContain('Fiduciary')
    })

    it('All templates produce valid flow structures', () => {
      TEMPLATES.forEach((template) => {
        const flow = convertTemplateToFlow(template)

        // Every flow should have at least input, process, output
        const hasInput = flow.nodes.some((n: any) => n.type === 'input')
        const hasProcess = flow.nodes.some((n: any) => n.type === 'process')
        const hasOutput = flow.nodes.some((n: any) => n.type === 'output')

        expect(hasInput).toBe(true)
        expect(hasProcess).toBe(true)
        expect(hasOutput).toBe(true)

        // Edges should connect valid nodes
        const nodeIds = flow.nodes.map((n: any) => n.id)
        flow.edges.forEach((edge: any) => {
          expect(nodeIds).toContain(edge.source)
          expect(nodeIds).toContain(edge.target)
        })
      })
    })
  })

  describe('DeFi templates are properly configured', () => {
    it('Google ADK template should have correct integration config', () => {
      const template = getTemplateById('google_adk')!
      expect(template.sdkIntegration).toBe('guardianclaw.integrations.google_adk')
      expect(template.integrationConfig).toBeDefined()
      expect(template.integrationConfig!.seed_level).toBe('standard')
      expect(template.integrationConfig!.validate_inputs).toBe(true)
      expect(template.integrationConfig!.validate_outputs).toBe(true)
    })

    it('Virtuals Protocol template should have correct integration config', () => {
      const template = getTemplateById('virtuals_protocol')!
      expect(template.sdkIntegration).toBe('guardianclaw.integrations.virtuals')
      expect(template.integrationConfig).toBeDefined()
      expect(template.integrationConfig!.block_unsafe).toBe(true)
      expect(template.integrationConfig!.fiduciary_enabled).toBe(true)
    })

    it('Solana Agent Kit template should have correct integration config', () => {
      const template = getTemplateById('solana_agent_kit')!
      expect(template.sdkIntegration).toBe('guardianclaw.integrations.solana')
      expect(template.integrationConfig).toBeDefined()
      expect(template.integrationConfig!.fiduciary_enabled).toBe(true)
      expect(template.integrationConfig!.spending_limits).toBeDefined()
    })
  })

  describe('Anthropic SDK template', () => {
    it('Anthropic SDK template should have correct validation config', () => {
      const template = getTemplateById('anthropic_sdk')!
      expect(template.sdkIntegration).toBe('guardianclaw.integrations.anthropic_sdk')
      expect(template.integrationConfig).toBeDefined()
      expect(template.integrationConfig!.use_heuristic_fallback).toBe(true)
      expect(template.integrationConfig!.block_unsafe_output).toBe(true)
      expect(template.integrationConfig!.enable_seed_injection).toBe(true)

      // Should enable llm_claw for dual-layer validation
      const modules = getDefaultModulesForTemplate(template)
      expect(modules['llm_claw']?.enabled).toBe(true)

      // Standard 5-node flow
      const flow = convertTemplateToFlow(template)
      expect(flow.nodes.length).toBe(5)
      expect(flow.edges.length).toBe(4)
    })
  })

  describe('VoltAgent template', () => {
    it('VoltAgent template should have correct TypeScript/Node.js flow structure', () => {
      const template = getTemplateById('voltagent')!
      expect(template.sdkIntegration).toBe('@guardianclaw/voltagent')
      expect(template.integrationConfig).toBeDefined()

      // GuardianClawBundleConfig fields from SDK
      expect(template.integrationConfig!.level).toBe('standard')
      expect(template.integrationConfig!.enablePII).toBe(false)
      expect(template.integrationConfig!.streamingPII).toBe(false)

      // GuardianClawGuardrailConfig fields from SDK
      expect(template.integrationConfig!.blockUnsafe).toBe(true)
      expect(template.integrationConfig!.logChecks).toBe(false)
      expect(template.integrationConfig!.enableCLAW).toBe(true)
      expect(template.integrationConfig!.enableOWASP).toBe(true)
      expect(template.integrationConfig!.maxContentLength).toBe(100000)
      expect(template.integrationConfig!.timeout).toBe(5000)

      // Standard 5-node flow
      const flow = convertTemplateToFlow(template)
      expect(flow.nodes.length).toBe(5)
      expect(flow.edges.length).toBe(4)

      // Should have standard input/output guardrails
      const clawNodes = flow.nodes.filter((n: any) => n.type === 'claw')
      expect(clawNodes.length).toBe(2)
    })

    it('VoltAgent template should build valid payload', () => {
      const template = getTemplateById('voltagent')!
      const payload = buildAgentPayload(template, { name: `Test ${template.name}` }, 'standard')

      expect(payload.name).toBe(`Test ${template.name}`)
      expect(payload.framework).toBe('voltagent')
      expect(payload.flow.nodes.length).toBeGreaterThan(0)
      expect(payload.flow.edges.length).toBeGreaterThan(0)
      expect(payload.integration_config).toBeDefined()
    })
  })

  describe('Payload structure matches API expectations', () => {
    it('Generated payload should have all required fields', () => {
      const template = getTemplateById('openai_agents')!
      const payload = buildAgentPayload(template, { name: 'Test Agent' }, 'standard')

      // Required fields for API
      expect(payload.name).toBeDefined()
      expect(typeof payload.name).toBe('string')
      expect(payload.description).toBeDefined()
      expect(payload.framework).toBe('openai_agents')
      expect(payload.flow).toBeDefined()
      expect(payload.flow.nodes).toBeDefined()
      expect(payload.flow.edges).toBeDefined()
      expect(payload.config).toBeDefined()
      expect(payload.claw_config).toBeDefined()
      expect(payload.claw_config.protection_level).toBeDefined()
      expect(payload.claw_config.gates).toBeDefined()
      expect(payload.claw_config.modules).toBeDefined()
      expect(payload.integration_config).toBeDefined()
    })

    it('Framework IDs match backend enum', () => {
      // These must match the backend enum in agents.ts
      const validFrameworks = [
        'anthropic_sdk',
        'openai_agents',
        'coinbase_agentkit',
        'solana_agent_kit',
        'google_adk',
        'virtuals_protocol',
        'elizaos',
        'voltagent',
        'moltbot',
        'custom',
      ]

      TEMPLATES.forEach((template) => {
        expect(validFrameworks).toContain(template.id)
      })
    })
  })
})
