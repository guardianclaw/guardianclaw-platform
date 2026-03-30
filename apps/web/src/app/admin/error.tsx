'use client'

import { AppErrorBoundary } from '@/components/app-error-boundary'

export default function AdminError({
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
      context="Admin Panel"
      backLabel="Back to Dashboard"
      backHref="/app"
    />
  )
}
