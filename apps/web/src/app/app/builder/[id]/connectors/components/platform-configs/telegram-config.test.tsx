/**
 * Telegram Config Component Tests
 *
 * Unit tests for the TelegramConfig form component.
 * Tests rendering, validation, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TelegramConfig, type TelegramConfigData } from './telegram-config'
import { validateTelegramConfig } from './validation'

// ============================================
// TEST FIXTURES
// ============================================

function createValidData(): TelegramConfigData {
  return {
    name: 'My Telegram Bot',
    botToken: '1234567890:ABCdefGHI_jklMNO-pqrSTUvwxYZ',
  }
}

function createValidDataWithChatId(): TelegramConfigData {
  return {
    ...createValidData(),
    defaultChatId: '-1001234567890',
  }
}

function createEmptyData(): TelegramConfigData {
  return {
    name: '',
    botToken: '',
  }
}

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================

describe('Telegram Validation Schema', () => {
  describe('Bot Token Validation', () => {
    it('validates correct bot token format', () => {
      const result = validateTelegramConfig(createValidData())
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('rejects empty bot token', () => {
      const result = validateTelegramConfig({ ...createValidData(), botToken: '' })
      expect(result.valid).toBe(false)
      expect(result.errors.botToken).toBeDefined()
    })

    it('rejects invalid bot token format - missing colon', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        botToken: '1234567890ABCdefGHI_jklMNO-pqrSTU',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.botToken).toContain('format')
    })

    it('rejects bot token that is too short', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        botToken: '123:ABC', // Less than 30 chars
      })
      expect(result.valid).toBe(false)
    })

    it('accepts valid token with digits:alphanumeric format', () => {
      const result = validateTelegramConfig({
        name: 'Test',
        botToken: '1234567890:ABCdefGHI_jklMNO-pqrSTUvwxYZ',
      })
      expect(result.valid).toBe(true)
    })

    it('accepts various bot ID lengths', () => {
      const result = validateTelegramConfig({
        name: 'Test',
        botToken: '12345678:ABCdefGHI_jklMNO-pqrSTUvwxYZ',
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('Chat ID Validation', () => {
    it('accepts empty chat ID (optional field)', () => {
      const result = validateTelegramConfig(createValidData())
      expect(result.valid).toBe(true)
    })

    it('accepts negative group ID', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        defaultChatId: '-1001234567890',
      })
      expect(result.valid).toBe(true)
    })

    it('accepts positive user ID', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        defaultChatId: '123456789',
      })
      expect(result.valid).toBe(true)
    })

    it('accepts @username format', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        defaultChatId: '@mychannel',
      })
      expect(result.valid).toBe(true)
    })

    it('rejects invalid @username - too short', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        defaultChatId: '@abc', // Too short (must be 5+ chars after @)
      })
      expect(result.valid).toBe(false)
    })

    it('rejects invalid chat ID format', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        defaultChatId: 'invalid-chat-id',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.defaultChatId).toBeDefined()
    })
  })

  describe('Name Validation', () => {
    it('rejects empty name', () => {
      const result = validateTelegramConfig({ ...createValidData(), name: '' })
      expect(result.valid).toBe(false)
      expect(result.errors.name).toBeDefined()
    })

    it('rejects name over 100 characters', () => {
      const result = validateTelegramConfig({
        ...createValidData(),
        name: 'A'.repeat(101),
      })
      expect(result.valid).toBe(false)
      expect(result.errors.name).toContain('100')
    })
  })
})

// ============================================
// COMPONENT TESTS
// ============================================

describe('TelegramConfig Component', () => {
  const mockOnChange = vi.fn()
  const mockOnValidationChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders all form fields', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Bot Token')).toBeInTheDocument()
      expect(screen.getByLabelText(/default chat id/i)).toBeInTheDocument()
    })

    it('renders with initial data', () => {
      const data = createValidDataWithChatId()
      render(<TelegramConfig data={data} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Connection Name')).toHaveValue(data.name)
      expect(screen.getByLabelText('Bot Token')).toHaveValue(data.botToken)
      expect(screen.getByLabelText(/default chat id/i)).toHaveValue(data.defaultChatId)
    })

    it('renders bot token as password field', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Bot Token')).toHaveAttribute('type', 'password')
    })

    it('renders help link to BotFather', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      const link = screen.getByRole('link', { name: /botfather/i })
      expect(link).toHaveAttribute('href', 'https://t.me/BotFather')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('renders getting started info box', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByText('Getting Started')).toBeInTheDocument()
      expect(screen.getByText(/message @botfather/i)).toBeInTheDocument()
    })

    it('renders chat ID help info box', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByText('Finding Chat ID')).toBeInTheDocument()
      // Check for text content about finding chat IDs
      expect(screen.getByText(/for groups/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Interaction Tests
  // ==========================================

  describe('Interactions', () => {
    it('calls onChange when name changes', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'New Bot Name' },
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        name: 'New Bot Name',
        botToken: '',
      })
    })

    it('calls onChange when bot token changes', () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText('Bot Token'), {
        target: { value: 'new-token' },
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        name: '',
        botToken: 'new-token',
      })
    })

    it('calls onChange when chat ID changes', () => {
      render(<TelegramConfig data={createValidData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText(/default chat id/i), {
        target: { value: '-100999' },
      })

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultChatId: '-100999',
        })
      )
    })
  })

  // ==========================================
  // Validation Feedback Tests
  // ==========================================

  describe('Validation Feedback', () => {
    it('calls onValidationChange with false for invalid data', async () => {
      render(
        <TelegramConfig
          data={createEmptyData()}
          onChange={mockOnChange}
          onValidationChange={mockOnValidationChange}
        />
      )

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(false)
      })
    })

    it('calls onValidationChange with true for valid data', async () => {
      render(
        <TelegramConfig
          data={createValidData()}
          onChange={mockOnChange}
          onValidationChange={mockOnValidationChange}
        />
      )

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(true)
      })
    })

    it('shows error message after blur on invalid name', async () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.blur(screen.getByLabelText('Connection Name'))

      await waitFor(() => {
        expect(screen.getByText(/connection name is required/i)).toBeInTheDocument()
      })
    })

    it('shows error message after blur on invalid bot token', async () => {
      render(
        <TelegramConfig
          data={{ ...createEmptyData(), name: 'Test', botToken: 'invalid' }}
          onChange={mockOnChange}
        />
      )

      fireEvent.blur(screen.getByLabelText('Bot Token'))

      await waitFor(() => {
        expect(screen.getByText(/invalid bot token format/i)).toBeInTheDocument()
      })
    })

    it('shows error for invalid chat ID format', async () => {
      render(
        <TelegramConfig
          data={{ ...createValidData(), defaultChatId: 'not-valid' }}
          onChange={mockOnChange}
        />
      )

      fireEvent.blur(screen.getByLabelText(/default chat id/i))

      await waitFor(() => {
        expect(screen.getByText(/chat id must be/i)).toBeInTheDocument()
      })
    })

    it('sets aria-invalid on invalid field after blur', async () => {
      render(<TelegramConfig data={createEmptyData()} onChange={mockOnChange} />)

      const tokenInput = screen.getByLabelText('Bot Token')
      fireEvent.blur(tokenInput)

      await waitFor(() => {
        expect(tokenInput).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })
})
