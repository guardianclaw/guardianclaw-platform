/**
 * Connector Card Component Tests
 *
 * Unit tests for the ConnectorCard component.
 * Tests rendering, platform styling, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectorCard, type ConnectorCardProps } from './connector-card'
import type { ToolCredential } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockCredential(overrides: Partial<ToolCredential> = {}): ToolCredential {
  return {
    id: 'cred-' + Math.random().toString(36).substr(2, 9),
    tool_type: 'twitter_api',
    name: 'My Twitter Bot',
    credential_preview: '****ABCD',
    config: {},
    is_active: true,
    last_used_at: new Date().toISOString(),
    usage_count: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('ConnectorCard', () => {
  const mockOnTest = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders credential name', () => {
      const credential = createMockCredential({ name: 'Test Bot' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('Test Bot')).toBeInTheDocument()
    })

    it('renders credential preview', () => {
      const credential = createMockCredential({ credential_preview: '****WXYZ' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('****WXYZ')).toBeInTheDocument()
    })

    it('renders usage count when > 0', () => {
      const credential = createMockCredential({ usage_count: 25 })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('25 uses')).toBeInTheDocument()
    })

    it('hides usage count when 0', () => {
      const credential = createMockCredential({ usage_count: 0 })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.queryByText('0 uses')).not.toBeInTheDocument()
    })

    it('shows inactive badge when not active', () => {
      const credential = createMockCredential({ is_active: false })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Platform Badge Tests
  // ==========================================

  describe('Platform Badge', () => {
    it('shows Twitter badge for twitter_api', () => {
      const credential = createMockCredential({ tool_type: 'twitter_api' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('Twitter')).toBeInTheDocument()
    })

    it('shows Discord badge for discord_bot', () => {
      const credential = createMockCredential({ tool_type: 'discord_bot' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('Discord')).toBeInTheDocument()
    })

    it('shows Telegram badge for telegram_bot', () => {
      const credential = createMockCredential({ tool_type: 'telegram_bot' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText('Telegram')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Test Button Tests
  // ==========================================

  describe('Test Button', () => {
    it('calls onTest when Test button is clicked', () => {
      const credential = createMockCredential({ id: 'test-id-123' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)

      fireEvent.click(screen.getByRole('button', { name: /test/i }))
      expect(mockOnTest).toHaveBeenCalledWith('test-id-123')
    })

    it('disables Test button when testing', () => {
      const credential = createMockCredential()
      render(
        <ConnectorCard
          credential={credential}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testing={true}
        />
      )

      // When testing, the Test button shows only a loader icon
      const buttons = screen.getAllByRole('button')
      const testButton = buttons.find(
        (btn) => btn.getAttribute('disabled') !== null && !btn.getAttribute('aria-haspopup')
      )
      expect(testButton).toBeDisabled()
    })

    it('disables Test button when deleting', () => {
      const credential = createMockCredential()
      render(
        <ConnectorCard
          credential={credential}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          deleting={true}
        />
      )

      expect(screen.getByRole('button', { name: /test/i })).toBeDisabled()
    })
  })

  // ==========================================
  // Test Result Display Tests
  // ==========================================

  describe('Test Result Display', () => {
    it('shows success result', () => {
      const credential = createMockCredential()
      render(
        <ConnectorCard
          credential={credential}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testResult={{ success: true, message: 'Connection successful' }}
        />
      )
      expect(screen.getByText('Connection successful')).toBeInTheDocument()
    })

    it('shows failure result', () => {
      const credential = createMockCredential()
      render(
        <ConnectorCard
          credential={credential}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testResult={{ success: false, message: 'Invalid token' }}
        />
      )
      expect(screen.getByText('Invalid token')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Delete Dialog Tests
  // ==========================================

  describe('Delete Dialog', () => {
    // Helper to open dropdown menu (Radix requires pointerDown)
    const openDropdownMenu = async () => {
      const buttons = screen.getAllByRole('button')
      const menuButton = buttons.find((btn) => btn.getAttribute('aria-haspopup') === 'menu')
      if (!menuButton) throw new Error('Menu button not found')

      // Radix DropdownMenu requires pointerDown event
      fireEvent.pointerDown(menuButton, { button: 0, pointerType: 'mouse' })
    }

    it('opens delete dialog when delete menu item is clicked', async () => {
      const credential = createMockCredential({ name: 'Bot to Delete' })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)

      await openDropdownMenu()

      // Wait for dropdown to open and click delete
      const deleteItem = await screen.findByRole('menuitem', { name: /delete/i })
      fireEvent.click(deleteItem)

      // Dialog should be open with the credential name in the description
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
      // Name appears in card AND dialog, use getAllByText
      expect(screen.getAllByText(/Bot to Delete/).length).toBeGreaterThanOrEqual(2)
    })

    it('calls onDelete when confirmed', async () => {
      const credential = createMockCredential({ id: 'delete-me' })
      mockOnDelete.mockResolvedValueOnce(undefined)

      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)

      await openDropdownMenu()
      const deleteItem = await screen.findByRole('menuitem', { name: /delete/i })
      fireEvent.click(deleteItem)

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
      const confirmButton = screen.getByRole('button', { name: /delete connector/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith('delete-me')
      })
    })

    it('closes dialog when cancelled', async () => {
      const credential = createMockCredential()
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)

      await openDropdownMenu()
      const deleteItem = await screen.findByRole('menuitem', { name: /delete/i })
      fireEvent.click(deleteItem)

      // Wait for dialog to be visible
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Timestamp Display Tests
  // ==========================================

  describe('Timestamp Display', () => {
    it('shows "just now" for recent timestamps', () => {
      const credential = createMockCredential({ last_used_at: new Date().toISOString() })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText(/Last used:.*just now/i)).toBeInTheDocument()
    })

    it('shows "Never" when last_used_at is null', () => {
      const credential = createMockCredential({ last_used_at: null })
      render(<ConnectorCard credential={credential} onTest={mockOnTest} onDelete={mockOnDelete} />)
      expect(screen.getByText(/Last used:.*Never/i)).toBeInTheDocument()
    })
  })
})
