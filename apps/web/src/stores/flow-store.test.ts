/**
 * Flow store tests — GuardianClaw warning system (SEC-001 Caminho 3)
 * Tests warning lifecycle: deleteNode, addNode, loadFlow, dismiss
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFlowStore } from './flow-store'
import type { FlowNode } from './flow-store'

// Helper to create a node
function makeNode(id: string, type: string): FlowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: `${type} ${id}` },
  }
}

describe('Flow Store — GuardianClaw Warning', () => {
  beforeEach(() => {
    useFlowStore.getState().reset()
  })

  it('starts with no warning', () => {
    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('none')
    expect(state.clawWarningDismissed).toBe(false)
  })

  it('sets all_removed when last claw node is deleted', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode(makeNode('n1', 'input'))
    addNode(makeNode('s1', 'claw'))
    addNode(makeNode('n2', 'output'))

    deleteNode('s1')

    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('all_removed')
    expect(state.clawWarningDismissed).toBe(false)
  })

  it('sets partial_removed when one of two claw nodes is deleted', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode(makeNode('s1', 'claw'))
    addNode(makeNode('s2', 'claw'))
    addNode(makeNode('n1', 'process'))

    deleteNode('s1')

    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('partial_removed')
  })

  it('does not set warning when non-claw node is deleted', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode(makeNode('n1', 'input'))
    addNode(makeNode('s1', 'claw'))

    deleteNode('n1')

    expect(useFlowStore.getState().clawWarning).toBe('none')
  })

  it('clears warning when claw node is added back', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode(makeNode('s1', 'claw'))

    // Delete claw — triggers warning
    deleteNode('s1')
    expect(useFlowStore.getState().clawWarning).toBe('all_removed')

    // Add a new claw — clears warning
    addNode(makeNode('s2', 'claw'))
    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('none')
    expect(state.clawWarningDismissed).toBe(false)
  })

  it('dismisses warning without resetting level', () => {
    const { addNode, deleteNode, dismissGuardianClawWarning } = useFlowStore.getState()
    addNode(makeNode('s1', 'claw'))
    deleteNode('s1')

    expect(useFlowStore.getState().clawWarning).toBe('all_removed')

    dismissGuardianClawWarning()
    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('all_removed')
    expect(state.clawWarningDismissed).toBe(true)
  })

  it('loadFlow resets warning and dismissed state', () => {
    const { addNode, deleteNode, loadFlow } = useFlowStore.getState()
    addNode(makeNode('s1', 'claw'))
    deleteNode('s1')

    expect(useFlowStore.getState().clawWarning).toBe('all_removed')

    loadFlow('agent-1', 'Test Agent', [makeNode('n1', 'input')], [])

    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('none')
    expect(state.clawWarningDismissed).toBe(false)
    expect(state.agentId).toBe('agent-1')
  })

  it('reset() clears active warning and dismissed state', () => {
    const { addNode, deleteNode, dismissGuardianClawWarning, reset } = useFlowStore.getState()
    addNode(makeNode('s1', 'claw'))
    deleteNode('s1')
    dismissGuardianClawWarning()

    // Confirm warning is active and dismissed before reset
    expect(useFlowStore.getState().clawWarning).toBe('all_removed')
    expect(useFlowStore.getState().clawWarningDismissed).toBe(true)

    reset()

    const state = useFlowStore.getState()
    expect(state.clawWarning).toBe('none')
    expect(state.clawWarningDismissed).toBe(false)
    expect(state.nodes).toHaveLength(0)
  })
})
