/**
 * Code Generator Service Tests
 */

import { describe, it, expect } from 'vitest'
import {
  hasExportSupport,
  getFrameworkLanguage,
  getSupportedFrameworks,
  generateProjectFiles,
  createZipBuffer,
  exportAgentAsZip,
} from './index'
import type { AgentData } from './types'

describe('Code Generator Service', () => {
  const mockOpenAIAgent: AgentData = {
    id: 'test-agent-2',
    name: 'Test OpenAI Agent',
    description: 'A test agent for OpenAI Agents SDK',
    framework: 'openai_agents',
    config: {
      model: 'gpt-4o',
      instructions: 'You are a helpful assistant.',
    },
    claw_config: {
      gates: {
        credibility: true,
        avoidance: true,
        limits: true,
        worth: false,
      },
    },
    integration_config: {
      guardrail_model: 'gpt-4o-mini',
    },
  }

  describe('hasExportSupport', () => {
    it('returns true for supported frameworks', () => {
      expect(hasExportSupport('openai_agents')).toBe(true)
      expect(hasExportSupport('coinbase_agentkit')).toBe(true)
      expect(hasExportSupport('solana_agent_kit')).toBe(true)
      expect(hasExportSupport('google_adk')).toBe(true)
      expect(hasExportSupport('virtuals_protocol')).toBe(true)
      expect(hasExportSupport('elizaos')).toBe(true)
    })

    it('returns false for unsupported frameworks', () => {
      expect(hasExportSupport('custom')).toBe(false)
      expect(hasExportSupport('unknown')).toBe(false)
    })
  })

  describe('getFrameworkLanguage', () => {
    it('returns python for Python frameworks', () => {
      expect(getFrameworkLanguage('openai_agents')).toBe('python')
      expect(getFrameworkLanguage('solana_agent_kit')).toBe('python')
      expect(getFrameworkLanguage('google_adk')).toBe('python')
      expect(getFrameworkLanguage('virtuals_protocol')).toBe('python')
    })

    it('returns typescript for TypeScript frameworks', () => {
      expect(getFrameworkLanguage('coinbase_agentkit')).toBe('typescript')
      expect(getFrameworkLanguage('elizaos')).toBe('typescript')
    })

    it('returns null for unsupported frameworks', () => {
      expect(getFrameworkLanguage('custom')).toBe(null)
      expect(getFrameworkLanguage('unknown')).toBe(null)
    })
  })

  describe('getSupportedFrameworks', () => {
    it('returns list of supported frameworks', () => {
      const frameworks = getSupportedFrameworks()
      expect(frameworks).toContain('openai_agents')
      expect(frameworks).toContain('coinbase_agentkit')
      expect(frameworks.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('generateProjectFiles', () => {
    it('generates files for OpenAI Agents agent', () => {
      const files = generateProjectFiles(mockOpenAIAgent)

      expect(files.length).toBeGreaterThan(0)

      const filenames = files.map((f) => f.path)
      expect(filenames).toContain('README.md')
      expect(filenames).toContain('requirements.txt')
      expect(filenames).toContain('main.py')
      expect(filenames).toContain('agent.py')
      expect(filenames).toContain('claw_config.py')
    })

    it('includes flow.json when option is set', () => {
      const agentWithFlow = {
        ...mockOpenAIAgent,
        flow: {
          nodes: [{ id: 'n1', type: 'input' }],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        },
      }

      const files = generateProjectFiles(agentWithFlow, { includeFlow: true })
      const filenames = files.map((f) => f.path)
      expect(filenames).toContain('flow.json')
    })

    it('throws error for unsupported framework', () => {
      const unsupportedAgent: AgentData = {
        id: 'test',
        name: 'Test',
        framework: 'custom',
        config: {},
        claw_config: {},
      }

      expect(() => generateProjectFiles(unsupportedAgent)).toThrow(
        'Export not supported for framework: custom'
      )
    })

    it('includes guardianclaw in requirements.txt', () => {
      const files = generateProjectFiles(mockOpenAIAgent)
      const requirements = files.find((f) => f.path === 'requirements.txt')

      expect(requirements).toBeDefined()
      expect(requirements!.content).toContain('guardianclaw')
    })

    it('includes CLAW gates in claw_config.py', () => {
      const files = generateProjectFiles(mockOpenAIAgent)
      const clawConfig = files.find((f) => f.path === 'claw_config.py')

      expect(clawConfig).toBeDefined()
      expect(clawConfig!.content).toContain('credibility')
      expect(clawConfig!.content).toContain('avoidance')
      expect(clawConfig!.content).toContain('limits')
    })
  })

  describe('createZipBuffer', () => {
    it('creates valid ZIP buffer', async () => {
      const files = [
        { path: 'test.txt', content: 'Hello World' },
        { path: 'dir/nested.txt', content: 'Nested content' },
      ]

      const buffer = await createZipBuffer(files, 'test-project')

      // Check ZIP signature
      expect(buffer[0]).toBe(0x50) // P
      expect(buffer[1]).toBe(0x4b) // K
      expect(buffer[2]).toBe(0x03) // Local file header
      expect(buffer[3]).toBe(0x04)
    })

    it('includes all files in ZIP', async () => {
      const files = [
        { path: 'a.txt', content: 'File A' },
        { path: 'b.txt', content: 'File B' },
        { path: 'c.txt', content: 'File C' },
      ]

      const buffer = await createZipBuffer(files, 'project')

      // Convert to string to check file names are present
      const text = new TextDecoder().decode(buffer)
      expect(text).toContain('project/a.txt')
      expect(text).toContain('project/b.txt')
      expect(text).toContain('project/c.txt')
    })
  })

  describe('exportAgentAsZip', () => {
    it('exports agent as ZIP with correct filename', async () => {
      const result = await exportAgentAsZip(mockOpenAIAgent)

      expect(result.filename).toBe('test-openai-agent.zip')
      expect(result.buffer).toBeInstanceOf(Uint8Array)
      expect(result.buffer.length).toBeGreaterThan(0)
    })

    it('sanitizes agent name for filename', async () => {
      const agentWithSpecialName: AgentData = {
        ...mockOpenAIAgent,
        name: 'My Agent! With @Special# Characters',
      }

      const result = await exportAgentAsZip(agentWithSpecialName)

      expect(result.filename).toBe('my-agent-with-special-characters.zip')
    })
  })
})
