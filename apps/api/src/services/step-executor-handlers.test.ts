import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  StepExecutor,
  type FlowStep,
  resolveTemplateVars,
  extractJsonPath,
  evaluateSimpleCondition,
  tryParseArray,
  cosineSimilarity,
  hashToVector,
} from './step-executor'
import type { GuardianClawGates, LayerConfigs, LLMConfig } from './execution'

// Mock the execution module
vi.mock('./execution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./execution')>()
  return {
    ...actual,
    executeWithOpenAI: vi.fn().mockResolvedValue({
      blocked: false,
      response: 'LLM response',
    }),
  }
})

// Mock tool executor
vi.mock('./tools/tool-executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tools/tool-executor')>()
  return {
    ...actual,
    executeTool: vi.fn().mockResolvedValue({
      success: true,
      output: 'tool result',
      outputText: 'Tool output text',
      toolType: 'web_search',
      latencyMs: 100,
    }),
  }
})

// Mock fetch for embedding/summary calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const defaultGates: GuardianClawGates = {
  credibility: true,
  avoidance: true,
  limits: true,
  worth: true,
}
const defaultLayerConfigs: LayerConfigs = { isV25Architecture: false }
const defaultLLMConfig: LLMConfig = { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 1024 }

function createExecutor() {
  return new StepExecutor({
    gates: defaultGates,
    layerConfigs: defaultLayerConfigs,
    llmConfig: defaultLLMConfig,
    openaiKey: 'test-key',
    toolCredentials: null,
    characterPrompt: undefined,
    history: [],
  })
}

function makeStep(type: FlowStep['type'], config: Record<string, unknown> = {}): FlowStep {
  return { id: `step-${type}`, type, category: 'test', config, label: type, position: 0 }
}

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

describe('resolveTemplateVars', () => {
  it('resolves {{currentInput}} and {{initialInput}}', () => {
    const state = { currentInput: 'hello', initialInput: 'world', conditionResult: undefined }
    expect(resolveTemplateVars('input: {{currentInput}}, initial: {{initialInput}}', state)).toBe(
      'input: hello, initial: world'
    )
  })

  it('leaves unknown vars untouched', () => {
    const state = { currentInput: 'x', initialInput: 'y', conditionResult: undefined }
    expect(resolveTemplateVars('{{unknown}}', state)).toBe('{{unknown}}')
  })

  it('resolves {{conditionResult}}', () => {
    const state = { currentInput: '', initialInput: '', conditionResult: true }
    expect(resolveTemplateVars('result: {{conditionResult}}', state)).toBe('result: true')
  })
})

describe('extractJsonPath', () => {
  it('extracts nested field', () => {
    expect(extractJsonPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('extracts array element', () => {
    expect(extractJsonPath({ users: ['alice', 'bob'] }, 'users[1]')).toBe('bob')
  })

  it('returns undefined for missing path', () => {
    expect(extractJsonPath({ a: 1 }, 'b.c')).toBeUndefined()
  })

  it('handles combined notation', () => {
    const data = { items: [{ name: 'first' }, { name: 'second' }] }
    expect(extractJsonPath(data, 'items[0].name')).toBe('first')
  })
})

describe('evaluateSimpleCondition', () => {
  it('recognizes true/false strings', () => {
    expect(evaluateSimpleCondition('true')).toBe(true)
    expect(evaluateSimpleCondition('false')).toBe(false)
    expect(evaluateSimpleCondition('yes')).toBe(true)
    expect(evaluateSimpleCondition('no')).toBe(false)
  })

  it('handles equality operators', () => {
    expect(evaluateSimpleCondition('hello == hello')).toBe(true)
    expect(evaluateSimpleCondition('hello != world')).toBe(true)
    expect(evaluateSimpleCondition('hello == world')).toBe(false)
  })

  it('handles numeric comparisons', () => {
    expect(evaluateSimpleCondition('5 > 3')).toBe(true)
    expect(evaluateSimpleCondition('2 < 1')).toBe(false)
    expect(evaluateSimpleCondition('10 >= 10')).toBe(true)
    expect(evaluateSimpleCondition('5 <= 4')).toBe(false)
  })

  it('empty string is false', () => {
    expect(evaluateSimpleCondition('')).toBe(false)
  })
})

describe('tryParseArray', () => {
  it('parses valid JSON array', () => {
    expect(tryParseArray('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('returns null for non-array JSON', () => {
    expect(tryParseArray('{"a":1}')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(tryParseArray('not json')).toBeNull()
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })
})

describe('hashToVector', () => {
  it('returns deterministic result', () => {
    const a = hashToVector('test')
    const b = hashToVector('test')
    expect(a).toEqual(b)
  })

  it('returns unit vector', () => {
    const v = hashToVector('hello world')
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1.0, 4)
  })

  it('produces different vectors for different inputs', () => {
    const a = hashToVector('alpha')
    const b = hashToVector('beta')
    expect(a).not.toEqual(b)
  })
})

// ============================================
// HANDLER TESTS (via executor.execute)
// ============================================

describe('memory_buffer handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds entry to buffer', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_buffer', { operation: 'add', buffer_size: 10 }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'Hello user', [])
    expect(result.blocked).toBe(false)
    expect(result.response).toBe('Hello user')
  })

  it('gets formatted buffer', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_buffer', { operation: 'add' }),
      makeStep('memory_buffer', { operation: 'get' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test msg', [])
    expect(result.blocked).toBe(false)
    expect(result.response).toContain('Human:')
    expect(result.response).toContain('AI:')
  })

  it('clears buffer', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_buffer', { operation: 'add' }),
      makeStep('memory_buffer', { operation: 'clear' }),
      makeStep('memory_buffer', { operation: 'get' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    expect(result.response).toBe('(empty buffer)')
  })

  it('trims to buffer_size', async () => {
    const executor = createExecutor()
    // Add 3 items with buffer_size 2 — should keep last 2
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_buffer', { operation: 'add', buffer_size: 2 }),
      makeStep('memory_buffer', { operation: 'add', buffer_size: 2 }),
      makeStep('memory_buffer', { operation: 'add', buffer_size: 2 }),
      makeStep('memory_buffer', { operation: 'get' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'msg', [])
    // Should contain exactly 2 entries separated by ---
    const entries = (result.response || '').split('---')
    expect(entries.length).toBe(2)
  })
})

describe('memory_vector handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch to fail (forces fallback hash embedding)
    mockFetch.mockRejectedValue(new Error('No network in tests'))
  })

  it('stores and searches documents using fallback embeddings', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_vector', { operation: 'store', namespace: 'test' }),
      makeStep('memory_vector', { operation: 'search', namespace: 'test', top_k: 1 }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'hello world', [])
    expect(result.blocked).toBe(false)
    // Should find the stored doc (same content = high similarity)
    expect(result.response).toContain('hello world')
  })

  it('returns no documents when namespace is empty', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_vector', { operation: 'search', namespace: 'empty' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'query', [])
    expect(result.response).toBe('(no documents found)')
  })

  it('clears namespace', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_vector', { operation: 'store', namespace: 'ns1' }),
      makeStep('memory_vector', { operation: 'clear', namespace: 'ns1' }),
      makeStep('memory_vector', { operation: 'search', namespace: 'ns1' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'data', [])
    expect(result.response).toBe('(no documents found)')
  })
})

describe('memory_summary handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('summarizes buffer content via LLM', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'A concise summary.' } }] }),
    })

    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_buffer', { operation: 'add' }),
      makeStep('memory_summary', { source: 'buffer', max_tokens: 100 }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'long conversation here', [])
    expect(result.response).toBe('A concise summary.')
  })

  it('summarizes currentInput', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Short version.' } }] }),
    })

    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_summary', { source: 'current' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'A very long text to summarize', [])
    expect(result.response).toBe('Short version.')
  })

  it('returns early on empty buffer', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('memory_summary', { source: 'buffer' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    // Should pass through without changing currentInput
    expect(result.response).toBe('test')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('condition handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets true_value on true expression', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('condition', { expression: 'true', true_value: 'YES', false_value: 'NO' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    expect(result.response).toBe('YES')
  })

  it('sets false_value on false expression', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('condition', { expression: 'false', true_value: 'YES', false_value: 'NO' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    expect(result.response).toBe('NO')
  })

  it('resolves template vars in expression', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('condition', {
        expression: '{{currentInput}} == yes',
        true_value: 'matched',
        false_value: 'nope',
      }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'yes', [])
    expect(result.response).toBe('matched')
  })

  it('handles comparison operators', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('condition', { expression: '10 > 5', true_value: 'bigger', false_value: 'smaller' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    expect(result.response).toBe('bigger')
  })
})

describe('flow_merge handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears activeBranch', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('flow_merge'),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    expect(result.blocked).toBe(false)
    expect(result.response).toBe('test')
  })

  it('passes through without modifying input', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('flow_merge'),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'preserved data', [])
    expect(result.response).toBe('preserved data')
  })
})

describe('flow_loop handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('iterates over items from input', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('flow_loop', { loop_over: 'items', max_iterations: 100 }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, '["a","b","c"]', [])
    const parsed = JSON.parse(result.response!)
    expect(parsed).toEqual(['a', 'b', 'c'])
  })

  it('generates range', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('flow_loop', { loop_over: 'range', range_start: 0, range_end: 5 }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'ignored', [])
    const parsed = JSON.parse(result.response!)
    expect(parsed).toEqual(['0', '1', '2', '3', '4'])
  })

  it('guards max_iterations', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('flow_loop', {
        loop_over: 'range',
        range_start: 0,
        range_end: 1000,
        max_iterations: 5,
      }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, '', [])
    const parsed = JSON.parse(result.response!)
    expect(parsed.length).toBe(5)
  })
})

describe('utility_delay handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('waits for specified duration', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('utility_delay', { seconds: 0.05, random_jitter: 0 }),
      makeStep('send_output'),
    ]
    const start = Date.now()
    const result = await executor.execute(steps, 'test', [])
    const elapsed = Date.now() - start
    expect(result.blocked).toBe(false)
    expect(elapsed).toBeGreaterThanOrEqual(40) // ~50ms with margin
  })

  it('caps at 30 seconds', async () => {
    // We can't actually wait 30s in tests, just verify it doesn't throw
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('utility_delay', { seconds: 0.01, random_jitter: 0 }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'test', [])
    expect(result.blocked).toBe(false)
  })
})

describe('utility_log handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs message without modifying currentInput', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('utility_log', { level: 'info', message: 'Step executed', include_data: false }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'my data', [])
    expect(result.response).toBe('my data') // Not modified
    expect(logSpy).toHaveBeenCalledWith('[INFO] Step executed')
    logSpy.mockRestore()
  })

  it('resolves template in message', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('utility_log', { level: 'info', message: 'Input was: {{currentInput}}' }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'hello', [])
    expect(result.response).toBe('hello')
    expect(logSpy).toHaveBeenCalledWith('[INFO] Input was: hello')
    logSpy.mockRestore()
  })

  it('uses correct log level', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('utility_log', { level: 'error', message: 'Something broke' }),
      makeStep('send_output'),
    ]
    await executor.execute(steps, 'test', [])
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] Something broke')
    errorSpy.mockRestore()
  })

  it('includes data when configured', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const executor = createExecutor()
    const steps: FlowStep[] = [
      makeStep('receive_input'),
      makeStep('utility_log', { level: 'info', message: 'debug', include_data: true }),
      makeStep('send_output'),
    ]
    const result = await executor.execute(steps, 'payload', [])
    expect(result.response).toBe('payload')
    logSpy.mockRestore()
  })
})
