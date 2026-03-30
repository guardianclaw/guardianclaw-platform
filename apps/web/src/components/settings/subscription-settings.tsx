'use client'

import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { paymentsApi, SubscriptionStatus, PaymentHistory } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function SubscriptionSettings() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [history, setHistory] = useState<PaymentHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([paymentsApi.getStatus(), paymentsApi.getHistory()])
      .then(([statusData, historyData]) => {
        setStatus(statusData)
        setHistory(historyData.subscriptions || [])
      })
      .catch(() => toast.error('Failed to load subscription'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-40 animate-pulse rounded-lg" />
        <div className="bg-muted h-32 animate-pulse rounded-lg" />
      </div>
    )
  }

  const isActive = status?.is_active
  const expiresAt = status?.plan_expires_at ? new Date(status.plan_expires_at) : null

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">Current Plan</h3>
            <p className="mt-2 text-2xl font-bold capitalize">{status?.plan || 'Free'}</p>
          </div>
          <div
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium',
              isActive ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </div>
        </div>

        {expiresAt && (
          <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span>
              {isActive ? 'Expires' : 'Expired'}: {expiresAt.toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="mt-6">
          <Button asChild>
            <Link href="/token">Upgrade Plan</Link>
          </Button>
        </div>
      </div>

      {/* Payment History */}
      {history.length > 0 && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-4 text-lg font-medium">Payment History</h3>
          <div className="space-y-3">
            {history.slice(0, 5).map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between border-b py-3 last:border-0"
              >
                <div>
                  <p className="font-medium capitalize">{payment.plan}</p>
                  <p className="text-muted-foreground text-sm">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono">{(payment.amount_lamports / 1e9).toFixed(4)} SOL</p>
                  <p
                    className={cn(
                      'text-sm',
                      payment.status === 'active' ? 'text-green-500' : 'text-muted-foreground'
                    )}
                  >
                    {payment.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="bg-card text-muted-foreground rounded-lg border p-6 text-center">
          No payment history yet.
        </div>
      )}
    </div>
  )
}
