import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeFiSection } from './defi-section'

const mockDefi = [
  { operation: 'transfer', total_transactions: 100, blocked_count: 3, total_value_usd: 50000 },
  { operation: 'swap', total_transactions: 50, blocked_count: 1, total_value_usd: 25000 },
  { operation: 'stake', total_transactions: 20, blocked_count: 0, total_value_usd: 10000 },
]

describe('DeFiSection', () => {
  it('renders title and description', () => {
    render(<DeFiSection defi={mockDefi} />)

    expect(screen.getByText('DeFi Protection')).toBeInTheDocument()
    expect(screen.getByText('Transaction validation and risk prevention')).toBeInTheDocument()
  })

  it('displays summary statistics', () => {
    render(<DeFiSection defi={mockDefi} />)

    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByText('Value Protected')).toBeInTheDocument()
  })

  it('calculates total transactions correctly', () => {
    const { container } = render(<DeFiSection defi={mockDefi} />)
    // Total: 100 + 50 + 20 = 170
    expect(container.textContent).toContain('170')
  })

  it('calculates total blocked correctly', () => {
    render(<DeFiSection defi={mockDefi} />)
    // Blocked: 3 + 1 + 0 = 4
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('calculates total value correctly', () => {
    const { container } = render(<DeFiSection defi={mockDefi} />)
    // Total: 50000 + 25000 + 10000 = 85000 -> $85.0K
    expect(container.textContent).toContain('$85.0K')
  })

  it('renders operation names from config', () => {
    render(<DeFiSection defi={mockDefi} />)

    expect(screen.getByText('Transfer')).toBeInTheDocument()
    expect(screen.getByText('Swap')).toBeInTheDocument()
    expect(screen.getByText('Stake')).toBeInTheDocument()
  })

  it('displays transaction count for each operation', () => {
    render(<DeFiSection defi={mockDefi} />)

    expect(screen.getByText('100 txns')).toBeInTheDocument()
    expect(screen.getByText('50 txns')).toBeInTheDocument()
    expect(screen.getByText('20 txns')).toBeInTheDocument()
  })

  it('displays blocked count only when greater than zero', () => {
    render(<DeFiSection defi={mockDefi} />)

    // Transfer has 3 blocked, Swap has 1
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    // Stake has 0 blocked - should not show blocked indicator
  })

  it('displays value for each operation', () => {
    render(<DeFiSection defi={mockDefi} />)

    expect(screen.getByText('$50.0K')).toBeInTheDocument()
    expect(screen.getByText('$25.0K')).toBeInTheDocument()
    expect(screen.getByText('$10.0K')).toBeInTheDocument()
  })

  it('formats large values with M suffix', () => {
    const largeValue = [
      { operation: 'transfer', total_transactions: 10, blocked_count: 0, total_value_usd: 2500000 },
    ]
    const { container } = render(<DeFiSection defi={largeValue} />)

    expect(container.textContent).toContain('$2.50M')
  })

  it('formats small values without suffix', () => {
    const smallValue = [
      { operation: 'transfer', total_transactions: 5, blocked_count: 0, total_value_usd: 500 },
    ]
    const { container } = render(<DeFiSection defi={smallValue} />)

    expect(container.textContent).toContain('$500')
  })

  it('shows loading skeleton when loading is true', () => {
    render(<DeFiSection defi={mockDefi} loading={true} />)

    // Content should not be visible when loading
    expect(screen.queryByText('DeFi Protection')).not.toBeInTheDocument()
    expect(screen.queryByText('Transfer')).not.toBeInTheDocument()
  })

  it('shows empty state when no DeFi data', () => {
    render(<DeFiSection defi={[]} />)

    expect(screen.getByText('No DeFi transactions in this period')).toBeInTheDocument()
    expect(
      screen.getByText('DeFi protection metrics will appear when your agent processes transactions')
    ).toBeInTheDocument()
  })

  it('handles unknown operation gracefully', () => {
    const unknownOp = [
      { operation: 'custom_op', total_transactions: 15, blocked_count: 2, total_value_usd: 5000 },
    ]
    render(<DeFiSection defi={unknownOp} />)

    expect(screen.getByText('custom_op')).toBeInTheDocument()
    expect(screen.getByText('15 txns')).toBeInTheDocument()
  })

  it('handles zero values correctly', () => {
    const zeroValues = [
      { operation: 'transfer', total_transactions: 0, blocked_count: 0, total_value_usd: 0 },
    ]
    render(<DeFiSection defi={zeroValues} />)

    expect(screen.getByText('0 txns')).toBeInTheDocument()
    // $0 appears in both summary (Value Protected) and operation row
    expect(screen.getAllByText('$0')).toHaveLength(2)
  })
})
