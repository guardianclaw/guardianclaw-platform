import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OverviewSection } from './overview-section'

const mockSummary = {
  total_requests: 1234,
  total_blocked: 56,
  block_rate: 4.54,
  avg_latency_ms: 150,
}

describe('OverviewSection', () => {
  it('renders all summary cards with correct values', () => {
    const { container } = render(<OverviewSection summary={mockSummary} />)

    expect(screen.getByText('Total Requests')).toBeInTheDocument()
    // toLocaleString() formats differently based on locale (1,234 or 1.234)
    expect(container.textContent).toMatch(/1[,.]234/)

    expect(screen.getByText('Blocked Requests')).toBeInTheDocument()
    expect(screen.getByText('56')).toBeInTheDocument()

    expect(screen.getByText('Avg Latency')).toBeInTheDocument()
    expect(screen.getByText('150ms')).toBeInTheDocument()

    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    // Success rate text may be split across elements
    expect(container.textContent).toContain('95.5')
  })

  it('shows loading skeleton when loading is true', () => {
    const { container } = render(<OverviewSection summary={mockSummary} loading={true} />)

    // Values should not be visible when loading
    expect(container.textContent).not.toMatch(/1[,.]234/)
    expect(screen.queryByText('56')).not.toBeInTheDocument()
    expect(screen.queryByText('150ms')).not.toBeInTheDocument()
  })

  it('shows Healthy status when success rate >= 95%', () => {
    render(<OverviewSection summary={mockSummary} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('shows Monitor status when success rate < 95%', () => {
    const lowSuccessSummary = {
      ...mockSummary,
      block_rate: 10, // 90% success rate
    }
    render(<OverviewSection summary={lowSuccessSummary} />)
    expect(screen.getByText('Monitor')).toBeInTheDocument()
  })

  it('handles zero requests correctly', () => {
    const zeroSummary = {
      total_requests: 0,
      total_blocked: 0,
      block_rate: 0,
      avg_latency_ms: 0,
    }
    const { container } = render(<OverviewSection summary={zeroSummary} />)

    expect(screen.getByText('0ms')).toBeInTheDocument()
    expect(container.textContent).toContain('100.0')
  })

  it('displays block rate in card subtitle', () => {
    render(<OverviewSection summary={mockSummary} />)
    expect(screen.getByText('4.54% block rate')).toBeInTheDocument()
  })
})
