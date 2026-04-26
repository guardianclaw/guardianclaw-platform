'use client'

import { useState, useCallback } from 'react'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Loader2,
  Plus,
  Pin,
  PinOff,
  Trash2,
  MessageSquare,
  AlertCircle,
  Shield,
  CreditCard,
  Headphones,
  FileCheck,
  StickyNote,
} from 'lucide-react'
import { useUserNotes, invalidateAdminCache } from '@/hooks/use-admin-api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

// Format relative time
function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Validation schema
const addNoteSchema = z.object({
  note: z.string().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters'),
  category: z.enum(['general', 'support', 'billing', 'security', 'compliance']).default('general'),
})

type NoteCategory = 'general' | 'support' | 'billing' | 'security' | 'compliance'

const NOTE_CATEGORIES = [
  {
    value: 'general',
    label: 'General',
    icon: StickyNote,
    color: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  },
  {
    value: 'support',
    label: 'Support',
    icon: Headphones,
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  {
    value: 'billing',
    label: 'Billing',
    icon: CreditCard,
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  {
    value: 'security',
    label: 'Security',
    icon: Shield,
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
  },
  {
    value: 'compliance',
    label: 'Compliance',
    icon: FileCheck,
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
] as const

interface UserNote {
  id: string
  wallet_address: string
  note: string
  category: string
  admin_wallet_hash: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

interface UserNotesProps {
  walletAddress: string
  className?: string
}

export function UserNotes({ walletAddress, className }: UserNotesProps) {
  const { data, isLoading, error } = useUserNotes(walletAddress)
  const [isAdding, setIsAdding] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [togglingPin, setTogglingPin] = useState<string | null>(null)

  // Form state
  const [noteText, setNoteText] = useState('')
  const [category, setCategory] = useState<NoteCategory>('general')
  const [validationError, setValidationError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setNoteText('')
    setCategory('general')
    setValidationError(null)
  }, [])

  const refreshNotes = useCallback(() => {
    invalidateAdminCache(`/admin/credits/user/${walletAddress}/notes`)
  }, [walletAddress])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    setActionError(null)

    // Validate with zod
    const result = addNoteSchema.safeParse({ note: noteText, category })
    if (!result.success) {
      const firstError = result.error.errors[0]
      setValidationError(firstError?.message || 'Invalid input')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_URL}/admin/credits/user/${walletAddress}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText, category }),
      })

      if (!response.ok) {
        const responseData = await response.json()
        throw new Error(responseData.error || 'Failed to add note')
      }

      resetForm()
      setIsAdding(false)
      refreshNotes()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteNoteId) return

    setIsSubmitting(true)
    setActionError(null)

    try {
      const response = await fetch(`${API_URL}/admin/credits/notes/${deleteNoteId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const responseData = await response.json()
        throw new Error(responseData.error || 'Failed to delete note')
      }

      setDeleteNoteId(null)
      refreshNotes()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete note')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTogglePin = async (noteId: string, currentlyPinned: boolean) => {
    setTogglingPin(noteId)
    setActionError(null)

    try {
      const response = await fetch(`${API_URL}/admin/credits/notes/${noteId}/pin`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !currentlyPinned }),
      })

      if (!response.ok) {
        const responseData = await response.json()
        throw new Error(responseData.error || 'Failed to update note')
      }

      refreshNotes()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update note')
    } finally {
      setTogglingPin(null)
    }
  }

  const notes = data?.notes || []
  const pinnedNotes = notes.filter((n: UserNote) => n.is_pinned)
  const regularNotes = notes.filter((n: UserNote) => !n.is_pinned)
  const sortedNotes = [...pinnedNotes, ...regularNotes]

  const getCategoryConfig = (cat: string) => {
    return NOTE_CATEGORIES.find((c) => c.value === cat) || NOTE_CATEGORIES[0]
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Notes
          </CardTitle>
          <CardDescription>Internal notes about this user</CardDescription>
        </div>
        <Button
          size="sm"
          variant={isAdding ? 'secondary' : 'default'}
          onClick={() => {
            setIsAdding(!isAdding)
            if (!isAdding) resetForm()
          }}
        >
          {isAdding ? (
            'Cancel'
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" />
              Add Note
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {actionError && (
          <div className="text-destructive bg-destructive/10 flex items-center gap-2 rounded-lg p-3 text-sm">
            <AlertCircle className="h-4 w-4" />
            {actionError}
          </div>
        )}

        {isAdding && (
          <form onSubmit={handleSubmit} className="bg-muted/50 space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Textarea
                placeholder="Write a note..."
                className="resize-none"
                rows={3}
                value={noteText}
                onChange={(e) => {
                  setNoteText(e.target.value)
                  setValidationError(null)
                }}
              />
              <div className="text-muted-foreground flex justify-between text-xs">
                {validationError ? (
                  <span className="text-destructive">{validationError}</span>
                ) : (
                  <span />
                )}
                <span>{noteText.length}/2000</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as NoteCategory)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-3 w-3" />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Note'
                )}
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-muted-foreground py-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>Failed to load notes</p>
          </div>
        ) : sortedNotes.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>No notes yet</p>
            <p className="mt-1 text-sm">Add a note to keep track of user interactions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedNotes.map((note: UserNote) => {
              const categoryConfig = getCategoryConfig(note.category)
              const CategoryIcon = categoryConfig.icon

              return (
                <div
                  key={note.id}
                  className={`relative rounded-lg border p-3 ${
                    note.is_pinned ? 'border-yellow-500/30 bg-yellow-500/5' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="outline" className={categoryConfig.color}>
                          <CategoryIcon className="mr-1 h-3 w-3" />
                          {categoryConfig.label}
                        </Badge>
                        {note.is_pinned && (
                          <Badge
                            variant="outline"
                            className="border-yellow-500/20 bg-yellow-500/10 text-yellow-500"
                          >
                            <Pin className="mr-1 h-3 w-3" />
                            Pinned
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(note.created_at))}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm">{note.note}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleTogglePin(note.id, note.is_pinned)}
                        disabled={togglingPin === note.id}
                      >
                        {togglingPin === note.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : note.is_pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive h-7 w-7"
                        onClick={() => setDeleteNoteId(note.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
