/**
 * Deploy History Dialog Component Tests
 *
 * Unit tests for the DeployHistoryDialog component.
 * Tests rendering, filtering, rollback actions, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DeployHistoryDialog } from './deploy-history-dialog'
import type { DeploymentHistoryEntry, Environment } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockHistoryEntry(
  overrides: Partial<DeploymentHistoryEntry> = {}
): DeploymentHistoryEntry {
  return {
    id: 'deploy-' + Math.random().toString(36).substring(2, 9),
    version: 1,
    status: 'running',
    environment: 'dev',
    endpoint_url: 'https://api.guardianclaw.org/invoke/test-agent',
    created_at: new Date().toISOString(),
    is_active: false,
    rollback_from: null,
    promoted_from: null,
    notes: null,
    ...overrides,
  }
}

function createMockHistory(count: number = 3): DeploymentHistoryEntry[] {
  return Array.from({ length: count }, (_, i) =>
    createMockHistoryEntry({
      version: count - i,
      environment: (['dev', 'staging', 'prod'] as Environment[])[i % 3],
      is_active: i === 0,
    })
  )
}

// ============================================
// TEST SUITES
// ============================================

describe('DeployHistoryDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnEnvFilterChange = vi.fn()
  const mockOnRollback = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    history: [] as DeploymentHistoryEntry[],
    envFilter: 'all' as Environment | 'all',
    onEnvFilterChange: mockOnEnvFilterChange,
    onRollback: mockOnRollback,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders dialog when open is true', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Deployment History')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(<DeployHistoryDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows empty state when history is empty', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      expect(screen.getByText('No deployment history found.')).toBeInTheDocument()
    })

    it('renders history entries', () => {
      const history = createMockHistory(3)
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('shows loading state', () => {
      render(<DeployHistoryDialog {...defaultProps} loading={true} />)

      expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // History Entry Display Tests
  // ==========================================

  describe('History Entry Display', () => {
    it('displays version number', () => {
      const history = [createMockHistoryEntry({ version: 5 })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText('v5')).toBeInTheDocument()
    })

    it('displays environment badge', () => {
      const history = [createMockHistoryEntry({ environment: 'staging' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText('Staging')).toBeInTheDocument()
    })

    it('displays Active badge for active deployment', () => {
      const history = [createMockHistoryEntry({ is_active: true })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('displays Rollback badge when rollback_from is set', () => {
      const history = [createMockHistoryEntry({ rollback_from: 'prev-deploy-id' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText('Rollback')).toBeInTheDocument()
    })

    it('displays Promoted badge when promoted_from is set', () => {
      const history = [createMockHistoryEntry({ promoted_from: 'prev-deploy-id' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText('Promoted')).toBeInTheDocument()
    })

    it('displays notes when present', () => {
      const history = [createMockHistoryEntry({ notes: 'Bug fix for auth' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText(/Bug fix for auth/)).toBeInTheDocument()
    })

    it('displays formatted date', () => {
      const history = [createMockHistoryEntry({ created_at: '2024-01-15T10:30:00Z' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      // Check that date is displayed (format varies by locale, just check year)
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('highlights active deployment with green border', () => {
      const history = [createMockHistoryEntry({ is_active: true })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      const entry = screen.getByRole('listitem')
      expect(entry).toHaveClass('border-green-500/50')
    })
  })

  // ==========================================
  // Filter Tests
  // ==========================================

  describe('Environment Filter', () => {
    it('renders filter select', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      expect(screen.getByRole('combobox', { name: /filter by environment/i })).toBeInTheDocument()
    })

    it('shows all environments option', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      const trigger = screen.getByRole('combobox', { name: /filter by environment/i })
      fireEvent.click(trigger)

      expect(screen.getByRole('option', { name: /all environments/i })).toBeInTheDocument()
    })

    it('shows individual environment options', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      const trigger = screen.getByRole('combobox', { name: /filter by environment/i })
      fireEvent.click(trigger)

      expect(screen.getByRole('option', { name: /development/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /staging/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /production/i })).toBeInTheDocument()
    })

    it('calls onEnvFilterChange when filter is changed', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      const trigger = screen.getByRole('combobox', { name: /filter by environment/i })
      fireEvent.click(trigger)

      const stagingOption = screen.getByRole('option', { name: /staging/i })
      fireEvent.click(stagingOption)

      expect(mockOnEnvFilterChange).toHaveBeenCalledWith('staging')
    })
  })

  // ==========================================
  // Rollback Action Tests
  // ==========================================

  describe('Rollback Action', () => {
    it('shows actions dropdown menu', () => {
      const history = [createMockHistoryEntry()]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      const actionsButton = screen.getByRole('button', { name: /actions for version/i })
      expect(actionsButton).toBeInTheDocument()
    })

    it('renders actions dropdown trigger button', () => {
      const history = [createMockHistoryEntry({ version: 3 })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      const actionsButton = screen.getByRole('button', { name: /actions for version 3/i })
      expect(actionsButton).toBeInTheDocument()
    })
  })

  // ==========================================
  // Dialog Control Tests
  // ==========================================

  describe('Dialog Controls', () => {
    it('calls onOpenChange when dialog is closed', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      // Click the close button (the X)
      const closeButton = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible dialog title', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/deployment history/i)
    })

    it('has accessible list container', () => {
      const history = createMockHistory(2)
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByRole('list', { name: /deployment history entries/i })).toBeInTheDocument()
    })

    it('marks list as busy when loading', () => {
      render(<DeployHistoryDialog {...defaultProps} loading={true} />)

      const list = screen.getByRole('list')
      expect(list).toHaveAttribute('aria-busy', 'true')
    })

    it('has accessible filter select', () => {
      render(<DeployHistoryDialog {...defaultProps} />)

      expect(screen.getByRole('combobox', { name: /filter by environment/i })).toBeInTheDocument()
    })

    it('displays date information in history entries', () => {
      const history = [createMockHistoryEntry({ created_at: '2024-01-15T10:30:00Z' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      // Check that the date is displayed (format may vary by locale)
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('renders history entries with proper structure', () => {
      const history = [createMockHistoryEntry({ rollback_from: 'prev-id' })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      // Verify the entry renders with badges
      expect(screen.getByText('Rollback')).toBeInTheDocument()
    })

    it('provides accessible labels for entry items', () => {
      const history = [createMockHistoryEntry({ version: 5, environment: 'prod', is_active: true })]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      const entry = screen.getByRole('listitem')
      expect(entry).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/version 5 deployed to production.*currently active/i)
      )
    })
  })

  // ==========================================
  // Multiple Entries Tests
  // ==========================================

  describe('Multiple Entries', () => {
    it('renders entries in order', () => {
      const history = [
        createMockHistoryEntry({ version: 3 }),
        createMockHistoryEntry({ version: 2 }),
        createMockHistoryEntry({ version: 1 }),
      ]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      const entries = screen.getAllByRole('listitem')
      expect(entries).toHaveLength(3)

      expect(within(entries[0]).getByText('v3')).toBeInTheDocument()
      expect(within(entries[1]).getByText('v2')).toBeInTheDocument()
      expect(within(entries[2]).getByText('v1')).toBeInTheDocument()
    })

    it('shows different environment badges for different entries', () => {
      const history = [
        createMockHistoryEntry({ version: 3, environment: 'prod' }),
        createMockHistoryEntry({ version: 2, environment: 'staging' }),
        createMockHistoryEntry({ version: 1, environment: 'dev' }),
      ]
      render(<DeployHistoryDialog {...defaultProps} history={history} />)

      expect(screen.getByText('Production')).toBeInTheDocument()
      expect(screen.getByText('Staging')).toBeInTheDocument()
      expect(screen.getByText('Development')).toBeInTheDocument()
    })
  })
})
