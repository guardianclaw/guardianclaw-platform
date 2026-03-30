/**
 * Health Status Components Tests
 *
 * Unit tests for HealthStatusWidget and HealthStatusBadge components.
 * Tests status rendering, loading states, and tooltip content.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HealthStatusWidget, HealthStatusBadge } from './health-status'
import type { HealthStats } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createHealthStats(overrides: Partial<HealthStats['stats']> = {}): HealthStats {
  return {
    status: 'healthy',
    agent_status: 'deployed',
    stats: {
      total_executions: 100,
      successful_executions: 95,
      blocked_executions: 3,
      error_executions: 2,
      success_rate: 95.0,
      avg_latency_ms: 150,
      last_execution_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error_at: new Date(Date.now() - 86400000).toISOString(),
      ...overrides,
    },
  }
}

// ============================================
// HealthStatusWidget Tests
// ============================================

describe('HealthStatusWidget', () => {
  it('renders nothing when health is null', () => {
    const { container } = render(<HealthStatusWidget health={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders loading skeleton when loading', () => {
    const { container } = render(<HealthStatusWidget health={null} loading={true} />)
    // Should render skeleton, not empty
    expect(container.firstChild).not.toBeNull()
  })

  it('displays "Healthy" status correctly', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'healthy',
    }
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('displays "Degraded" status correctly', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'degraded',
    }
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })

  it('displays "Unhealthy" status correctly', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'unhealthy',
    }
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()
  })

  it('displays "Unknown" status correctly', () => {
    const health: HealthStats = {
      ...createHealthStats({ total_executions: 0 }),
      status: 'unknown',
    }
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('shows success rate badge when executions exist', () => {
    const health = createHealthStats({ success_rate: 95.5 })
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText('96%')).toBeInTheDocument() // Rounded
  })

  it('hides success rate badge when no executions', () => {
    const health: HealthStats = {
      ...createHealthStats({ total_executions: 0, success_rate: 0 }),
      status: 'unknown',
    }
    render(<HealthStatusWidget health={health} />)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('displays last execution time', () => {
    const health = createHealthStats()
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText(/Last exec:/)).toBeInTheDocument()
  })

  it('shows "Never" when no executions', () => {
    const health = createHealthStats({ last_execution_at: null })
    render(<HealthStatusWidget health={health} />)
    expect(screen.getByText('Last exec: Never')).toBeInTheDocument()
  })
})

// ============================================
// HealthStatusBadge Tests
// ============================================

describe('HealthStatusBadge', () => {
  it('renders nothing when health is null', () => {
    const { container } = render(<HealthStatusBadge health={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders loading skeleton when loading', () => {
    const { container } = render(<HealthStatusBadge health={null} loading={true} />)
    expect(container.firstChild).not.toBeNull()
  })

  it('displays status label in badge', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'healthy',
    }
    render(<HealthStatusBadge health={health} />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('uses correct color classes for healthy status', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'healthy',
    }
    const { container } = render(<HealthStatusBadge health={health} />)
    const badge = container.querySelector('[class*="green"]')
    expect(badge).toBeInTheDocument()
  })

  it('uses correct color classes for degraded status', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'degraded',
    }
    const { container } = render(<HealthStatusBadge health={health} />)
    const badge = container.querySelector('[class*="amber"]')
    expect(badge).toBeInTheDocument()
  })

  it('uses correct color classes for unhealthy status', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'unhealthy',
    }
    const { container } = render(<HealthStatusBadge health={health} />)
    const badge = container.querySelector('[class*="red"]')
    expect(badge).toBeInTheDocument()
  })

  it('uses correct color classes for unknown status', () => {
    const health: HealthStats = {
      ...createHealthStats(),
      status: 'unknown',
    }
    const { container } = render(<HealthStatusBadge health={health} />)
    const badge = container.querySelector('[class*="gray"]')
    expect(badge).toBeInTheDocument()
  })
})
