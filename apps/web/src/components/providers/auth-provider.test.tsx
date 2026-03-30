/**
 * Auth Provider Tests
 *
 * Tests for session persistence and wallet mismatch detection.
 * These tests verify that:
 * 1. Token persists when wallet temporarily disconnects (navigation)
 * 2. Session is cleared when a different wallet connects
 * 3. Logout explicitly clears all session data
 * 4. Token is restored from localStorage on mount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './auth-provider'
import { ReactNode } from 'react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/builder',
}))

// Mock wallet state
const mockWalletState = {
  publicKey: null as { toBase58: () => string } | null,
  signMessage: vi.fn(),
  connected: false,
  disconnect: vi.fn(),
}

// Mock @solana/wallet-adapter-react
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mockWalletState,
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Test component to access auth context
function TestConsumer({ onAuth }: { onAuth: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth()
  onAuth(auth)
  return (
    <div>
      <span data-testid="authenticated">{auth.isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="token">{auth.token || 'none'}</span>
      <span data-testid="wallet">{auth.profile?.wallet_address || 'none'}</span>
    </div>
  )
}

// Wrapper for rendering with AuthProvider
function renderWithAuth(onAuth: (auth: ReturnType<typeof useAuth>) => void) {
  return render(
    <AuthProvider>
      <TestConsumer onAuth={onAuth} />
    </AuthProvider>
  )
}

// Helper to create mock public key
function createMockPublicKey(address: string) {
  return {
    toBase58: () => address,
  }
}

// Helper to create mock profile response
function createMockProfileResponse(walletAddress: string) {
  return {
    profile: {
      wallet_address: walletAddress,
      display_name: null,
      avatar_url: null,
      plan: 'free' as const,
      plan_expires_at: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  }
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()

    // Reset wallet state
    mockWalletState.publicKey = null
    mockWalletState.connected = false
    mockWalletState.signMessage = vi.fn()
    mockWalletState.disconnect = vi.fn()

    // Default fetch mock
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should start with isAuthenticated false when no token exists', async () => {
      let authState: ReturnType<typeof useAuth> | null = null

      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isLoading).toBe(false)
      })

      expect(authState?.isAuthenticated).toBe(false)
      expect(authState?.token).toBeNull()
      expect(authState?.profile).toBeNull()
    })

    it('should restore session from localStorage on mount', async () => {
      const walletAddress = 'TestWallet123456789'
      const savedToken = 'valid-jwt-token'

      // Set up localStorage with existing token
      localStorageMock.setItem('claw_token', savedToken)

      // Mock successful /auth/me response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      let authState: ReturnType<typeof useAuth> | null = null

      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isLoading).toBe(false)
      })

      expect(authState?.isAuthenticated).toBe(true)
      expect(authState?.token).toBe(savedToken)
      expect(authState?.profile?.wallet_address).toBe(walletAddress)
    })
  })

  describe('Wallet Disconnect Behavior', () => {
    it('should NOT clear token when wallet disconnects', async () => {
      const walletAddress = 'TestWallet123456789'
      const savedToken = 'valid-jwt-token'

      // Set up authenticated state
      localStorageMock.setItem('claw_token', savedToken)
      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      let authState: ReturnType<typeof useAuth> | null = null
      const { rerender } = renderWithAuth((auth) => {
        authState = auth
      })

      // Wait for initial auth check
      await waitFor(() => {
        expect(authState?.isAuthenticated).toBe(true)
      })

      // Simulate wallet disconnect
      mockWalletState.publicKey = null
      mockWalletState.connected = false

      // Force re-render to trigger useEffect
      rerender(
        <AuthProvider>
          <TestConsumer
            onAuth={(auth) => {
              authState = auth
            }}
          />
        </AuthProvider>
      )

      // Token should still exist
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('claw_token')
      expect(authState?.token).toBe(savedToken)
    })

    it('should maintain session during temporary wallet disconnect (navigation)', async () => {
      const walletAddress = 'TestWallet123456789'
      const savedToken = 'valid-jwt-token'

      // Set up authenticated state
      localStorageMock.setItem('claw_token', savedToken)
      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      let authState: ReturnType<typeof useAuth> | null = null
      const { rerender } = renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isAuthenticated).toBe(true)
      })

      // Simulate temporary disconnect (like during navigation)
      mockWalletState.connected = false
      mockWalletState.publicKey = null

      rerender(
        <AuthProvider>
          <TestConsumer
            onAuth={(auth) => {
              authState = auth
            }}
          />
        </AuthProvider>
      )

      // Wait a bit (simulating navigation time)
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Reconnect wallet (same wallet)
      mockWalletState.connected = true
      mockWalletState.publicKey = createMockPublicKey(walletAddress)

      rerender(
        <AuthProvider>
          <TestConsumer
            onAuth={(auth) => {
              authState = auth
            }}
          />
        </AuthProvider>
      )

      // Session should still be valid
      expect(authState?.token).toBe(savedToken)
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('claw_token')
    })
  })

  describe('Wallet Mismatch Detection', () => {
    it('should clear session when a different wallet connects', async () => {
      const originalWallet = 'OriginalWallet123'
      const differentWallet = 'DifferentWallet456'
      const savedToken = 'valid-jwt-token'

      // Set up authenticated state with original wallet
      localStorageMock.setItem('claw_token', savedToken)
      mockWalletState.publicKey = createMockPublicKey(originalWallet)
      mockWalletState.connected = true

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(originalWallet)),
      })

      let authState: ReturnType<typeof useAuth> | null = null
      const { rerender } = renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isAuthenticated).toBe(true)
        expect(authState?.profile?.wallet_address).toBe(originalWallet)
      })

      // Connect a DIFFERENT wallet
      mockWalletState.publicKey = createMockPublicKey(differentWallet)
      mockWalletState.connected = true

      rerender(
        <AuthProvider>
          <TestConsumer
            onAuth={(auth) => {
              authState = auth
            }}
          />
        </AuthProvider>
      )

      await waitFor(() => {
        // Session should be cleared due to wallet mismatch
        expect(authState?.isAuthenticated).toBe(false)
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claw_token')
      expect(authState?.token).toBeNull()
      expect(authState?.profile).toBeNull()
    })

    it('should NOT clear session when same wallet reconnects', async () => {
      const walletAddress = 'TestWallet123456789'
      const savedToken = 'valid-jwt-token'

      // Set up authenticated state
      localStorageMock.setItem('claw_token', savedToken)
      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      let authState: ReturnType<typeof useAuth> | null = null
      const { rerender } = renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isAuthenticated).toBe(true)
      })

      // Disconnect
      mockWalletState.connected = false
      mockWalletState.publicKey = null

      rerender(
        <AuthProvider>
          <TestConsumer
            onAuth={(auth) => {
              authState = auth
            }}
          />
        </AuthProvider>
      )

      // Reconnect with SAME wallet
      mockWalletState.connected = true
      mockWalletState.publicKey = createMockPublicKey(walletAddress)

      rerender(
        <AuthProvider>
          <TestConsumer
            onAuth={(auth) => {
              authState = auth
            }}
          />
        </AuthProvider>
      )

      // Session should remain valid
      expect(authState?.token).toBe(savedToken)
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('claw_token')
    })
  })

  describe('Explicit Logout', () => {
    it('should clear all session data on logout', async () => {
      const walletAddress = 'TestWallet123456789'
      const savedToken = 'valid-jwt-token'

      // Set up authenticated state
      localStorageMock.setItem('claw_token', savedToken)
      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true
      mockWalletState.disconnect = vi.fn().mockResolvedValue(undefined)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      let authState: ReturnType<typeof useAuth> | null = null
      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isAuthenticated).toBe(true)
      })

      // Call logout
      await act(async () => {
        await authState?.logout()
      })

      // Everything should be cleared
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claw_token')
      expect(authState?.token).toBeNull()
      expect(authState?.profile).toBeNull()
      expect(authState?.isAuthenticated).toBe(false)
      expect(mockWalletState.disconnect).toHaveBeenCalled()
    })
  })

  describe('Token Expiration Handling', () => {
    it('should clear token on 401 from auth/me (expired token)', async () => {
      const savedToken = 'expired-jwt-token'

      // Set up localStorage with expired token
      localStorageMock.setItem('claw_token', savedToken)

      // Mock /auth/me returning 401 (token expired)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Token expired' }),
      })

      let authState: ReturnType<typeof useAuth> | null = null
      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isLoading).toBe(false)
      })

      // Token should be removed on 401 so stale tokens don't persist
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claw_token')

      // isAuthenticated should be false (profile is null)
      expect(authState?.isAuthenticated).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const savedToken = 'valid-jwt-token'
      localStorageMock.setItem('claw_token', savedToken)

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let authState: ReturnType<typeof useAuth> | null = null
      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isLoading).toBe(false)
      })

      // Should not crash, token kept for retry
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('claw_token')
    })
  })
})
