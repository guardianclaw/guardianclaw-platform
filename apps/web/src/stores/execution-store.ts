import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// Execution status for nodes
export type NodeExecutionStatus = 'idle' | 'pending' | 'running' | 'success' | 'error' | 'skipped'

// Execution step from API trace
export interface ExecutionStep {
  step_id: string
  step_name: string
  step_type: string
  category: string
  status: NodeExecutionStatus
  duration_ms?: number
  error?: string
  metadata?: Record<string, unknown>
}

// Store state
interface ExecutionState {
  // Execution status
  isExecuting: boolean
  executionId: string | null
  startTime: number | null

  // Node execution states (maps flow node ID to status)
  nodeStates: Record<string, NodeExecutionStatus>

  // Active edges (edges currently showing animation)
  activeEdges: Set<string>

  // Execution trace (steps from API)
  trace: ExecutionStep[]

  // Current step index (for animation sequencing)
  currentStepIndex: number

  // Actions
  startExecution: () => void
  stopExecution: () => void
  setNodeStatus: (nodeId: string, status: NodeExecutionStatus) => void
  setEdgeActive: (edgeId: string, active: boolean) => void
  setMultipleEdgesActive: (edgeIds: string[], active: boolean) => void
  addTraceStep: (step: ExecutionStep) => void
  setTrace: (trace: ExecutionStep[]) => void
  advanceStep: () => void
  clearExecution: () => void
  reset: () => void

  // Computed helpers
  getNodeStatus: (nodeId: string) => NodeExecutionStatus
  isEdgeActive: (edgeId: string) => boolean
}

// Initial state
const initialState = {
  isExecuting: false,
  executionId: null,
  startTime: null,
  nodeStates: {} as Record<string, NodeExecutionStatus>,
  activeEdges: new Set<string>(),
  trace: [] as ExecutionStep[],
  currentStepIndex: -1,
}

export const useExecutionStore = create<ExecutionState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startExecution: () => {
        const executionId = `exec_${Date.now()}`
        set({
          isExecuting: true,
          executionId,
          startTime: Date.now(),
          nodeStates: {},
          activeEdges: new Set(),
          trace: [],
          currentStepIndex: -1,
        })
      },

      stopExecution: () => {
        set({ isExecuting: false })
      },

      setNodeStatus: (nodeId, status) => {
        set((state) => ({
          nodeStates: {
            ...state.nodeStates,
            [nodeId]: status,
          },
        }))
      },

      setEdgeActive: (edgeId, active) => {
        set((state) => {
          const newActiveEdges = new Set(state.activeEdges)
          if (active) {
            newActiveEdges.add(edgeId)
          } else {
            newActiveEdges.delete(edgeId)
          }
          return { activeEdges: newActiveEdges }
        })
      },

      setMultipleEdgesActive: (edgeIds, active) => {
        set((state) => {
          const newActiveEdges = new Set(state.activeEdges)
          edgeIds.forEach((edgeId) => {
            if (active) {
              newActiveEdges.add(edgeId)
            } else {
              newActiveEdges.delete(edgeId)
            }
          })
          return { activeEdges: newActiveEdges }
        })
      },

      addTraceStep: (step) => {
        set((state) => ({
          trace: [...state.trace, step],
        }))
      },

      setTrace: (trace) => {
        set({ trace })
      },

      advanceStep: () => {
        set((state) => ({
          currentStepIndex: state.currentStepIndex + 1,
        }))
      },

      clearExecution: () => {
        set({
          nodeStates: {},
          activeEdges: new Set(),
          currentStepIndex: -1,
        })
      },

      reset: () => {
        set(initialState)
      },

      // Computed helpers
      getNodeStatus: (nodeId) => {
        return get().nodeStates[nodeId] || 'idle'
      },

      isEdgeActive: (edgeId) => {
        return get().activeEdges.has(edgeId)
      },
    }),
    { name: 'ExecutionStore' }
  )
)

// Selector hooks for performance
export const useIsExecuting = () => useExecutionStore((state) => state.isExecuting)
export const useNodeStates = () => useExecutionStore((state) => state.nodeStates)
export const useActiveEdges = () => useExecutionStore((state) => state.activeEdges)
export const useExecutionTrace = () => useExecutionStore((state) => state.trace)

// Hook to get a specific node's execution status
export const useNodeExecutionStatus = (nodeId: string): NodeExecutionStatus => {
  return useExecutionStore((state) => state.nodeStates[nodeId] || 'idle')
}

// Hook to check if an edge is active
export const useIsEdgeActive = (edgeId: string): boolean => {
  return useExecutionStore((state) => state.activeEdges.has(edgeId))
}
