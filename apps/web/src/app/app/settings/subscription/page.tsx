'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Subscription page has been deprecated in favor of pay-per-use credits.
 * This page redirects users to the new credits page.
 */
export default function SubscriptionPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/app/settings/credits')
  }, [router])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Redirecting to Credits...</p>
        <p className="text-muted-foreground text-sm">
          We've moved to a pay-per-use model. No more subscriptions!
        </p>
      </div>
    </div>
  )
}
