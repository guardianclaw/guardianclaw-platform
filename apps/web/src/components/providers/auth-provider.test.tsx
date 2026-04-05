/**
 * Auth Provider Tests
 *
 * Tests for session persistence and wallet mismatch detection.
 * Auth is now cookie-based (httpOnly) — no localStorage involved.
 *
 * These tests verify that:
 * 1. Session is restored from cookie on mount (via /auth/me)
 * 2. Session is cleared when a different wallet connects
 * 3. Logout clears session state and calls server-side cookie clear
 * 4. Token expiration (401 from /auth/me) clears auth state
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

    // Reset wallet state
    mockWalletState.publicKey = null
    mockWalletState.connected = false
    mockWalletState.signMessage = vi.fn()
    mockWalletState.disconnect = vi.fn()

    // Default fetch mock — no valid session
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
    it('should start with isAuthenticated false when no session cookie exists', async () => {
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

    it('should restore session from cookie on mount', async () => {
      const walletAddress = 'TestWallet123456789'

      // Mock successful /auth/me response (cookie sent automatically)
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
      expect(authState?.token).toBe('authenticated')
      expect(authState?.profile?.wallet_address).toBe(walletAddress)
    })
  })

  describe('Wallet Disconnect Behavior', () => {
    it('should NOT immediately clear session when wallet disconnects', async () => {
      const walletAddress = 'TestWallet123456789'

      // Set up authenticated state via cookie
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true

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

      // Token should still exist (disconnect timer is 2s)
      expect(authState?.token).toBe('authenticated')
    })

    it('should maintain session during temporary wallet disconnect (navigation)', async () => {
      const walletAddress = 'TestWallet123456789'

      // Set up authenticated state via cookie
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true

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
      expect(authState?.token).toBe('authenticated')
    })
  })

  describe('Wallet Mismatch Detection', () => {
    it('should clear session when a different wallet connects', async () => {
      const originalWallet = 'OriginalWallet123'
      const differentWallet = 'DifferentWallet456'

      // Set up authenticated state with original wallet
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(originalWallet)),
      })

      mockWalletState.publicKey = createMockPublicKey(originalWallet)
      mockWalletState.connected = true

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

      expect(authState?.token).toBeNull()
      expect(authState?.profile).toBeNull()
    })

    it('should NOT clear session when same wallet reconnects', async () => {
      const walletAddress = 'TestWallet123456789'

      // Set up authenticated state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true

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
      expect(authState?.token).toBe('authenticated')
    })
  })

  describe('Explicit Logout', () => {
    it('should clear all session data on logout', async () => {
      const walletAddress = 'TestWallet123456789'

      // Set up authenticated state
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createMockProfileResponse(walletAddress)),
      })

      mockWalletState.publicKey = createMockPublicKey(walletAddress)
      mockWalletState.connected = true
      mockWalletState.disconnect = vi.fn().mockResolvedValue(undefined)

      let authState: ReturnType<typeof useAuth> | null = null
      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isAuthenticated).toBe(true)
      })

      // Mock the logout endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      // Call logout
      await act(async () => {
        await authState?.logout()
      })

      // Everything should be cleared
      expect(authState?.token).toBeNull()
      expect(authState?.profile).toBeNull()
      expect(authState?.isAuthenticated).toBe(false)
      expect(mockWalletState.disconnect).toHaveBeenCalled()

      // Should have called /auth/logout to clear httpOnly cookie
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      )
    })
  })

  describe('Token Expiration Handling', () => {
    it('should not authenticate on 401 from auth/me (expired cookie)', async () => {
      // Mock /auth/me returning 401 (cookie expired)
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

      // isAuthenticated should be false (no valid session)
      expect(authState?.isAuthenticated).toBe(false)
      expect(authState?.token).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      let authState: ReturnType<typeof useAuth> | null = null
      renderWithAuth((auth) => {
        authState = auth
      })

      await waitFor(() => {
        expect(authState?.isLoading).toBe(false)
      })

      // Should not crash, no authentication
      expect(authState?.isAuthenticated).toBe(false)
    })
  })
})
