/**
 * API Key Section Component Tests
 *
 * Unit tests for the ApiKeySection component.
 * Tests rendering, key management, limits, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ApiKeySection } from './api-key-section'
import type { ApiKeyInfo } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockApiKey(overrides: Partial<ApiKeyInfo> = {}): ApiKeyInfo {
  return {
    id: 'key-' + Math.random().toString(36).substring(2, 9),
    name: 'Test API Key',
    key_prefix: 'sk_live_abc123',
    rate_limit: 100,
    is_active: true,
    last_used_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockApiKeys(count: number): ApiKeyInfo[] {
  return Array.from({ length: count }, (_, i) =>
    createMockApiKey({
      name: `API Key ${i + 1}`,
      key_prefix: `sk_live_${i}abc`,
    })
  )
}

// ============================================
// TEST SUITES
// ============================================

describe('ApiKeySection', () => {
  const mockOnCreateKey = vi.fn()
  const mockOnRevokeKey = vi.fn()

  const defaultProps = {
    apiKeys: [] as ApiKeyInfo[],
    onCreateKey: mockOnCreateKey,
    onRevokeKey: mockOnRevokeKey,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders API Keys title', () => {
      render(<ApiKeySection {...defaultProps} />)

      expect(screen.getByText('API Keys')).toBeInTheDocument()
    })

    it('shows empty state when no keys', () => {
      render(<ApiKeySection {...defaultProps} />)

      expect(screen.getByText(/no api keys/i)).toBeInTheDocument()
    })

    it('renders list of keys', () => {
      const apiKeys = createMockApiKeys(3)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getAllByRole('listitem')).toHaveLength(3)
    })

    it('shows key count', () => {
      const apiKeys = createMockApiKeys(2)
      const { container } = render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      // Check description text contains the count
      const description = container.querySelector('.text-muted-foreground')
      expect(description?.textContent).toContain('2/5')
    })

    it('shows custom max keys', () => {
      const apiKeys = createMockApiKeys(3)
      const { container } = render(
        <ApiKeySection {...defaultProps} apiKeys={apiKeys} maxKeys={10} />
      )

      // Check description text contains the count
      const description = container.querySelector('.text-muted-foreground')
      expect(description?.textContent).toContain('3/10')
    })

    it('renders New Key button', () => {
      render(<ApiKeySection {...defaultProps} />)

      expect(screen.getByRole('button', { name: /create new api key/i })).toBeInTheDocument()
    })
  })

  // ==========================================
  // Key Item Display Tests
  // ==========================================

  describe('Key Item Display', () => {
    it('displays key name', () => {
      const apiKeys = [createMockApiKey({ name: 'Production Key' })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByText('Production Key')).toBeInTheDocument()
    })

    it('displays key prefix', () => {
      const apiKeys = [createMockApiKey({ key_prefix: 'sk_live_xyz789' })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByText('sk_live_xyz789...')).toBeInTheDocument()
    })

    it('displays rate limit badge', () => {
      const apiKeys = [createMockApiKey({ rate_limit: 200 })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByText('200 req/min')).toBeInTheDocument()
    })

    it('displays "Never used" when last_used_at is null', () => {
      const apiKeys = [createMockApiKey({ last_used_at: null })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByText('Never used')).toBeInTheDocument()
    })

    it('displays last used date when available', () => {
      const apiKeys = [createMockApiKey({ last_used_at: '2024-01-15T10:30:00Z' })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByText(/Last used:/)).toBeInTheDocument()
    })

    it('displays revoke button for each key', () => {
      const apiKeys = createMockApiKeys(2)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i })
      expect(revokeButtons).toHaveLength(2)
    })
  })

  // ==========================================
  // Create Key Tests
  // ==========================================

  describe('Create Key', () => {
    it('calls onCreateKey when New Key button clicked', () => {
      render(<ApiKeySection {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /create new api key/i }))

      expect(mockOnCreateKey).toHaveBeenCalledTimes(1)
    })

    it('enables New Key button when under limit', () => {
      const apiKeys = createMockApiKeys(3)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      const button = screen.getByRole('button', { name: /create new api key/i })
      expect(button).not.toBeDisabled()
    })

    it('disables New Key button when at limit', () => {
      const apiKeys = createMockApiKeys(5)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      const button = screen.getByRole('button', { name: /maximum/i })
      expect(button).toBeDisabled()
    })

    it('respects custom maxKeys for limit', () => {
      const apiKeys = createMockApiKeys(3)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} maxKeys={3} />)

      const button = screen.getByRole('button', { name: /maximum/i })
      expect(button).toBeDisabled()
    })
  })

  // ==========================================
  // Revoke Key Tests
  // ==========================================

  describe('Revoke Key', () => {
    it('calls onRevokeKey with correct key id when revoke button clicked', () => {
      const apiKeys = [createMockApiKey({ id: 'key-to-revoke' })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      fireEvent.click(screen.getByRole('button', { name: /revoke/i }))

      expect(mockOnRevokeKey).toHaveBeenCalledWith('key-to-revoke')
    })

    it('calls correct onRevokeKey for multiple keys', () => {
      const apiKeys = [
        createMockApiKey({ id: 'key-1', name: 'Key 1' }),
        createMockApiKey({ id: 'key-2', name: 'Key 2' }),
      ]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      const items = screen.getAllByRole('listitem')
      const secondRevokeButton = within(items[1]).getByRole('button', { name: /revoke/i })
      fireEvent.click(secondRevokeButton)

      expect(mockOnRevokeKey).toHaveBeenCalledWith('key-2')
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible list container', () => {
      const apiKeys = createMockApiKeys(2)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByRole('list', { name: /api keys list/i })).toBeInTheDocument()
    })

    it('has accessible list items', () => {
      const apiKeys = [createMockApiKey({ name: 'My Key' })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByRole('listitem', { name: /api key my key/i })).toBeInTheDocument()
    })

    it('has accessible New Key button when enabled', () => {
      render(<ApiKeySection {...defaultProps} />)

      expect(screen.getByRole('button', { name: /create new api key/i })).toBeInTheDocument()
    })

    it('has accessible New Key button when disabled', () => {
      const apiKeys = createMockApiKeys(5)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByRole('button', { name: /maximum 5 keys reached/i })).toBeInTheDocument()
    })

    it('has accessible revoke button with key name', () => {
      const apiKeys = [createMockApiKey({ name: 'Production' })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByRole('button', { name: /revoke api key production/i })).toBeInTheDocument()
    })

    it('has accessible rate limit badge', () => {
      const apiKeys = [createMockApiKey({ rate_limit: 150 })]
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByLabelText(/rate limit: 150 requests per minute/i)).toBeInTheDocument()
    })

    it('uses status role for empty state', () => {
      render(<ApiKeySection {...defaultProps} />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('hides decorative icons from screen readers', () => {
      const apiKeys = createMockApiKeys(1)
      const { container } = render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      const icons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Multiple Keys Tests
  // ==========================================

  describe('Multiple Keys', () => {
    it('renders all keys', () => {
      const apiKeys = createMockApiKeys(4)
      render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      expect(screen.getByText('API Key 1')).toBeInTheDocument()
      expect(screen.getByText('API Key 2')).toBeInTheDocument()
      expect(screen.getByText('API Key 3')).toBeInTheDocument()
      expect(screen.getByText('API Key 4')).toBeInTheDocument()
    })

    it('updates count correctly', () => {
      const apiKeys = createMockApiKeys(4)
      const { container } = render(<ApiKeySection {...defaultProps} apiKeys={apiKeys} />)

      // Check description text contains the count
      const description = container.querySelector('.text-muted-foreground')
      expect(description?.textContent).toContain('4/5')
    })
  })
})
