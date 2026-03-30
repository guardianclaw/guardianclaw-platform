import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentActivitySection } from './recent-activity-section'

const mockBlocks = [
  { id: '1', layer: 'L1_input', gate: 'avoidance', created_at: new Date().toISOString() },
  {
    id: '2',
    layer: 'L3_output',
    gate: 'limits',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '3',
    layer: 'L4_observer',
    gate: 'credibility',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

describe('RecentActivitySection', () => {
  it('renders title and description', () => {
    render(<RecentActivitySection recentBlocks={mockBlocks} />)

    expect(screen.getByText('Recent Blocks')).toBeInTheDocument()
    expect(screen.getByText('Last blocked requests by GuardianClaw')).toBeInTheDocument()
  })

  it('renders all blocks with layer names', () => {
    render(<RecentActivitySection recentBlocks={mockBlocks} />)

    expect(screen.getByText('Blocked by L1 Input')).toBeInTheDocument()
    expect(screen.getByText('Blocked by L3 Output')).toBeInTheDocument()
    expect(screen.getByText('Blocked by L4 Observer')).toBeInTheDocument()
  })

  it('displays layer badges', () => {
    render(<RecentActivitySection recentBlocks={mockBlocks} />)

    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.getByText('L3')).toBeInTheDocument()
    expect(screen.getByText('L4')).toBeInTheDocument()
  })

  it('shows loading skeleton when loading is true', () => {
    render(<RecentActivitySection recentBlocks={mockBlocks} loading={true} />)

    // Content should not be visible when loading
    expect(screen.queryByText('Blocked by L1 Input')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent Blocks')).not.toBeInTheDocument()
  })

  it('shows empty state when no blocks', () => {
    render(<RecentActivitySection recentBlocks={[]} />)

    expect(screen.getByText('No blocked requests yet')).toBeInTheDocument()
  })

  it('formats time ago correctly - just now', () => {
    const justNow = [
      { id: '1', layer: 'L1_input', gate: 'avoidance', created_at: new Date().toISOString() },
    ]
    render(<RecentActivitySection recentBlocks={justNow} />)

    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('formats time ago correctly - hours', () => {
    const hoursAgo = [
      {
        id: '1',
        layer: 'L1_input',
        gate: 'avoidance',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ]
    render(<RecentActivitySection recentBlocks={hoursAgo} />)

    expect(screen.getByText('1 hour ago')).toBeInTheDocument()
  })

  it('formats time ago correctly - days', () => {
    const daysAgo = [
      {
        id: '1',
        layer: 'L1_input',
        gate: 'avoidance',
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ]
    render(<RecentActivitySection recentBlocks={daysAgo} />)

    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  it('handles unknown layer gracefully', () => {
    const unknownLayer = [
      { id: '1', layer: 'unknown', gate: 'avoidance', created_at: new Date().toISOString() },
    ]
    render(<RecentActivitySection recentBlocks={unknownLayer} />)

    expect(screen.getByText('Blocked by unknown')).toBeInTheDocument()
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('applies correct badge colors for each layer', () => {
    const { container } = render(<RecentActivitySection recentBlocks={mockBlocks} />)

    // L1 should have red styling
    expect(container.querySelector('.bg-red-500\\/20')).toBeInTheDocument()
    // L3 should have yellow styling
    expect(container.querySelector('.bg-yellow-500\\/20')).toBeInTheDocument()
    // L4 should have blue styling
    expect(container.querySelector('.bg-blue-500\\/20')).toBeInTheDocument()
  })
})
