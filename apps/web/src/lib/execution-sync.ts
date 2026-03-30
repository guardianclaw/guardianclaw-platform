/**
 * Execution synchronization utilities
 *
 * Maps execution trace steps to flow nodes and edges for real-time animation.
 */

import type { FlowNode, FlowEdge } from '@/stores/flow-store'
import type { ExecutionStep, NodeExecutionStatus } from '@/stores/execution-store'

// Find node ID by matching step_id, label, or type
export function findNodeIdForStep(step: ExecutionStep, nodes: FlowNode[]): string | null {
  // Direct ID match
  const directMatch = nodes.find((n) => n.id === step.step_id)
  if (directMatch) return directMatch.id

  // Match by label
  const labelMatch = nodes.find(
    (n) => (n.data.label as string)?.toLowerCase() === step.step_name.toLowerCase()
  )
  if (labelMatch) return labelMatch.id

  // Match by type pattern
  const typePatterns: Record<string, string[]> = {
    receive_input: ['input'],
    llm_call: ['process'],
    validate_input: ['claw'],
    validate_output: ['claw'],
    send_output: ['output'],
    tool_web_search: ['tool'],
    tool_code_exec: ['tool'],
    tool_api_request: ['tool'],
    tool_database: ['tool'],
    router: ['flow'],
    merge: ['flow'],
    loop: ['flow'],
    buffer: ['memory'],
    vector: ['memory'],
    summary: ['memory'],
    delay: ['utility'],
    log: ['utility'],
  }

  const patterns = typePatterns[step.step_type] || []
  for (const pattern of patterns) {
    const typeMatch = nodes.find((n) => n.type === pattern)
    if (typeMatch) return typeMatch.id
  }

  // Match by category
  const categoryMatch = nodes.find((n) => n.type === step.category)
  if (categoryMatch) return categoryMatch.id

  return null
}

// Find edges connected to a node
export function findEdgesForNode(
  nodeId: string,
  edges: FlowEdge[],
  direction: 'incoming' | 'outgoing' | 'both' = 'both'
): string[] {
  return edges
    .filter((edge) => {
      if (direction === 'incoming') return edge.target === nodeId
      if (direction === 'outgoing') return edge.source === nodeId
      return edge.source === nodeId || edge.target === nodeId
    })
    .map((edge) => edge.id)
}

// Find edges between two nodes
export function findEdgeBetweenNodes(
  sourceId: string,
  targetId: string,
  edges: FlowEdge[]
): string | null {
  const edge = edges.find((e) => e.source === sourceId && e.target === targetId)
  return edge?.id || null
}

// Get execution order based on edges (topological sort)
export function getExecutionOrder(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const inDegree: Record<string, number> = {}
  const adjacency: Record<string, string[]> = {}

  // Initialize
  nodeIds.forEach((id) => {
    inDegree[id] = 0
    adjacency[id] = []
  })

  // Build graph
  edges.forEach((edge) => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      inDegree[edge.target] = (inDegree[edge.target] || 0) + 1
      adjacency[edge.source].push(edge.target)
    }
  })

  // Kahn's algorithm
  const queue: string[] = []
  const result: string[] = []

  Object.entries(inDegree).forEach(([id, degree]) => {
    if (degree === 0) queue.push(id)
  })

  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    adjacency[current].forEach((neighbor) => {
      inDegree[neighbor]--
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor)
      }
    })
  }

  return result
}

// Animate execution step by step
export async function animateExecution(
  trace: ExecutionStep[],
  nodes: FlowNode[],
  edges: FlowEdge[],
  callbacks: {
    onNodeStatusChange: (nodeId: string, status: NodeExecutionStatus) => void
    onEdgeActivate: (edgeIds: string[], active: boolean) => void
    onStepComplete: (stepIndex: number) => void
  }
): Promise<void> {
  let prevNodeId: string | null = null

  for (let i = 0; i < trace.length; i++) {
    const step = trace[i]
    const nodeId = findNodeIdForStep(step, nodes)

    if (nodeId) {
      // Deactivate previous edges
      if (prevNodeId) {
        const prevEdges = findEdgesForNode(prevNodeId, edges, 'outgoing')
        callbacks.onEdgeActivate(prevEdges, false)
      }

      // Set node to running
      callbacks.onNodeStatusChange(nodeId, 'running')

      // Activate incoming edges
      const incomingEdges = findEdgesForNode(nodeId, edges, 'incoming')
      callbacks.onEdgeActivate(incomingEdges, true)

      // Simulate execution time (use actual duration if available)
      const duration = step.duration_ms || 200
      await new Promise((resolve) => setTimeout(resolve, Math.min(duration, 500)))

      // Set final status
      const finalStatus: NodeExecutionStatus =
        step.status === 'error' ? 'error' : step.status === 'skipped' ? 'skipped' : 'success'

      callbacks.onNodeStatusChange(nodeId, finalStatus)

      // Deactivate incoming edges, activate outgoing
      callbacks.onEdgeActivate(incomingEdges, false)

      prevNodeId = nodeId
    }

    callbacks.onStepComplete(i)
  }

  // Clear all active edges at the end
  if (prevNodeId) {
    const finalEdges = findEdgesForNode(prevNodeId, edges, 'outgoing')
    callbacks.onEdgeActivate(finalEdges, false)
  }
}

// Create a simplified trace animation (without delays)
export function mapTraceToNodeStates(
  trace: ExecutionStep[],
  nodes: FlowNode[]
): Record<string, NodeExecutionStatus> {
  const states: Record<string, NodeExecutionStatus> = {}

  trace.forEach((step) => {
    const nodeId = findNodeIdForStep(step, nodes)
    if (nodeId) {
      states[nodeId] =
        step.status === 'error'
          ? 'error'
          : step.status === 'skipped'
            ? 'skipped'
            : step.status === 'running'
              ? 'running'
              : 'success'
    }
  })

  return states
}
