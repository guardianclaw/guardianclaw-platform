/**
 * New API Key Dialog Component Tests
 *
 * Unit tests for NewApiKeyDialog and ShowApiKeyDialog components.
 * Tests rendering, input, creation, key display, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NewApiKeyDialog, ShowApiKeyDialog } from './new-api-key-dialog'

// ============================================
// MOCKS
// ============================================

const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// ============================================
// NewApiKeyDialog Tests
// ============================================

describe('NewApiKeyDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnKeyNameChange = vi.fn()
  const mockOnCreate = vi.fn()

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    keyName: '',
    onKeyNameChange: mockOnKeyNameChange,
    onCreate: mockOnCreate,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders dialog when open is true', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Create API Key')).toBeInTheDocument()
    })

    it('does not render when open is false', () => {
      render(<NewApiKeyDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows description about key being shown once', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByText(/only be shown once/i)).toBeInTheDocument()
    })

    it('renders key name input', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('textbox', { name: /key name/i })).toBeInTheDocument()
    })

    it('renders create button', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Input Tests
  // ==========================================

  describe('Key Name Input', () => {
    it('displays current key name value', () => {
      render(<NewApiKeyDialog {...defaultProps} keyName="Production Key" />)

      expect(screen.getByDisplayValue('Production Key')).toBeInTheDocument()
    })

    it('calls onKeyNameChange when text is typed', () => {
      render(<NewApiKeyDialog {...defaultProps} keyName="" />)

      const input = screen.getByRole('textbox', { name: /key name/i })
      fireEvent.change(input, { target: { value: 'Development' } })

      expect(mockOnKeyNameChange).toHaveBeenCalledWith('Development')
    })

    it('shows placeholder text', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByPlaceholderText(/production, development, testing/i)).toBeInTheDocument()
    })

    it('disables input when creating', () => {
      render(<NewApiKeyDialog {...defaultProps} creating={true} />)

      const input = screen.getByRole('textbox', { name: /key name/i })
      expect(input).toBeDisabled()
    })
  })

  // ==========================================
  // Action Button Tests
  // ==========================================

  describe('Action Buttons', () => {
    it('calls onCreate when create button clicked', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      const createButton = screen.getByRole('button', { name: /create api key/i })
      fireEvent.click(createButton)

      expect(mockOnCreate).toHaveBeenCalledTimes(1)
    })

    it('calls onOpenChange(false) when cancel button clicked', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })

    it('disables create button when creating', () => {
      render(<NewApiKeyDialog {...defaultProps} creating={true} />)

      const createButton = screen.getByRole('button', { name: /creating/i })
      expect(createButton).toBeDisabled()
    })

    it('disables cancel button when creating', () => {
      render(<NewApiKeyDialog {...defaultProps} creating={true} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })

    it('shows loading state when creating', () => {
      render(<NewApiKeyDialog {...defaultProps} creating={true} />)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible dialog title', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/create api key/i)
    })

    it('has accessible dialog description', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/shown once/i)
    })

    it('has accessible create button label', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /create api key/i })).toBeInTheDocument()
    })

    it('has accessible creating button label', () => {
      render(<NewApiKeyDialog {...defaultProps} creating={true} />)

      expect(screen.getByRole('button', { name: /creating api key/i })).toBeInTheDocument()
    })

    it('input has accessible description', () => {
      render(<NewApiKeyDialog {...defaultProps} />)

      const input = screen.getByRole('textbox', { name: /key name/i })
      expect(input).toHaveAccessibleDescription(/descriptive name/i)
    })
  })
})

// ============================================
// ShowApiKeyDialog Tests
// ============================================

describe('ShowApiKeyDialog', () => {
  const mockOnClose = vi.fn()
  const testApiKey = 'sk_live_test1234567890abcdef'

  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders dialog when apiKey is provided', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('API Key Created')).toBeInTheDocument()
    })

    it('does not render when apiKey is null', () => {
      render(<ShowApiKeyDialog apiKey={null} onClose={mockOnClose} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows warning about storing key securely', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByText(/store this key securely/i)).toBeInTheDocument()
    })

    it('displays the API key', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByText(testApiKey)).toBeInTheDocument()
    })

    it('renders copy button', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })

    it('renders done button', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Copy Functionality Tests
  // ==========================================

  describe('Copy Functionality', () => {
    it('copies API key to clipboard when copy button clicked', async () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      fireEvent.click(screen.getByRole('button', { name: /copy/i }))

      expect(mockWriteText).toHaveBeenCalledWith(testApiKey)
    })

    it('shows "Copied!" state after copying', async () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      fireEvent.click(screen.getByRole('button', { name: /copy/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
      })
    })

    it('initially shows copy button, not copied state', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      // Initially should show copy button
      expect(screen.getByRole('button', { name: /copy api key/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /copied/i })).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Close Functionality Tests
  // ==========================================

  describe('Close Functionality', () => {
    it('calls onClose when done button clicked', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      const doneButton = screen.getByRole('button', { name: /done/i })
      fireEvent.click(doneButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible dialog title', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/api key created/i)
    })

    it('has accessible dialog description', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/not be shown again/i)
    })

    it('has alert role for warning message', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('has accessible label for API key display', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByLabelText(/your new api key/i)).toBeInTheDocument()
    })

    it('has accessible copy button label', () => {
      render(<ShowApiKeyDialog apiKey={testApiKey} onClose={mockOnClose} />)

      expect(screen.getByRole('button', { name: /copy api key/i })).toBeInTheDocument()
    })
  })
})
