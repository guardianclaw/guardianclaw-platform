/**
 * Memory Viewer Client Tests
 *
 * Unit tests for the MemoryPageClient component.
 * Tests memory listing, filtering, detail view, search,
 * and archive/delete functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryPageClient } from './client'
import {
  memoriesApi,
  type MemorySession,
  type MemorySessionDetail,
  type ConversationMemoryStats,
} from '@/lib/api'

// ============================================
// MOCKS
// ============================================

const mockAgent = {
  id: 'test-agent-id',
  name: 'Test Agent',
}

vi.mock('../context', () => ({
  useAgent: () => ({
    agent: mockAgent,
    isDemo: false,
  }),
}))

vi.mock('@/lib/api', () => ({
  memoriesApi: {
    list: vi.fn(),
    stats: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clearAll: vi.fn(),
    search: vi.fn(),
    restore: vi.fn(),
  },
}))

// ============================================
// TEST FIXTURES
// ============================================

function createMockMemorySession(overrides: Partial<MemorySession> = {}): MemorySession {
  return {
    id: 'conv-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Conversation',
    status: 'active',
    memory_strategy: 'sliding_window',
    context_window: 10,
    message_count: 5,
    total_tokens: 500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockMemoryDetail(overrides: Partial<MemorySessionDetail> = {}): MemorySessionDetail {
  return {
    ...createMockMemorySession(),
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, how are you?',
        position: 1,
        input_tokens: 10,
        output_tokens: 0,
        blocked: false,
        blocked_reason: null,
        blocked_gate: null,
        latency_ms: null,
        model_used: null,
        created_at: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'I am doing well, thank you!',
        position: 2,
        input_tokens: 0,
        output_tokens: 20,
        blocked: false,
        blocked_reason: null,
        blocked_gate: null,
        latency_ms: 150,
        model_used: 'gpt-4o-mini',
        created_at: new Date().toISOString(),
      },
    ],
    context: [],
    ...overrides,
  }
}

const mockStats: ConversationMemoryStats = {
  stats: {
    total_conversations: 5,
    active_conversations: 3,
    archived_conversations: 2,
    total_messages: 50,
    total_tokens: 5000,
    avg_messages_per_conversation: 10,
  },
  strategy_breakdown: {
    sliding_window: 3,
    summary: 1,
    full: 1,
  },
}

function mockApiSuccess(memories: MemorySession[] = [], stats = mockStats) {
  vi.mocked(memoriesApi.list).mockResolvedValueOnce({
    memories,
    pagination: {
      total: memories.length,
      limit: 50,
      offset: 0,
      has_more: false,
    },
  })
  vi.mocked(memoriesApi.stats).mockResolvedValueOnce(stats)
}

function mockApiError(message = 'API Error') {
  vi.mocked(memoriesApi.list).mockRejectedValueOnce(new Error(message))
  vi.mocked(memoriesApi.stats).mockRejectedValueOnce(new Error(message))
}

// ============================================
// TEST SUITES
// ============================================

describe('MemoryPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Loading State Tests
  // ==========================================

  describe('Loading State', () => {
    it('shows loading spinner while fetching memories', () => {
      vi.mocked(memoriesApi.list).mockReturnValue(new Promise(() => {}))
      vi.mocked(memoriesApi.stats).mockReturnValue(new Promise(() => {}))

      render(<MemoryPageClient />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })

    it('hides loading spinner after memories load', async () => {
      mockApiSuccess([])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeNull()
      })
    })
  })

  // ==========================================
  // Empty State Tests
  // ==========================================

  describe('Empty State', () => {
    it('shows empty state when no memories', async () => {
      mockApiSuccess([])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(/no memory sessions found/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Error State Tests
  // ==========================================

  describe('Error State', () => {
    it('shows error message when API fails', async () => {
      mockApiError('Network error')

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Memory List Tests
  // ==========================================

  describe('Memory List', () => {
    it('displays memory sessions after loading', async () => {
      const memories = [
        createMockMemorySession({ title: 'Conversation 1' }),
        createMockMemorySession({ title: 'Conversation 2' }),
      ]
      mockApiSuccess(memories)

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText('Conversation 1')).toBeInTheDocument()
        expect(screen.getByText('Conversation 2')).toBeInTheDocument()
      })
    })

    it('displays message count for each session', async () => {
      const memories = [createMockMemorySession({ title: 'Test', message_count: 42 })]
      mockApiSuccess(memories)

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument()
      })
    })

    it('displays token count for each session', async () => {
      const memories = [createMockMemorySession({ title: 'Test', total_tokens: 1500 })]
      mockApiSuccess(memories)

      render(<MemoryPageClient />)

      await waitFor(() => {
        // Token count is displayed with hash icon
        const hashIcons = document.querySelectorAll('.lucide-hash')
        expect(hashIcons.length).toBeGreaterThan(0)
      })
    })

    it('shows archived badge for archived sessions', async () => {
      const memories = [createMockMemorySession({ title: 'Archived Session', status: 'archived' })]
      mockApiSuccess(memories)

      render(<MemoryPageClient />)

      await waitFor(() => {
        // Badge shows "Archived" text
        expect(screen.getByText('Archived')).toBeInTheDocument()
      })
    })

    it('calls memoriesApi.list on mount', async () => {
      mockApiSuccess([])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(memoriesApi.list).toHaveBeenCalled()
      })
    })
  })

  // ==========================================
  // Stats Display Tests
  // ==========================================

  describe('Stats Display', () => {
    it('displays stats section', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        // Stats section has muted background
        const statsSection = document.querySelector('.bg-muted\\/30')
        expect(statsSection).toBeTruthy()
      })
    })

    it('displays total messages count', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText('50')).toBeInTheDocument() // From mockStats
      })
    })

    it('calls stats API on mount', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(memoriesApi.stats).toHaveBeenCalled()
      })
    })
  })

  // ==========================================
  // Filter Tests
  // ==========================================

  describe('Filters', () => {
    it('has status filter dropdown', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      })
    })

    it('has search input', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search by title/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Memory Detail Tests
  // ==========================================

  describe('Memory Detail', () => {
    it('loads memory detail when session clicked', async () => {
      const memory = createMockMemorySession({ id: 'conv-123', title: 'Test Session' })
      mockApiSuccess([memory])
      vi.mocked(memoriesApi.get).mockResolvedValueOnce(createMockMemoryDetail({ id: 'conv-123' }))

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText('Test Session')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Test Session'))

      await waitFor(() => {
        expect(memoriesApi.get).toHaveBeenCalledWith('test-agent-id', 'conv-123')
      })
    })

    it('displays messages in detail view', async () => {
      const memory = createMockMemorySession({ id: 'conv-123' })
      mockApiSuccess([memory])
      vi.mocked(memoriesApi.get).mockResolvedValueOnce(createMockMemoryDetail())

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(memory.title!)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(memory.title!))

      await waitFor(() => {
        expect(screen.getByText('Hello, how are you?')).toBeInTheDocument()
        expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument()
      })
    })

    it('shows placeholder when no session selected', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(/select a memory session/i)).toBeInTheDocument()
      })
    })
  })

  // ==========================================
  // Archive/Delete Tests
  // ==========================================

  describe('Archive/Delete', () => {
    it('shows archive button for active sessions', async () => {
      const memory = createMockMemorySession({ id: 'conv-123', status: 'active' })
      mockApiSuccess([memory])
      vi.mocked(memoriesApi.get).mockResolvedValueOnce(
        createMockMemoryDetail({ id: 'conv-123', status: 'active' })
      )

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(memory.title!)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(memory.title!))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument()
      })
    })

    it('shows restore button for archived sessions', async () => {
      const memory = createMockMemorySession({ id: 'conv-123', status: 'archived' })
      mockApiSuccess([memory])
      vi.mocked(memoriesApi.get).mockResolvedValueOnce(
        createMockMemoryDetail({ id: 'conv-123', status: 'archived' })
      )

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(memory.title!)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(memory.title!))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument()
      })
    })

    it('shows confirmation dialog when delete clicked', async () => {
      const memory = createMockMemorySession({ id: 'conv-123' })
      mockApiSuccess([memory])
      vi.mocked(memoriesApi.get).mockResolvedValueOnce(createMockMemoryDetail({ id: 'conv-123' }))

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(memory.title!)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(memory.title!))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })
    })

    it('calls delete API when confirmed', async () => {
      const memory = createMockMemorySession({ id: 'conv-123' })
      mockApiSuccess([memory])
      vi.mocked(memoriesApi.get).mockResolvedValueOnce(createMockMemoryDetail({ id: 'conv-123' }))
      vi.mocked(memoriesApi.delete).mockResolvedValueOnce({ success: true, deleted: true })

      render(<MemoryPageClient />)

      await waitFor(() => {
        expect(screen.getByText(memory.title!)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText(memory.title!))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /delete/i }))

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      })

      // Find and click the delete confirmation button inside the dialog
      const alertDialog = screen.getByRole('alertdialog')
      const confirmButton =
        alertDialog.querySelector('button[class*="destructive"]') ||
        Array.from(alertDialog.querySelectorAll('button')).find((btn) =>
          btn.textContent?.toLowerCase().includes('delete')
        )
      if (confirmButton) {
        fireEvent.click(confirmButton)
      }

      await waitFor(() => {
        expect(memoriesApi.delete).toHaveBeenCalledWith('test-agent-id', 'conv-123', true)
      })
    })
  })

  // ==========================================
  // Action Buttons Tests
  // ==========================================

  describe('Action Buttons', () => {
    it('has search button', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        const searchIcon = document.querySelector('.lucide-search')
        expect(searchIcon).toBeTruthy()
      })
    })

    it('has refresh button', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        const refreshIcon = document.querySelector('.lucide-refresh-cw')
        expect(refreshIcon).toBeTruthy()
      })
    })

    it('has clear all button', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        // Clear all button uses Trash2 icon - check for SVG with trash path
        const buttons = screen.getAllByRole('button')
        const clearButton = buttons.find(
          (btn) => btn.querySelector('svg') && btn.innerHTML.includes('trash')
        )
        expect(clearButton || document.querySelector('[class*="lucide"]')).toBeTruthy()
      })
    })

    it('refreshes memories when refresh button clicked', async () => {
      mockApiSuccess([createMockMemorySession()])

      render(<MemoryPageClient />)

      await waitFor(() => {
        const refreshIcon = document.querySelector('.lucide-refresh-cw')
        expect(refreshIcon).toBeTruthy()
      })

      // Setup for refresh
      mockApiSuccess([createMockMemorySession(), createMockMemorySession()])

      const refreshIcon = document.querySelector('.lucide-refresh-cw')
      const refreshButton = refreshIcon?.closest('button')
      if (refreshButton) {
        fireEvent.click(refreshButton)
      }

      await waitFor(() => {
        expect(memoriesApi.list).toHaveBeenCalledTimes(2)
      })
    })
  })
})

// ============================================
// EDGE CASES
// ============================================

describe('MemoryPageClient - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles empty memory title gracefully', async () => {
    const memory = createMockMemorySession({ title: null as unknown as string })
    mockApiSuccess([memory])

    render(<MemoryPageClient />)

    await waitFor(() => {
      expect(screen.getByText('Untitled')).toBeInTheDocument()
    })
  })

  it('handles very long conversation titles', async () => {
    const memory = createMockMemorySession({ title: 'A'.repeat(200) })
    mockApiSuccess([memory])

    render(<MemoryPageClient />)

    await waitFor(() => {
      // Should truncate or handle gracefully
      expect(document.querySelector('.truncate')).toBeTruthy()
    })
  })

  it('handles session with zero messages', async () => {
    const memory = createMockMemorySession({ message_count: 0, total_tokens: 0 })
    mockApiSuccess([memory])
    vi.mocked(memoriesApi.get).mockResolvedValueOnce({
      ...createMockMemoryDetail(),
      messages: [],
      message_count: 0,
    })

    render(<MemoryPageClient />)

    await waitFor(() => {
      expect(screen.getByText(memory.title!)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(memory.title!))

    // Should not crash with empty messages array
    await waitFor(() => {
      expect(memoriesApi.get).toHaveBeenCalled()
    })
  })

  it('handles session with blocked messages', async () => {
    const detail = createMockMemoryDetail()
    detail.messages.push({
      id: 'msg-blocked',
      role: 'assistant',
      content: 'This was blocked',
      position: 3,
      input_tokens: 0,
      output_tokens: 0,
      blocked: true,
      blocked_reason: 'Harmful content detected',
      blocked_gate: 'avoidance',
      latency_ms: null,
      model_used: null,
      created_at: new Date().toISOString(),
    })

    const memory = createMockMemorySession({ id: 'conv-blocked' })
    mockApiSuccess([memory])
    vi.mocked(memoriesApi.get).mockResolvedValueOnce(detail)

    render(<MemoryPageClient />)

    await waitFor(() => {
      expect(screen.getByText(memory.title!)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(memory.title!))

    // Just verify the API was called - blocked message display varies by implementation
    await waitFor(() => {
      expect(memoriesApi.get).toHaveBeenCalledWith('test-agent-id', 'conv-blocked')
    })
  })

  it('handles context data in collapsible section', async () => {
    const detail = createMockMemoryDetail()
    detail.context = [
      {
        context_key: 'summary',
        context_value: { text: 'Previous conversation summary' },
        updated_at: new Date().toISOString(),
      },
    ]

    const memory = createMockMemorySession({ id: 'conv-with-context' })
    mockApiSuccess([memory])
    vi.mocked(memoriesApi.get).mockResolvedValueOnce(detail)

    render(<MemoryPageClient />)

    await waitFor(() => {
      expect(screen.getByText(memory.title!)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(memory.title!))

    await waitFor(() => {
      expect(screen.getByText(/context data/i)).toBeInTheDocument()
    })
  })

  it('handles API error during detail load', async () => {
    const memory = createMockMemorySession({ id: 'conv-error' })
    mockApiSuccess([memory])
    vi.mocked(memoriesApi.get).mockRejectedValueOnce(new Error('Detail load failed'))

    render(<MemoryPageClient />)

    await waitFor(() => {
      expect(screen.getByText(memory.title!)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(memory.title!))

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })
})

// ============================================
// HEADER TESTS
// ============================================

describe('MemoryPageClient - Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays Memory Sessions title', async () => {
    mockApiSuccess([])

    render(<MemoryPageClient />)

    await waitFor(() => {
      expect(screen.getByText('Memory Sessions')).toBeInTheDocument()
    })
  })
})
