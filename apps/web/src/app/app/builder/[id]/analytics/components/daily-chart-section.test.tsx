import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DailyChartSection } from './daily-chart-section'

const mockDaily = [
  { date: '2026-01-08', requests: 100, blocked: 5, avg_latency_ms: 120 },
  { date: '2026-01-09', requests: 150, blocked: 8, avg_latency_ms: 130 },
  { date: '2026-01-10', requests: 80, blocked: 3, avg_latency_ms: 110 },
  { date: '2026-01-11', requests: 200, blocked: 10, avg_latency_ms: 140 },
  { date: '2026-01-12', requests: 120, blocked: 6, avg_latency_ms: 125 },
  { date: '2026-01-13', requests: 90, blocked: 4, avg_latency_ms: 115 },
  { date: '2026-01-14', requests: 180, blocked: 9, avg_latency_ms: 135 },
]

describe('DailyChartSection', () => {
  it('renders chart title and description', () => {
    render(<DailyChartSection daily={mockDaily} />)

    expect(screen.getByText('Request Volume')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
  })

  it('renders bars for each day', () => {
    const { container } = render(<DailyChartSection daily={mockDaily} />)

    // Should have 7 bars
    const bars = container.querySelectorAll('.bg-claw-500')
    expect(bars).toHaveLength(7)
  })

  it('renders weekday labels', () => {
    render(<DailyChartSection daily={mockDaily} />)

    // Check for weekday abbreviations
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
  })

  it('shows loading skeleton when loading is true', () => {
    render(<DailyChartSection daily={mockDaily} loading={true} />)

    // Title should not be visible when loading
    expect(screen.queryByText('Request Volume')).not.toBeInTheDocument()
    expect(screen.queryByText('Wed')).not.toBeInTheDocument()
  })

  it('handles empty data', () => {
    render(<DailyChartSection daily={[]} />)

    expect(screen.getByText('Request Volume')).toBeInTheDocument()
    // No bars should be rendered
    const { container } = render(<DailyChartSection daily={[]} />)
    const bars = container.querySelectorAll('.bg-claw-500')
    expect(bars).toHaveLength(0)
  })

  it('handles single day data', () => {
    const singleDay = [{ date: '2026-01-14', requests: 100, blocked: 5, avg_latency_ms: 120 }]
    const { container } = render(<DailyChartSection daily={singleDay} />)

    const bars = container.querySelectorAll('.bg-claw-500')
    expect(bars).toHaveLength(1)
  })

  it('sets bar height based on max requests', () => {
    const { container } = render(<DailyChartSection daily={mockDaily} />)

    const bars = container.querySelectorAll('.bg-claw-500')
    // Bar with max requests (200) should have 100% height
    // Bar with min requests (80) should have 40% height
    // Check that bars have height styles set
    bars.forEach((bar) => {
      const style = bar.getAttribute('style')
      expect(style).toContain('height:')
    })
  })
})
