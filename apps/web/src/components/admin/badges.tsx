'use client'

import { Badge } from '@/components/ui/badge'
import {
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Bell,
  Clock,
  CheckCircle,
  Crown,
  Shield,
  Headphones,
  Eye,
} from 'lucide-react'

// Plan Badge
export type PlanType = 'free' | 'starter' | 'pro'

const planVariants: Record<PlanType, 'default' | 'secondary' | 'outline'> = {
  pro: 'default',
  starter: 'secondary',
  free: 'outline',
}

export function PlanBadge({ plan }: { plan: string }) {
  const variant = planVariants[plan as PlanType] || 'outline'

  return (
    <Badge variant={variant} className="capitalize">
      {plan}
    </Badge>
  )
}

// Severity Badge
export type SeverityType = 'info' | 'warning' | 'critical'

const severityConfig: Record<
  SeverityType,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  info: { variant: 'outline', icon: AlertCircle },
  warning: { variant: 'secondary', icon: AlertTriangle },
  critical: { variant: 'destructive', icon: ShieldAlert },
}

export function SeverityBadge({
  severity,
  showIcon = true,
}: {
  severity: string
  showIcon?: boolean
}) {
  const config = severityConfig[severity as SeverityType] || {
    variant: 'outline' as const,
    icon: AlertCircle,
  }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={showIcon ? 'gap-1' : ''}>
      {showIcon && <Icon className="h-3 w-3" />}
      <span className="capitalize">{severity}</span>
    </Badge>
  )
}

// Alert Status Badge
export type AlertStatusType = 'active' | 'acknowledged' | 'resolved'

const alertStatusConfig: Record<
  AlertStatusType,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  active: { variant: 'destructive', icon: Bell },
  acknowledged: { variant: 'secondary', icon: Clock },
  resolved: { variant: 'outline', icon: CheckCircle },
}

export function AlertStatusBadge({ status }: { status: string }) {
  const config = alertStatusConfig[status as AlertStatusType] || {
    variant: 'outline' as const,
    icon: AlertCircle,
  }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="gap-1 capitalize">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

// Agent/Entity Status Badge
export type EntityStatusType =
  | 'deployed'
  | 'draft'
  | 'testing'
  | 'archived'
  | 'active'
  | 'cancelled'
  | 'expired'

const entityStatusConfig: Record<
  EntityStatusType,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    label: string
  }
> = {
  deployed: { variant: 'default', label: 'Deployed' },
  active: { variant: 'default', label: 'Active' },
  draft: { variant: 'secondary', label: 'Draft' },
  testing: { variant: 'outline', label: 'Testing' },
  archived: { variant: 'destructive', label: 'Archived' },
  cancelled: { variant: 'destructive', label: 'Cancelled' },
  expired: { variant: 'outline', label: 'Expired' },
}

export function EntityStatusBadge({ status }: { status: string }) {
  const config = entityStatusConfig[status as EntityStatusType] || {
    variant: 'outline' as const,
    label: status,
  }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Risk Level Badge
export type RiskLevelType = 'low' | 'medium' | 'high' | 'critical'

const riskLevelConfig: Record<
  RiskLevelType,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    label: string
  }
> = {
  low: { variant: 'outline', label: 'Low' },
  medium: { variant: 'secondary', label: 'Medium' },
  high: { variant: 'default', label: 'High' },
  critical: { variant: 'destructive', label: 'Critical' },
}

export function RiskLevelBadge({ level }: { level: string }) {
  const config = riskLevelConfig[level as RiskLevelType] || {
    variant: 'outline' as const,
    label: level,
  }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Admin Role Badge
export type AdminRoleType = 'super_admin' | 'admin' | 'support' | 'viewer'

const adminRoleConfig: Record<
  AdminRoleType,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
  }
> = {
  super_admin: { label: 'Super Admin', icon: Crown, color: 'text-yellow-500' },
  admin: { label: 'Admin', icon: Shield, color: 'text-blue-500' },
  support: { label: 'Support', icon: Headphones, color: 'text-green-500' },
  viewer: { label: 'Viewer', icon: Eye, color: 'text-muted-foreground' },
}

export function AdminRoleBadge({ role }: { role: string }) {
  const config = adminRoleConfig[role as AdminRoleType]
  if (!config) return <Badge variant="outline">{role}</Badge>

  const Icon = config.icon

  return (
    <Badge variant="outline" className={`gap-1 ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Health Status Badge
export type HealthStatusType = 'healthy' | 'degraded' | 'down'

const healthStatusConfig: Record<
  HealthStatusType,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
  }
> = {
  healthy: { label: 'Healthy', icon: CheckCircle, color: 'text-green-500' },
  degraded: { label: 'Degraded', icon: AlertCircle, color: 'text-yellow-500' },
  down: { label: 'Down', icon: ShieldAlert, color: 'text-red-500' },
}

export function HealthStatusBadge({ status }: { status: string }) {
  const config = healthStatusConfig[status as HealthStatusType]
  if (!config) return <Badge variant="outline">{status}</Badge>

  const Icon = config.icon

  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-5 w-5 ${config.color}`} />
      <span className={`font-medium ${config.color}`}>{config.label}</span>
    </div>
  )
}

// Trend Indicator
export type TrendType = 'improving' | 'stable' | 'degrading'

const trendConfig: Record<
  TrendType,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    label: string
  }
> = {
  improving: { icon: CheckCircle, color: 'text-green-500', label: 'Improving' },
  stable: { icon: AlertCircle, color: 'text-muted-foreground', label: 'Stable' },
  degrading: { icon: AlertTriangle, color: 'text-red-500', label: 'Degrading' },
}

export function TrendIndicator({ trend }: { trend: string }) {
  const config = trendConfig[trend as TrendType]
  if (!config) return null

  const Icon = config.icon

  return (
    <div className="flex items-center gap-1">
      <Icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-sm ${config.color}`}>{config.label}</span>
    </div>
  )
}
