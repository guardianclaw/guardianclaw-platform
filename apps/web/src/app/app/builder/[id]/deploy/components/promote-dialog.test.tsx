/**
 * Promote Dialog Component Tests
 *
 * Unit tests for the PromoteDialog component.
 * Tests rendering, target selection, notes input, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PromoteDialog } from './promote-dialog'
import type { Environment } from '@/lib/api'

// ============================================
// TEST SUITES
// ============================================

describe('PromoteDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnTargetEnvChange = vi.fn()
  const mockOnNotesChange = vi.fn()
  const mockOnPromote = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    sourceEnv: 'dev' as Environment,
    targetEnv: 'staging' as 'staging' | 'prod',
    onTargetEnvChange: mockOnTargetEnvChange,
    notes: '',
    onNotesChange: mockOnNotesChange,
    onPromote: mockOnPromote,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders dialog when open is true', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Promote Deployment')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(<PromoteDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows source environment in description', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="dev" />)

      expect(screen.getByText(/from Development to/)).toBeInTheDocument()
    })

    it('renders target environment select', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(
        screen.getByRole('combobox', { name: /select target environment/i })
      ).toBeInTheDocument()
    })

    it('renders notes textarea', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()
    })

    it('renders promote button', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /promote/i })).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Target Environment Select Tests
  // ==========================================

  describe('Target Environment Selection', () => {
    it('shows both staging and prod options when source is dev', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="dev" />)

      const trigger = screen.getByRole('combobox', { name: /select target environment/i })
      fireEvent.click(trigger)

      expect(screen.getByRole('option', { name: /staging/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /production/i })).toBeInTheDocument()
    })

    it('shows only prod option when source is staging', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="staging" targetEnv="prod" />)

      const trigger = screen.getByRole('combobox', { name: /select target environment/i })
      fireEvent.click(trigger)

      expect(screen.queryByRole('option', { name: /staging/i })).not.toBeInTheDocument()
      expect(screen.getByRole('option', { name: /production/i })).toBeInTheDocument()
    })

    it('calls onTargetEnvChange when selection changes', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="dev" targetEnv="staging" />)

      const trigger = screen.getByRole('combobox', { name: /select target environment/i })
      fireEvent.click(trigger)

      const prodOption = screen.getByRole('option', { name: /production/i })
      fireEvent.click(prodOption)

      expect(mockOnTargetEnvChange).toHaveBeenCalledWith('prod')
    })

    it('shows helpful text for dev source', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="dev" />)

      expect(screen.getByText(/promote to staging for testing/i)).toBeInTheDocument()
    })

    it('shows helpful text for staging source', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="staging" targetEnv="prod" />)

      expect(screen.getByText(/promote to production for live/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Notes Input Tests
  // ==========================================

  describe('Notes Input', () => {
    it('displays current notes value', () => {
      render(<PromoteDialog {...defaultProps} notes="Test notes" />)

      expect(screen.getByDisplayValue('Test notes')).toBeInTheDocument()
    })

    it('calls onNotesChange when notes are typed', () => {
      render(<PromoteDialog {...defaultProps} notes="" />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      fireEvent.change(textarea, { target: { value: 'New notes' } })

      expect(mockOnNotesChange).toHaveBeenCalledWith('New notes')
    })

    it('shows placeholder text', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByPlaceholderText(/passed qa testing/i)).toBeInTheDocument()
    })

    it('shows optional label', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByText('(optional)')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Action Button Tests
  // ==========================================

  describe('Action Buttons', () => {
    it('calls onPromote when promote button clicked', () => {
      render(<PromoteDialog {...defaultProps} />)

      const promoteButton = screen.getByRole('button', { name: /promote/i })
      fireEvent.click(promoteButton)

      expect(mockOnPromote).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenChange(false) when cancel button clicked', () => {
      render(<PromoteDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('disables promote button when promoting', () => {
      render(<PromoteDialog {...defaultProps} promoting={true} />)

      const promoteButton = screen.getByRole('button', { name: /promoting/i })
      expect(promoteButton).toBeDisabled()
    })

    it('disables cancel button when promoting', () => {
      render(<PromoteDialog {...defaultProps} promoting={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })

    it('shows loading state when promoting', () => {
      render(<PromoteDialog {...defaultProps} promoting={true} />)

      expect(screen.getByText('Promoting...')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible dialog title', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/promote deployment/i)
    })

    it('has accessible dialog description', () => {
      render(<PromoteDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
        /promote the current deployment/i
      )
    })

    it('has accessible promote button label', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv="dev" targetEnv="staging" />)

      const promoteButton = screen.getByRole('button', {
        name: /promote from development to staging/i,
      })
      expect(promoteButton).toBeInTheDocument()
    })

    it('has accessible promoting button label', () => {
      render(<PromoteDialog {...defaultProps} targetEnv="prod" promoting={true} />)

      const promoteButton = screen.getByRole('button', { name: /promoting to production/i })
      expect(promoteButton).toBeInTheDocument()
    })

    it('notes textarea has accessible description', () => {
      render(<PromoteDialog {...defaultProps} />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      expect(textarea).toHaveAccessibleDescription(/add context about this promotion/i)
    })

    it('dialog renders with proper structure', () => {
      render(<PromoteDialog {...defaultProps} />)

      // Verify the dialog renders with proper accessibility structure
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('handles null sourceEnv gracefully', () => {
      render(<PromoteDialog {...defaultProps} sourceEnv={null} />)

      // Should not throw, dialog should render
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not call onPromote when button is disabled', () => {
      render(<PromoteDialog {...defaultProps} promoting={true} />)

      const promoteButton = screen.getByRole('button', { name: /promoting/i })
      fireEvent.click(promoteButton)

      expect(mockOnPromote).not.toHaveBeenCalled()
    })
  })
})
