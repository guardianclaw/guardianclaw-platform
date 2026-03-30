import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseL4Response,
  applyL4FallbackPolicy,
  StepExecutor,
  type ExecutionState,
  type StepExecutorDeps,
  type FlowStep,
} from './step-executor'

// =============================================
// parseL4Response
// =============================================

describe('parseL4Response', () => {
  it('parses valid passed response', () => {
    const result = parseL4Response(
      JSON.stringify({ passed: true, gate: 'none', reason: 'safe', confidence: 0.95 })
    )
    expect(result.passed).toBe(true)
    expect(result.gate).toBe('none')
    expect(result.confidence).toBe(0.95)
  })

  it('parses valid blocked response', () => {
    const result = parseL4Response(
      JSON.stringify({
        passed: false,
        gate: 'avoidance',
        reason: 'harmful content',
        violations: ['avoidance:violence'],
      })
    )
    expect(result.passed).toBe(false)
    expect(result.gate).toBe('avoidance')
    expect(result.violations).toEqual(['avoidance:violence'])
  })

  it('defaults safe on non-JSON', () => {
    const result = parseL4Response('this is not json')
    expect(result.passed).toBe(true)
    expect(result.reason).toContain('parse error')
  })

  it('defaults safe on empty string', () => {
    const result = parseL4Response('')
    expect(result.passed).toBe(true)
  })

  it('treats missing passed field as passed', () => {
    const result = parseL4Response(JSON.stringify({ gate: 'none' }))
    expect(result.passed).toBe(true)
  })
})

// =============================================
// applyL4FallbackPolicy
// =============================================

describe('applyL4FallbackPolicy', () => {
  function makeState(overrides?: Partial<ExecutionState>): ExecutionState {
    return {
      currentInput: 'test output',
      initialInput: 'test input',
      blocked: false,
      finalOutput: null,
      traceSteps: [],
      ...overrides,
    }
  }

  it('BLOCK policy blocks state', () => {
    const state = makeState()
    applyL4FallbackPolicy(state, 'BLOCK', new Error('timeout'))
    expect(state.blocked).toBe(true)
    expect(state.blockInfo?.gate).toBe('L4:fallback')
    expect(state.blockInfo?.violations).toContain('l4_fallback:block')
  })

  it('ALLOW policy does not block', () => {
    const state = makeState()
    applyL4FallbackPolicy(state, 'ALLOW', new Error('timeout'))
    expect(state.blocked).toBe(false)
  })

  it('ALLOW_IF_L2_PASSED does not block when L3 passed', () => {
    const state = makeState({ blocked: false })
    applyL4FallbackPolicy(state, 'ALLOW_IF_L2_PASSED', new Error('timeout'))
    expect(state.blocked).toBe(false)
  })

  it('ALLOW_IF_L2_PASSED blocks when L3 failed', () => {
    const state = makeState({
      blocked: true,
      blockInfo: { stage: 'output', gate: 'L3:avoidance', reason: 'L3 blocked', violations: [] },
    })
    applyL4FallbackPolicy(state, 'ALLOW_IF_L2_PASSED', new Error('timeout'))
    expect(state.blocked).toBe(true)
    expect(state.blockInfo?.gate).toBe('L4:fallback')
    expect(state.blockInfo?.violations).toContain('l4_fallback:l3_failed')
  })
})

// =============================================
// StepExecutor L4 integration
// =============================================

describe('StepExecutor L4 Observer', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  function makeDeps(overrides?: Partial<StepExecutorDeps>): StepExecutorDeps {
    return {
      gates: { credibility: true, avoidance: true, limits: true, worth: true },
      layerConfigs: {
        isV25Architecture: true,
        l4Config: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-4o-mini',
          fallbackPolicy: 'ALLOW_IF_L2_PASSED',
          maxRetries: 2,
          retryDelayMs: 10, // fast for tests
        },
      },
      llmConfig: { model: 'gpt-4o-mini' },
      openaiKey: 'test-key',
      toolCredentials: null,
      history: [{ role: 'user', content: 'hello' }],
      ...overrides,
    }
  }

  function makeL4Step(): FlowStep {
    return {
      id: 'l4_1',
      type: 'claw_l4_observer',
      category: 'claw',
      config: {},
      label: 'Observer',
      position: 3,
    }
  }

  function mockFetchResponse(body: object, ok = true) {
    return Promise.resolve({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: JSON.stringify(body) } }],
        }),
    } as Response)
  }

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips when L4 disabled', async () => {
    const deps = makeDeps({
      layerConfigs: {
        isV25Architecture: true,
        l4Config: {
          enabled: false,
          provider: 'openai',
          model: 'gpt-4o-mini',
          fallbackPolicy: 'BLOCK',
          maxRetries: 2,
          retryDelayMs: 10,
        },
      },
    })

    const executor = new StepExecutor(deps)
    const result = await executor.execute([makeL4Step()], 'test', [])

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.blocked).toBe(false)
  })

  it('passes safe response', async () => {
    fetchSpy.mockReturnValue(mockFetchResponse({ passed: true, gate: 'none', reason: 'safe' }))

    const executor = new StepExecutor(makeDeps())
    const result = await executor.execute([makeL4Step()], 'what is 2+2?', [
      { role: 'user', content: 'hello' },
    ])

    expect(result.blocked).toBe(false)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('blocks unsafe response', async () => {
    fetchSpy.mockReturnValue(
      mockFetchResponse({
        passed: false,
        gate: 'avoidance',
        reason: 'harmful content',
        violations: ['avoidance:violence'],
      })
    )

    const executor = new StepExecutor(makeDeps())
    const result = await executor.execute([makeL4Step()], 'test input', [])

    expect(result.blocked).toBe(true)
    expect(result.gate).toBe('L4:avoidance')
  })

  it('retries on failure then succeeds', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'))
      .mockReturnValue(mockFetchResponse({ passed: true, gate: 'none', reason: 'ok' }))

    const executor = new StepExecutor(makeDeps())
    const result = await executor.execute([makeL4Step()], 'test', [])

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(result.blocked).toBe(false)
  })

  it('applies BLOCK fallback when all retries fail', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'))

    const deps = makeDeps({
      layerConfigs: {
        isV25Architecture: true,
        l4Config: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-4o-mini',
          fallbackPolicy: 'BLOCK',
          maxRetries: 1,
          retryDelayMs: 10,
        },
      },
    })

    const executor = new StepExecutor(deps)
    const result = await executor.execute([makeL4Step()], 'test', [])

    expect(result.blocked).toBe(true)
    expect(result.gate).toBe('L4:fallback')
  })

  it('applies ALLOW fallback when all retries fail', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'))

    const deps = makeDeps({
      layerConfigs: {
        isV25Architecture: true,
        l4Config: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-4o-mini',
          fallbackPolicy: 'ALLOW',
          maxRetries: 1,
          retryDelayMs: 10,
        },
      },
    })

    const executor = new StepExecutor(deps)
    const result = await executor.execute([makeL4Step()], 'test', [])

    expect(result.blocked).toBe(false)
  })

  it('ALLOW_IF_L2_PASSED does not block when L3 not failed', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'))

    const executor = new StepExecutor(makeDeps())
    const result = await executor.execute([makeL4Step()], 'test', [])

    // L3 never ran so state is not blocked -> fallback allows
    expect(result.blocked).toBe(false)
  })
})
