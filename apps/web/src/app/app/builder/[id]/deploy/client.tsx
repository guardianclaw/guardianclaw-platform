'use client'

/**
 * Deploy Page Client Component
 *
 * Main deployment management interface for agents.
 * Supports multi-environment deployment (dev/staging/prod),
 * deployment history, rollback, promote, and API key management.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Cloud,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  History,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAgent } from '../context'
import {
  deployApi,
  executionLogsApi,
  DeploymentHistoryEntry,
  ApiKeyInfo,
  HealthStats,
  API_URL,
  Environment,
  EnvironmentDeployment,
} from '@/lib/api'
import { HealthStatusBadge } from '../logs/components/health-status'

// Import extracted components
import {
  EnvironmentCard,
  DeployHistoryDialog,
  PromoteDialog,
  RollbackDialog,
  ApiKeySection,
  CodeExamples,
  DeployDialog,
} from './components'
import { NewApiKeyDialog, ShowApiKeyDialog } from './components/new-api-key-dialog'

// ============================================
// TYPES
// ============================================

interface EnvironmentsState {
  dev: EnvironmentDeployment | null
  staging: EnvironmentDeployment | null
  prod: EnvironmentDeployment | null
}

interface PromoteDialogState {
  sourceEnv: Environment
  sourceDeploymentId: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DeployPageClient() {
  const { agent, isDemo, refetch } = useAgent()

  // Core state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Deploy data
  const [environments, setEnvironments] = useState<EnvironmentsState>({
    dev: null,
    staging: null,
    prod: null,
  })
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [health, setHealth] = useState<HealthStats | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // Operation states
  const [deployingEnv, setDeployingEnv] = useState<Environment | null>(null)
  const [stoppingEnv, setStoppingEnv] = useState<Environment | null>(null)

  // History dialog state
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<DeploymentHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyEnvFilter, setHistoryEnvFilter] = useState<Environment | 'all'>('all')

  // Deploy dialog state
  const [deployDialog, setDeployDialog] = useState<Environment | null>(null)
  const [deployNotes, setDeployNotes] = useState('')

  // Promote dialog state
  const [promoteDialog, setPromoteDialog] = useState<PromoteDialogState | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<'staging' | 'prod'>('staging')
  const [promoteNotes, setPromoteNotes] = useState('')
  const [promoting, setPromoting] = useState(false)

  // Rollback dialog state
  const [rollbackDialog, setRollbackDialog] = useState<DeploymentHistoryEntry | null>(null)
  const [rollbackNotes, setRollbackNotes] = useState('')
  const [rollingBack, setRollingBack] = useState(false)

  // API key dialog state
  const [newKeyDialog, setNewKeyDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [showNewKeyValue, setShowNewKeyValue] = useState<string | null>(null)

  // Revoke confirmation state
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null)
  const [revokingKey, setRevokingKey] = useState(false)

  // Copy state
  const [copied, setCopied] = useState<string | null>(null)

  // Computed values
  const prodDeployment = environments.prod
  const endpoint =
    agent && prodDeployment
      ? prodDeployment.endpoint_url
      : agent
        ? `${API_URL}/invoke/${agent.id}`
        : ''
  const hasAnyDeployment = environments.dev || environments.staging || environments.prod

  // ==========================================
  // DATA LOADING
  // ==========================================

  const loadHealth = useCallback(async () => {
    if (!agent || isDemo) return

    try {
      setHealthLoading(true)
      const healthData = await executionLogsApi.getHealth(agent.id)
      setHealth(healthData)
    } catch (err) {
      console.error('Failed to load health:', err)
    } finally {
      setHealthLoading(false)
    }
  }, [agent, isDemo])

  const loadStatus = useCallback(async () => {
    if (!agent || isDemo) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const status = await deployApi.getStatus(agent.id)
      setEnvironments(status.environments)
      setApiKeys(status.api_keys)
    } catch (err) {
      console.error('Failed to load deploy status:', err)
      setError('Failed to load deployment status. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [agent, isDemo])

  const loadHistory = useCallback(async () => {
    if (!agent || isDemo) return

    try {
      setHistoryLoading(true)
      const envFilter = historyEnvFilter === 'all' ? undefined : historyEnvFilter
      const result = await deployApi.getHistory(agent.id, { environment: envFilter, limit: 50 })
      setHistory(result.deployments)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [agent, isDemo, historyEnvFilter])

  useEffect(() => {
    loadStatus()
    loadHealth()
  }, [loadStatus, loadHealth])

  useEffect(() => {
    if (historyOpen) {
      loadHistory()
    }
  }, [historyOpen, loadHistory])

  // ==========================================
  // DEPLOYMENT HANDLERS
  // ==========================================

  const handleDeploy = async (env: Environment, notes?: string) => {
    if (!agent) return

    try {
      setDeployingEnv(env)
      setError(null)

      const result = await deployApi.deploy(agent.id, env, notes)

      if (result.api_key) {
        setShowNewKeyValue(result.api_key)
      }

      await loadStatus()
      refetch()
    } catch (err: unknown) {
      console.error('Deploy failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to deploy agent. Please try again.')
    } finally {
      setDeployingEnv(null)
      setDeployDialog(null)
      setDeployNotes('')
    }
  }

  const handleStop = async (env: Environment) => {
    if (!agent) return

    try {
      setStoppingEnv(env)
      setError(null)

      await deployApi.stop(agent.id, env)

      await loadStatus()
      refetch()
    } catch (err: unknown) {
      console.error('Stop failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to stop deployment. Please try again.')
    } finally {
      setStoppingEnv(null)
    }
  }

  const handlePromote = async () => {
    if (!agent || !promoteDialog) return

    try {
      setPromoting(true)
      setError(null)

      await deployApi.promote(
        agent.id,
        promoteDialog.sourceDeploymentId,
        promoteTarget,
        promoteNotes || undefined
      )

      await loadStatus()
      refetch()
      setPromoteDialog(null)
      setPromoteNotes('')
    } catch (err: unknown) {
      console.error('Promote failed:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to promote deployment. Please try again.'
      )
    } finally {
      setPromoting(false)
    }
  }

  const handleRollback = async () => {
    if (!agent || !rollbackDialog) return

    try {
      setRollingBack(true)
      setError(null)

      await deployApi.rollback(agent.id, rollbackDialog.id, rollbackNotes || undefined)

      await loadStatus()
      await loadHistory()
      refetch()
      setRollbackDialog(null)
      setRollbackNotes('')
    } catch (err: unknown) {
      console.error('Rollback failed:', err)
      setError(
        err instanceof Error ? err.message : 'Failed to rollback deployment. Please try again.'
      )
    } finally {
      setRollingBack(false)
    }
  }

  // ==========================================
  // API KEY HANDLERS
  // ==========================================

  const handleCreateKey = async () => {
    if (!agent) return

    try {
      setCreatingKey(true)
      setError(null)

      const result = await deployApi.createKey(agent.id, newKeyName || undefined)

      setShowNewKeyValue(result.api_key)
      setNewKeyDialog(false)
      setNewKeyName('')

      await loadStatus()
    } catch (err: unknown) {
      console.error('Create key failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to create API key. Please try again.')
    } finally {
      setCreatingKey(false)
    }
  }

  const handleRevokeKey = async () => {
    if (!agent || !revokeKeyId) return

    try {
      setRevokingKey(true)
      setError(null)

      await deployApi.revokeKey(agent.id, revokeKeyId)
      setRevokeKeyId(null)

      await loadStatus()
    } catch (err: unknown) {
      console.error('Revoke key failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to revoke API key. Please try again.')
    } finally {
      setRevokingKey(false)
    }
  }

  // ==========================================
  // UTILITY HANDLERS
  // ==========================================

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const openPromoteDialog = (env: Environment) => {
    const deployment = environments[env]
    if (!deployment) return

    setPromoteDialog({
      sourceEnv: env,
      sourceDeploymentId: deployment.id,
    })
    setPromoteTarget(env === 'dev' ? 'staging' : 'prod')
  }

  // ==========================================
  // RENDER STATES
  // ==========================================

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading deploy settings...</p>
        </div>
      </div>
    )
  }

  // Demo mode
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <div className="max-w-md text-center">
          <Cloud className="text-muted-foreground mx-auto mb-4 h-12 w-12" aria-hidden="true" />
          <h2 className="mb-2 text-xl font-semibold">Deploy Not Available</h2>
          <p className="text-muted-foreground">
            Sign in to deploy your agents and generate API keys.
          </p>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-claw-500 h-8 w-8 animate-spin" aria-hidden="true" />
          <p className="text-muted-foreground">Loading deployment status...</p>
        </div>
      </div>
    )
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Cloud className="text-claw-500 h-6 w-6" aria-hidden="true" />
              Deploy
            </h1>
            <p className="text-muted-foreground mt-1">Deploy your agent across environments</p>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Page actions">
            {hasAnyDeployment && (
              <Button
                variant="outline"
                onClick={() => setHistoryOpen(true)}
                aria-label="View deployment history"
              >
                <History className="mr-2 h-4 w-4" aria-hidden="true" />
                History
              </Button>
            )}
            <Button variant="outline" onClick={loadStatus} aria-label="Refresh deployment status">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div
            className="bg-destructive/10 border-destructive/20 mb-6 rounded-lg border p-4"
            role="alert"
          >
            <p className="text-destructive flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          </div>
        )}

        {/* Environment Cards - Responsive Grid */}
        <section aria-label="Environments" className="mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <EnvironmentCard
              env="dev"
              deployment={environments.dev}
              onDeploy={() => setDeployDialog('dev')}
              onStop={() => handleStop('dev')}
              onPromote={() => openPromoteDialog('dev')}
              deploying={deployingEnv === 'dev'}
              stopping={stoppingEnv === 'dev'}
            />
            <EnvironmentCard
              env="staging"
              deployment={environments.staging}
              onDeploy={() => setDeployDialog('staging')}
              onStop={() => handleStop('staging')}
              onPromote={() => openPromoteDialog('staging')}
              deploying={deployingEnv === 'staging'}
              stopping={stoppingEnv === 'staging'}
            />
            <EnvironmentCard
              env="prod"
              deployment={environments.prod}
              onDeploy={() => setDeployDialog('prod')}
              onStop={() => handleStop('prod')}
              deploying={deployingEnv === 'prod'}
              stopping={stoppingEnv === 'prod'}
            />
          </div>
        </section>

        {/* Production Info - Only shown when prod is deployed */}
        {environments.prod && (
          <>
            {/* Endpoint Card */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle>Production Endpoint</CardTitle>
                    <CardDescription>Your agent&apos;s live API endpoint</CardDescription>
                  </div>
                  <HealthStatusBadge health={health} loading={healthLoading} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code
                    className="bg-muted flex-1 truncate rounded-md px-3 py-2 font-mono text-sm"
                    aria-label="Production endpoint URL"
                  >
                    {endpoint}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(endpoint, 'endpoint')}
                    aria-label={copied === 'endpoint' ? 'Copied!' : 'Copy endpoint URL'}
                  >
                    {copied === 'endpoint' ? (
                      <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* API Keys Section */}
            <div className="mb-6">
              <ApiKeySection
                apiKeys={apiKeys}
                maxKeys={5}
                onCreateKey={() => setNewKeyDialog(true)}
                onRevokeKey={setRevokeKeyId}
              />
            </div>

            {/* Code Examples */}
            <div className="mb-6">
              <CodeExamples endpoint={endpoint} />
            </div>

            {/* API Documentation Link */}
            <div className="text-center">
              <a
                href="https://docs.guardianclaw.org/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
              >
                View full API documentation
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </>
        )}
      </div>

      {/* ==========================================
          DIALOGS
          ========================================== */}

      {/* Deploy Dialog */}
      <DeployDialog
        open={!!deployDialog}
        onOpenChange={() => setDeployDialog(null)}
        targetEnv={deployDialog}
        notes={deployNotes}
        onNotesChange={setDeployNotes}
        onDeploy={() => deployDialog && handleDeploy(deployDialog, deployNotes)}
        deploying={deployingEnv !== null}
      />

      {/* Promote Dialog */}
      <PromoteDialog
        open={!!promoteDialog}
        onOpenChange={() => setPromoteDialog(null)}
        sourceEnv={promoteDialog?.sourceEnv ?? null}
        targetEnv={promoteTarget}
        onTargetEnvChange={setPromoteTarget}
        notes={promoteNotes}
        onNotesChange={setPromoteNotes}
        onPromote={handlePromote}
        promoting={promoting}
      />

      {/* History Dialog */}
      <DeployHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        loading={historyLoading}
        envFilter={historyEnvFilter}
        onEnvFilterChange={setHistoryEnvFilter}
        onRollback={setRollbackDialog}
      />

      {/* Rollback Dialog */}
      <RollbackDialog
        open={!!rollbackDialog}
        onOpenChange={() => setRollbackDialog(null)}
        entry={rollbackDialog}
        notes={rollbackNotes}
        onNotesChange={setRollbackNotes}
        onRollback={handleRollback}
        rollingBack={rollingBack}
      />

      {/* New API Key Dialog */}
      <NewApiKeyDialog
        open={newKeyDialog}
        onOpenChange={setNewKeyDialog}
        keyName={newKeyName}
        onKeyNameChange={setNewKeyName}
        onCreate={handleCreateKey}
        creating={creatingKey}
      />

      {/* Show New API Key Dialog */}
      <ShowApiKeyDialog apiKey={showNewKeyValue} onClose={() => setShowNewKeyValue(null)} />

      {/* Revoke Key Confirmation */}
      <AlertDialog open={!!revokeKeyId} onOpenChange={() => setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the API key. Any applications using this key will no
              longer be able to access your agent. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingKey}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              disabled={revokingKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
