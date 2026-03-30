'use client'

import { useState } from 'react'
import { Download, Trash2, AlertTriangle, Check, Loader2, Shield, FileJson } from 'lucide-react'
import { userApi, UserDataExport, UserDeletionResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

type ExportStatus = 'idle' | 'loading' | 'success' | 'error'
type DeleteStatus = 'idle' | 'confirm' | 'loading' | 'success' | 'error'

export function DataManagement() {
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle')
  const [exportError, setExportError] = useState<string | null>(null)

  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteResult, setDeleteResult] = useState<UserDeletionResponse | null>(null)

  const handleExport = async () => {
    setExportStatus('loading')
    setExportError(null)

    try {
      const data = await userApi.exportData()

      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `claw-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportStatus('success')
      setTimeout(() => setExportStatus('idle'), 3000)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
      setExportStatus('error')
    }
  }

  const handleDelete = async () => {
    if (deleteStatus !== 'confirm') {
      setDeleteStatus('confirm')
      return
    }

    setDeleteStatus('loading')
    setDeleteError(null)

    try {
      const result = await userApi.deleteData()
      setDeleteResult(result)
      setDeleteStatus('success')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Deletion failed')
      setDeleteStatus('error')
    }
  }

  const cancelDelete = () => {
    setDeleteStatus('idle')
    setDeleteError(null)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Shield className="text-primary mt-0.5 h-6 w-6" />
        <div>
          <h2 className="text-xl font-semibold">Data & Privacy</h2>
          <p className="text-muted-foreground mt-1">
            Manage your data in compliance with GDPR. Export or delete your personal data.
          </p>
        </div>
      </div>

      {/* Export Data Section */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-blue-500/10 p-3">
            <FileJson className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">Export Your Data</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Download a copy of all your data in JSON format. This includes your profile, agents,
              configurations, and subscription history.
            </p>
            <p className="text-muted-foreground mt-2 text-xs">
              <strong>Note:</strong> LLM API keys are encrypted client-side. Only metadata is
              exported.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportStatus === 'loading'}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              exportStatus === 'success'
                ? 'bg-green-500/10 text-green-600'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
              exportStatus === 'loading' && 'cursor-not-allowed opacity-50'
            )}
          >
            {exportStatus === 'loading' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : exportStatus === 'success' ? (
              <>
                <Check className="h-4 w-4" />
                Downloaded
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Data
              </>
            )}
          </button>
        </div>
        {exportStatus === 'error' && exportError && (
          <div className="bg-destructive/10 text-destructive mt-4 rounded-md p-3 text-sm">
            {exportError}
          </div>
        )}
      </div>

      {/* Delete Data Section */}
      <div className="border-destructive/20 bg-card rounded-lg border p-6">
        <div className="flex items-start gap-4">
          <div className="bg-destructive/10 rounded-full p-3">
            <Trash2 className="text-destructive h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-destructive font-medium">Delete Your Data</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Permanently delete your data from our systems. This action cannot be undone.
            </p>

            {/* What gets deleted */}
            <div className="bg-muted/50 mt-4 rounded-md p-3 text-sm">
              <p className="mb-2 font-medium">What will be deleted:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>- Your agents and configurations</li>
                <li>- Stored LLM API keys (encrypted blobs)</li>
                <li>- Usage analytics and event logs</li>
                <li>- API keys for deployed agents</li>
                <li>- Profile optional fields (display name, avatar)</li>
              </ul>
            </div>

            {/* What gets retained */}
            <div className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm">
              <p className="mb-2 font-medium text-amber-600">
                What will be retained (legal requirement):
              </p>
              <ul className="text-muted-foreground space-y-1">
                <li>- Payment/subscription records (7 years for tax compliance)</li>
                <li>- Deletion audit trail (GDPR proof of compliance)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Delete Actions */}
        <div className="mt-6 flex items-center gap-3">
          {deleteStatus === 'idle' && (
            <button
              onClick={handleDelete}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete My Data
            </button>
          )}

          {deleteStatus === 'confirm' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Are you sure? This cannot be undone.</span>
              </div>
              <button
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={cancelDelete}
                className="hover:bg-muted inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {deleteStatus === 'loading' && (
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Deleting your data...</span>
            </div>
          )}

          {deleteStatus === 'success' && deleteResult && (
            <div className="w-full space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Data deletion completed</span>
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p className="mb-2 font-medium">Summary:</p>
                <p className="text-muted-foreground">
                  <strong>Deleted:</strong> {deleteResult.deleted.join(', ')}
                </p>
                <p className="text-muted-foreground mt-1">
                  <strong>Retained:</strong> {deleteResult.retained.join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {deleteStatus === 'error' && deleteError && (
          <div className="bg-destructive/10 text-destructive mt-4 rounded-md p-3 text-sm">
            {deleteError}
          </div>
        )}
      </div>

      {/* Legal Notice */}
      <div className="text-muted-foreground bg-muted/30 rounded-md p-4 text-xs">
        <p className="mb-1 font-medium">Your Rights Under GDPR</p>
        <ul className="space-y-1">
          <li>
            <strong>Article 15:</strong> Right of access to your personal data
          </li>
          <li>
            <strong>Article 17:</strong> Right to erasure (right to be forgotten)
          </li>
          <li>
            <strong>Article 20:</strong> Right to data portability
          </li>
        </ul>
        <p className="mt-2">
          For questions about your data or to exercise other rights, contact us at{' '}
          <a href="mailto:privacy@guardianclaw.org" className="text-primary hover:underline">
            privacy@guardianclaw.org
          </a>
        </p>
      </div>
    </div>
  )
}
