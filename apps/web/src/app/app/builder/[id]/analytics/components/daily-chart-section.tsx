'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DailyStats } from '@/lib/api'

interface DailyChartSectionProps {
  daily: DailyStats[]
  loading?: boolean
}

export function DailyChartSection({ daily, loading }: DailyChartSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-4 w-20" />
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-col justify-end" style={{ height: '120px' }}>
                  <Skeleton
                    className="w-full rounded-t"
                    style={{ height: `${20 + Math.random() * 60}%` }}
                  />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxRequests = Math.max(...daily.map((d) => d.requests), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Volume</CardTitle>
        <CardDescription>Last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-2">
          {daily.map((day, i) => {
            const height = (day.requests / maxRequests) * 100

            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-col justify-end" style={{ height: '120px' }}>
                  <div
                    className="bg-claw-500 w-full rounded-t transition-all"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.requests} requests on ${day.date}`}
                  />
                </div>
                <span className="text-muted-foreground text-xs">
                  {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
