'use client'

/**
 * New API Key Dialog Component
 *
 * Dialogs for creating a new API key and displaying the created key.
 * The key value is shown only once after creation.
 */

import { useState } from 'react'
import { Key, Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================
// TYPES
// ============================================

export interface NewApiKeyDialogProps {
  /** Whether the create dialog is open */
  open: boolean
  /** Handler for dialog open state change */
  onOpenChange: (open: boolean) => void
  /** Name for the new key */
  keyName: string
  /** Handler for key name change */
  onKeyNameChange: (name: string) => void
  /** Handler for create action */
  onCreate: () => void
  /** Whether creation is in progress */
  creating?: boolean
}

export interface ShowApiKeyDialogProps {
  /** The API key value to display (null to hide dialog) */
  apiKey: string | null
  /** Handler for closing the dialog */
  onClose: () => void
}

// ============================================
// CREATE DIALOG COMPONENT
// ============================================

export function NewApiKeyDialog({
  open,
  onOpenChange,
  keyName,
  onKeyNameChange,
  onCreate,
  creating = false,
}: NewApiKeyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="create-key-description">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription id="create-key-description">
            Create a new API key for this agent. The key will only be shown once after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="key-name" className="text-sm font-medium">
            Key Name
            <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
          </Label>
          <Input
            id="key-name"
            placeholder="e.g., Production, Development, Testing"
            value={keyName}
            onChange={(e) => onKeyNameChange(e.target.value)}
            className="mt-2"
            disabled={creating}
            aria-describedby="key-name-hint"
          />
          <p id="key-name-hint" className="text-muted-foreground mt-1 text-xs">
            Give your key a descriptive name to help identify its purpose.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={onCreate}
            disabled={creating}
            className="bg-claw-600 hover:bg-claw-700"
            aria-label={creating ? 'Creating API key' : 'Create API key'}
          >
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Key className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {creating ? 'Creating...' : 'Create Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// SHOW KEY DIALOG COMPONENT
// ============================================

export function ShowApiKeyDialog({ apiKey, onClose }: ShowApiKeyDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Dialog open={!!apiKey} onOpenChange={() => onClose()}>
      <DialogContent aria-describedby="show-key-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="text-claw-500 h-5 w-5" aria-hidden="true" />
            API Key Created
          </DialogTitle>
          <DialogDescription id="show-key-description">
            This is your API key. Copy it now - it will not be shown again!
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4" role="alert">
            <div className="mb-3 flex items-center gap-2 text-sm text-yellow-600">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span className="font-medium">Store this key securely</span>
            </div>
            <div className="flex items-center gap-2">
              <code
                className="bg-background flex-1 break-all rounded-md px-3 py-2 font-mono text-sm"
                aria-label="Your new API key"
              >
                {apiKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={copied ? 'Copied!' : 'Copy API key'}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
