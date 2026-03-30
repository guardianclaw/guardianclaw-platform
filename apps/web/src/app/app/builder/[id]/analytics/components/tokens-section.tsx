'use client'

import { Coins, ArrowDown, ArrowUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TokenStats } from '@/lib/api'

interface TokensSectionProps {
  tokens: TokenStats
  loading?: boolean
}

function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(2)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toLocaleString()
}

function TokenBoxSkeleton() {
  return (
    <div className="bg-muted/30 rounded-lg p-3 text-center">
      <div className="mb-1 flex items-center justify-center gap-1">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="mx-auto mb-1 h-8 w-16" />
      <Skeleton className="mx-auto h-3 w-20" />
    </div>
  )
}

export function TokensSection({ tokens, loading }: TokensSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="mt-1 h-4 w-36" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <TokenBoxSkeleton />
            <TokenBoxSkeleton />
            <TokenBoxSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const inputPercentage =
    tokens.total_tokens > 0 ? ((tokens.input_tokens / tokens.total_tokens) * 100).toFixed(0) : '0'
  const outputPercentage =
    tokens.total_tokens > 0 ? ((tokens.output_tokens / tokens.total_tokens) * 100).toFixed(0) : '0'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-500" />
          Token Usage
        </CardTitle>
        <CardDescription>LLM token consumption</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-blue-500/10 p-3 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <ArrowDown className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground text-xs">Input</span>
            </div>
            <div className="text-2xl font-bold text-blue-500">
              {formatTokens(tokens.input_tokens)}
            </div>
            <div className="text-muted-foreground text-xs">{inputPercentage}% of total</div>
          </div>

          <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <ArrowUp className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground text-xs">Output</span>
            </div>
            <div className="text-2xl font-bold text-emerald-500">
              {formatTokens(tokens.output_tokens)}
            </div>
            <div className="text-muted-foreground text-xs">{outputPercentage}% of total</div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-muted-foreground text-xs">Total</span>
            </div>
            <div className="text-2xl font-bold">{formatTokens(tokens.total_tokens)}</div>
            <div className="text-muted-foreground text-xs">tokens used</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
