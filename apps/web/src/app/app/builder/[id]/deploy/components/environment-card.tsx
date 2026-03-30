'use client'

/**
 * Environment Card Component
 *
 * Displays deployment status and actions for a single environment (dev/staging/prod).
 * Includes status indicator, version info, and action buttons.
 */

import { Play, Square, ArrowRightCircle, Loader2, Server, GitBranch, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Environment, EnvironmentDeployment } from '@/lib/api'
import type { LucideIcon } from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface EnvironmentConfig {
  label: string
  color: string
  icon: LucideIcon
  description: string
}

export interface EnvironmentCardProps {
  /** The environment type */
  env: Environment
  /** Current deployment data for this environment, null if not deployed */
  deployment: EnvironmentDeployment | null
  /** Handler for deploy action */
  onDeploy: () => void
  /** Handler for stop action */
  onStop: () => void
  /** Handler for promote action (optional, not available for prod) */
  onPromote?: () => void
  /** Whether a deploy is in progress for this environment */
  deploying?: boolean
  /** Whether a stop is in progress for this environment */
  stopping?: boolean
  /** Additional CSS classes */
  className?: string
}

// ============================================
// CONSTANTS
// ============================================

export const ENV_CONFIG: Record<Environment, EnvironmentConfig> = {
  dev: {
    label: 'Development',
    color: 'bg-blue-500',
    icon: Server,
    description: 'Test and iterate on changes',
  },
  staging: {
    label: 'Staging',
    color: 'bg-yellow-500',
    icon: GitBranch,
    description: 'Pre-production testing',
  },
  prod: {
    label: 'Production',
    color: 'bg-green-500',
    icon: Cloud,
    description: 'Live environment',
  },
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}

// ============================================
// COMPONENT
// ============================================

export function EnvironmentCard({
  env,
  deployment,
  onDeploy,
  onStop,
  onPromote,
  deploying = false,
  stopping = false,
  className,
}: EnvironmentCardProps) {
  const config = ENV_CONFIG[env]
  const isRunning = deployment?.status === 'running'
  const Icon = config.icon

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-shadow',
        isRunning && 'ring-2 ring-green-500/50',
        className
      )}
      role="region"
      aria-label={`${config.label} environment`}
    >
      {/* Color indicator bar */}
      <div className={cn('absolute left-0 right-0 top-0 h-1', config.color)} aria-hidden="true" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            <CardTitle className="text-base">{config.label}</CardTitle>
          </div>
          <Badge
            className={cn('text-xs', isRunning ? 'bg-green-500' : 'bg-gray-500')}
            aria-label={isRunning ? 'Status: Running' : 'Status: Not deployed'}
          >
            {isRunning ? (
              <>
                <span
                  className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white"
                  aria-hidden="true"
                />
                Running
              </>
            ) : (
              'Not Deployed'
            )}
          </Badge>
        </div>
        {deployment && (
          <CardDescription className="text-xs">
            <span aria-label={`Version ${deployment.version}`}>v{deployment.version}</span>
            {' • '}
            <span aria-label={`Deployed on ${formatDate(deployment.created_at)}`}>
              {formatDate(deployment.created_at)}
            </span>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2" role="group" aria-label="Environment actions">
          {!isRunning ? (
            <Button
              size="sm"
              onClick={onDeploy}
              disabled={deploying}
              className="bg-claw-600 hover:bg-claw-700"
              aria-label={deploying ? `Deploying to ${config.label}` : `Deploy to ${config.label}`}
            >
              {deploying ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="mr-1.5 h-3 w-3" aria-hidden="true" />
              )}
              {deploying ? 'Deploying...' : 'Deploy'}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onStop}
                disabled={stopping}
                aria-label={
                  stopping ? `Stopping ${config.label}` : `Stop ${config.label} deployment`
                }
              >
                {stopping ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Square className="mr-1.5 h-3 w-3" aria-hidden="true" />
                )}
                {stopping ? 'Stopping...' : 'Stop'}
              </Button>
              {onPromote && env !== 'prod' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onPromote}
                  aria-label={`Promote ${config.label} to ${env === 'dev' ? 'staging or production' : 'production'}`}
                >
                  <ArrowRightCircle className="mr-1.5 h-3 w-3" aria-hidden="true" />
                  Promote
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
