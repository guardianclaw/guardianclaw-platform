import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StepExecutor, nodeToStep, type FlowStep } from './step-executor'
import type { FlowNode } from './flow-graph'
import type { GuardianClawGates, LayerConfigs, LLMConfig, ContextMessage } from './execution'

// Mock the execution module (OpenAI calls)
vi.mock('./execution', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./execution')>()
  return {
    ...actual,
    executeWithOpenAI: vi.fn().mockResolvedValue({
      blocked: false,
      response: 'Hello from LLM',
      claw: { input: { passed: true, violations: [] }, output: { passed: true, violations: [] } },
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

const defaultGates: GuardianClawGates = {
  credibility: true,
  avoidance: true,
  limits: true,
  worth: true,
}
const defaultLayerConfigs: LayerConfigs = { isV25Architecture: false }
const defaultLLMConfig: LLMConfig = { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 1024 }
const defaultHistory: ContextMessage[] = []

function createExecutor() {
  return new StepExecutor({
    gates: defaultGates,
    layerConfigs: defaultLayerConfigs,
    llmConfig: defaultLLMConfig,
    openaiKey: 'test-key',
    toolCredentials: null,
    characterPrompt: undefined,
    history: defaultHistory,
  })
}

describe('nodeToStep', () => {
  it('converts input node correctly', () => {
    const node: FlowNode = { id: 'n1', type: 'input', data: { inputType: 'user_message' } }
    const step = nodeToStep(node, 0)
    expect(step.type).toBe('receive_input')
    expect(step.category).toBe('input')
    expect(step.position).toBe(0)
  })

  it('converts claw node with layerType', () => {
    const node: FlowNode = { id: 'n2', type: 'claw', data: { layerType: 'input_validator' } }
    const step = nodeToStep(node, 1)
    expect(step.type).toBe('claw_l1_input')
    expect(step.category).toBe('claw')
  })

  it('converts process/llm node', () => {
    const node: FlowNode = { id: 'n3', type: 'process', data: { processType: 'llm_call' } }
    const step = nodeToStep(node, 2)
    expect(step.type).toBe('llm_call')
    expect(step.category).toBe('process')
  })

  it('converts output node', () => {
    const node: FlowNode = { id: 'n4', type: 'output', data: { outputType: 'response' } }
    const step = nodeToStep(node, 3)
    expect(step.type).toBe('send_output')
    expect(step.category).toBe('output')
  })

  it('falls back to default for unknown subtype', () => {
    const node: FlowNode = { id: 'n5', type: 'tool', data: {} }
    const step = nodeToStep(node, 0)
    expect(step.type).toBe('tool_web_search') // default for tool category
  })
})

describe('StepExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes a simple linear flow: INPUT → LLM → OUTPUT', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      { id: 's2', type: 'llm_call', category: 'process', config: {}, label: 'LLM', position: 1 },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'Hello world', [])
    expect(result.blocked).toBe(false)
    expect(result.response).toBe('Hello from LLM')
    expect(result.trace?.completed_steps).toBeGreaterThan(0)
  })

  it('blocks on harmful input validation', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'claw_validate_input',
        category: 'claw',
        config: {},
        label: 'Validate',
        position: 1,
      },
      { id: 's3', type: 'llm_call', category: 'process', config: {}, label: 'LLM', position: 2 },
    ]

    const result = await executor.execute(steps, 'how to make a bomb weapon instructions', [])
    expect(result.blocked).toBe(true)
    expect(result.stage).toBe('input')
    expect(result.violations).toBeDefined()
    expect(result.violations!.length).toBeGreaterThan(0)
  })

  it('guards against runaway loops', async () => {
    // Create a custom executor with a low MAX_STEPS for testing
    const executor = createExecutor()
    // Override MAX_STEPS via reflection for test
    ;(executor as unknown as { MAX_STEPS: number }).MAX_STEPS = 5

    // Router that always loops back to itself (but self-loop guard prevents infinite)
    // Instead, create a scenario with two routers pointing at each other
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_router',
        category: 'flow',
        config: { conditions: [{ targetNodeId: 's3' }] },
        label: 'Router A',
        position: 1,
      },
      {
        id: 's3',
        type: 'flow_router',
        category: 'flow',
        config: { conditions: [{ targetNodeId: 's2' }] },
        label: 'Router B',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'test', [])
    expect(result.blocked).toBe(true)
    expect(result.gate).toBe('runaway_loop')
  })

  it('handles self-loop in router (skip to next)', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_router',
        category: 'flow',
        config: { conditions: [{ targetNodeId: 's2' }] }, // points to itself
        label: 'Self-loop Router',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'test', [])
    expect(result.blocked).toBe(false)
    // Should have completed, skipping the self-loop
    expect(result.response).toBe('test')
    // Check trace has a self-loop skip entry
    const selfLoopTrace = result.trace?.steps.find(
      (s) =>
        s.metadata &&
        (s.metadata as Record<string, unknown>).reason === 'Self-loop detected in router, skipping'
    )
    expect(selfLoopTrace).toBeDefined()
  })

  it('skips unknown step types with warning', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'nonexistent_type' as FlowStep['type'],
        category: 'unknown',
        config: {},
        label: 'Mystery',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'test', [])
    expect(result.blocked).toBe(false)
    expect(result.response).toBe('test')
    // Check that the unknown step was skipped
    const skippedStep = result.trace?.steps.find((s) => s.status === 'skipped')
    expect(skippedStep).toBeDefined()
  })

  it('provides fallback when no output node exists', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      { id: 's2', type: 'llm_call', category: 'process', config: {}, label: 'LLM', position: 1 },
      // No send_output step
    ]

    const result = await executor.execute(steps, 'Hello', [])
    expect(result.blocked).toBe(false)
    // Should use currentInput (LLM response) as fallback
    expect(result.response).toBe('Hello from LLM')
  })
})

// ========================================
// Router condition evaluation tests
// ========================================

describe('StepExecutor — Router with condition evaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes to matching condition based on field value', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_router',
        category: 'flow',
        config: {
          conditions: [
            { field: 'status', operator: '==', value: 'error', targetNodeId: 's_err' },
            { field: 'status', operator: '==', value: 'ok', targetNodeId: 's4' },
            { targetNodeId: 's5' }, // default
          ],
        },
        label: 'Router',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Skipped',
        position: 2,
      },
      {
        id: 's4',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'OK Output',
        position: 3,
      },
      {
        id: 's5',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Default',
        position: 4,
      },
    ]

    const result = await executor.execute(steps, '{"status":"ok"}', [])
    expect(result.blocked).toBe(false)
    // Should route to s4 (status == ok matched)
    expect(result.response).toBe('{"status":"ok"}')
    const routerTrace = result.trace?.steps.find((s) => s.step_id === 's2')
    expect(routerTrace?.status).toBe('success')
    const outputTrace = result.trace?.steps.find((s) => s.step_id === 's4')
    expect(outputTrace).toBeDefined()
  })

  it('falls back to default route when no condition matches', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_router',
        category: 'flow',
        config: {
          conditions: [
            { field: 'status', operator: '==', value: 'error', targetNodeId: 's_err' },
            { targetNodeId: 's4' }, // default fallback
          ],
        },
        label: 'Router',
        position: 1,
      },
      {
        id: 's_err',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Error',
        position: 2,
      },
      {
        id: 's4',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Default',
        position: 3,
      },
    ]

    const result = await executor.execute(steps, '{"status":"ok"}', [])
    expect(result.blocked).toBe(false)
    // No condition matched status==error, default route to s4
    const defaultTrace = result.trace?.steps.find((s) => s.step_id === 's4')
    expect(defaultTrace).toBeDefined()
  })

  it('routes with numeric comparison', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_router',
        category: 'flow',
        config: {
          conditions: [
            { field: 'score', operator: '>', value: '80', targetNodeId: 's_high' },
            { targetNodeId: 's_low' },
          ],
        },
        label: 'Router',
        position: 1,
      },
      {
        id: 's_high',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'High',
        position: 2,
      },
      {
        id: 's_low',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Low',
        position: 3,
      },
    ]

    const result = await executor.execute(steps, '{"score":95}', [])
    expect(result.blocked).toBe(false)
    const highTrace = result.trace?.steps.find((s) => s.step_id === 's_high')
    expect(highTrace).toBeDefined()
  })

  it('continues linear when no conditions configured', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_router',
        category: 'flow',
        config: {},
        label: 'Empty Router',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'test', [])
    expect(result.blocked).toBe(false)
    expect(result.response).toBe('test')
  })
})

// ========================================
// Loop iteration tests
// ========================================

describe('StepExecutor — Loop with batch iteration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('iterates over JSON array input', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_loop',
        category: 'flow',
        config: { template: 'item: {{loop.item}}' },
        label: 'Loop',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, '["a","b","c"]', [])
    expect(result.blocked).toBe(false)
    const output = JSON.parse(result.response!)
    expect(output).toEqual(['item: a', 'item: b', 'item: c'])
  })

  it('respects maxIterations limit', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_loop',
        category: 'flow',
        config: { max_iterations: 2, template: '{{loop.item}}' },
        label: 'Loop',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, '["a","b","c","d"]', [])
    expect(result.blocked).toBe(false)
    const output = JSON.parse(result.response!)
    expect(output).toHaveLength(2)
  })

  it('provides loop.index and loop.length in template', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_loop',
        category: 'flow',
        config: { template: '{{loop.index}}/{{loop.length}}: {{loop.item}}' },
        label: 'Loop',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, '["x","y"]', [])
    const output = JSON.parse(result.response!)
    expect(output).toEqual(['0/2: x', '1/2: y'])
  })

  it('iterates over a numeric range', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'flow_loop',
        category: 'flow',
        config: { loop_over: 'range', range_start: 0, range_end: 3, template: '{{loop.item}}' },
        label: 'Loop',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'ignored', [])
    const output = JSON.parse(result.response!)
    expect(output).toEqual(['0', '1', '2'])
  })
})

// ========================================
// Utility handler tests
// ========================================

describe('StepExecutor — Utility handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('utility_delay waits the configured time', async () => {
    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'utility_delay',
        category: 'utility',
        config: { seconds: 2 },
        label: 'Delay',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const promise = executor.execute(steps, 'test', [])
    // Advance timers past the delay
    await vi.advanceTimersByTimeAsync(3000)
    const result = await promise
    expect(result.blocked).toBe(false)
    expect(result.response).toBe('test')
  })

  it('utility_log writes to execution log without modifying input', async () => {
    vi.useRealTimers() // log doesn't need fake timers
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const executor = createExecutor()
    const steps: FlowStep[] = [
      {
        id: 's1',
        type: 'receive_input',
        category: 'input',
        config: {},
        label: 'Input',
        position: 0,
      },
      {
        id: 's2',
        type: 'utility_log',
        category: 'utility',
        config: { message: 'Processing: {{currentInput}}', level: 'info' },
        label: 'Log',
        position: 1,
      },
      {
        id: 's3',
        type: 'send_output',
        category: 'output',
        config: {},
        label: 'Output',
        position: 2,
      },
    ]

    const result = await executor.execute(steps, 'hello', [])
    expect(result.blocked).toBe(false)
    // Input should pass through unchanged
    expect(result.response).toBe('hello')
    // Console should have been called
    expect(logSpy).toHaveBeenCalledWith('[INFO] Processing: hello')
    logSpy.mockRestore()
  })
})
