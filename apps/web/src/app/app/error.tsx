'use client'

import { AppErrorBoundary } from '@/components/app-error-boundary'

export default function AppError({
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
      context="the App"
      backLabel="Back to Dashboard"
      backHref="/app"
    />
  )
}
