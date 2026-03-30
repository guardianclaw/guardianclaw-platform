'use client'

/**
 * API Key Section Component
 *
 * Displays and manages API keys for an agent.
 * Includes list of keys, create button, and revoke functionality.
 */

import { Key, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApiKeyInfo } from '@/lib/api'

// ============================================
// TYPES
// ============================================

export interface ApiKeySectionProps {
  /** List of API keys */
  apiKeys: ApiKeyInfo[]
  /** Maximum number of keys allowed */
  maxKeys?: number
  /** Handler for creating a new key */
  onCreateKey: () => void
  /** Handler for revoking a key */
  onRevokeKey: (keyId: string) => void
}

// ============================================
// HELPERS
// ============================================

function formatLastUsed(dateString: string | null): string {
  if (!dateString) return 'Never used'
  try {
    return `Last used: ${new Date(dateString).toLocaleDateString()}`
  } catch {
    return 'Invalid date'
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface ApiKeyItemProps {
  apiKey: ApiKeyInfo
  onRevoke: () => void
}

function ApiKeyItem({ apiKey, onRevoke }: ApiKeyItemProps) {
  return (
    <div
      className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
      role="listitem"
      aria-label={`API key ${apiKey.name}`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{apiKey.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{apiKey.key_prefix}...</p>
        </div>
        <Badge
          variant="secondary"
          className="text-xs"
          aria-label={`Rate limit: ${apiKey.rate_limit} requests per minute`}
        >
          {apiKey.rate_limit} req/min
        </Badge>
        <span className="text-muted-foreground text-xs">{formatLastUsed(apiKey.last_used_at)}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive flex-shrink-0"
        onClick={onRevoke}
        aria-label={`Revoke API key ${apiKey.name}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ApiKeySection({
  apiKeys,
  maxKeys = 5,
  onCreateKey,
  onRevokeKey,
}: ApiKeySectionProps) {
  const canCreateMore = apiKeys.length < maxKeys

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" aria-hidden="true" />
              API Keys
            </CardTitle>
            <CardDescription>
              Manage API keys for this agent ({apiKeys.length}/{maxKeys})
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateKey}
            disabled={!canCreateMore}
            aria-label={canCreateMore ? 'Create new API key' : `Maximum ${maxKeys} keys reached`}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Key
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {apiKeys.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm" role="status">
            No API keys. Generate one to start making requests.
          </p>
        ) : (
          <div className="space-y-3" role="list" aria-label="API keys list">
            {apiKeys.map((key) => (
              <ApiKeyItem key={key.id} apiKey={key} onRevoke={() => onRevokeKey(key.id)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
