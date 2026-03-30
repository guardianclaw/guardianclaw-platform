/**
 * Gate Breakdown Section Component Tests
 *
 * Unit tests for the GateBreakdownSection component.
 * Tests rendering states, data display, and accessibility.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GateBreakdownSection } from './gate-breakdown-section'
import type { GateBreakdown } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockGateBreakdown(overrides: Partial<GateBreakdown>[] = []): GateBreakdown[] {
  const defaults: GateBreakdown[] = [
    { gate: 'avoidance', count: 45, percentage: 45 },
    { gate: 'credibility', count: 30, percentage: 30 },
    { gate: 'limits', count: 15, percentage: 15 },
    { gate: 'worth', count: 10, percentage: 10 },
  ]

  if (overrides.length > 0) {
    return overrides.map((override, i) => ({
      ...defaults[i % defaults.length],
      ...override,
    }))
  }

  return defaults
}

// ============================================
// TEST SUITES
// ============================================

describe('GateBreakdownSection', () => {
  // ==========================================
  // Loading State Tests
  // ==========================================

  describe('Loading State', () => {
    it('renders loading skeleton when loading is true', () => {
      render(<GateBreakdownSection gateBreakdown={[]} loading={true} />)

      // Should not show content
      expect(screen.queryByText('CLAW Gate Analysis')).not.toBeInTheDocument()
    })

    it('renders multiple skeleton rows during loading', () => {
      const { container } = render(<GateBreakdownSection gateBreakdown={[]} loading={true} />)

      // Check for skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Empty State Tests
  // ==========================================

  describe('Empty State', () => {
    it('renders empty state when no gate data', () => {
      render(<GateBreakdownSection gateBreakdown={[]} loading={false} />)

      expect(screen.getByText('CLAW Gate Analysis')).toBeInTheDocument()
      expect(screen.getByText('No blocks to analyze')).toBeInTheDocument()
    })

    it('shows helpful message in empty state', () => {
      render(<GateBreakdownSection gateBreakdown={[]} loading={false} />)

      expect(screen.getByText('All requests passed CLAW validation')).toBeInTheDocument()
    })

    it('renders empty state for zero counts', () => {
      const zeroData = createMockGateBreakdown([
        { gate: 'avoidance', count: 0, percentage: 0 },
        { gate: 'credibility', count: 0, percentage: 0 },
      ])

      render(<GateBreakdownSection gateBreakdown={zeroData} loading={false} />)

      expect(screen.getByText('No blocks to analyze')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Data Display Tests
  // ==========================================

  describe('Data Display', () => {
    it('renders all gate entries', () => {
      const data = createMockGateBreakdown()
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      expect(screen.getByText('Credibility')).toBeInTheDocument()
      expect(screen.getByText('Avoidance')).toBeInTheDocument()
      expect(screen.getByText('Limits')).toBeInTheDocument()
      expect(screen.getByText('Worth')).toBeInTheDocument()
    })

    it('displays counts correctly', () => {
      const data = createMockGateBreakdown([{ gate: 'avoidance', count: 42, percentage: 100 }])
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      // Check within the list item, not the total
      const listItem = screen.getByRole('listitem', { name: /avoidance gate/i })
      expect(listItem).toHaveTextContent('42')
    })

    it('displays percentages correctly', () => {
      const data = createMockGateBreakdown([{ gate: 'avoidance', count: 50, percentage: 75.5 }])
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      expect(screen.getByText('(75.5%)')).toBeInTheDocument()
    })

    it('shows total blocks count', () => {
      const data = createMockGateBreakdown()
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      // Total should be 100 (45 + 30 + 15 + 10)
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('handles unknown gate types', () => {
      const data: GateBreakdown[] = [{ gate: 'unknown_gate', count: 10, percentage: 100 }]
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      // Should render with 'Other' fallback
      expect(screen.getByText('Other')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible list container', () => {
      const data = createMockGateBreakdown()
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      expect(screen.getByRole('list', { name: /gate breakdown list/i })).toBeInTheDocument()
    })

    it('has accessible list items with labels', () => {
      const data = createMockGateBreakdown([{ gate: 'avoidance', count: 45, percentage: 45 }])
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      expect(
        screen.getByRole('listitem', { name: /avoidance gate: 45 blocks/i })
      ).toBeInTheDocument()
    })

    it('has progress bar with aria attributes', () => {
      const data = createMockGateBreakdown([{ gate: 'avoidance', count: 45, percentage: 45 }])
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '45')
    })

    it('hides decorative icons from screen readers', () => {
      const data = createMockGateBreakdown()
      const { container } = render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      const icons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Visual Tests
  // ==========================================

  describe('Visual Elements', () => {
    it('renders progress bars for each gate', () => {
      const data = createMockGateBreakdown()
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      const progressBars = screen.getAllByRole('progressbar')
      expect(progressBars).toHaveLength(4)
    })

    it('renders gate descriptions', () => {
      const data = createMockGateBreakdown([{ gate: 'credibility', count: 10, percentage: 100 }])
      render(<GateBreakdownSection gateBreakdown={data} loading={false} />)

      expect(screen.getByText('Factual accuracy validation')).toBeInTheDocument()
    })
  })
})
