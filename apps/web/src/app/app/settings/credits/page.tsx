'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Credits page redirects to Profile credits
 * Maintains backwards compatibility with old URLs
 */
export default function CreditsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/app/profile/credits')
  }, [router])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Redirecting to Credits...</p>
      </div>
    </div>
  )
}
