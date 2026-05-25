/**
 * Single KPI card used in the ClawPay overview.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  tone?: 'neutral' | 'positive' | 'caution' | 'critical'
}

const TONE_STYLES: Record<NonNullable<StatCardProps['tone']>, string> = {
  neutral: 'text-foreground',
  positive: 'text-emerald-600 dark:text-emerald-400',
  caution: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral' }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          {Icon ? <Icon className="text-muted-foreground h-4 w-4" /> : null}
        </div>
      </CardHeader>
      <CardContent>
        <CardTitle className={cn('text-3xl tabular-nums', TONE_STYLES[tone])}>{value}</CardTitle>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
