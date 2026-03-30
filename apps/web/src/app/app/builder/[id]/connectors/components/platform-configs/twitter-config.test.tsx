/**
 * Twitter Config Component Tests
 *
 * Unit tests for the TwitterConfig form component.
 * Tests rendering, validation, error display, and user interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TwitterConfig, type TwitterConfigData } from './twitter-config'
import { validateTwitterConfig } from './validation'

// ============================================
// TEST FIXTURES
// ============================================

function createValidData(): TwitterConfigData {
  return {
    name: 'My Twitter Bot',
    bearerToken: 'AAAA_valid_bearer_token_123',
  }
}

function createEmptyData(): TwitterConfigData {
  return {
    name: '',
    bearerToken: '',
  }
}

// ============================================
// VALIDATION SCHEMA TESTS
// ============================================

describe('Twitter Validation Schema', () => {
  it('validates correct data', () => {
    const result = validateTwitterConfig(createValidData())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('rejects empty name', () => {
    const result = validateTwitterConfig({ ...createValidData(), name: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.name).toBeDefined()
  })

  it('rejects empty bearer token', () => {
    const result = validateTwitterConfig({ ...createValidData(), bearerToken: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.bearerToken).toBeDefined()
  })

  it('rejects name over 100 characters', () => {
    const result = validateTwitterConfig({
      ...createValidData(),
      name: 'A'.repeat(101),
    })
    expect(result.valid).toBe(false)
    expect(result.errors.name).toContain('100')
  })

  it('validates bearer token with minimum 20 characters', () => {
    const result = validateTwitterConfig({
      name: 'Test',
      bearerToken: '12345678901234567890', // exactly 20 chars
    })
    expect(result.valid).toBe(true)
  })

  it('rejects bearer token shorter than 20 characters', () => {
    const result = validateTwitterConfig({
      name: 'Test',
      bearerToken: 'short_token', // less than 20 chars
    })
    expect(result.valid).toBe(false)
    expect(result.errors.bearerToken).toContain('short')
  })
})

// ============================================
// COMPONENT TESTS
// ============================================

describe('TwitterConfig Component', () => {
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
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Connection Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Bearer Token')).toBeInTheDocument()
    })

    it('renders with initial data', () => {
      const data = createValidData()
      render(<TwitterConfig data={data} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Connection Name')).toHaveValue(data.name)
      expect(screen.getByLabelText('Bearer Token')).toHaveValue(data.bearerToken)
    })

    it('renders bearer token as password field', () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByLabelText('Bearer Token')).toHaveAttribute('type', 'password')
    })

    it('renders help link to Twitter Developer Portal', () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      const link = screen.getByRole('link', { name: /twitter developer portal/i })
      expect(link).toHaveAttribute('href', 'https://developer.twitter.com/en/portal/dashboard')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('renders requirements info box', () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      expect(screen.getByText('Requirements')).toBeInTheDocument()
      expect(screen.getByText(/Twitter Developer Account/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Interaction Tests
  // ==========================================

  describe('Interactions', () => {
    it('calls onChange when name changes', () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText('Connection Name'), {
        target: { value: 'New Name' },
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        name: 'New Name',
        bearerToken: '',
      })
    })

    it('calls onChange when bearer token changes', () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      fireEvent.change(screen.getByLabelText('Bearer Token'), {
        target: { value: 'new-token' },
      })

      expect(mockOnChange).toHaveBeenCalledWith({
        name: '',
        bearerToken: 'new-token',
      })
    })
  })

  // ==========================================
  // Validation Feedback Tests
  // ==========================================

  describe('Validation Feedback', () => {
    it('calls onValidationChange with false for invalid data', async () => {
      render(
        <TwitterConfig
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
        <TwitterConfig
          data={createValidData()}
          onChange={mockOnChange}
          onValidationChange={mockOnValidationChange}
        />
      )

      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalledWith(true)
      })
    })

    it('shows error message after blur on invalid field', async () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      const nameInput = screen.getByLabelText('Connection Name')
      fireEvent.blur(nameInput)

      await waitFor(() => {
        expect(screen.getByText(/connection name is required/i)).toBeInTheDocument()
      })
    })

    it('does not show error before blur', () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      // Error should not be visible before interaction
      expect(screen.queryByText(/connection name is required/i)).not.toBeInTheDocument()
    })

    it('sets aria-invalid on invalid field after blur', async () => {
      render(<TwitterConfig data={createEmptyData()} onChange={mockOnChange} />)

      const nameInput = screen.getByLabelText('Connection Name')
      fireEvent.blur(nameInput)

      await waitFor(() => {
        expect(nameInput).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })
})
