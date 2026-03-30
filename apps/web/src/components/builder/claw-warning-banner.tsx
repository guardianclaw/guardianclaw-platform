'use client'

import { useFlowStore } from '@/stores'
import { ShieldOff, X } from 'lucide-react'

export function GuardianClawWarningBanner() {
  const warning = useFlowStore((s) => s.clawWarning)
  const dismissed = useFlowStore((s) => s.clawWarningDismissed)
  const dismiss = useFlowStore((s) => s.dismissGuardianClawWarning)

  if (warning === 'none' || dismissed) return null

  const isFullRemoval = warning === 'all_removed'

  return (
    <div
      className={`absolute left-1/2 top-4 z-50 flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
        isFullRemoval
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'
          : 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100'
      } `}
    >
      <ShieldOff className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 text-sm">
        {isFullRemoval ? (
          <>
            <strong>No GuardianClaw protection.</strong> All validation nodes have been removed.
            Runtime auto-protection will apply basic validation.
          </>
        ) : (
          <>
            <strong>Partial protection.</strong> Some validation nodes have been removed. Missing
            layers will use auto-protection.
          </>
        )}
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Dismiss warning"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
