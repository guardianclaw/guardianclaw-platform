/**
 * Latency Histogram Section Component Tests
 *
 * Unit tests for the LatencyHistogramSection component.
 * Tests rendering states, percentile display, and accessibility.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LatencyHistogramSection } from './latency-histogram-section'
import type { LatencyPercentiles } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockLatencyPercentiles(
  overrides: Partial<LatencyPercentiles> = {}
): LatencyPercentiles {
  return {
    p50: 150,
    p75: 300,
    p95: 750,
    p99: 1200,
    max: 2500,
    distribution: [
      { bucket: '0-100ms', count: 25 },
      { bucket: '100-250ms', count: 45 },
      { bucket: '250-500ms', count: 20 },
      { bucket: '500ms-1s', count: 7 },
      { bucket: '1-2.5s', count: 2 },
      { bucket: '2.5s+', count: 1 },
    ],
    ...overrides,
  }
}

const emptyPercentiles: LatencyPercentiles = {
  p50: 0,
  p75: 0,
  p95: 0,
  p99: 0,
  max: 0,
  distribution: [
    { bucket: '0-100ms', count: 0 },
    { bucket: '100-250ms', count: 0 },
    { bucket: '250-500ms', count: 0 },
    { bucket: '500ms-1s', count: 0 },
    { bucket: '1-2.5s', count: 0 },
    { bucket: '2.5s+', count: 0 },
  ],
}

// ============================================
// TEST SUITES
// ============================================

describe('LatencyHistogramSection', () => {
  // ==========================================
  // Loading State Tests
  // ==========================================

  describe('Loading State', () => {
    it('renders loading skeleton when loading is true', () => {
      render(<LatencyHistogramSection latencyPercentiles={emptyPercentiles} loading={true} />)

      // Should not show title
      expect(screen.queryByText('Latency Distribution')).not.toBeInTheDocument()
    })

    it('renders skeleton elements during loading', () => {
      const { container } = render(
        <LatencyHistogramSection latencyPercentiles={emptyPercentiles} loading={true} />
      )

      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Empty State Tests
  // ==========================================

  describe('Empty State', () => {
    it('renders empty state when no latency data', () => {
      render(<LatencyHistogramSection latencyPercentiles={emptyPercentiles} loading={false} />)

      expect(screen.getByText('Latency Distribution')).toBeInTheDocument()
      expect(screen.getByText('No latency data available')).toBeInTheDocument()
    })

    it('shows helpful message in empty state', () => {
      render(<LatencyHistogramSection latencyPercentiles={emptyPercentiles} loading={false} />)

      expect(
        screen.getByText('Latency metrics will appear after agent executions')
      ).toBeInTheDocument()
    })
  })

  // ==========================================
  // Percentile Display Tests
  // ==========================================

  describe('Percentile Display', () => {
    it('displays all percentile values', () => {
      const data = createMockLatencyPercentiles()
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('P50')).toBeInTheDocument()
      expect(screen.getByText('P75')).toBeInTheDocument()
      expect(screen.getByText('P95')).toBeInTheDocument()
      expect(screen.getByText('P99')).toBeInTheDocument()
      expect(screen.getByText('Max')).toBeInTheDocument()
    })

    it('formats milliseconds correctly', () => {
      const data = createMockLatencyPercentiles({ p50: 150 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('150ms')).toBeInTheDocument()
    })

    it('formats seconds correctly', () => {
      const data = createMockLatencyPercentiles({ p99: 1200 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('1.20s')).toBeInTheDocument()
    })

    it('shows dash for zero values', () => {
      const data = createMockLatencyPercentiles({ p50: 0 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      // P50 should show dash
      const p50Section = screen.getByRole('listitem', { name: /median/i })
      expect(p50Section).toHaveTextContent('—')
    })
  })

  // ==========================================
  // Status Badge Tests
  // ==========================================

  describe('Status Badge', () => {
    it('shows Excellent status for low P95', () => {
      const data = createMockLatencyPercentiles({ p95: 300 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('Excellent')).toBeInTheDocument()
    })

    it('shows Good status for moderate P95', () => {
      const data = createMockLatencyPercentiles({ p95: 750 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('Good')).toBeInTheDocument()
    })

    it('shows Acceptable status for higher P95', () => {
      const data = createMockLatencyPercentiles({ p95: 1500 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('Acceptable')).toBeInTheDocument()
    })

    it('shows Slow status for very high P95', () => {
      const data = createMockLatencyPercentiles({ p95: 3000 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('Slow')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Histogram Display Tests
  // ==========================================

  describe('Histogram Display', () => {
    it('renders distribution buckets', () => {
      const data = createMockLatencyPercentiles()
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('Distribution')).toBeInTheDocument()
    })

    it('shows total request count', () => {
      const data = createMockLatencyPercentiles()
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      // Total: 25 + 45 + 20 + 7 + 2 + 1 = 100
      expect(screen.getByText('100 total requests')).toBeInTheDocument()
    })

    it('renders bucket labels', () => {
      const data = createMockLatencyPercentiles()
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      // Check some bucket labels (formatted without 'ms')
      expect(screen.getByText(/0–100/)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible percentile list', () => {
      const data = createMockLatencyPercentiles()
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByRole('list', { name: /latency percentiles/i })).toBeInTheDocument()
    })

    it('has accessible percentile items with labels', () => {
      const data = createMockLatencyPercentiles({ p50: 150 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByRole('listitem', { name: /median: 150ms/i })).toBeInTheDocument()
    })

    it('has accessible histogram image', () => {
      const data = createMockLatencyPercentiles()
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(
        screen.getByRole('img', { name: /latency distribution histogram/i })
      ).toBeInTheDocument()
    })

    it('hides decorative icons from screen readers', () => {
      const data = createMockLatencyPercentiles()
      const { container } = render(
        <LatencyHistogramSection latencyPercentiles={data} loading={false} />
      )

      const icons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('handles single bucket with data', () => {
      const data = createMockLatencyPercentiles({
        distribution: [
          { bucket: '0-100ms', count: 100 },
          { bucket: '100-250ms', count: 0 },
          { bucket: '250-500ms', count: 0 },
          { bucket: '500ms-1s', count: 0 },
          { bucket: '1-2.5s', count: 0 },
          { bucket: '2.5s+', count: 0 },
        ],
      })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('100 total requests')).toBeInTheDocument()
    })

    it('handles very high latency values', () => {
      const data = createMockLatencyPercentiles({
        p99: 10000,
        max: 15000,
      })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      expect(screen.getByText('10.00s')).toBeInTheDocument()
      expect(screen.getByText('15.00s')).toBeInTheDocument()
    })

    it('handles decimal latency values', () => {
      const data = createMockLatencyPercentiles({ p50: 123.456 })
      render(<LatencyHistogramSection latencyPercentiles={data} loading={false} />)

      // Should round to integer for ms display
      expect(screen.getByText('123ms')).toBeInTheDocument()
    })
  })
})
