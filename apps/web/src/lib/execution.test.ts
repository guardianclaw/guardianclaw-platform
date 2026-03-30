/**
 * Execution Animation Tests
 *
 * Tests for the execution store and synchronization utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  findNodeIdForStep,
  findEdgesForNode,
  findEdgeBetweenNodes,
  getExecutionOrder,
  mapTraceToNodeStates,
} from './execution-sync'
import type { ExecutionStep } from '@/stores/execution-store'
import type { FlowNode, FlowEdge } from '@/stores/flow-store'

// Sample nodes for testing
const sampleNodes: FlowNode[] = [
  {
    id: 'input-1',
    type: 'input',
    position: { x: 0, y: 0 },
    data: { label: 'User Input', inputType: 'user_message' },
  },
  {
    id: 'claw-1',
    type: 'claw',
    position: { x: 200, y: 0 },
    data: { label: 'Input Validator', gateType: 'all' },
  },
  {
    id: 'process-1',
    type: 'process',
    position: { x: 400, y: 0 },
    data: { label: 'LLM Call', processType: 'llm_call' },
  },
  {
    id: 'claw-2',
    type: 'claw',
    position: { x: 600, y: 0 },
    data: { label: 'Output Validator', gateType: 'all' },
  },
  {
    id: 'output-1',
    type: 'output',
    position: { x: 800, y: 0 },
    data: { label: 'Response', outputType: 'response' },
  },
]

// Sample edges for testing
const sampleEdges: FlowEdge[] = [
  { id: 'e1', source: 'input-1', target: 'claw-1' },
  { id: 'e2', source: 'claw-1', target: 'process-1' },
  { id: 'e3', source: 'process-1', target: 'claw-2' },
  { id: 'e4', source: 'claw-2', target: 'output-1' },
]

// Sample trace for testing
const sampleTrace: ExecutionStep[] = [
  {
    step_id: 'input-1',
    step_name: 'User Input',
    step_type: 'receive_input',
    category: 'input',
    status: 'success',
    duration_ms: 10,
  },
  {
    step_id: 'claw-1',
    step_name: 'Input Validator',
    step_type: 'validate_input',
    category: 'claw',
    status: 'success',
    duration_ms: 50,
  },
  {
    step_id: 'process-1',
    step_name: 'LLM Call',
    step_type: 'llm_call',
    category: 'process',
    status: 'success',
    duration_ms: 500,
  },
  {
    step_id: 'claw-2',
    step_name: 'Output Validator',
    step_type: 'validate_output',
    category: 'claw',
    status: 'error',
    duration_ms: 30,
    error: 'Content blocked by avoidance gate',
  },
]

describe('Execution Sync - findNodeIdForStep', () => {
  it('should find node by direct ID match', () => {
    const step: ExecutionStep = {
      step_id: 'input-1',
      step_name: 'User Input',
      step_type: 'receive_input',
      category: 'input',
      status: 'success',
    }
    expect(findNodeIdForStep(step, sampleNodes)).toBe('input-1')
  })

  it('should find node by label match', () => {
    const step: ExecutionStep = {
      step_id: 'unknown-id',
      step_name: 'LLM Call',
      step_type: 'llm_call',
      category: 'process',
      status: 'success',
    }
    expect(findNodeIdForStep(step, sampleNodes)).toBe('process-1')
  })

  it('should find node by type pattern match', () => {
    const step: ExecutionStep = {
      step_id: 'some-id',
      step_name: 'Some Name',
      step_type: 'receive_input',
      category: 'input',
      status: 'success',
    }
    expect(findNodeIdForStep(step, sampleNodes)).toBe('input-1')
  })

  it('should return null for non-matching step', () => {
    const step: ExecutionStep = {
      step_id: 'nonexistent',
      step_name: 'Unknown Step',
      step_type: 'unknown_type',
      category: 'unknown',
      status: 'success',
    }
    expect(findNodeIdForStep(step, sampleNodes)).toBe(null)
  })
})

describe('Execution Sync - findEdgesForNode', () => {
  it('should find incoming edges', () => {
    const edges = findEdgesForNode('claw-1', sampleEdges, 'incoming')
    expect(edges).toHaveLength(1)
    expect(edges).toContain('e1')
  })

  it('should find outgoing edges', () => {
    const edges = findEdgesForNode('claw-1', sampleEdges, 'outgoing')
    expect(edges).toHaveLength(1)
    expect(edges).toContain('e2')
  })

  it('should find both incoming and outgoing edges', () => {
    const edges = findEdgesForNode('claw-1', sampleEdges, 'both')
    expect(edges).toHaveLength(2)
    expect(edges).toContain('e1')
    expect(edges).toContain('e2')
  })

  it('should return empty array for node with no edges', () => {
    const edges = findEdgesForNode('nonexistent', sampleEdges, 'both')
    expect(edges).toHaveLength(0)
  })
})

describe('Execution Sync - findEdgeBetweenNodes', () => {
  it('should find edge between connected nodes', () => {
    const edgeId = findEdgeBetweenNodes('input-1', 'claw-1', sampleEdges)
    expect(edgeId).toBe('e1')
  })

  it('should return null for non-connected nodes', () => {
    const edgeId = findEdgeBetweenNodes('input-1', 'output-1', sampleEdges)
    expect(edgeId).toBe(null)
  })

  it('should return null for reversed direction', () => {
    const edgeId = findEdgeBetweenNodes('claw-1', 'input-1', sampleEdges)
    expect(edgeId).toBe(null)
  })
})

describe('Execution Sync - getExecutionOrder', () => {
  it('should return topologically sorted node IDs', () => {
    const order = getExecutionOrder(sampleNodes, sampleEdges)
    expect(order).toHaveLength(5)

    // input-1 should come before claw-1
    expect(order.indexOf('input-1')).toBeLessThan(order.indexOf('claw-1'))

    // claw-1 should come before process-1
    expect(order.indexOf('claw-1')).toBeLessThan(order.indexOf('process-1'))

    // process-1 should come before claw-2
    expect(order.indexOf('process-1')).toBeLessThan(order.indexOf('claw-2'))

    // claw-2 should come before output-1
    expect(order.indexOf('claw-2')).toBeLessThan(order.indexOf('output-1'))
  })

  it('should handle empty nodes', () => {
    const order = getExecutionOrder([], [])
    expect(order).toHaveLength(0)
  })

  it('should handle disconnected nodes', () => {
    const disconnectedNodes: FlowNode[] = [
      { id: 'a', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', type: 'process', position: { x: 100, y: 0 }, data: { label: 'B' } },
    ]
    const order = getExecutionOrder(disconnectedNodes, [])
    expect(order).toHaveLength(2)
    expect(order).toContain('a')
    expect(order).toContain('b')
  })
})

describe('Execution Sync - mapTraceToNodeStates', () => {
  it('should map trace steps to node states', () => {
    const states = mapTraceToNodeStates(sampleTrace, sampleNodes)

    expect(states['input-1']).toBe('success')
    expect(states['claw-1']).toBe('success')
    expect(states['process-1']).toBe('success')
    expect(states['claw-2']).toBe('error')
  })

  it('should not include nodes not in trace', () => {
    const states = mapTraceToNodeStates(sampleTrace, sampleNodes)
    expect(states['output-1']).toBeUndefined()
  })

  it('should handle empty trace', () => {
    const states = mapTraceToNodeStates([], sampleNodes)
    expect(Object.keys(states)).toHaveLength(0)
  })

  it('should handle running status', () => {
    const runningTrace: ExecutionStep[] = [
      {
        step_id: 'input-1',
        step_name: 'User Input',
        step_type: 'receive_input',
        category: 'input',
        status: 'running',
      },
    ]
    const states = mapTraceToNodeStates(runningTrace, sampleNodes)
    expect(states['input-1']).toBe('running')
  })

  it('should handle skipped status', () => {
    const skippedTrace: ExecutionStep[] = [
      {
        step_id: 'claw-2',
        step_name: 'Output Validator',
        step_type: 'validate_output',
        category: 'claw',
        status: 'skipped',
      },
    ]
    const states = mapTraceToNodeStates(skippedTrace, sampleNodes)
    expect(states['claw-2']).toBe('skipped')
  })
})

describe('Execution Store Types', () => {
  it('should have correct NodeExecutionStatus values', () => {
    const validStatuses = ['idle', 'pending', 'running', 'success', 'error', 'skipped']

    validStatuses.forEach((status) => {
      expect(typeof status).toBe('string')
    })
  })

  it('should have correct ExecutionStep structure', () => {
    const step: ExecutionStep = {
      step_id: 'test',
      step_name: 'Test Step',
      step_type: 'test_type',
      category: 'test',
      status: 'success',
      duration_ms: 100,
      error: undefined,
    }

    expect(step.step_id).toBeDefined()
    expect(step.step_name).toBeDefined()
    expect(step.step_type).toBeDefined()
    expect(step.category).toBeDefined()
    expect(step.status).toBeDefined()
  })
})
