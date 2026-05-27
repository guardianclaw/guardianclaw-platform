/**
 * Reusable empty-state card for the ClawPay dashboard. Matches the existing
 * dashed-border pattern used elsewhere in the app (e.g. the agents list).
 */

import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        {Icon ? <Icon className="text-muted-foreground mx-auto mb-3 h-10 w-10" /> : null}
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  )
}
