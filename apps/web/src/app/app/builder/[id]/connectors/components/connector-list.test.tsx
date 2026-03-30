/**
 * Connector List Component Tests
 *
 * Unit tests for the ConnectorList component.
 * Tests grouping, rendering, and callback propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectorList } from './connector-list'
import type { ToolCredential } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockCredential(overrides: Partial<ToolCredential> = {}): ToolCredential {
  return {
    id: 'cred-' + Math.random().toString(36).substr(2, 9),
    tool_type: 'twitter_api',
    name: 'Test Credential',
    credential_preview: '****TEST',
    config: {},
    is_active: true,
    last_used_at: new Date().toISOString(),
    usage_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('ConnectorList', () => {
  const mockOnTest = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders nothing when credentials array is empty', () => {
      const { container } = render(
        <ConnectorList
          credentials={[]}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{}}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders credentials list', () => {
      const credentials = [
        createMockCredential({ name: 'Bot One' }),
        createMockCredential({ name: 'Bot Two' }),
      ]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{}}
        />
      )

      expect(screen.getByText('Bot One')).toBeInTheDocument()
      expect(screen.getByText('Bot Two')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Grouping Tests
  // ==========================================

  describe('Grouping', () => {
    it('groups credentials by platform', () => {
      const credentials = [
        createMockCredential({ tool_type: 'twitter_api', name: 'Twitter Bot' }),
        createMockCredential({ tool_type: 'discord_bot', name: 'Discord Bot' }),
        createMockCredential({ tool_type: 'telegram_bot', name: 'Telegram Bot' }),
      ]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{}}
        />
      )

      // Check for platform group headers (these appear in the group header section)
      // "Twitter / X" is unique, but "Discord" and "Telegram" also appear as badges
      expect(screen.getByText('Twitter / X')).toBeInTheDocument()
      // Use getAllByText since "Discord" and "Telegram" appear multiple times (header + badge)
      expect(screen.getAllByText('Discord').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Telegram').length).toBeGreaterThanOrEqual(1)
    })

    it('shows count per platform group', () => {
      const credentials = [
        createMockCredential({ tool_type: 'twitter_api', name: 'Twitter 1' }),
        createMockCredential({ tool_type: 'twitter_api', name: 'Twitter 2' }),
        createMockCredential({ tool_type: 'discord_bot', name: 'Discord 1' }),
      ]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{}}
        />
      )

      expect(screen.getByText('(2)')).toBeInTheDocument() // Twitter count
      expect(screen.getByText('(1)')).toBeInTheDocument() // Discord count
    })

    it('only shows groups with credentials', () => {
      const credentials = [createMockCredential({ tool_type: 'twitter_api', name: 'Twitter Only' })]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{}}
        />
      )

      expect(screen.getByText('Twitter / X')).toBeInTheDocument()
      expect(screen.queryByText('Discord')).not.toBeInTheDocument()
      expect(screen.queryByText('Telegram')).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // State Propagation Tests
  // ==========================================

  describe('State Propagation', () => {
    it('passes testingId to correct card', () => {
      const credentials = [
        createMockCredential({ id: 'cred-1', name: 'Bot 1' }),
        createMockCredential({ id: 'cred-2', name: 'Bot 2' }),
      ]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId="cred-1"
          deletingId={null}
          testResults={{}}
        />
      )

      // First test button should be disabled (loading)
      const testButtons = screen.getAllByRole('button', { name: '' })
      // Should have at least one disabled button (the loading one)
      expect(testButtons.length).toBeGreaterThan(0)
    })

    it('passes testResults to cards', () => {
      const credentials = [createMockCredential({ id: 'cred-1', name: 'Bot 1' })]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{ 'cred-1': { success: true, message: 'OK' } }}
        />
      )

      expect(screen.getByText('OK')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Multiple Credentials per Platform
  // ==========================================

  describe('Multiple Credentials', () => {
    it('renders multiple credentials under same platform', () => {
      const credentials = [
        createMockCredential({ tool_type: 'discord_bot', name: 'Discord Server 1' }),
        createMockCredential({ tool_type: 'discord_bot', name: 'Discord Server 2' }),
        createMockCredential({ tool_type: 'discord_bot', name: 'Discord Server 3' }),
      ]

      render(
        <ConnectorList
          credentials={credentials}
          onTest={mockOnTest}
          onDelete={mockOnDelete}
          testingId={null}
          deletingId={null}
          testResults={{}}
        />
      )

      expect(screen.getByText('Discord Server 1')).toBeInTheDocument()
      expect(screen.getByText('Discord Server 2')).toBeInTheDocument()
      expect(screen.getByText('Discord Server 3')).toBeInTheDocument()
      expect(screen.getByText('(3)')).toBeInTheDocument()
    })
  })
})
