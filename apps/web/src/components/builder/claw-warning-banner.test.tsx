/**
 * GuardianClawWarningBanner component tests (SEC-001 Caminho 3)
 * Tests rendering, conditional display, and dismiss behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFlowStore } from '@/stores'
import { GuardianClawWarningBanner } from './claw-warning-banner'

describe('GuardianClawWarningBanner', () => {
  beforeEach(() => {
    useFlowStore.getState().reset()
  })

  it('renders nothing when clawWarning is none', () => {
    const { container } = render(<GuardianClawWarningBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders full removal warning when all claw nodes are removed', () => {
    // Trigger the warning via store actions
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode({
      id: 's1',
      type: 'claw',
      position: { x: 0, y: 0 },
      data: { label: 'GuardianClaw' },
    })
    deleteNode('s1')

    render(<GuardianClawWarningBanner />)

    expect(screen.getByText('No GuardianClaw protection.')).toBeInTheDocument()
    expect(screen.getByText(/All validation nodes have been removed/)).toBeInTheDocument()
  })

  it('renders partial removal warning when some claw nodes remain', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode({
      id: 's1',
      type: 'claw',
      position: { x: 0, y: 0 },
      data: { label: 'GuardianClaw In' },
    })
    addNode({
      id: 's2',
      type: 'claw',
      position: { x: 100, y: 0 },
      data: { label: 'GuardianClaw Out' },
    })
    deleteNode('s1')

    render(<GuardianClawWarningBanner />)

    expect(screen.getByText('Partial protection.')).toBeInTheDocument()
    expect(screen.getByText(/Missing layers will use auto-protection/)).toBeInTheDocument()
  })

  it('renders nothing when warning is dismissed', () => {
    const { addNode, deleteNode, dismissGuardianClawWarning } = useFlowStore.getState()
    addNode({
      id: 's1',
      type: 'claw',
      position: { x: 0, y: 0 },
      data: { label: 'GuardianClaw' },
    })
    deleteNode('s1')
    dismissGuardianClawWarning()

    const { container } = render(<GuardianClawWarningBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('dismisses when X button is clicked', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode({
      id: 's1',
      type: 'claw',
      position: { x: 0, y: 0 },
      data: { label: 'GuardianClaw' },
    })
    deleteNode('s1')

    const { container } = render(<GuardianClawWarningBanner />)

    // Banner is visible
    expect(screen.getByText('No GuardianClaw protection.')).toBeInTheDocument()

    // Click dismiss
    const dismissButton = screen.getByRole('button', { name: /dismiss warning/i })
    fireEvent.click(dismissButton)

    // Store should be updated
    expect(useFlowStore.getState().clawWarningDismissed).toBe(true)
  })

  it('has accessible dismiss button with aria-label', () => {
    const { addNode, deleteNode } = useFlowStore.getState()
    addNode({
      id: 's1',
      type: 'claw',
      position: { x: 0, y: 0 },
      data: { label: 'GuardianClaw' },
    })
    deleteNode('s1')

    render(<GuardianClawWarningBanner />)

    const button = screen.getByRole('button', { name: /dismiss warning/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Dismiss warning')
  })
})
