/**
 * Hook for managing LLM API key decryption
 *
 * Zero-Knowledge Implementation:
 * - Keys are stored encrypted on server
 * - Decryption requires wallet signature
 * - Decrypted key only exists in memory temporarily
 * - Key is never stored or logged
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAuth } from '@/components/providers/auth-provider'
import { decryptApiKey, getKeyEncryptionMessage, type EncryptedKey } from '@/lib/key-encryption'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

export interface LLMKeyInfo {
  id: string
  provider: string
  name: string
  key_preview: string
}

interface FullLLMKey extends LLMKeyInfo {
  ciphertext: string
  iv: string
  salt: string
}

interface UseLLMKeyResult {
  // Available keys (list only, no sensitive data)
  keys: LLMKeyInfo[]
  loadingKeys: boolean

  // Selected key
  selectedKeyId: string | null
  setSelectedKeyId: (id: string | null) => void

  // Decryption
  decryptKey: (keyId: string) => Promise<string | null>
  isDecrypting: boolean
  decryptionError: string | null

  // Cache control (key stays decrypted for session)
  cachedDecryptedKey: string | null
  clearCache: () => void

  // Helper to check if we have a usable key
  hasUsableKey: boolean
}

export function useLLMKey(): UseLLMKeyResult {
  const { publicKey, signMessage, connected } = useWallet()
  const { isAuthenticated } = useAuth()

  // Key list state
  const [keys, setKeys] = useState<LLMKeyInfo[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)

  // Selection state
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)

  // Decryption state
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptionError, setDecryptionError] = useState<string | null>(null)

  // Cache signature for session to avoid repeated sign requests
  const signatureCache = useRef<Uint8Array | null>(null)

  // Cache decrypted key for current session
  const [cachedDecryptedKey, setCachedDecryptedKey] = useState<string | null>(null)
  const cachedKeyId = useRef<string | null>(null)

  // Fetch available keys
  useEffect(() => {
    if (!isAuthenticated) {
      setKeys([])
      setLoadingKeys(false)
      return
    }

    const fetchKeys = async () => {
      setLoadingKeys(true)
      try {
        const response = await fetch(`${API_URL}/llm-keys`, {
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          setKeys(data.keys || [])

          // Auto-select first key if available
          if (data.keys?.length > 0 && !selectedKeyId) {
            setSelectedKeyId(data.keys[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch LLM keys:', err)
      } finally {
        setLoadingKeys(false)
      }
    }

    fetchKeys()
  }, [isAuthenticated, selectedKeyId])

  // Clear cache when wallet disconnects
  useEffect(() => {
    if (!connected) {
      signatureCache.current = null
      setCachedDecryptedKey(null)
      cachedKeyId.current = null
    }
  }, [connected])

  // Decrypt a specific key
  const decryptKey = useCallback(
    async (keyId: string): Promise<string | null> => {
      if (!signMessage || !publicKey || !isAuthenticated) {
        setDecryptionError('Wallet not connected')
        return null
      }

      // Return cached key if same key was previously decrypted
      if (cachedKeyId.current === keyId && cachedDecryptedKey) {
        return cachedDecryptedKey
      }

      setIsDecrypting(true)
      setDecryptionError(null)

      try {
        // Fetch full key data (including encrypted blob)
        const response = await fetch(`${API_URL}/llm-keys/${keyId}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch key data')
        }

        const { key: fullKey } = (await response.json()) as { key: FullLLMKey }

        // Get signature (use cached or request new)
        let signature = signatureCache.current

        if (!signature) {
          const message = getKeyEncryptionMessage()
          const encodedMessage = new TextEncoder().encode(message)
          signature = await signMessage(encodedMessage)
          signatureCache.current = signature
        }

        // Decrypt the key
        const encrypted: EncryptedKey = {
          ciphertext: fullKey.ciphertext,
          iv: fullKey.iv,
          salt: fullKey.salt,
          key_preview: fullKey.key_preview,
        }

        const decryptedKey = await decryptApiKey(encrypted, signature)

        // Cache the decrypted key for this session
        setCachedDecryptedKey(decryptedKey)
        cachedKeyId.current = keyId

        return decryptedKey
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Decryption failed'

        // Handle user rejection
        if (message.includes('User rejected')) {
          setDecryptionError('Signature request was rejected')
        } else if (message.includes('Decryption failed')) {
          // Clear signature cache if decryption fails (might be wrong signature)
          signatureCache.current = null
          setDecryptionError('Decryption failed. Please try signing again.')
        } else {
          setDecryptionError(message)
        }

        return null
      } finally {
        setIsDecrypting(false)
      }
    },
    [signMessage, publicKey, isAuthenticated, cachedDecryptedKey]
  )

  // Clear decryption cache
  const clearCache = useCallback(() => {
    signatureCache.current = null
    setCachedDecryptedKey(null)
    cachedKeyId.current = null
  }, [])

  return {
    keys,
    loadingKeys,
    selectedKeyId,
    setSelectedKeyId,
    decryptKey,
    isDecrypting,
    decryptionError,
    cachedDecryptedKey,
    clearCache,
    hasUsableKey: keys.length > 0 && !!selectedKeyId,
  }
}
