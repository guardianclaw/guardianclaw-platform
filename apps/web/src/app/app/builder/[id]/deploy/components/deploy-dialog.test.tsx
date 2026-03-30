/**
 * Deploy Dialog Component Tests
 *
 * Unit tests for the DeployDialog component.
 * Tests rendering, notes input, deploy action, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeployDialog } from './deploy-dialog'
import type { Environment } from '@/lib/api'

// ============================================
// TEST SUITES
// ============================================

describe('DeployDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnNotesChange = vi.fn()
  const mockOnDeploy = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    targetEnv: 'dev' as Environment,
    notes: '',
    onNotesChange: mockOnNotesChange,
    onDeploy: mockOnDeploy,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders dialog when open is true', () => {
      render(<DeployDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(<DeployDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows environment name in title', () => {
      render(<DeployDialog {...defaultProps} targetEnv="staging" />)

      expect(screen.getByText(/deploy to staging/i)).toBeInTheDocument()
    })

    it('shows Production for prod environment', () => {
      render(<DeployDialog {...defaultProps} targetEnv="prod" />)

      expect(screen.getByText(/deploy to production/i)).toBeInTheDocument()
    })

    it('renders notes textarea', () => {
      render(<DeployDialog {...defaultProps} />)

      expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument()
    })

    it('renders deploy button', () => {
      render(<DeployDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /deploy/i })).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<DeployDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Notes Input Tests
  // ==========================================

  describe('Notes Input', () => {
    it('displays current notes value', () => {
      render(<DeployDialog {...defaultProps} notes="Fix login bug" />)

      expect(screen.getByDisplayValue('Fix login bug')).toBeInTheDocument()
    })

    it('calls onNotesChange when notes are typed', () => {
      render(<DeployDialog {...defaultProps} notes="" />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      fireEvent.change(textarea, { target: { value: 'New feature' } })

      expect(mockOnNotesChange).toHaveBeenCalledWith('New feature')
    })

    it('shows placeholder text', () => {
      render(<DeployDialog {...defaultProps} />)

      expect(screen.getByPlaceholderText(/bug fix for authentication/i)).toBeInTheDocument()
    })

    it('disables textarea when deploying', () => {
      render(<DeployDialog {...defaultProps} deploying={true} />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      expect(textarea).toBeDisabled()
    })
  })

  // ==========================================
  // Action Button Tests
  // ==========================================

  describe('Action Buttons', () => {
    it('calls onDeploy when deploy button clicked', () => {
      render(<DeployDialog {...defaultProps} />)

      const deployButton = screen.getByRole('button', { name: /deploy to development/i })
      fireEvent.click(deployButton)

      expect(mockOnDeploy).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenChange(false) when cancel button clicked', () => {
      render(<DeployDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('disables deploy button when deploying', () => {
      render(<DeployDialog {...defaultProps} deploying={true} />)

      const deployButton = screen.getByRole('button', { name: /deploying/i })
      expect(deployButton).toBeDisabled()
    })

    it('disables cancel button when deploying', () => {
      render(<DeployDialog {...defaultProps} deploying={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })

    it('shows loading state when deploying', () => {
      render(<DeployDialog {...defaultProps} deploying={true} />)

      expect(screen.getByText('Deploying...')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible dialog title', () => {
      render(<DeployDialog {...defaultProps} targetEnv="staging" />)

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/deploy to staging/i)
    })

    it('has accessible dialog description', () => {
      render(<DeployDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleDescription()
    })

    it('has accessible deploy button label', () => {
      render(<DeployDialog {...defaultProps} targetEnv="prod" />)

      expect(screen.getByRole('button', { name: /deploy to production/i })).toBeInTheDocument()
    })

    it('has accessible deploying button label', () => {
      render(<DeployDialog {...defaultProps} targetEnv="staging" deploying={true} />)

      expect(screen.getByRole('button', { name: /deploying to staging/i })).toBeInTheDocument()
    })

    it('notes textarea has accessible description', () => {
      render(<DeployDialog {...defaultProps} />)

      const textarea = screen.getByRole('textbox', { name: /notes/i })
      expect(textarea).toHaveAccessibleDescription(/add context about this deployment/i)
    })
  })

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('handles null targetEnv gracefully', () => {
      render(<DeployDialog {...defaultProps} targetEnv={null} />)

      // Should render without crashing
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not call onDeploy when button is disabled', () => {
      render(<DeployDialog {...defaultProps} deploying={true} />)

      const deployButton = screen.getByRole('button', { name: /deploying/i })
      fireEvent.click(deployButton)

      expect(mockOnDeploy).not.toHaveBeenCalled()
    })
  })
})
