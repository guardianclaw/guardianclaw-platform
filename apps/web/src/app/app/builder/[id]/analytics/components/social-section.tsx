'use client'

import { Share2, Twitter, MessageCircle, Send, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { SocialStats } from '@/lib/api'

interface SocialSectionProps {
  social: SocialStats[]
  loading?: boolean
}

interface PlatformConfig {
  name: string
  icon: typeof Twitter
  color: string
  bgColor: string
}

const platformConfig: Record<string, PlatformConfig> = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  discord: {
    name: 'Discord',
    icon: MessageCircle,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
  },
  telegram: {
    name: 'Telegram',
    icon: Send,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
  },
}

function PlatformRowSkeleton() {
  return (
    <div className="bg-muted/30 flex items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

function SummaryBoxSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <Skeleton className="mx-auto mb-1 h-8 w-16" />
      <Skeleton className="mx-auto h-3 w-20" />
    </div>
  )
}

export function SocialSection({ social, loading }: SocialSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="mt-1 h-4 w-52" />
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <SummaryBoxSkeleton />
            <SummaryBoxSkeleton />
            <SummaryBoxSkeleton />
          </div>
          <div className="space-y-3">
            <PlatformRowSkeleton />
            <PlatformRowSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (social.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="text-muted-foreground h-5 w-5" />
            Social Delivery
          </CardTitle>
          <CardDescription>No social deliveries in this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            Social delivery metrics will appear when your agent posts to platforms
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalDeliveries = social.reduce((sum, s) => sum + s.total_deliveries, 0)
  const totalSuccess = social.reduce((sum, s) => sum + s.success_count, 0)
  const totalFailure = social.reduce((sum, s) => sum + s.failure_count, 0)
  const successRate =
    totalDeliveries > 0 ? ((totalSuccess / totalDeliveries) * 100).toFixed(1) : '0'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-400" />
          Social Delivery
        </CardTitle>
        <CardDescription>Message delivery across platforms</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{totalDeliveries.toLocaleString()}</div>
            <div className="text-muted-foreground text-xs">Total Sent</div>
          </div>
          <div className="rounded-lg bg-green-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{totalSuccess.toLocaleString()}</div>
            <div className="text-muted-foreground text-xs">Successful</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{successRate}%</div>
            <div className="text-muted-foreground text-xs">Success Rate</div>
          </div>
        </div>

        {/* Per platform */}
        <div className="space-y-3">
          {social.map((stat) => {
            const config = platformConfig[stat.platform] || {
              name: stat.platform,
              icon: Share2,
              color: 'text-gray-400',
              bgColor: 'bg-gray-500/10',
            }
            const Icon = config.icon

            return (
              <div
                key={stat.platform}
                className={cn('flex items-center justify-between rounded-lg p-3', config.bgColor)}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-5 w-5', config.color)} />
                  <span className="font-medium">{config.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    {stat.success_count.toLocaleString()}
                  </span>
                  {stat.failure_count > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="h-4 w-4" />
                      {stat.failure_count.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
