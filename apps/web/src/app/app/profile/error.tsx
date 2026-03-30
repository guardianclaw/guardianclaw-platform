'use client'

import { AppErrorBoundary } from '@/components/app-error-boundary'

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <AppErrorBoundary
      error={error}
      reset={reset}
      context="Profile"
      backLabel="Back to Dashboard"
      backHref="/app"
    />
  )
}
