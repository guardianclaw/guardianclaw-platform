/**
 * Tool Executor Tests
 *
 * Tests for tool execution orchestration including:
 * - Tool extraction from flow
 * - Template variable resolution
 * - Sequential execution
 * - Result aggregation
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  executeTool,
  extractToolNodes,
  executeFlowTools,
  aggregateToolResults,
  type ToolNodeConfig,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from './tool-executor'

// Mock DNS resolver to avoid external DNS calls
vi.mock('./dns-resolver', () => ({
  resolveAndValidateUrl: vi.fn(() =>
    Promise.resolve({ safe: true, ip: '104.16.132.229', latencyMs: 1 })
  ),
}))

// Mock the web search module
vi.mock('./web-search', () => ({
  executeWebSearch: vi.fn().mockImplementation(async (config) => {
    if (config.query === 'error') {
      return {
        success: false,
        results: [],
        provider: config.provider,
        query: config.query,
        latencyMs: 50,
        error: 'Test error',
        errorCode: 'TEST_ERROR',
      }
    }
    return {
      success: true,
      results: [
        {
          title: `Result for ${config.query}`,
          link: 'https://example.com/1',
          snippet: 'Test snippet',
          position: 1,
        },
      ],
      provider: config.provider,
      query: config.query,
      latencyMs: 100,
    }
  }),
}))

// Mock the credentials function
vi.mock('../../routes/tool-credentials', () => ({
  getDecryptedCredential: vi.fn().mockResolvedValue({
    credential: 'test-api-key',
    config: {},
  }),
}))

// ============================================
// EXTRACT TOOL NODES TESTS
// ============================================

describe('extractToolNodes', () => {
  it('extracts tool nodes from flow', () => {
    const nodes = [
      { type: 'input', data: { label: 'Input' } },
      { type: 'tool', data: { toolType: 'web_search', config: { provider: 'duckduckgo' } } },
      { type: 'process', data: { label: 'LLM' } },
      { type: 'tool', data: { toolType: 'api_request', config: { method: 'GET' } } },
      { type: 'output', data: { label: 'Output' } },
    ]

    const toolNodes = extractToolNodes(nodes)

    expect(toolNodes).toHaveLength(2)
    expect(toolNodes[0].toolType).toBe('web_search')
    expect(toolNodes[1].toolType).toBe('api_request')
  })

  it('returns empty array when no tools', () => {
    const nodes = [
      { type: 'input', data: { label: 'Input' } },
      { type: 'process', data: { label: 'LLM' } },
      { type: 'output', data: { label: 'Output' } },
    ]

    const toolNodes = extractToolNodes(nodes)

    expect(toolNodes).toHaveLength(0)
  })

  it('handles nodes without data', () => {
    const nodes = [{ type: 'tool' }, { type: 'tool', data: {} }]

    const toolNodes = extractToolNodes(nodes)

    expect(toolNodes).toHaveLength(2)
    expect(toolNodes[0].toolType).toBe('web_search') // Default
    expect(toolNodes[0].config).toEqual({})
  })
})

// ============================================
// EXECUTE TOOL TESTS
// ============================================

describe('executeTool', () => {
  const baseContext: ToolExecutionContext = {
    currentInput: 'test query',
    initialInput: 'test query',
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('executes web_search tool', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'web_search',
      config: { provider: 'duckduckgo', max_results: 5 },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(true)
    expect(result.toolType).toBe('web_search')
    expect(result.output).toBeInstanceOf(Array)
    expect(result.outputText).toBeDefined()
  })

  it('handles web_search error', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'web_search',
      config: { provider: 'duckduckgo', query: 'error' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Test error')
    expect(result.errorCode).toBe('TEST_ERROR')
  })

  it('executes api_request tool', async () => {
    // Mock successful API response
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const toolConfig: ToolNodeConfig = {
      toolType: 'api_request',
      config: { method: 'GET', url: 'https://api.example.com/data' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.toolType).toBe('api_request')
    expect(result.success).toBe(true)
    expect(result.output).toEqual({ data: 'test' })
  })

  it('returns error for api_request with missing URL', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'api_request',
      config: { method: 'GET' }, // Missing URL
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('MISSING_URL')
  })

  it('returns error for api_request with blocked URL', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'api_request',
      config: { method: 'GET', url: 'http://localhost:3000/api' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_URL')
  })

  it('executes code_exec tool via Modal', async () => {
    // Mock fetch for Modal API call
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          stdout: 'hello\n',
          stderr: '',
          exit_code: 0,
          execution_time_ms: 150,
        }),
        { status: 200 }
      )
    )

    const toolConfig: ToolNodeConfig = {
      toolType: 'code_exec',
      config: { language: 'python', code: 'print("hello")' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.toolType).toBe('code_exec')
    expect(result.success).toBe(true)
    expect(result.output).toBe('hello')
  })

  it('returns error for invalid code_exec language', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'code_exec',
      config: { language: 'ruby', code: 'puts "hello"' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_LANGUAGE')
  })

  it('returns error for missing code in code_exec', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'code_exec',
      config: { language: 'python', code: '' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('MISSING_CODE')
  })

  it('returns not implemented for database', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'database',
      config: { db_type: 'postgresql', query: 'SELECT 1' },
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NOT_IMPLEMENTED')
  })

  it('handles unknown tool type', async () => {
    const toolConfig: ToolNodeConfig = {
      toolType: 'unknown' as unknown,
      config: {},
    }

    const result = await executeTool(toolConfig, baseContext, null)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('UNKNOWN_TOOL')
  })
})

// ============================================
// EXECUTE FLOW TOOLS TESTS
// ============================================

describe('executeFlowTools', () => {
  const baseContext: ToolExecutionContext = {
    currentInput: 'initial query',
    initialInput: 'initial query',
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('executes multiple tools sequentially', async () => {
    const nodes = [
      { type: 'tool', data: { toolType: 'web_search', config: { provider: 'duckduckgo' } } },
      { type: 'tool', data: { toolType: 'web_search', config: { provider: 'serper' } } },
    ]

    const results = await executeFlowTools(nodes, baseContext, null)

    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
  })

  it('returns empty array when no tools', async () => {
    const nodes = [
      { type: 'input', data: {} },
      { type: 'output', data: {} },
    ]

    const results = await executeFlowTools(nodes, baseContext, null)

    expect(results).toHaveLength(0)
  })

  it('continues execution even if a tool fails', async () => {
    const nodes = [
      { type: 'tool', data: { toolType: 'web_search', config: { query: 'error' } } },
      { type: 'tool', data: { toolType: 'web_search', config: { provider: 'duckduckgo' } } },
    ]

    const results = await executeFlowTools(nodes, baseContext, null)

    expect(results).toHaveLength(2)
    expect(results[0].success).toBe(false)
    expect(results[1].success).toBe(true)
  })
})

// ============================================
// AGGREGATE RESULTS TESTS
// ============================================

describe('aggregateToolResults', () => {
  it('aggregates successful results', () => {
    const results: ToolExecutionResult[] = [
      {
        success: true,
        output: [{ title: 'Test', link: 'https://test.com', snippet: 'Test' }],
        outputText: 'Found 1 result for "test":\n\n1. Test',
        toolType: 'web_search',
        latencyMs: 100,
      },
    ]

    const aggregated = aggregateToolResults(results)

    expect(aggregated).toContain('[WEB_SEARCH RESULTS]')
    expect(aggregated).toContain('Found 1 result')
  })

  it('returns empty string for no results', () => {
    const aggregated = aggregateToolResults([])

    expect(aggregated).toBe('')
  })

  it('skips failed results', () => {
    const results: ToolExecutionResult[] = [
      {
        success: false,
        output: null,
        toolType: 'web_search',
        latencyMs: 50,
        error: 'Failed',
      },
    ]

    const aggregated = aggregateToolResults(results)

    expect(aggregated).toBe('')
  })

  it('combines multiple successful results', () => {
    const results: ToolExecutionResult[] = [
      {
        success: true,
        output: [],
        outputText: 'Result 1',
        toolType: 'web_search',
        latencyMs: 100,
      },
      {
        success: true,
        output: [],
        outputText: 'Result 2',
        toolType: 'web_search',
        latencyMs: 100,
      },
    ]

    const aggregated = aggregateToolResults(results)

    expect(aggregated).toContain('Result 1')
    expect(aggregated).toContain('Result 2')
    expect(aggregated).toContain('---') // Separator
  })
})

// ============================================
// TEMPLATE VARIABLE TESTS
// ============================================

describe('Template variable resolution', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resolves {{current_input}}', async () => {
    const { executeWebSearch } = await import('./web-search')

    const toolConfig: ToolNodeConfig = {
      toolType: 'web_search',
      config: { query: '{{current_input}}', provider: 'duckduckgo' },
    }

    const context: ToolExecutionContext = {
      currentInput: 'resolved query',
      initialInput: 'initial',
    }

    await executeTool(toolConfig, context, null)

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'resolved query' })
    )
  })

  it('resolves {{initial_input}}', async () => {
    const { executeWebSearch } = await import('./web-search')

    const toolConfig: ToolNodeConfig = {
      toolType: 'web_search',
      config: { query: '{{initial_input}}', provider: 'duckduckgo' },
    }

    const context: ToolExecutionContext = {
      currentInput: 'current',
      initialInput: 'initial query',
    }

    await executeTool(toolConfig, context, null)

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'initial query' })
    )
  })

  it('uses currentInput when query is empty', async () => {
    const { executeWebSearch } = await import('./web-search')

    const toolConfig: ToolNodeConfig = {
      toolType: 'web_search',
      config: { provider: 'duckduckgo' }, // No query specified
    }

    const context: ToolExecutionContext = {
      currentInput: 'default query',
      initialInput: 'initial',
    }

    await executeTool(toolConfig, context, null)

    expect(executeWebSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'default query' })
    )
  })
})
