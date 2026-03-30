/**
 * Add Connector Dialog Tests
 *
 * Unit tests for the AddConnectorDialog component.
 * Tests wizard flow, platform selection, and form submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddConnectorDialog } from './add-connector-dialog'
import { toolCredentialsApi } from '@/lib/api'

// Mock the API
vi.mock('@/lib/api', () => ({
  toolCredentialsApi: {
    create: vi.fn(),
  },
}))

// ============================================
// TEST SUITES
// ============================================

describe('AddConnectorDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Initial State Tests
  // ==========================================

  describe('Initial State', () => {
    it('shows platform selection on open', () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      expect(screen.getByText('Add Connector')).toBeInTheDocument()
      expect(screen.getByText('Twitter / X')).toBeInTheDocument()
      expect(screen.getByText('Discord')).toBeInTheDocument()
      expect(screen.getByText('Telegram')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(
        <AddConnectorDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      )

      expect(screen.queryByText('Add Connector')).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Platform Selection Tests
  // ==========================================

  describe('Platform Selection', () => {
    it('advances to Twitter config when Twitter selected', async () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByText('Connect Twitter / X')).toBeInTheDocument()
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Bearer Token')).toBeInTheDocument()
      })
    })

    it('advances to Discord config when Discord selected', async () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      fireEvent.click(screen.getByText('Discord'))

      await waitFor(() => {
        expect(screen.getByText('Connect Discord')).toBeInTheDocument()
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
        expect(screen.getByText('Connection Type')).toBeInTheDocument()
      })
    })

    it('advances to Telegram config when Telegram selected', async () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      fireEvent.click(screen.getByText('Telegram'))

      await waitFor(() => {
        expect(screen.getByText('Connect Telegram')).toBeInTheDocument()
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Bot Token')).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Navigation Tests
  // ==========================================

  describe('Navigation', () => {
    it('goes back to platform selection when Back clicked', async () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      // Go to config step
      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByText('Connect Twitter / X')).toBeInTheDocument()
      })

      // Go back
      fireEvent.click(screen.getByRole('button', { name: /back/i }))

      await waitFor(() => {
        expect(screen.getByText('Add Connector')).toBeInTheDocument()
        expect(screen.getByText('Twitter / X')).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Form Validation Tests
  // ==========================================

  describe('Form Validation', () => {
    it('disables Add Connector button when form is empty', async () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add connector/i })).toBeDisabled()
      })
    })

    it('enables Add Connector button when form is valid', async () => {
      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      })

      // Fill in form
      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'My Bot' },
      })
      fireEvent.change(screen.getByLabelText('Bearer Token'), {
        target: { value: 'AAAA...' },
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add connector/i })).not.toBeDisabled()
      })
    })
  })

  // ==========================================
  // Submission Tests
  // ==========================================

  describe('Submission', () => {
    it('calls API with correct data for Twitter', async () => {
      const mockCreate = vi.mocked(toolCredentialsApi.create)
      mockCreate.mockResolvedValueOnce({
        success: true,
        credential: {
          id: 'new-id',
          tool_type: 'twitter_api',
          name: 'My Twitter Bot',
          credential_preview: '****test',
          config: {},
          is_active: true,
          last_used_at: null,
          usage_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })

      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      // Select Twitter
      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      })

      // Fill form
      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'My Twitter Bot' },
      })
      fireEvent.change(screen.getByLabelText('Bearer Token'), {
        target: { value: 'my-bearer-token' },
      })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /add connector/i }))

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith({
          tool_type: 'twitter_api',
          name: 'My Twitter Bot',
          credential: 'my-bearer-token',
          config: {},
        })
      })
    })

    it('shows success screen after successful submission', async () => {
      const mockCreate = vi.mocked(toolCredentialsApi.create)
      mockCreate.mockResolvedValueOnce({
        success: true,
        credential: {
          id: 'new-id',
          tool_type: 'twitter_api',
          name: 'Test',
          credential_preview: '****test',
          config: {},
          is_active: true,
          last_used_at: null,
          usage_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })

      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      // Fill and submit
      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByLabelText('Bearer Token'), {
        target: { value: 'token' },
      })

      fireEvent.click(screen.getByRole('button', { name: /add connector/i }))

      await waitFor(() => {
        expect(screen.getByText('Connector Added')).toBeInTheDocument()
      })
    })

    it('shows error on API failure', async () => {
      const mockCreate = vi.mocked(toolCredentialsApi.create)
      mockCreate.mockRejectedValueOnce(new Error('API Error: Invalid token'))

      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      // Fill and submit
      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByLabelText('Bearer Token'), {
        target: { value: 'token' },
      })

      fireEvent.click(screen.getByRole('button', { name: /add connector/i }))

      await waitFor(() => {
        expect(screen.getByText('API Error: Invalid token')).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Success Callback Tests
  // ==========================================

  describe('Success Callback', () => {
    it('calls onSuccess when Done is clicked', async () => {
      const mockCreate = vi.mocked(toolCredentialsApi.create)
      mockCreate.mockResolvedValueOnce({
        success: true,
        credential: {
          id: 'new-id',
          tool_type: 'twitter_api',
          name: 'Test',
          credential_preview: '****test',
          config: {},
          is_active: true,
          last_used_at: null,
          usage_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      })

      render(
        <AddConnectorDialog open={true} onOpenChange={mockOnOpenChange} onSuccess={mockOnSuccess} />
      )

      // Complete flow
      fireEvent.click(screen.getByText('Twitter / X'))

      await waitFor(() => {
        expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByLabelText('Bearer Token'), {
        target: { value: 'token' },
      })

      fireEvent.click(screen.getByRole('button', { name: /add connector/i }))

      await waitFor(() => {
        expect(screen.getByText('Connector Added')).toBeInTheDocument()
      })

      // Click Done
      fireEvent.click(screen.getByRole('button', { name: /done/i }))

      expect(mockOnSuccess).toHaveBeenCalled()
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
