import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GuardianClawSection } from './claw-section'

const mockLayers = [
  { layer: 'L1_input', total_checks: 100, blocked_count: 10 },
  { layer: 'L3_output', total_checks: 80, blocked_count: 5 },
  { layer: 'L4_observer', total_checks: 50, blocked_count: 2 },
]

describe('GuardianClawSection', () => {
  it('renders all layers with correct names', () => {
    render(<GuardianClawSection layers={mockLayers} />)

    expect(screen.getByText('L1 Input Validator')).toBeInTheDocument()
    expect(screen.getByText('L3 Output Validator')).toBeInTheDocument()
    expect(screen.getByText('L4 Observer')).toBeInTheDocument()
  })

  it('displays blocked count for each layer', () => {
    render(<GuardianClawSection layers={mockLayers} />)

    expect(screen.getByText('10 blocks')).toBeInTheDocument()
    expect(screen.getByText('5 blocks')).toBeInTheDocument()
    expect(screen.getByText('2 blocks')).toBeInTheDocument()
  })

  it('shows loading skeleton when loading is true', () => {
    render(<GuardianClawSection layers={mockLayers} loading={true} />)

    // Layer names should not be visible when loading
    expect(screen.queryByText('L1 Input Validator')).not.toBeInTheDocument()
    expect(screen.queryByText('10 blocks')).not.toBeInTheDocument()
  })

  it('shows empty state when no blocks in period', () => {
    const emptyLayers = [{ layer: 'L1_input', total_checks: 100, blocked_count: 0 }]
    render(<GuardianClawSection layers={emptyLayers} />)

    expect(screen.getByText('No blocks in this period')).toBeInTheDocument()
    expect(screen.getByText('All requests passed validation')).toBeInTheDocument()
  })

  it('shows Blocks by Layer title when there are blocks', () => {
    render(<GuardianClawSection layers={mockLayers} />)
    expect(screen.getByText('Blocks by Layer')).toBeInTheDocument()
  })

  it('shows GuardianClaw Protection title when no blocks', () => {
    const emptyLayers = [{ layer: 'L1_input', total_checks: 100, blocked_count: 0 }]
    render(<GuardianClawSection layers={emptyLayers} />)
    expect(screen.getByText('GuardianClaw Protection')).toBeInTheDocument()
  })

  it('displays layer descriptions', () => {
    render(<GuardianClawSection layers={mockLayers} />)

    expect(screen.getByText('Pattern-based input filtering')).toBeInTheDocument()
    expect(screen.getByText('Response safety checks')).toBeInTheDocument()
    expect(screen.getByText('LLM-based semantic analysis')).toBeInTheDocument()
  })

  it('handles unknown layer gracefully', () => {
    const unknownLayers = [{ layer: 'unknown_layer', total_checks: 50, blocked_count: 3 }]
    render(<GuardianClawSection layers={unknownLayers} />)

    expect(screen.getByText('unknown_layer')).toBeInTheDocument()
    expect(screen.getByText('3 blocks')).toBeInTheDocument()
  })
})
