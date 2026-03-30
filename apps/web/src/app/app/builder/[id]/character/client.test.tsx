/**
 * Character Editor Client Tests
 *
 * Unit tests for the CharacterPageClient component.
 * Tests character loading, editing, memory integrity settings,
 * import/export functionality, and preview.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CharacterPageClient } from './client'
import { characterApi, agentExportApi } from '@/lib/api'

// ============================================
// MOCKS
// ============================================

const mockAgent = {
  id: 'test-agent-id',
  name: 'Test Agent',
  framework: 'elizaos',
}

vi.mock('../context', () => ({
  useAgent: () => ({
    agent: mockAgent,
    isDemo: false,
  }),
}))

vi.mock('@/lib/api', () => ({
  characterApi: {
    get: vi.fn(),
    update: vi.fn(),
    reset: vi.fn(),
    preview: vi.fn(),
  },
  agentExportApi: {
    export: vi.fn(),
    import: vi.fn(),
  },
}))

// ============================================
// TEST FIXTURES
// ============================================

const mockCharacterConfig = {
  character: {
    name: 'TestBot',
    personality: 'A friendly assistant.',
    bio: 'Background info.',
    topics: ['technology', 'science'],
    forbidden_topics: ['politics'],
    adjectives: ['helpful', 'curious'],
    knowledge: ['AI basics'],
    examples: [{ user: 'Hello', assistant: 'Hi there!' }],
  },
  memory_integrity: {
    enabled: true,
    verify_on_read: true,
    sign_on_write: true,
    min_trust_score: 0.5,
  },
  framework: 'elizaos',
  is_elizaos: true,
}

const mockEmptyCharacterConfig = {
  character: {
    name: '',
    personality: '',
    bio: '',
    topics: [],
    forbidden_topics: [],
    adjectives: [],
    knowledge: [],
    examples: [],
  },
  memory_integrity: {
    enabled: true,
    verify_on_read: true,
    sign_on_write: true,
    min_trust_score: 0.5,
  },
  framework: 'elizaos',
  is_elizaos: true,
}

function mockApiSuccess(config = mockCharacterConfig) {
  vi.mocked(characterApi.get).mockResolvedValueOnce(config)
}

function mockApiError(message = 'API Error') {
  vi.mocked(characterApi.get).mockRejectedValueOnce(new Error(message))
}

// ============================================
// TEST SUITES
// ============================================

describe('CharacterPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Loading State Tests
  // ==========================================

  describe('Loading State', () => {
    it('shows loading spinner while fetching character', () => {
      vi.mocked(characterApi.get).mockReturnValue(new Promise(() => {}))

      render(<CharacterPageClient />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading spinner after character loads', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeNull()
      })
    })

    it('shows loading text', () => {
      vi.mocked(characterApi.get).mockReturnValue(new Promise(() => {}))

      render(<CharacterPageClient />)

      expect(screen.getByText(/loading character/i)).toBeInTheDocument()
    })
  })

  // ==========================================
  // Error State Tests
  // ==========================================

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      mockApiError('Failed to load character')

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
      })
    })

    it('displays error with alert styling', async () => {
      mockApiError()

      render(<CharacterPageClient />)

      await waitFor(() => {
        // Error is displayed as a div with destructive styling
        const errorDiv = document.querySelector('[class*="destructive"]')
        expect(errorDiv).toBeTruthy()
      })
    })
  })

  // ==========================================
  // Character Display Tests
  // ==========================================

  describe('Character Display', () => {
    it('displays character name in input field', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/name/i)
        expect(nameInput).toHaveValue('TestBot')
      })
    })

    it('displays bio in textarea', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        const bioTextarea = screen.getByLabelText(/bio/i)
        expect(bioTextarea).toHaveValue('Background info.')
      })
    })

    it('displays page title', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByText('Character Configuration')).toBeInTheDocument()
      })
    })

    it('calls characterApi.get on mount', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(characterApi.get).toHaveBeenCalledWith('test-agent-id')
      })
    })
  })

  // ==========================================
  // Tab Navigation Tests
  // ==========================================

  describe('Tab Navigation', () => {
    it('shows Identity tab as default active', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        const identityTab = screen.getByRole('tab', { name: /identity/i })
        expect(identityTab).toHaveAttribute('data-state', 'active')
      })
    })

    it('renders all four tabs', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /identity/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /personality/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /knowledge/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /safety/i })).toBeInTheDocument()
      })
    })

    it('tabs are clickable', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        const personalityTab = screen.getByRole('tab', { name: /personality/i })
        expect(personalityTab).not.toBeDisabled()
      })
    })
  })

  // ==========================================
  // Save Changes Tests
  // ==========================================

  describe('Save Changes', () => {
    it('save button is disabled when no changes', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save/i })
        expect(saveButton).toBeDisabled()
      })
    })

    it('save button is enabled when changes are made', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/name/i)
      fireEvent.change(nameInput, { target: { value: 'New Name' } })

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /save/i })
        expect(saveButton).not.toBeDisabled()
      })
    })

    it('calls update API when save clicked', async () => {
      mockApiSuccess()
      vi.mocked(characterApi.update).mockResolvedValueOnce({
        ...mockCharacterConfig,
        character: { ...mockCharacterConfig.character, name: 'New Name' },
      })

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText(/name/i)
      fireEvent.change(nameInput, { target: { value: 'New Name' } })

      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(characterApi.update).toHaveBeenCalled()
      })
    })

    it('shows success message after save', async () => {
      mockApiSuccess()
      vi.mocked(characterApi.update).mockResolvedValueOnce({
        ...mockCharacterConfig,
        character: { ...mockCharacterConfig.character, name: 'New Name' },
      })

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Name' } })
      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument()
      })
    })

    it('tracks changes between original and current state', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
      })

      // Initially no changes
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()

      // Make a change
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Changed' } })
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()

      // Revert to original
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'TestBot' } })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
      })
    })
  })

  // ==========================================
  // Export Tests
  // ==========================================

  describe('Export', () => {
    it('has export button', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
      })
    })

    it('export button is not disabled when data is loaded', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        const exportBtn = screen.getByRole('button', { name: /export/i })
        expect(exportBtn).not.toBeDisabled()
      })
    })
  })

  // ==========================================
  // Import Tests
  // ==========================================

  describe('Import', () => {
    it('opens import dialog when import button clicked', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /import/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/import configuration/i)).toBeInTheDocument()
      })
    })

    it('shows textarea for pasting JSON', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /import/i }))
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/paste json/i)).toBeInTheDocument()
      })
    })

    it('shows cancel button in import dialog', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /import/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Preview Tests
  // ==========================================

  describe('Preview', () => {
    it('opens preview dialog when preview button clicked', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /preview/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/preview character/i)).toBeInTheDocument()
      })
    })

    it('shows test message input in preview dialog', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /preview/i }))
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })
    })

    it('calls preview API when generating preview', async () => {
      mockApiSuccess()
      vi.mocked(characterApi.preview).mockResolvedValueOnce({
        preview_available: true,
        response: 'Hello from the bot!',
        character_prompt: 'Test prompt',
        test_message: 'Hello',
      })

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /preview/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      // Find and fill the test message input
      const input = screen.getByPlaceholderText(/type a message/i)
      fireEvent.change(input, { target: { value: 'Hello' } })

      // Submit the preview - button says "Generate Preview"
      const generateButton = screen.getByRole('button', { name: /generate preview/i })
      fireEvent.click(generateButton)

      await waitFor(() => {
        expect(characterApi.preview).toHaveBeenCalledWith('test-agent-id', 'Hello')
      })
    })

    it('displays preview response', async () => {
      mockApiSuccess()
      vi.mocked(characterApi.preview).mockResolvedValueOnce({
        preview_available: true,
        response: 'Hello from the bot!',
        character_prompt: 'Test prompt',
        test_message: 'Hello',
      })

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /preview/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i)
      fireEvent.change(input, { target: { value: 'Hello' } })
      fireEvent.click(screen.getByRole('button', { name: /generate preview/i }))

      await waitFor(() => {
        expect(screen.getByText('Hello from the bot!')).toBeInTheDocument()
      })
    })

    it('handles preview not available', async () => {
      mockApiSuccess()
      vi.mocked(characterApi.preview).mockResolvedValueOnce({
        preview_available: false,
        message: 'OpenAI API key not configured',
      })

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /preview/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i)
      fireEvent.change(input, { target: { value: 'Hello' } })
      fireEvent.click(screen.getByRole('button', { name: /generate preview/i }))

      await waitFor(() => {
        expect(screen.getByText(/not available/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Reset Character Tests
  // ==========================================

  describe('Reset Character', () => {
    it('shows confirmation dialog when reset clicked', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /reset/i }))

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
        expect(screen.getByText(/reset character/i)).toBeInTheDocument()
      })
    })

    it('shows warning in reset dialog', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /reset/i }))
      })

      await waitFor(() => {
        expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
      })
    })

    it('can cancel reset', async () => {
      mockApiSuccess()

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /reset/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      })
    })

    it('calls reset API when confirmed', async () => {
      mockApiSuccess()
      vi.mocked(characterApi.reset).mockResolvedValueOnce({
        success: true,
        character: mockEmptyCharacterConfig.character,
        memory_integrity: mockEmptyCharacterConfig.memory_integrity,
      })

      render(<CharacterPageClient />)

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /reset/i }))
      })

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      // Find and click the confirm reset button (the one inside the alert dialog)
      const alertDialog = screen.getByRole('alertdialog')
      const resetButtons = alertDialog.querySelectorAll('button')
      const confirmButton = Array.from(resetButtons).find(
        (btn) => btn.textContent?.toLowerCase() === 'reset'
      )
      if (confirmButton) fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(characterApi.reset).toHaveBeenCalledWith('test-agent-id')
      })
    })
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('CharacterPageClient - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles empty character config gracefully', async () => {
    vi.mocked(characterApi.get).mockResolvedValueOnce(mockEmptyCharacterConfig)

    render(<CharacterPageClient />)

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('')
    })
  })

  it('handles null values in character config', async () => {
    const configWithNulls = {
      character: null,
      memory_integrity: null,
      framework: 'elizaos',
      is_elizaos: true,
    }
    vi.mocked(characterApi.get).mockResolvedValueOnce(configWithNulls as any)

    render(<CharacterPageClient />)

    // Should not crash, should show empty state or defaults
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeNull()
    })
  })

  it('handles API error gracefully', async () => {
    vi.mocked(characterApi.get).mockRejectedValueOnce(new Error('Network error'))

    render(<CharacterPageClient />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  it('handles save API error', async () => {
    vi.mocked(characterApi.get).mockResolvedValueOnce(mockCharacterConfig)
    vi.mocked(characterApi.update).mockRejectedValueOnce(new Error('Save failed'))

    render(<CharacterPageClient />)

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
  })
})

// ============================================
// ACTION HEADER TESTS
// ============================================

describe('CharacterPageClient - Action Buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all action buttons', async () => {
    vi.mocked(characterApi.get).mockResolvedValueOnce(mockCharacterConfig)

    render(<CharacterPageClient />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })
  })

  it('export button is not disabled', async () => {
    vi.mocked(characterApi.get).mockResolvedValueOnce(mockCharacterConfig)

    render(<CharacterPageClient />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled()
    })
  })
})
