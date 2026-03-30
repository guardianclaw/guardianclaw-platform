'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Brain,
  Search,
  Trash2,
  Archive,
  RotateCcw,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  Clock,
  Hash,
  Zap,
  User,
  Bot,
  XCircle,
  Eye,
  ChevronDown,
  BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import {
  memoriesApi,
  MemorySession,
  MemorySessionDetail,
  ConversationMemoryStats,
  MemorySearchResult,
} from '@/lib/api'

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  return date.toLocaleDateString()
}

// Memory strategy labels
const STRATEGY_LABELS: Record<string, { label: string; description: string }> = {
  sliding_window: { label: 'Sliding Window', description: 'Keeps last N messages' },
  summary: { label: 'Summary', description: 'Summarizes older messages' },
  full: { label: 'Full History', description: 'Keeps all messages' },
  none: { label: 'No Memory', description: 'Stateless conversations' },
}

export function MemoryPageClient() {
  const { agent, isDemo } = useAgent()
  const agentId = agent?.id || ''

  // State
  const [memories, setMemories] = useState<MemorySession[]>([])
  const [stats, setStats] = useState<ConversationMemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Selected memory
  const [selectedMemory, setSelectedMemory] = useState<MemorySessionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; permanent: boolean } | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)

  // Context collapse toggle
  const [contextExpanded, setContextExpanded] = useState(false)

  // Load memories
  const loadMemories = useCallback(async () => {
    if (!agentId || isDemo) return

    setLoading(true)
    setError(null)

    try {
      const [memoriesData, statsData] = await Promise.all([
        memoriesApi.list(agentId, {
          status: statusFilter,
          search: searchQuery || undefined,
          limit: 50,
        }),
        memoriesApi.stats(agentId),
      ])

      setMemories(memoriesData.memories)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load memories:', err)
      setError('Failed to load memories')
    } finally {
      setLoading(false)
    }
  }, [agentId, isDemo, statusFilter, searchQuery])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  // Load memory detail
  const loadMemoryDetail = async (conversationId: string) => {
    if (!agentId) return

    setLoadingDetail(true)

    try {
      const data = await memoriesApi.get(agentId, conversationId)
      setSelectedMemory(data)
    } catch (err) {
      console.error('Failed to load memory detail:', err)
      setError('Failed to load memory details')
    } finally {
      setLoadingDetail(false)
    }
  }

  // Delete memory
  const handleDelete = async () => {
    if (!agentId || !deleteTarget) return

    try {
      await memoriesApi.delete(agentId, deleteTarget.id, deleteTarget.permanent)
      setSuccess(deleteTarget.permanent ? 'Memory deleted permanently' : 'Memory archived')
      setDeleteTarget(null)
      loadMemories()
      if (selectedMemory?.id === deleteTarget.id) {
        setSelectedMemory(null)
      }
    } catch (err) {
      console.error('Failed to delete memory:', err)
      setError('Failed to delete memory')
    }
  }

  // Clear all memories
  const handleClearAll = async (permanent: boolean) => {
    if (!agentId) return

    try {
      const result = await memoriesApi.clearAll(agentId, permanent)
      setSuccess(`${result.count} memories ${permanent ? 'deleted' : 'archived'}`)
      setClearAllOpen(false)
      loadMemories()
      setSelectedMemory(null)
    } catch (err) {
      console.error('Failed to clear memories:', err)
      setError('Failed to clear memories')
    }
  }

  // Restore memory
  const handleRestore = async (conversationId: string) => {
    if (!agentId) return

    try {
      await memoriesApi.restore(agentId, conversationId)
      setSuccess('Memory restored')
      loadMemories()
    } catch (err) {
      console.error('Failed to restore memory:', err)
      setError('Failed to restore memory')
    }
  }

  // Search memories
  const handleSearch = async () => {
    if (!agentId || !searchInput.trim()) return

    setSearching(true)

    try {
      const result = await memoriesApi.search(agentId, searchInput, 20)
      setSearchResults(result.results)
    } catch (err) {
      console.error('Failed to search memories:', err)
      setError('Failed to search memories')
    } finally {
      setSearching(false)
    }
  }

  // Clear messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Demo mode message
  if (isDemo) {
    return (
      <div className="bg-muted/20 flex h-full items-center justify-center">
        <div className="max-w-md p-8 text-center">
          <Brain className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Memory Viewer</h2>
          <p className="text-muted-foreground">
            Memory management is not available in demo mode. Sign in to view and manage your
            agent&apos;s conversation history.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Memory List */}
      <div className="flex w-1/3 flex-col border-r">
        {/* Header */}
        <div className="border-b p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Memory Sessions</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={loadMemories} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setClearAllOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'archived')}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="bg-muted/30 border-b p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{stats.stats.total_conversations}</div>
                <div className="text-muted-foreground text-xs">Sessions</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.stats.total_messages}</div>
                <div className="text-muted-foreground text-xs">Messages</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {stats.stats.total_tokens.toLocaleString()}
                </div>
                <div className="text-muted-foreground text-xs">Tokens</div>
              </div>
            </div>
          </div>
        )}

        {/* Status messages */}
        {error && (
          <div className="bg-destructive/10 text-destructive mx-4 mt-4 flex items-center gap-2 rounded-lg p-2 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-green-500/10 p-2 text-sm text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Memory List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-muted-foreground flex h-32 flex-col items-center justify-center">
              <MessageSquare className="mb-2 h-8 w-8" />
              <p className="text-sm">No memory sessions found</p>
            </div>
          ) : (
            <div className="divide-y">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className={cn(
                    'hover:bg-muted/50 cursor-pointer p-4 transition-colors',
                    selectedMemory?.id === memory.id && 'bg-muted'
                  )}
                  onClick={() => loadMemoryDetail(memory.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{memory.title || 'Untitled'}</span>
                        {memory.status === 'archived' && (
                          <Badge variant="secondary" className="text-xs">
                            <Archive className="mr-1 h-3 w-3" />
                            Archived
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {memory.message_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {memory.total_tokens.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(memory.last_message_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Memory Detail */}
      <div className="flex flex-1 flex-col">
        {loadingDetail ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : selectedMemory ? (
          <>
            {/* Detail Header */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedMemory.title || 'Untitled Session'}
                  </h2>
                  <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                    <Badge variant="outline">
                      {STRATEGY_LABELS[selectedMemory.memory_strategy]?.label ||
                        selectedMemory.memory_strategy}
                    </Badge>
                    <span>Context: {selectedMemory.context_window} messages</span>
                    <span>{selectedMemory.message_count} messages</span>
                    <span>{selectedMemory.total_tokens.toLocaleString()} tokens</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedMemory.status === 'archived' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(selectedMemory.id)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget({ id: selectedMemory.id, permanent: false })}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: selectedMemory.id, permanent: true })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-auto p-4">
              {selectedMemory.messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role !== 'user' && (
                    <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <Bot className="text-primary h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg p-3',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.role === 'system'
                          ? 'bg-muted border'
                          : 'bg-muted'
                    )}
                  >
                    {message.blocked && (
                      <div className="text-destructive mb-2 flex items-center gap-1 text-xs">
                        <XCircle className="h-3 w-3" />
                        Blocked: {message.blocked_reason || message.blocked_gate}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs opacity-70">
                      <span>#{message.position}</span>
                      {message.latency_ms && <span>{message.latency_ms}ms</span>}
                      {message.model_used && <span>{message.model_used}</span>}
                      {(message.input_tokens || message.output_tokens) && (
                        <span>
                          {message.input_tokens || 0}+{message.output_tokens || 0} tokens
                        </span>
                      )}
                    </div>
                  </div>
                  {message.role === 'user' && (
                    <div className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <User className="text-primary-foreground h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Context Info */}
            {selectedMemory.context && selectedMemory.context.length > 0 && (
              <div className="border-t p-4">
                <Collapsible open={contextExpanded} onOpenChange={setContextExpanded}>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm">
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        contextExpanded && 'rotate-180'
                      )}
                    />
                    Context Data ({selectedMemory.context.length} entries)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {selectedMemory.context.map((ctx, index) => (
                      <div key={index} className="bg-muted rounded p-2 text-xs">
                        <div className="font-medium">{ctx.context_key}</div>
                        <pre className="mt-1 overflow-auto">
                          {JSON.stringify(ctx.context_value, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 items-center justify-center">
            <div className="text-center">
              <Eye className="mx-auto mb-4 h-12 w-12" />
              <p>Select a memory session to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.permanent ? 'Delete Memory?' : 'Archive Memory?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.permanent
                ? 'This will permanently delete this memory session and all messages. This action cannot be undone.'
                : 'This will archive the memory session. You can restore it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={deleteTarget?.permanent ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {deleteTarget?.permanent ? 'Delete' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Memories?</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how you want to clear memories for this agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Button
              variant="outline"
              onClick={() => handleClearAll(false)}
              className="justify-start"
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive All (recoverable)
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleClearAll(true)}
              className="justify-start"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Permanently
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Search Memories</DialogTitle>
            <DialogDescription>Search through all message content</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter search query..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-4 flex-1 overflow-auto">
            {searchResults.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                {searchInput ? 'No results found' : 'Enter a search query'}
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div
                    key={result.message_id}
                    className="hover:bg-muted/50 cursor-pointer rounded-lg border p-3"
                    onClick={() => {
                      loadMemoryDetail(result.conversation_id)
                      setSearchOpen(false)
                    }}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{result.role}</Badge>
                      <span className="text-muted-foreground truncate">
                        {result.conversation_title || 'Untitled'}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(result.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{result.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
