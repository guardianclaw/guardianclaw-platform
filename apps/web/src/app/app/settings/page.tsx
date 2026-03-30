'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Settings page redirects to Profile
 * Maintains backwards compatibility with old URLs
 */
export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')

  useEffect(() => {
    // Redirect to profile with tab parameter if present
    if (tab) {
      router.replace(`/app/profile?tab=${tab}`)
    } else {
      router.replace('/app/profile')
    }
  }, [router, tab])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Redirecting to Profile...</p>
      </div>
    </div>
  )
}
