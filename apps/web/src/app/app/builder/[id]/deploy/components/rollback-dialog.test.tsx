/**
 * Rollback Dialog Component Tests
 *
 * Unit tests for the RollbackDialog component.
 * Tests rendering, notes input, rollback action, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RollbackDialog } from './rollback-dialog'
import type { DeploymentHistoryEntry, Environment } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockEntry(overrides: Partial<DeploymentHistoryEntry> = {}): DeploymentHistoryEntry {
  return {
    id: 'deploy-' + Math.random().toString(36).substring(2, 9),
    version: 3,
    status: 'stopped',
    environment: 'prod',
    endpoint_url: 'https://api.guardianclaw.org/invoke/test-agent',
    created_at: new Date().toISOString(),
    is_active: false,
    rollback_from: null,
    promoted_from: null,
    notes: null,
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('RollbackDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnNotesChange = vi.fn()
  const mockOnRollback = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    entry: createMockEntry({ version: 3, environment: 'prod' }),
    notes: '',
    onNotesChange: mockOnNotesChange,
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
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(<RollbackDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('shows version number in title', () => {
      render(<RollbackDialog {...defaultProps} entry={createMockEntry({ version: 5 })} />)

      expect(screen.getByText(/rollback to v5/i)).toBeInTheDocument()
    })

    it('shows environment name in description', () => {
      render(
        <RollbackDialog {...defaultProps} entry={createMockEntry({ environment: 'staging' })} />
      )

      expect(screen.getByText(/staging/i)).toBeInTheDocument()
    })

    it('shows warning message', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/current active deployment will be stopped/i)).toBeInTheDocument()
    })

    it('renders notes textarea', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()
    })

    it('renders rollback button', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /rollback/i })).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Notes Input Tests
  // ==========================================

  describe('Notes Input', () => {
    it('displays current notes value', () => {
      render(<RollbackDialog {...defaultProps} notes="Reverting bug fix" />)

      expect(screen.getByDisplayValue('Reverting bug fix')).toBeInTheDocument()
    })

    it('calls onNotesChange when notes are typed', () => {
      render(<RollbackDialog {...defaultProps} notes="" />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      fireEvent.change(textarea, { target: { value: 'New rollback reason' } })

      expect(mockOnNotesChange).toHaveBeenCalledWith('New rollback reason')
    })

    it('shows placeholder text', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByPlaceholderText(/reverting due to bug/i)).toBeInTheDocument()
    })

    it('shows optional label', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByText('(optional)')).toBeInTheDocument()
    })

    it('disables textarea when rolling back', () => {
      render(<RollbackDialog {...defaultProps} rollingBack={true} />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      expect(textarea).toBeDisabled()
    })
  })

  // ==========================================
  // Action Button Tests
  // ==========================================

  describe('Action Buttons', () => {
    it('calls onRollback when rollback button clicked', () => {
      render(<RollbackDialog {...defaultProps} />)

      const rollbackButton = screen.getByRole('button', { name: /confirm rollback/i })
      fireEvent.click(rollbackButton)

      expect(mockOnRollback).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenChange(false) when cancel button clicked', () => {
      render(<RollbackDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('disables rollback button when rolling back', () => {
      render(<RollbackDialog {...defaultProps} rollingBack={true} />)

      const rollbackButton = screen.getByRole('button', { name: /rolling back/i })
      expect(rollbackButton).toBeDisabled()
    })

    it('disables cancel button when rolling back', () => {
      render(<RollbackDialog {...defaultProps} rollingBack={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })

    it('shows loading state when rolling back', () => {
      render(<RollbackDialog {...defaultProps} rollingBack={true} />)

      expect(screen.getByText('Rolling back...')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Different Environments Tests
  // ==========================================

  describe('Different Environments', () => {
    it('shows Development for dev environment', () => {
      render(<RollbackDialog {...defaultProps} entry={createMockEntry({ environment: 'dev' })} />)

      expect(screen.getByText(/development/i)).toBeInTheDocument()
    })

    it('shows Staging for staging environment', () => {
      render(
        <RollbackDialog {...defaultProps} entry={createMockEntry({ environment: 'staging' })} />
      )

      expect(screen.getByText(/staging/i)).toBeInTheDocument()
    })

    it('shows Production for prod environment', () => {
      render(<RollbackDialog {...defaultProps} entry={createMockEntry({ environment: 'prod' })} />)

      expect(screen.getByText(/production/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('uses alertdialog role for confirmation', () => {
      render(<RollbackDialog {...defaultProps} />)

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('has accessible rollback button label with version', () => {
      render(<RollbackDialog {...defaultProps} entry={createMockEntry({ version: 7 })} />)

      expect(
        screen.getByRole('button', { name: /confirm rollback to version 7/i })
      ).toBeInTheDocument()
    })

    it('has accessible rolling back button label', () => {
      render(
        <RollbackDialog
          {...defaultProps}
          entry={createMockEntry({ version: 5 })}
          rollingBack={true}
        />
      )

      expect(screen.getByRole('button', { name: /rolling back to version 5/i })).toBeInTheDocument()
    })

    it('has accessible warning alert', () => {
      render(<RollbackDialog {...defaultProps} />)

      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
    })

    it('notes textarea has accessible description', () => {
      render(<RollbackDialog {...defaultProps} />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      expect(textarea).toHaveAccessibleDescription(/document why you are rolling back/i)
    })

    it('dialog renders with proper structure', () => {
      render(<RollbackDialog {...defaultProps} />)

      // Verify the dialog renders with proper accessibility structure
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('handles null entry gracefully', () => {
      render(<RollbackDialog {...defaultProps} entry={null} />)

      // Should render with v0
      expect(screen.getByText(/rollback to v0/i)).toBeInTheDocument()
    })

    it('does not call onRollback when button is disabled', () => {
      render(<RollbackDialog {...defaultProps} rollingBack={true} />)

      const rollbackButton = screen.getByRole('button', { name: /rolling back/i })
      fireEvent.click(rollbackButton)

      expect(mockOnRollback).not.toHaveBeenCalled()
    })

    it('shows correct version info for different versions', () => {
      const versions = [1, 5, 10, 99]

      versions.forEach((version) => {
        const { unmount } = render(
          <RollbackDialog {...defaultProps} entry={createMockEntry({ version })} />
        )

        expect(screen.getByText(new RegExp(`v${version}`, 'i'))).toBeInTheDocument()
        unmount()
      })
    })
  })
})
