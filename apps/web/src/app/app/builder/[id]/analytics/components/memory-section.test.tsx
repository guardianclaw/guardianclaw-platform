import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemorySection } from './memory-section'

const mockMemory = {
  reads: 500,
  writes: 150,
  shield_blocks: 3,
}

describe('MemorySection', () => {
  it('renders title and description', () => {
    render(<MemorySection memory={mockMemory} />)

    expect(screen.getByText('Memory Operations')).toBeInTheDocument()
    expect(screen.getByText('Agent memory and shield protection')).toBeInTheDocument()
  })

  it('displays all three metrics', () => {
    render(<MemorySection memory={mockMemory} />)

    expect(screen.getByText('Reads')).toBeInTheDocument()
    expect(screen.getByText('Writes')).toBeInTheDocument()
    expect(screen.getByText('Shield Blocks')).toBeInTheDocument()
  })

  it('displays correct values', () => {
    render(<MemorySection memory={mockMemory} />)

    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('formats large numbers with K suffix', () => {
    const largeMemory = {
      reads: 5000,
      writes: 1500,
      shield_blocks: 0,
    }
    render(<MemorySection memory={largeMemory} />)

    expect(screen.getByText('5.0K')).toBeInTheDocument()
    expect(screen.getByText('1.5K')).toBeInTheDocument()
  })

  it('formats very large numbers with M suffix', () => {
    const veryLargeMemory = {
      reads: 2500000,
      writes: 500000,
      shield_blocks: 0,
    }
    render(<MemorySection memory={veryLargeMemory} />)

    expect(screen.getByText('2.5M')).toBeInTheDocument()
    expect(screen.getByText('500.0K')).toBeInTheDocument()
  })

  it('shows shield block warning when blocks > 0', () => {
    render(<MemorySection memory={mockMemory} />)

    expect(screen.getByText(/Memory Shield blocked 3 injection attempts/)).toBeInTheDocument()
  })

  it('uses singular form for single block', () => {
    const singleBlock = {
      reads: 100,
      writes: 50,
      shield_blocks: 1,
    }
    render(<MemorySection memory={singleBlock} />)

    expect(screen.getByText(/Memory Shield blocked 1 injection attempt$/)).toBeInTheDocument()
  })

  it('does not show shield warning when blocks = 0', () => {
    const noBlocks = {
      reads: 100,
      writes: 50,
      shield_blocks: 0,
    }
    render(<MemorySection memory={noBlocks} />)

    expect(screen.queryByText(/Memory Shield blocked/)).not.toBeInTheDocument()
  })

  it('shows loading skeleton when loading is true', () => {
    render(<MemorySection memory={mockMemory} loading={true} />)

    // Content should not be visible when loading
    expect(screen.queryByText('Memory Operations')).not.toBeInTheDocument()
    expect(screen.queryByText('Reads')).not.toBeInTheDocument()
  })

  it('shows empty state when no activity', () => {
    const emptyMemory = {
      reads: 0,
      writes: 0,
      shield_blocks: 0,
    }
    render(<MemorySection memory={emptyMemory} />)

    expect(screen.getByText('No memory operations in this period')).toBeInTheDocument()
    expect(
      screen.getByText('Memory metrics will appear when your agent uses persistent memory')
    ).toBeInTheDocument()
  })

  it('applies red styling to shield blocks when > 0', () => {
    const { container } = render(<MemorySection memory={mockMemory} />)

    // Should have red background for shield blocks
    expect(container.querySelector('.bg-red-500\\/10')).toBeInTheDocument()
    // Should have red text
    expect(container.querySelector('.text-red-500')).toBeInTheDocument()
  })

  it('applies muted styling to shield blocks when = 0', () => {
    const noBlocks = {
      reads: 100,
      writes: 50,
      shield_blocks: 0,
    }
    const { container } = render(<MemorySection memory={noBlocks} />)

    // Should have muted background for shield blocks (not red)
    expect(container.querySelector('.bg-muted\\/50')).toBeInTheDocument()
  })

  it('handles zero reads with writes correctly', () => {
    const noReads = {
      reads: 0,
      writes: 50,
      shield_blocks: 0,
    }
    render(<MemorySection memory={noReads} />)

    // Should still show the metrics (not empty state)
    // 0 appears twice: once for reads, once for shield_blocks
    expect(screen.getAllByText('0')).toHaveLength(2)
    expect(screen.getByText('50')).toBeInTheDocument()
  })
})
