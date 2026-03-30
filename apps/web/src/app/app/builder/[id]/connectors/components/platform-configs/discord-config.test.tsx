/**
 * Discord Config Component Tests
 *
 * Unit tests for the DiscordConfig form component.
 * Tests rendering, validation, mode switching, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DiscordConfig, type DiscordConfigData } from './discord-config'
import { validateDiscordConfig } from './validation'

// ============================================
// TEST FIXTURES
// ============================================

function createValidWebhookData(): DiscordConfigData {
  return {
    name: 'My Discord Channel',
    mode: 'webhook',
    credential: 'https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz',
  }
}

function createValidBotData(): DiscordConfigData {
  return {
    name: 'My Discord Bot',
    mode: 'bot',
    credential: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.abcdef.ghijklmnopqrstuvwxyz1234567890',
    channelId: '123456789012345678',
  }
}

function createEmptyData(): DiscordConfigData {
  return {
    name: '',
    mode: 'webhook',
    credential: '',
  }
}

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================

describe('Discord Validation Schema', () => {
  describe('Webhook Mode', () => {
    it('validates correct webhook URL', () => {
      const result = validateDiscordConfig(createValidWebhookData())
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('rejects invalid webhook URL format', () => {
      const result = validateDiscordConfig({
        ...createValidWebhookData(),
        credential: 'https://discord.com/invalid',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.credential).toContain('webhook')
    })

    it('rejects non-discord webhook URL', () => {
      const result = validateDiscordConfig({
        ...createValidWebhookData(),
        credential: 'https://example.com/api/webhooks/123/abc',
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('Bot Mode', () => {
    it('validates correct bot data', () => {
      const result = validateDiscordConfig(createValidBotData())
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('rejects bot token too short', () => {
      const result = validateDiscordConfig({
        ...createValidBotData(),
        credential: 'short',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.credential).toContain('short')
    })

    it('requires channel ID in bot mode', () => {
      const result = validateDiscordConfig({
        ...createValidBotData(),
        channelId: '',
      })
      expect(result.valid).toBe(false)
      expect(result.errors.channelId).toBeDefined()
    })

    it('validates channel ID format (17-19 digits)', () => {
      const result = validateDiscordConfig({
        ...createValidBotData(),
        channelId: '12345', // Too short
      })
      expect(result.valid).toBe(false)
      expect(result.errors.channelId).toContain('snowflake')
    })

    it('accepts valid 18-digit channel ID', () => {
      const result = validateDiscordConfig({
        ...createValidBotData(),
        channelId: '123456789012345678',
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('Common Validation', () => {
    it('rejects empty name', () => {
      const result = validateDiscordConfig({ ...createValidWebhookData(), name: '' })
      expect(result.valid).toBe(false)
      expect(result.errors.name).toBeDefined()
    })

    it('rejects name over 100 characters', () => {
      const result = validateDiscordConfig({
        ...createValidWebhookData(),
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

describe('DiscordConfig Component', () => {
  const mockOnChange = vi.fn()
  const mockOnValidationChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders name field and mode selector', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      expect(screen.getByText('Connection Type')).toBeInTheDocument()
    })

    it('renders webhook URL field in webhook mode', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Webhook URL')).toBeInTheDocument()
      expect(screen.queryByLabelText('Bot Token')).not.toBeInTheDocument()
    })

    it('renders bot token and channel ID fields in bot mode', () => {
      render(
        <DiscordConfig
          data={{ ...createEmptyData(), mode: 'bot', channelId: '' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByLabelText('Bot Token')).toBeInTheDocument()
      expect(screen.getByLabelText('Channel ID')).toBeInTheDocument()
      expect(screen.queryByLabelText('Webhook URL')).not.toBeInTheDocument()
    })

    it('renders credential fields as password type', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Webhook URL')).toHaveAttribute('type', 'password')
    })

    it('renders help link to Discord Developer Portal', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      const link = screen.getByRole('link', { name: /discord developer portal/i })
      expect(link).toHaveAttribute('href', 'https://discord.com/developers/applications')
    })

    it('shows webhook mode info box', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByText('Webhook Mode')).toBeInTheDocument()
      expect(screen.getByText(/no bot required/i)).toBeInTheDocument()
    })

    it('shows bot mode info box when in bot mode', () => {
      render(
        <DiscordConfig
          data={{ ...createEmptyData(), mode: 'bot', channelId: '' }}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('Bot Mode')).toBeInTheDocument()
      expect(screen.getByText(/requires a discord application/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Interaction Tests
  // ==========================================

  describe('Interactions', () => {
    it('calls onChange when name changes', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'New Name' },
      })

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Name',
        })
      )
    })

    it('calls onChange when webhook URL changes', () => {
      render(<DiscordConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText('Webhook URL'), {
        target: { value: 'https://example.com/webhook' },
      })

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: 'https://example.com/webhook',
        })
      )
    })

    // Note: Mode switching via Select is tested through integration tests
    // Radix Select doesn't work well in unit tests without complex setup
  })

  // ==========================================
  // Validation Feedback Tests
  // ==========================================

  describe('Validation Feedback', () => {
    it('calls onValidationChange with false for invalid data', async () => {
      render(
        <DiscordConfig
          data={createEmptyData()}
          onChange={mockOnChange}
          onValidationChange={mockOnValidationChange}
        />
      )

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(false)
      })
    })

    it('calls onValidationChange with true for valid webhook data', async () => {
      render(
        <DiscordConfig
          data={createValidWebhookData()}
          onChange={mockOnChange}
          onValidationChange={mockOnValidationChange}
        />
      )

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(true)
      })
    })

    it('shows error message after blur on invalid webhook URL', async () => {
      render(
        <DiscordConfig
          data={{ ...createEmptyData(), credential: 'invalid-url' }}
          onChange={mockOnChange}
        />
      )

      fireEvent.blur(screen.getByLabelText('Webhook URL'))

      await waitFor(() => {
        expect(screen.getByText(/invalid discord webhook/i)).toBeInTheDocument()
      })
    })

    it('shows channel ID error in bot mode', async () => {
      render(
        <DiscordConfig
          data={{ name: 'Test', mode: 'bot', credential: 'x'.repeat(60), channelId: '123' }}
          onChange={mockOnChange}
        />
      )

      fireEvent.blur(screen.getByLabelText('Channel ID'))

      await waitFor(() => {
        expect(screen.getByText(/snowflake/i)).toBeInTheDocument()
      })
    })
  })
})
