import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'

// =============================================================================
// GuardianClaw v2.25 Layer Types
// =============================================================================

/** GuardianClaw validation layer types (v2.25 architecture) */
export type GuardianClawLayerType =
  | 'input_validator'
  | 'seed_injection'
  | 'output_validator'
  | 'observer'

/** L1: Input Validator configuration */
export interface L1Config {
  mode: 'strict' | 'moderate' | 'lenient'
  enabledDetectors: {
    pattern: boolean // PatternDetector - 700+ attack patterns
    escalation: boolean // EscalationDetector - multi-turn attacks (Crescendo)
    framing: boolean // FramingDetector - roleplay/fiction bypass
    harmful_request: boolean // HarmfulRequestDetector - 10 avoidance categories
    intent_signal: boolean // IntentSignalDetector - compositional intent
    safe_agent: boolean // SafeAgentDetector - embodied AI safety
    embedding: boolean // EmbeddingDetector - semantic similarity (requires API)
    benign_context: boolean // BenignContextDetector - false positive reduction
  }
  threshold: number // 0-100, detection threshold
}

/** L2: Seed Injection configuration */
export interface L2Config {
  seedLevel: 'minimal' | 'standard' | 'full'
  customSeed?: string
  appendMode: boolean // true = append to system prompt, false = replace
}

/** L3: Output Validator configuration */
export interface L3Config {
  mode: 'strict' | 'moderate'
  enabledGates: {
    credibility: boolean
    avoidance: boolean
    limits: boolean
    worth: boolean
  }
}

/** L4: GuardianClaw Observer configuration */
export interface L4Config {
  enabled: boolean
  provider: 'openai' | 'anthropic' | 'openrouter'
  model: string
  /**
   * Fallback policy when L4 LLM call fails.
   * - BLOCK: Always block (maximum security)
   * - ALLOW_IF_L2_PASSED: Allow if Gate 2 (L3 OutputValidator) passed (balanced)
   * - ALLOW: Always allow (maximum usability)
   * Note: "L2" refers to Gate 2 in SDK nomenclature, which is the L3 OutputValidator layer.
   */
  fallbackPolicy: 'BLOCK' | 'ALLOW_IF_L2_PASSED' | 'ALLOW'
  maxRetries: number
  retryDelayMs: number
}

// =============================================================================
// Flow Node Data
// =============================================================================

// Base node data type - flexible to accommodate all node types
export interface FlowNodeData extends Record<string, unknown> {
  label: string

  // Type-specific fields (optional for flexibility)
  inputType?: 'user_message' | 'api_call' | 'webhook'
  processType?: 'llm_call' | 'condition'
  toolType?: 'web_search' | 'code_exec' | 'api_request' | 'database'
  outputType?:
    | 'response'
    | 'webhook'
    | 'store'
    | 'twitter_post'
    | 'discord_message'
    | 'telegram_message'
  flowType?: 'router' | 'merge' | 'loop'
  memoryType?: 'buffer' | 'vector' | 'summary'
  utilityType?: 'delay' | 'log'

  // Legacy CLAW gates (v2.18 compatibility)
  gateType?: 'credibility' | 'avoidance' | 'limits' | 'worth' | 'all'

  // GuardianClaw v2.25 Layer Architecture
  layerType?: GuardianClawLayerType
  l1Config?: L1Config
  l2Config?: L2Config
  l3Config?: L3Config
  l4Config?: L4Config

  // Generic config for other node types
  config?: Record<string, unknown>
}

// Custom node and edge types
export type FlowNode = Node<FlowNodeData>
export type FlowEdge = Edge

// GuardianClaw warning state for auto-protection awareness
export type GuardianClawWarningLevel = 'none' | 'partial_removed' | 'all_removed'

// History snapshot for undo/redo
interface FlowSnapshot {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

const MAX_HISTORY = 50

// Store state
interface FlowState {
  // Agent data
  agentId: string | null
  agentName: string
  isDirty: boolean
  isSaving: boolean
  lastSaved: Date | null

  // Flow data
  nodes: FlowNode[]
  edges: FlowEdge[]

  // Undo/redo history
  past: FlowSnapshot[]
  future: FlowSnapshot[]

  // Selection
  selectedNodes: string[]
  selectedEdge: string | null

  // Viewport
  viewport: { x: number; y: number; zoom: number }

  // GuardianClaw protection warning
  clawWarning: GuardianClawWarningLevel
  clawWarningDismissed: boolean

  // Actions
  setAgentId: (id: string | null) => void
  setAgentName: (name: string) => void
  setNodes: (nodes: FlowNode[]) => void
  setEdges: (edges: FlowEdge[]) => void
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: FlowNode) => void
  updateNode: (nodeId: string, data: Partial<FlowNodeData>) => void
  deleteNode: (nodeId: string) => void
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  markDirty: () => void
  markClean: () => void
  setSaving: (saving: boolean) => void
  dismissGuardianClawWarning: () => void
  undo: () => void
  redo: () => void
  reset: () => void
  loadFlow: (agentId: string, name: string, nodes: FlowNode[], edges: FlowEdge[]) => void
}

// Initial state
const initialState = {
  agentId: null,
  agentName: '',
  isDirty: false,
  isSaving: false,
  lastSaved: null,
  nodes: [] as FlowNode[],
  edges: [] as FlowEdge[],
  past: [] as FlowSnapshot[],
  future: [] as FlowSnapshot[],
  selectedNodes: [] as string[],
  selectedEdge: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  clawWarning: 'none' as GuardianClawWarningLevel,
  clawWarningDismissed: false,
}

export const useFlowStore = create<FlowState>()(
  devtools(
    persist(
      (set, get) => {
        // Save current nodes/edges to history before a destructive change
        const pushHistory = () => {
          const { nodes, edges, past } = get()
          const snapshot: FlowSnapshot = { nodes: [...nodes], edges: [...edges] }
          set({
            past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
            future: [], // clear redo stack on new action
          })
        }

        return {
          ...initialState,

          setAgentId: (id) => set({ agentId: id }),

          setAgentName: (name) => set({ agentName: name }),

          setNodes: (nodes) => set({ nodes, isDirty: true }),

          setEdges: (edges) => set({ edges, isDirty: true }),

          onNodesChange: (changes) => {
            const currentNodes = get().nodes
            const hasRemovals = changes.some((c) => c.type === 'remove')

            // Push history before removing nodes so undo can restore them
            if (hasRemovals) {
              pushHistory()
            }

            const newNodes = applyNodeChanges(changes, currentNodes)

            // Check if claw nodes were removed (e.g. via Delete key)
            const removeChanges = changes.filter((c) => c.type === 'remove')
            let clawUpdate: Partial<FlowState> = {}

            if (removeChanges.length > 0) {
              const removedIds = new Set(removeChanges.map((c) => c.id))
              const removedGuardianClaw = currentNodes.some(
                (n) => removedIds.has(n.id) && n.type === 'claw'
              )

              if (removedGuardianClaw) {
                const remainingGuardianClawCount = newNodes.filter((n) => n.type === 'claw').length

                clawUpdate = {
                  clawWarning: (remainingGuardianClawCount === 0
                    ? 'all_removed'
                    : 'partial_removed') as GuardianClawWarningLevel,
                  clawWarningDismissed: false,
                }
              }
            }

            set({
              nodes: newNodes,
              isDirty: true,
              ...clawUpdate,
            })
          },

          onEdgesChange: (changes) => {
            const hasRemovals = changes.some((c) => c.type === 'remove')
            if (hasRemovals) {
              pushHistory()
            }

            set({
              edges: applyEdgeChanges(changes, get().edges),
              isDirty: true,
            })
          },

          onConnect: (connection) => {
            pushHistory()

            const newEdge = {
              ...connection,
              id: `${connection.source}-${connection.target}`,
              type: 'execution',
              animated: false,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            } as FlowEdge

            set({
              edges: addEdge(newEdge, get().edges),
              isDirty: true,
            })
          },

          addNode: (node) => {
            pushHistory()

            const isGuardianClaw = node.type === 'claw'
            set({
              nodes: [...get().nodes, node],
              isDirty: true,
              // Clear warning when a claw node is added back
              ...(isGuardianClaw
                ? {
                    clawWarning: 'none' as GuardianClawWarningLevel,
                    clawWarningDismissed: false,
                  }
                : {}),
            })
          },

          updateNode: (nodeId, data) => {
            set({
              nodes: get().nodes.map((node) =>
                node.id === nodeId
                  ? { ...node, data: { ...node.data, ...data } as FlowNodeData }
                  : node
              ),
              isDirty: true,
            })
          },

          deleteNode: (nodeId) => {
            pushHistory()

            const nodeToDelete = get().nodes.find((n) => n.id === nodeId)
            const isClawNode = nodeToDelete?.type === 'claw'

            // Count remaining claw nodes after deletion
            const remainingGuardianClawCount = get().nodes.filter(
              (n) => n.type === 'claw' && n.id !== nodeId
            ).length

            set({
              nodes: get().nodes.filter((node) => node.id !== nodeId),
              edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
              selectedNodes: get().selectedNodes.filter((id) => id !== nodeId),
              isDirty: true,
              // Track claw removal for warning display
              ...(isClawNode
                ? {
                    clawWarning: (remainingGuardianClawCount === 0
                      ? 'all_removed'
                      : 'partial_removed') as GuardianClawWarningLevel,
                    clawWarningDismissed: false,
                  }
                : {}),
            })
          },

          selectNode: (nodeId) => {
            if (nodeId === null) {
              set({ selectedNodes: [] })
            } else {
              set({ selectedNodes: [nodeId], selectedEdge: null })
            }
          },

          selectEdge: (edgeId) => {
            set({ selectedEdge: edgeId, selectedNodes: [] })
          },

          setViewport: (viewport) => set({ viewport }),

          markDirty: () => set({ isDirty: true }),

          markClean: () => set({ isDirty: false, lastSaved: new Date() }),

          setSaving: (saving) => set({ isSaving: saving }),

          dismissGuardianClawWarning: () => set({ clawWarningDismissed: true }),

          undo: () => {
            const { past, nodes, edges, future } = get()
            if (past.length === 0) return

            const previous = past[past.length - 1]
            const newPast = past.slice(0, -1)

            // Recalculate claw warning based on restored state
            const clawCount = previous.nodes.filter((n) => n.type === 'claw').length
            const currentGuardianClawCount = nodes.filter((n) => n.type === 'claw').length

            set({
              nodes: previous.nodes,
              edges: previous.edges,
              past: newPast,
              future: [{ nodes: [...nodes], edges: [...edges] }, ...future].slice(0, MAX_HISTORY),
              isDirty: true,
              // Reset claw warning if nodes were restored
              ...(clawCount > currentGuardianClawCount
                ? {
                    clawWarning: (clawCount === 0
                      ? 'all_removed'
                      : 'none') as GuardianClawWarningLevel,
                    clawWarningDismissed: false,
                  }
                : {}),
            })
          },

          redo: () => {
            const { future, nodes, edges, past } = get()
            if (future.length === 0) return

            const next = future[0]
            const newFuture = future.slice(1)

            set({
              nodes: next.nodes,
              edges: next.edges,
              past: [...past, { nodes: [...nodes], edges: [...edges] }],
              future: newFuture,
              isDirty: true,
            })
          },

          reset: () => set(initialState),

          loadFlow: (agentId, name, nodes, edges) => {
            // Normalize edges to ensure proper positioning
            const normalizedEdges = edges.map(
              (edge) =>
                ({
                  ...edge,
                  type: edge.type || 'execution',
                  sourcePosition: (edge as any).sourcePosition || Position.Right,
                  targetPosition: (edge as any).targetPosition || Position.Left,
                }) as FlowEdge
            )

            set({
              agentId,
              agentName: name,
              nodes,
              edges: normalizedEdges,
              past: [],
              future: [],
              isDirty: false,
              selectedNodes: [],
              selectedEdge: null,
              clawWarning: 'none',
              clawWarningDismissed: false,
            })
          },
        }
      },
      {
        name: 'claw-flow-store',
        partialize: (state) => ({
          // Only persist viewport preferences
          viewport: state.viewport,
        }),
      }
    ),
    { name: 'FlowStore' }
  )
)

// Selector hooks for performance
export const useNodes = () => useFlowStore((state) => state.nodes)
export const useEdges = () => useFlowStore((state) => state.edges)
export const useSelectedNode = () => {
  const selectedNodes = useFlowStore((state) => state.selectedNodes)
  const nodes = useFlowStore((state) => state.nodes)
  return selectedNodes.length > 0 ? nodes.find((n) => n.id === selectedNodes[0]) || null : null
}
export const useIsDirty = () => useFlowStore((state) => state.isDirty)
export const useIsSaving = () => useFlowStore((state) => state.isSaving)
