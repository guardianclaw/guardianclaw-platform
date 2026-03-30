'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Key, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/components/providers/auth-provider'
import {
  encryptApiKey,
  getKeyEncryptionMessage,
  validateApiKeyFormat,
  LLM_PROVIDERS,
  type LLMProvider,
} from '@/lib/key-encryption'

interface StoredKey {
  id: string
  provider: string
  name: string
  key_preview: string
  created_at: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

export function ApiKeysManager() {
  const { publicKey, signMessage, connected } = useWallet()
  const { token, isAuthenticated } = useAuth()

  const [keys, setKeys] = useState<StoredKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add key dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newKeyProvider, setNewKeyProvider] = useState<LLMProvider>('openai')
  const [newKeyName, setNewKeyName] = useState('Default')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [addingKey, setAddingKey] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [validatingKey, setValidatingKey] = useState(false)
  const [keyValidated, setKeyValidated] = useState(false)

  // Delete dialog
  const [keyToDelete, setKeyToDelete] = useState<StoredKey | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch keys
  const fetchKeys = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/llm-keys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch keys')
      }

      const data = await response.json()
      setKeys(data.keys || [])
    } catch (err) {
      setError('Failed to load API keys')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchKeys()
    }
  }, [isAuthenticated, token, fetchKeys])

  // Add new key
  const handleAddKey = async () => {
    if (!signMessage || !publicKey || !token) {
      setAddError('Wallet not connected')
      return
    }

    // Validate key format
    const formatValidation = validateApiKeyFormat(newKeyProvider, newKeyValue)
    if (!formatValidation.valid) {
      setAddError(formatValidation.error || 'Invalid key format')
      return
    }

    setAddingKey(true)
    setAddError(null)
    setValidatingKey(true)
    setKeyValidated(false)

    try {
      // Validate key with provider API
      const providerValidation = await validateApiKeyWithProvider(
        newKeyProvider,
        newKeyValue.trim()
      )

      setValidatingKey(false)

      if (!providerValidation.valid) {
        setAddError(providerValidation.error || 'API key validation failed')
        setAddingKey(false)
        return
      }

      setKeyValidated(true)

      // Request wallet signature for encryption
      const message = getKeyEncryptionMessage()
      const encodedMessage = new TextEncoder().encode(message)
      const signature = await signMessage(encodedMessage)

      // Encrypt the key client-side
      const encrypted = await encryptApiKey(newKeyValue.trim(), signature)

      // Send encrypted key to server
      const response = await fetch(`${API_URL}/llm-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: newKeyProvider,
          name: newKeyName.trim() || 'Default',
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
          key_preview: encrypted.key_preview,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save key')
      }

      // Success - refresh list and close dialog
      await fetchKeys()
      setShowAddDialog(false)
      setNewKeyValue('')
      setNewKeyName('Default')
      setKeyValidated(false)
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('User rejected')) {
          setAddError('Signature request was rejected')
        } else {
          setAddError(err.message)
        }
      } else {
        setAddError('Failed to add key')
      }
    } finally {
      setAddingKey(false)
      setValidatingKey(false)
    }
  }

  // Delete key
  const handleDeleteKey = async () => {
    if (!keyToDelete || !token) return

    setDeleting(true)

    try {
      const response = await fetch(`${API_URL}/llm-keys/${keyToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete key')
      }

      await fetchKeys()
      setKeyToDelete(null)
    } catch (err) {
      console.error('Failed to delete key:', err)
    } finally {
      setDeleting(false)
    }
  }

  // Validate API key with a test call to the provider
  const validateApiKeyWithProvider = async (
    provider: LLMProvider,
    apiKey: string
  ): Promise<{ valid: boolean; error?: string }> => {
    try {
      switch (provider) {
        case 'openai': {
          // Test with OpenAI models endpoint (minimal cost)
          const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          })
          if (response.status === 401) {
            return { valid: false, error: 'Invalid API key' }
          }
          if (response.status === 403) {
            return { valid: false, error: 'API key lacks required permissions' }
          }
          if (!response.ok) {
            return { valid: false, error: `API error: ${response.status}` }
          }
          return { valid: true }
        }

        case 'anthropic': {
          // Test with Anthropic models endpoint
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
          })
          // 400 or 200 means key is valid (400 if we hit limits or model issues)
          if (response.status === 401) {
            return { valid: false, error: 'Invalid API key' }
          }
          if (response.status === 403) {
            return { valid: false, error: 'API key lacks required permissions' }
          }
          // Any other response means key works
          return { valid: true }
        }

        case 'openrouter': {
          // Test with OpenRouter models endpoint
          const response = await fetch('https://openrouter.ai/api/v1/models', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          })
          if (response.status === 401) {
            return { valid: false, error: 'Invalid API key' }
          }
          if (!response.ok) {
            return { valid: false, error: `API error: ${response.status}` }
          }
          return { valid: true }
        }

        default:
          // For unknown providers, skip validation
          return { valid: true }
      }
    } catch (err) {
      // Network error - could be CORS or connectivity issue
      // For production, validation should happen server-side
      console.warn('Key validation network error:', err)
      // Allow save anyway since validation is best-effort client-side
      return { valid: true }
    }
  }

  // Get provider display info
  const getProviderLabel = (provider: string) => {
    return LLM_PROVIDERS.find((p) => p.value === provider)?.label || provider
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <AlertCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-medium">Authentication Required</h3>
        <p className="text-muted-foreground">Connect your wallet to manage API keys.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">LLM API Keys</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Your keys are encrypted client-side. We never see your plaintext keys.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} disabled={!connected}>
          <Plus className="mr-2 h-4 w-4" />
          Add Key
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Keys List */}
      {!loading && keys.length === 0 && (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Key className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">No API Keys</h3>
          <p className="text-muted-foreground mb-4">
            Add your LLM API keys to use your own models when testing agents.
          </p>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Key
          </Button>
        </div>
      )}

      {!loading && keys.length > 0 && (
        <div className="divide-y rounded-lg border">
          {keys.map((key) => (
            <div key={key.id} className="hover:bg-muted/50 flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Key className="text-primary h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">
                    {getProviderLabel(key.provider)}
                    {key.name !== 'Default' && (
                      <span className="text-muted-foreground ml-2">({key.name})</span>
                    )}
                  </div>
                  <div className="text-muted-foreground font-mono text-sm">{key.key_preview}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  Added {new Date(key.created_at).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setKeyToDelete(key)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Key Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Your key will be encrypted using your wallet signature. Only you can decrypt it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {addError && (
              <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
                {addError}
              </div>
            )}

            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={newKeyProvider}
                onValueChange={(v) => setNewKeyProvider(v as LLMProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                placeholder="Default"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Use different names if you have multiple keys per provider
              </p>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={
                  LLM_PROVIDERS.find((p) => p.value === newKeyProvider)?.placeholder ||
                  'Enter your API key'
                }
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
              />
            </div>

            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />
                <div>
                  <p className="font-medium">Zero-Knowledge Encryption</p>
                  <p className="text-muted-foreground">
                    Your key is encrypted in your browser using your wallet signature. Our servers
                    only store encrypted data.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddKey} disabled={!newKeyValue.trim() || addingKey}>
              {validatingKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : addingKey && keyValidated ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Encrypting...
                </>
              ) : addingKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Validate & Add Key'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!keyToDelete} onOpenChange={() => setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your {keyToDelete?.provider} key
              {keyToDelete?.name !== 'Default' && ` (${keyToDelete?.name})`}. Agents using this key
              will fall back to simulation mode.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
