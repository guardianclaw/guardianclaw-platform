/**
 * Flow Graph Module
 *
 * Topological sort for flow nodes using Kahn's algorithm.
 * Port of Python flow_parser.py:402-492 for TS fallback execution.
 * When Modal is unavailable, the TS engine uses this to determine
 * proper node execution order from canvas edges.
 */

// ===========================================
// TYPES
// ===========================================

export interface FlowNode {
  id: string
  type: string
  data?: Record<string, unknown>
}

export interface FlowEdge {
  id?: string
  source: string
  target: string
}

export type NodeCategory =
  | 'input'
  | 'claw'
  | 'process'
  | 'flow'
  | 'memory'
  | 'tool'
  | 'utility'
  | 'output'
  | 'unknown'

export interface TopologicalSortResult {
  sortedNodeIds: string[]
  warnings: string[]
}

export interface FlowValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ===========================================
// CATEGORY CLASSIFICATION
// ===========================================

// Priority order: lower = earlier in execution
const CATEGORY_PRIORITY: Record<NodeCategory, number> = {
  input: 0,
  claw: 1,
  process: 2,
  flow: 3,
  memory: 4,
  tool: 5,
  utility: 6,
  output: 7,
  unknown: 8,
}

export function getNodeCategory(nodeType: string): NodeCategory {
  switch (nodeType) {
    case 'input':
      return 'input'
    case 'claw':
      return 'claw'
    case 'process':
      return 'process'
    case 'flow':
      return 'flow'
    case 'memory':
      return 'memory'
    case 'tool':
      return 'tool'
    case 'utility':
      return 'utility'
    case 'output':
      return 'output'
    default:
      return 'unknown'
  }
}

// ===========================================
// ADJACENCY MAP
// ===========================================

export function buildAdjacencyMap(edges: FlowEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()

  for (const edge of edges) {
    if (!adj.has(edge.source)) {
      adj.set(edge.source, new Set())
    }
    adj.get(edge.source)!.add(edge.target)
  }

  return adj
}

// ===========================================
// TOPOLOGICAL SORT (KAHN'S ALGORITHM)
// ===========================================

/**
 * Topological sort with category-based priority.
 *
 * - Detects disconnected nodes (no incoming/outgoing edges)
 * - Detects self-loops
 * - Detects cycles (nodes remaining after Kahn's)
 * - Falls back gracefully: cyclic nodes appended by priority
 */
export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): TopologicalSortResult {
  const warnings: string[] = []

  if (nodes.length === 0) {
    return { sortedNodeIds: [], warnings }
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Detect self-loops
  const filteredEdges: FlowEdge[] = []
  for (const edge of edges) {
    if (edge.source === edge.target) {
      warnings.push(`Self-loop detected on node ${edge.source}`)
      continue
    }
    // Only keep edges between known nodes
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      filteredEdges.push(edge)
    }
  }

  // Detect disconnected nodes (no edges at all)
  const connectedNodes = new Set<string>()
  for (const edge of filteredEdges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  for (const id of nodeIds) {
    if (!connectedNodes.has(id) && filteredEdges.length > 0) {
      warnings.push(`Disconnected node: ${id}`)
    }
  }

  // If no edges, sort purely by category priority
  if (filteredEdges.length === 0) {
    const sorted = [...nodes].sort((a, b) => {
      const pa = CATEGORY_PRIORITY[getNodeCategory(a.type)]
      const pb = CATEGORY_PRIORITY[getNodeCategory(b.type)]
      return pa - pb
    })
    return { sortedNodeIds: sorted.map((n) => n.id), warnings }
  }

  // Build in-degree map
  const inDegree = new Map<string, number>()
  for (const id of nodeIds) {
    inDegree.set(id, 0)
  }
  for (const edge of filteredEdges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  // Build adjacency list
  const adj = buildAdjacencyMap(filteredEdges)

  // Initialize queue with zero in-degree nodes, sorted by priority
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
    }
  }
  // Sort queue by category priority (stable insertion order)
  queue.sort((a, b) => {
    const na = nodeMap.get(a)!
    const nb = nodeMap.get(b)!
    return CATEGORY_PRIORITY[getNodeCategory(na.type)] - CATEGORY_PRIORITY[getNodeCategory(nb.type)]
  })

  const sorted: string[] = []

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    sorted.push(nodeId)

    const neighbors = adj.get(nodeId)
    if (!neighbors) continue

    // Collect newly freed nodes, then insert sorted
    const freed: string[] = []
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) {
        freed.push(neighbor)
      }
    }

    // Sort freed nodes by priority before adding to queue
    freed.sort((a, b) => {
      const na = nodeMap.get(a)!
      const nb = nodeMap.get(b)!
      return (
        CATEGORY_PRIORITY[getNodeCategory(na.type)] - CATEGORY_PRIORITY[getNodeCategory(nb.type)]
      )
    })

    queue.push(...freed)
  }

  // Cycle detection: nodes not in sorted result
  if (sorted.length < nodeIds.size) {
    const remaining = [...nodeIds].filter((id) => !sorted.includes(id))
    warnings.push(`Cycle detected involving ${remaining.length} node(s): ${remaining.join(', ')}`)

    // Append cyclic nodes sorted by priority (don't crash)
    remaining.sort((a, b) => {
      const na = nodeMap.get(a)!
      const nb = nodeMap.get(b)!
      return (
        CATEGORY_PRIORITY[getNodeCategory(na.type)] - CATEGORY_PRIORITY[getNodeCategory(nb.type)]
      )
    })
    sorted.push(...remaining)
  }

  return { sortedNodeIds: sorted, warnings }
}

// ===========================================
// FLOW GRAPH VALIDATION
// ===========================================

/**
 * Semantic validation for flow graphs.
 *
 * Unlike topologicalSort (which always produces a result, even for
 * invalid graphs), this function returns clear errors vs warnings:
 *
 * Errors (invalid graph):
 * - No nodes
 * - Cycle detected (not a DAG)
 *
 * Warnings (valid but suspicious):
 * - Disconnected non-terminal nodes
 * - Nodes unreachable from input
 * - No input nodes when flow has edges
 */
export function validateFlowGraph(nodes: FlowNode[], edges: FlowEdge[]): FlowValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (nodes.length === 0) {
    errors.push('Flow has no nodes')
    return { valid: false, errors, warnings }
  }

  const nodeIds = new Set(nodes.map((n) => n.id))

  // Filter to valid, non-self-loop edges
  const validEdges = edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target
  )

  // Run topologicalSort to detect cycles and disconnected nodes
  const sortResult = topologicalSort(nodes, edges)
  for (const w of sortResult.warnings) {
    if (w.includes('Cycle detected')) {
      errors.push(w)
    } else if (w.includes('Self-loop')) {
      warnings.push(w)
    } else if (w.includes('Disconnected')) {
      // Re-check: only warn for non-terminal disconnected nodes
      const match = w.match(/Disconnected node: (.+)/)
      if (match) {
        const nodeId = match[1]
        const node = nodes.find((n) => n.id === nodeId)
        if (node) {
          const cat = getNodeCategory(node.type)
          if (cat !== 'input' && cat !== 'output') {
            warnings.push(w)
          }
        }
      }
    }
  }

  // Check reachability from input nodes (only if edges exist)
  if (validEdges.length > 0) {
    const inputNodes = nodes.filter((n) => getNodeCategory(n.type) === 'input')

    if (inputNodes.length === 0) {
      warnings.push('Flow has edges but no input nodes')
    } else {
      // BFS from all input nodes
      const reachable = new Set<string>()
      const queue = inputNodes.map((n) => n.id)
      const adj = buildAdjacencyMap(validEdges)

      while (queue.length > 0) {
        const current = queue.shift()!
        if (reachable.has(current)) continue
        reachable.add(current)

        const neighbors = adj.get(current)
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!reachable.has(neighbor)) {
              queue.push(neighbor)
            }
          }
        }
      }

      // Report unreachable non-input nodes
      for (const node of nodes) {
        if (!reachable.has(node.id) && getNodeCategory(node.type) !== 'input') {
          warnings.push(`Node ${node.id} (${node.type}) is unreachable from input`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
