import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from './metric-card'
import { Users } from 'lucide-react'

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="Total Users" value={1234} icon={Users} />)

    expect(screen.getByText('Total Users')).toBeInTheDocument()
    expect(screen.getByText('1234')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<MetricCard title="Total Users" value={1234} subtitle="5 new today" icon={Users} />)

    expect(screen.getByText('5 new today')).toBeInTheDocument()
  })

  it('shows loading skeleton when loading', () => {
    render(<MetricCard title="Total Users" value={1234} icon={Users} loading={true} />)

    // Title and value should not be visible when loading
    expect(screen.queryByText('Total Users')).not.toBeInTheDocument()
    expect(screen.queryByText('1234')).not.toBeInTheDocument()
  })

  it('shows trend up indicator', () => {
    const { container } = render(
      <MetricCard title="Revenue" value="$100" icon={Users} trend="up" />
    )

    // TrendingUp icon should have text-green-500 class
    const trendDiv = container.querySelector('.text-green-500')
    expect(trendDiv).toBeInTheDocument()
  })

  it('shows trend down indicator', () => {
    const { container } = render(<MetricCard title="Errors" value={50} icon={Users} trend="down" />)

    // TrendingDown icon should have text-red-500 class
    const trendDiv = container.querySelector('.text-red-500')
    expect(trendDiv).toBeInTheDocument()
  })

  it('applies danger variant styling', () => {
    const { container } = render(
      <MetricCard title="Critical Alerts" value={5} icon={Users} variant="danger" />
    )

    // Value should have text-red-500 class
    const valueElement = container.querySelector('.text-red-500')
    expect(valueElement).toBeInTheDocument()
  })

  it('applies success variant styling', () => {
    const { container } = render(
      <MetricCard title="Revenue" value="$100" icon={Users} variant="success" />
    )

    // Value should have text-green-500 class
    const valueElement = container.querySelector('.text-green-500')
    expect(valueElement).toBeInTheDocument()
  })

  it('applies warning variant styling', () => {
    const { container } = render(
      <MetricCard title="Warnings" value={10} icon={Users} variant="warning" />
    )

    // Value should have text-yellow-500 class
    const valueElement = container.querySelector('.text-yellow-500')
    expect(valueElement).toBeInTheDocument()
  })

  it('handles string values', () => {
    render(<MetricCard title="Revenue" value="$1,234.56" icon={Users} />)

    expect(screen.getByText('$1,234.56')).toBeInTheDocument()
  })

  it('handles zero values', () => {
    render(<MetricCard title="Errors" value={0} icon={Users} />)

    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
