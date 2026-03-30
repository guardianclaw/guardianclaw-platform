/**
 * Template conversion utilities for the GuardianClaw Platform.
 *
 * Converts template definitions from templates.ts into the flow format
 * expected by the React Flow canvas and the backend API.
 */

import { Template, FlowNode as TemplateFlowNode, FlowEdge as TemplateFlowEdge } from './templates'

// Node types in the canvas
type CanvasNodeType =
  | 'input'
  | 'output'
  | 'process'
  | 'claw'
  | 'tool'
  | 'flow'
  | 'memory'
  | 'utility'

// Mapping from template node types to canvas node types
const NODE_TYPE_MAP: Record<string, CanvasNodeType> = {
  input: 'input',
  output: 'output',
  llm: 'process',
  claw: 'claw',
  module: 'tool',
  memory: 'memory',
}

// Default node dimensions for layout calculation
const NODE_WIDTH = 200
const NODE_HEIGHT = 80
const NODE_SPACING_X = 250
const NODE_SPACING_Y = 150

/**
 * Calculate optimal node positions based on the flow topology.
 * Uses a simple left-to-right layout algorithm.
 */
function calculateNodePositions(
  nodes: TemplateFlowNode[],
  edges: TemplateFlowEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  // Build adjacency map for topological sorting
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  nodes.forEach((node) => {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  })

  edges.forEach((edge) => {
    const sources = adjacency.get(edge.source) || []
    sources.push(edge.target)
    adjacency.set(edge.source, sources)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })

  // Topological sort using Kahn's algorithm to determine layers
  const layers: string[][] = []
  let currentLayer = nodes
    .filter((node) => (inDegree.get(node.id) || 0) === 0)
    .map((node) => node.id)

  const visited = new Set<string>()

  while (currentLayer.length > 0) {
    layers.push([...currentLayer])
    currentLayer.forEach((id) => visited.add(id))

    const nextLayer: string[] = []
    currentLayer.forEach((nodeId) => {
      const neighbors = adjacency.get(nodeId) || []
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          const degree = (inDegree.get(neighbor) || 0) - 1
          inDegree.set(neighbor, degree)
          if (degree === 0) {
            nextLayer.push(neighbor)
          }
        }
      })
    })
    currentLayer = nextLayer
  }

  // Assign positions based on layers
  const startX = 100
  const startY = 200

  layers.forEach((layer, layerIndex) => {
    const layerHeight = layer.length * NODE_SPACING_Y
    const layerStartY = startY - layerHeight / 2 + NODE_SPACING_Y / 2

    layer.forEach((nodeId, nodeIndex) => {
      positions.set(nodeId, {
        x: startX + layerIndex * NODE_SPACING_X,
        y: layerStartY + nodeIndex * NODE_SPACING_Y,
      })
    })
  })

  // Handle any orphaned nodes (not in topology)
  nodes.forEach((node, index) => {
    if (!positions.has(node.id)) {
      positions.set(node.id, {
        x: startX + index * NODE_SPACING_X,
        y: startY,
      })
    }
  })

  return positions
}

/**
 * Get the appropriate subtype for a node based on template type.
 */
function getNodeSubtype(templateNode: TemplateFlowNode): Record<string, unknown> {
  switch (templateNode.type) {
    case 'input':
      return { inputType: 'user_message' }
    case 'output':
      return { outputType: 'response' }
    case 'llm':
      return { processType: 'llm_call' }
    case 'claw':
      return { gateType: 'all' }
    case 'module':
      // Module type is typically a GuardianClaw module (fiduciary, memory shield, etc.)
      return { toolType: 'claw_module' }
    case 'memory':
      // Memory type from template data, defaults to 'vector' for RAG use cases
      return { memoryType: templateNode.data?.memoryType || 'vector' }
    default:
      return {}
  }
}

/**
 * Get default configuration for a node based on its type.
 */
function getNodeDefaultConfig(templateNode: TemplateFlowNode): Record<string, unknown> {
  switch (templateNode.type) {
    case 'input':
      return {}
    case 'output':
      return { format: 'text' }
    case 'llm':
      return { model: 'gpt-4o-mini' }
    case 'claw':
      return { enabled: true }
    case 'module':
      return { enabled: true }
    case 'memory': {
      // Default config based on memory type
      const memoryType = templateNode.data?.memoryType || 'vector'
      if (memoryType === 'buffer') {
        return { operation: 'get', bufferSize: 10 }
      }
      if (memoryType === 'summary') {
        return { model: 'gpt-4o-mini', maxLength: 500 }
      }
      // Default: vector
      return { operation: 'search', topK: 5, threshold: 0.7 }
    }
    default:
      return {}
  }
}

/**
 * Convert a template's default flow to the canvas/API format.
 *
 * @param template - The template to convert
 * @returns Flow object with nodes and edges in canvas format
 */
export function convertTemplateToFlow(template: Template): {
  nodes: unknown[]
  edges: unknown[]
} {
  const templateNodes = template.defaultFlow.nodes
  const templateEdges = template.defaultFlow.edges

  // Calculate optimal positions
  const positions = calculateNodePositions(templateNodes, templateEdges)

  // Convert nodes
  const nodes = templateNodes.map((templateNode) => {
    const position = positions.get(templateNode.id) || { x: 100, y: 200 }
    const canvasType = NODE_TYPE_MAP[templateNode.type] || (templateNode.type as CanvasNodeType)
    const subtype = getNodeSubtype(templateNode)
    const defaultConfig = getNodeDefaultConfig(templateNode)

    return {
      id: templateNode.id,
      type: canvasType,
      position,
      data: {
        label: templateNode.label,
        ...subtype,
        config: {
          ...defaultConfig,
          ...(templateNode.data || {}),
        },
      },
    }
  })

  // Convert edges with animation and styling
  const edges = templateEdges.map((templateEdge) => ({
    id: templateEdge.id,
    source: templateEdge.source,
    target: templateEdge.target,
    type: 'smoothstep',
    animated: true,
  }))

  return { nodes, edges }
}

/**
 * Get the default protection level based on template category.
 * DeFi templates get stricter protection by default.
 */
export function getDefaultProtectionLevel(template: Template): 'minimal' | 'standard' | 'maximum' {
  if (template.category === 'defi') {
    return 'maximum'
  }
  return 'standard'
}

/**
 * Get the default gates configuration based on protection level.
 */
export function getGatesForProtectionLevel(level: 'minimal' | 'standard' | 'maximum'): {
  credibility: boolean
  avoidance: boolean
  limits: boolean
  worth: boolean
} {
  switch (level) {
    case 'minimal':
      return { credibility: false, avoidance: true, limits: false, worth: false }
    case 'standard':
      return { credibility: true, avoidance: true, limits: true, worth: false }
    case 'maximum':
      return { credibility: true, avoidance: true, limits: true, worth: true }
    default:
      return { credibility: true, avoidance: true, limits: true, worth: false }
  }
}

/**
 * Get the security modules that should be enabled by default based on template.
 * DeFi templates enable Fiduciary by default.
 */
export function getDefaultModulesForTemplate(
  template: Template
): Record<string, { enabled: boolean }> {
  const modules: Record<string, { enabled: boolean }> = {}

  template.securityModules.forEach((module) => {
    modules[module.id] = { enabled: module.enabled }
  })

  // DeFi templates should always have fiduciary enabled
  if (template.category === 'defi') {
    modules['fiduciary'] = { enabled: true }
    modules['memory_shield'] = { enabled: true }
  }

  return modules
}

/**
 * Build complete agent creation payload from a template and user configuration.
 */
export function buildAgentPayload(
  template: Template,
  userConfig: Record<string, string | number | boolean>,
  protectionLevel: 'minimal' | 'standard' | 'maximum' = 'standard'
): {
  name: string
  description: string
  framework: string
  icon: string
  flow: { nodes: unknown[]; edges: unknown[] }
  config: Record<string, unknown>
  claw_config: {
    protection_level: string
    modules: Record<string, { enabled: boolean }>
    gates: { credibility: boolean; avoidance: boolean; limits: boolean; worth: boolean }
  }
  integration_config: Record<string, unknown>
} {
  const flow = convertTemplateToFlow(template)
  const gates = getGatesForProtectionLevel(protectionLevel)
  const modules = getDefaultModulesForTemplate(template)

  // Extract name from config, use template name as fallback
  const name = (userConfig.name as string)?.trim() || template.name

  // Build agent config from user values (excluding name)
  const agentConfig: Record<string, unknown> = {}
  Object.entries(userConfig).forEach(([key, value]) => {
    if (key !== 'name') {
      agentConfig[key] = value
    }
  })

  return {
    name,
    description: template.description,
    framework: template.id,
    icon: template.icon,
    flow,
    config: {
      template_id: template.id,
      ...agentConfig,
    },
    claw_config: {
      protection_level: protectionLevel,
      modules,
      gates,
    },
    integration_config: template.integrationConfig || {},
  }
}
