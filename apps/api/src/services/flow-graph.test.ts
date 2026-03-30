import { describe, it, expect } from 'vitest'
import {
  topologicalSort,
  validateFlowGraph,
  getNodeCategory,
  buildAdjacencyMap,
  type FlowNode,
  type FlowEdge,
} from './flow-graph'

describe('getNodeCategory', () => {
  it('maps known types correctly', () => {
    expect(getNodeCategory('input')).toBe('input')
    expect(getNodeCategory('claw')).toBe('claw')
    expect(getNodeCategory('process')).toBe('process')
    expect(getNodeCategory('flow')).toBe('flow')
    expect(getNodeCategory('memory')).toBe('memory')
    expect(getNodeCategory('tool')).toBe('tool')
    expect(getNodeCategory('utility')).toBe('utility')
    expect(getNodeCategory('output')).toBe('output')
  })

  it('returns unknown for unrecognized types', () => {
    expect(getNodeCategory('foobar')).toBe('unknown')
    expect(getNodeCategory('')).toBe('unknown')
  })
})

describe('buildAdjacencyMap', () => {
  it('builds correct adjacency from edges', () => {
    const edges: FlowEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
    ]
    const adj = buildAdjacencyMap(edges)
    expect(adj.get('a')).toEqual(new Set(['b', 'c']))
    expect(adj.get('b')).toEqual(new Set(['c']))
    expect(adj.has('c')).toBe(false)
  })
})

describe('topologicalSort', () => {
  it('sorts a linear flow: INPUT → PROCESS → OUTPUT', () => {
    const nodes: FlowNode[] = [
      { id: 'out', type: 'output' },
      { id: 'proc', type: 'process' },
      { id: 'in', type: 'input' },
    ]
    const edges: FlowEdge[] = [
      { source: 'in', target: 'proc' },
      { source: 'proc', target: 'out' },
    ]

    const result = topologicalSort(nodes, edges)
    expect(result.sortedNodeIds).toEqual(['in', 'proc', 'out'])
    expect(result.warnings).toHaveLength(0)
  })

  it('falls back to priority sort when no edges', () => {
    const nodes: FlowNode[] = [
      { id: 'out', type: 'output' },
      { id: 'in', type: 'input' },
      { id: 'sen', type: 'claw' },
    ]

    const result = topologicalSort(nodes, [])
    // Priority: input(0) < claw(1) < output(7)
    expect(result.sortedNodeIds).toEqual(['in', 'sen', 'out'])
    expect(result.warnings).toHaveLength(0)
  })

  it('handles diamond flow correctly', () => {
    const nodes: FlowNode[] = [
      { id: 'in', type: 'input' },
      { id: 'a', type: 'process' },
      { id: 'b', type: 'process' },
      { id: 'out', type: 'output' },
    ]
    const edges: FlowEdge[] = [
      { source: 'in', target: 'a' },
      { source: 'in', target: 'b' },
      { source: 'a', target: 'out' },
      { source: 'b', target: 'out' },
    ]

    const result = topologicalSort(nodes, edges)
    // Input must be first, output must be last
    expect(result.sortedNodeIds[0]).toBe('in')
    expect(result.sortedNodeIds[result.sortedNodeIds.length - 1]).toBe('out')
    expect(result.sortedNodeIds).toHaveLength(4)
    expect(result.warnings).toHaveLength(0)
  })

  it('detects cycles and appends cyclic nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'process' },
      { id: 'b', type: 'process' },
    ]
    const edges: FlowEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ]

    const result = topologicalSort(nodes, edges)
    // Both nodes are in a cycle — should still appear in result
    expect(result.sortedNodeIds).toHaveLength(2)
    expect(result.warnings.some((w) => w.includes('Cycle detected'))).toBe(true)
  })

  it('detects self-loops', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'process' },
      { id: 'b', type: 'output' },
    ]
    const edges: FlowEdge[] = [
      { source: 'a', target: 'a' }, // self-loop
      { source: 'a', target: 'b' },
    ]

    const result = topologicalSort(nodes, edges)
    expect(result.warnings.some((w) => w.includes('Self-loop'))).toBe(true)
    // Should still sort correctly ignoring self-loop edge
    expect(result.sortedNodeIds).toEqual(['a', 'b'])
  })

  it('detects disconnected nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'input' },
      { id: 'b', type: 'output' },
      { id: 'c', type: 'tool' }, // disconnected
    ]
    const edges: FlowEdge[] = [{ source: 'a', target: 'b' }]

    const result = topologicalSort(nodes, edges)
    expect(result.warnings.some((w) => w.includes('Disconnected node: c'))).toBe(true)
    // All nodes should still appear
    expect(result.sortedNodeIds).toHaveLength(3)
  })

  it('handles empty flow', () => {
    const result = topologicalSort([], [])
    expect(result.sortedNodeIds).toEqual([])
    expect(result.warnings).toHaveLength(0)
  })

  it('respects category priority order', () => {
    const nodes: FlowNode[] = [
      { id: 'out', type: 'output' },
      { id: 'tool', type: 'tool' },
      { id: 'sen', type: 'claw' },
      { id: 'in', type: 'input' },
      { id: 'proc', type: 'process' },
    ]

    // No edges — pure priority sort
    const result = topologicalSort(nodes, [])
    expect(result.sortedNodeIds).toEqual(['in', 'sen', 'proc', 'tool', 'out'])
  })

  it('ignores edges referencing unknown nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'input' },
      { id: 'b', type: 'output' },
    ]
    const edges: FlowEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'ghost' }, // ghost node doesn't exist
    ]

    const result = topologicalSort(nodes, edges)
    expect(result.sortedNodeIds).toEqual(['a', 'b'])
  })

  it('handles single node flow', () => {
    const nodes: FlowNode[] = [{ id: 'solo', type: 'process' }]

    const result = topologicalSort(nodes, [])
    expect(result.sortedNodeIds).toEqual(['solo'])
    expect(result.warnings).toHaveLength(0)
  })
})

describe('validateFlowGraph', () => {
  it('returns valid for a correct linear flow', () => {
    const nodes: FlowNode[] = [
      { id: 'in', type: 'input' },
      { id: 'proc', type: 'process' },
      { id: 'out', type: 'output' },
    ]
    const edges: FlowEdge[] = [
      { source: 'in', target: 'proc' },
      { source: 'proc', target: 'out' },
    ]

    const result = validateFlowGraph(nodes, edges)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns error for empty flow', () => {
    const result = validateFlowGraph([], [])
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Flow has no nodes')
  })

  it('returns error for cyclic flow', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'process' },
      { id: 'b', type: 'process' },
    ]
    const edges: FlowEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ]

    const result = validateFlowGraph(nodes, edges)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Cycle detected'))).toBe(true)
  })

  it('warns about unreachable nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'in', type: 'input' },
      { id: 'proc', type: 'process' },
      { id: 'orphan', type: 'tool' },
      { id: 'out', type: 'output' },
    ]
    const edges: FlowEdge[] = [
      { source: 'in', target: 'proc' },
      { source: 'proc', target: 'out' },
      // orphan has no connection from input
    ]

    const result = validateFlowGraph(nodes, edges)
    expect(result.valid).toBe(true) // warnings don't invalidate
    expect(result.warnings.some((w) => w.includes('orphan') && w.includes('unreachable'))).toBe(
      true
    )
  })

  it('warns about edges without input nodes', () => {
    const nodes: FlowNode[] = [
      { id: 'proc', type: 'process' },
      { id: 'out', type: 'output' },
    ]
    const edges: FlowEdge[] = [{ source: 'proc', target: 'out' }]

    const result = validateFlowGraph(nodes, edges)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.includes('no input nodes'))).toBe(true)
  })

  it('allows single node without edges', () => {
    const nodes: FlowNode[] = [{ id: 'solo', type: 'process' }]

    const result = validateFlowGraph(nodes, [])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('does not warn about disconnected input/output terminals', () => {
    const nodes: FlowNode[] = [
      { id: 'in', type: 'input' },
      { id: 'proc', type: 'process' },
      { id: 'out', type: 'output' },
      { id: 'extra_out', type: 'output' }, // disconnected output
    ]
    const edges: FlowEdge[] = [
      { source: 'in', target: 'proc' },
      { source: 'proc', target: 'out' },
    ]

    const result = validateFlowGraph(nodes, edges)
    expect(result.valid).toBe(true)
    // Should NOT have a disconnected warning for the extra output terminal
    expect(result.warnings.filter((w) => w.includes('Disconnected'))).toHaveLength(0)
  })

  it('warns about self-loops as warning, not error', () => {
    const nodes: FlowNode[] = [
      { id: 'a', type: 'input' },
      { id: 'b', type: 'output' },
    ]
    const edges: FlowEdge[] = [
      { source: 'a', target: 'a' }, // self-loop
      { source: 'a', target: 'b' },
    ]

    const result = validateFlowGraph(nodes, edges)
    expect(result.valid).toBe(true) // self-loop is warning, not error
    expect(result.warnings.some((w) => w.includes('Self-loop'))).toBe(true)
  })
})
