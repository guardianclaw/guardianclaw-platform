'use client'

/**
 * Connectors Page Client
 *
 * Manages social platform connections for agent output delivery.
 * Supports Discord, Twitter/X, and Telegram connectors.
 */

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Loader2, AlertCircle, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import { toolCredentialsApi, type ToolCredential } from '@/lib/api'
import { ConnectorList } from './components/connector-list'
import { EmptyState } from './components/empty-state'
import { AddConnectorDialog } from './components/add-connector-dialog'

// Social connector tool types
const SOCIAL_TOOL_TYPES = ['twitter_api', 'discord_bot', 'telegram_bot'] as const
type SocialToolType = (typeof SOCIAL_TOOL_TYPES)[number]

// Filter for social credentials only
function isSocialCredential(credential: ToolCredential): boolean {
  return SOCIAL_TOOL_TYPES.includes(credential.tool_type as SocialToolType)
}

export function ConnectorsPageClient() {
  const { agent, isDemo } = useAgent()

  // Data state
  const [credentials, setCredentials] = useState<ToolCredential[]>([])

  // Loading states
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  // Operation states
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Load credentials
  const fetchCredentials = useCallback(
    async (isRefresh = false) => {
      if (isDemo) {
        setLoading(false)
        return
      }

      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        // Fetch all credentials (API doesn't support multiple tool_type filter)
        const response = await toolCredentialsApi.list()
        // Filter to only social connectors
        const socialCredentials = (response.credentials || []).filter(isSocialCredential)
        setCredentials(socialCredentials)
      } catch (err) {
        console.error('Failed to fetch credentials:', err)
        setError('Failed to load connectors')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [isDemo]
  )

  // Initial load
  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  // Handle test connector
  const handleTest = useCallback(async (id: string) => {
    setTestingId(id)
    setTestResults((prev) => ({
      ...prev,
      [id]: undefined as unknown as { success: boolean; message: string },
    }))

    try {
      const result = await toolCredentialsApi.test(id)
      setTestResults((prev) => ({
        ...prev,
        [id]: {
          success: result.success,
          message: result.message || (result.success ? 'Connection successful' : 'Test failed'),
        },
      }))
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Test failed'
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: errorMessage },
      }))
    } finally {
      setTestingId(null)
    }
  }, [])

  // Handle delete connector
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)

    try {
      await toolCredentialsApi.delete(id)
      setCredentials((prev) => prev.filter((c) => c.id !== id))
      // Clear test result for deleted credential
      setTestResults((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      console.error('Failed to delete connector:', err)
      // Show error in test results area
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: 'Failed to delete connector' },
      }))
    } finally {
      setDeletingId(null)
    }
  }, [])

  // Handle add success
  const handleAddSuccess = useCallback(() => {
    fetchCredentials(true)
    setAddDialogOpen(false)
  }, [fetchCredentials])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchCredentials(true)
  }, [fetchCredentials])

  // Demo mode message
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <Plug className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Connectors Not Available</h2>
          <p className="text-muted-foreground">
            Sign in to connect your social platforms (Discord, Twitter, Telegram) to your agents.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Connectors</h1>
              <p className="text-muted-foreground">
                Connect social platforms to deliver agent responses
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || loading}
              >
                <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                Refresh
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Connector
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Platforms</CardTitle>
              <CardDescription>
                Your credentials for social platform integrations. Use these in flow output nodes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="text-destructive mb-2 h-8 w-8" />
                  <p className="text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchCredentials()}
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              ) : credentials.length === 0 ? (
                <EmptyState onAdd={() => setAddDialogOpen(true)} />
              ) : (
                <ErrorBoundary>
                  <ConnectorList
                    credentials={credentials}
                    onTest={handleTest}
                    onDelete={handleDelete}
                    testingId={testingId}
                    deletingId={deletingId}
                    testResults={testResults}
                  />
                </ErrorBoundary>
              )}
            </CardContent>
          </Card>

          {/* Info Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <AlertCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Using Connectors</p>
                  <p className="text-muted-foreground text-sm">
                    After adding a connector, go to the Flow tab and add an Output node. Select
                    Twitter Post, Discord Message, or Telegram Message as the output type, then
                    choose your connector from the dropdown.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Connector Dialog */}
      <AddConnectorDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
