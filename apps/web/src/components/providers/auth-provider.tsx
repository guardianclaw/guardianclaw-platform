'use client'

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

// Skip auto-login if user explicitly cancelled within session
let userCancelledSession = false

interface Profile {
  wallet_address: string
  display_name: string | null
  avatar_url: string | null
  plan: 'free' | 'starter' | 'pro'
  plan_expires_at: string | null
  created_at: string
}

interface AuthContextType {
  token: string | null
  profile: Profile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  wallet: string | null
  connected: boolean
  login: () => Promise<string | null>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected, disconnect } = useWallet()
  const pathname = usePathname()
  const [token, setToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialCheckDone = useRef(false)
  const wasConnected = useRef(false)
  const loginAttemptRef = useRef(0)

  const isAuthenticated = !!token && !!profile

  // Check for existing session on mount via cookie (only once)
  useEffect(() => {
    if (initialCheckDone.current) return
    initialCheckDone.current = true

    const checkAuth = async () => {
      try {
        // Cookie is sent automatically with credentials: 'include'
        const res = await fetch(`${API_URL}/auth/me`, {
          credentials: 'include',
        })

        if (res.ok) {
          const data = await res.json()
          setToken('authenticated') // boolean flag, actual token is in httpOnly cookie
          setProfile(data.profile)
        } else if (res.status === 401) {
          console.log('Session expired or invalid')
        } else {
          console.log('Session validation failed, status:', res.status)
        }
      } catch (err) {
        console.log('Session check failed:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Listen for token expiration events from api.ts (401 responses)
  useEffect(() => {
    const handleTokenExpired = () => {
      setToken(null)
      setProfile(null)
      setIsLoading(false)
    }
    window.addEventListener('claw:token-expired', handleTokenExpired)
    return () => window.removeEventListener('claw:token-expired', handleTokenExpired)
  }, [])

  // Track wallet connection state and handle explicit disconnect.
  // When the user disconnects via wallet UI, clear the session after a short
  // delay to avoid clearing during transient disconnects (route navigation).
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (connected) {
      wasConnected.current = true
      // Cancel pending disconnect cleanup — wallet reconnected
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = null
      }
    } else if (wasConnected.current && token) {
      // Wallet went from connected → disconnected while authenticated.
      // Wait briefly to distinguish explicit disconnect from navigation transient.
      disconnectTimer.current = setTimeout(() => {
        // Still disconnected after delay — treat as explicit user disconnect
        if (!disconnectTimer.current) return
        console.log('Wallet disconnected, clearing session')
        setToken(null)
        setProfile(null)
        wasConnected.current = false
        loginAttemptRef.current = 0
        disconnectTimer.current = null
      }, 2000)
    }

    return () => {
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current)
        disconnectTimer.current = null
      }
    }
  }, [connected, token])

  // Detect wallet change - if user connects a different wallet than the authenticated one,
  // clear the session to prevent confusion (profile shows wallet A, connected wallet is B).
  //
  // IMPORTANT: We do NOT clear the session when wallet merely disconnects.
  // The JWT token is valid independently of wallet connection state.
  // Token expiration is handled by the backend (1h TTL).
  // Users who want to fully logout should use the explicit logout function.
  useEffect(() => {
    // Only check when we have both an authenticated profile and a connected wallet
    if (profile && connected && publicKey) {
      const connectedWallet = publicKey.toBase58()
      const profileWallet = profile.wallet_address

      // If the connected wallet doesn't match the authenticated profile, clear session
      if (connectedWallet !== profileWallet) {
        console.log('Wallet mismatch detected: connected wallet differs from authenticated profile')
        setToken(null)
        setProfile(null)
        wasConnected.current = false
        loginAttemptRef.current = 0
      }
    }
  }, [profile, connected, publicKey])

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError('Wallet not connected or does not support signing')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      // 1. Get nonce from server
      const nonceRes = await fetch(`${API_URL}/auth/nonce?wallet=${publicKey.toBase58()}`, {
        credentials: 'include',
      })

      if (!nonceRes.ok) {
        const errorData = await nonceRes.json()
        throw new Error(errorData.error || 'Failed to get nonce')
      }

      const { nonce, message } = await nonceRes.json()

      // 2. Sign the message with wallet
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase58 = bs58.encode(signature)

      // 3. Verify signature and get JWT (cookie set automatically via Set-Cookie)
      const verifyRes = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          signature: signatureBase58,
          nonce,
          message,
        }),
      })

      if (!verifyRes.ok) {
        const errorData = await verifyRes.json()
        throw new Error(errorData.error || 'Verification failed')
      }

      await verifyRes.json()

      // 4. Get user profile (cookie sent automatically)
      const profileRes = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      })

      const { profile: newProfile } = await profileRes.json()

      // 5. Update state (token lives in httpOnly cookie)
      setToken('authenticated')
      setProfile(newProfile)
      setError(null)

      return 'authenticated'
    } catch (err) {
      let errorMessage = 'Authentication failed'

      if (err instanceof Error) {
        // Handle wallet-specific errors with user-friendly messages
        if (err.name === 'WalletSignMessageError' || err.message.includes('JSON-RPC')) {
          errorMessage =
            'Wallet signing failed. Please disconnect and reconnect your wallet, or try refreshing the page.'
        } else if (err.message.includes('User rejected')) {
          errorMessage = 'Signature request was rejected'
          userCancelledSession = true
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, signMessage])

  // Auto-login when wallet connects (only in /app/* routes)
  // Includes a 10s timeout — if signing takes too long, fall back to manual
  const [autoConnectTimedOut, setAutoConnectTimedOut] = useState(false)

  useEffect(() => {
    const isAppRoute = pathname?.startsWith('/app')

    if (
      connected &&
      !isAuthenticated &&
      !isLoading &&
      signMessage &&
      !userCancelledSession &&
      !autoConnectTimedOut &&
      isAppRoute &&
      loginAttemptRef.current < 2
    ) {
      let aborted = false

      // 10s timeout for the entire auto-login flow
      const timeoutId = setTimeout(() => {
        if (!aborted) {
          setAutoConnectTimedOut(true)
          setIsLoading(false)
          console.warn('Auto-connect timed out after 10s')
        }
      }, 10_000)

      // Small delay to ensure wallet is fully ready
      const delayId = setTimeout(() => {
        if (connected && !isAuthenticated && !aborted) {
          loginAttemptRef.current += 1
          login()
            .then((result) => {
              if (result) {
                loginAttemptRef.current = 0
              }
            })
            .catch(() => {
              userCancelledSession = true
            })
            .finally(() => {
              clearTimeout(timeoutId)
            })
        }
      }, 300)

      return () => {
        aborted = true
        clearTimeout(delayId)
        clearTimeout(timeoutId)
      }
    }
  }, [connected, isAuthenticated, isLoading, signMessage, login, pathname, autoConnectTimedOut])

  const logout = useCallback(async () => {
    // Call logout endpoint to clear httpOnly cookie server-side
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Best-effort — cookie will expire on its own
    }
    setToken(null)
    setProfile(null)
    setError(null)
    await disconnect()
  }, [disconnect])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        token,
        profile,
        isAuthenticated,
        isLoading,
        error,
        wallet: publicKey?.toBase58() || null,
        connected,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
