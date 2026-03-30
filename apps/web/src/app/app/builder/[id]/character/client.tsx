'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Sparkles,
  BookOpen,
  Tags,
  Ban,
  Palette,
  Brain,
  MessageSquare,
  Save,
  RotateCcw,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Upload,
  Plus,
  Trash2,
  Info,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import {
  characterApi,
  agentExportApi,
  CharacterConfig,
  CharacterExample,
  MemoryIntegrityConfig,
} from '@/lib/api'

// Default character config
const DEFAULT_CHARACTER: CharacterConfig = {
  name: '',
  personality: '',
  bio: '',
  topics: [],
  forbidden_topics: [],
  adjectives: [],
  knowledge: [],
  examples: [],
}

const DEFAULT_MEMORY_INTEGRITY: MemoryIntegrityConfig = {
  enabled: true,
  verify_on_read: true,
  sign_on_write: true,
  min_trust_score: 0.5,
}

export function CharacterPageClient() {
  const { agent, isDemo } = useAgent()
  const agentId = agent?.id || ''

  // State
  const [character, setCharacter] = useState<CharacterConfig>(DEFAULT_CHARACTER)
  const [memoryIntegrity, setMemoryIntegrity] =
    useState<MemoryIntegrityConfig>(DEFAULT_MEMORY_INTEGRITY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalCharacter, setOriginalCharacter] = useState<CharacterConfig>(DEFAULT_CHARACTER)

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResponse, setPreviewResponse] = useState<string | null>(null)

  // Reset confirmation
  const [resetOpen, setResetOpen] = useState(false)

  // Import/Export
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Load character
  const loadCharacter = useCallback(async () => {
    if (!agentId || isDemo) return

    setLoading(true)
    setError(null)

    try {
      const data = await characterApi.get(agentId)
      const loadedCharacter = data.character || DEFAULT_CHARACTER
      setCharacter(loadedCharacter)
      setOriginalCharacter(loadedCharacter)
      setMemoryIntegrity(data.memory_integrity || DEFAULT_MEMORY_INTEGRITY)
    } catch (err) {
      console.error('Failed to load character:', err)
      setError('Failed to load character configuration')
    } finally {
      setLoading(false)
    }
  }, [agentId, isDemo])

  useEffect(() => {
    loadCharacter()
  }, [loadCharacter])

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(character) !== JSON.stringify(originalCharacter)
    setHasChanges(changed)
  }, [character, originalCharacter])

  // Save character
  const handleSave = async () => {
    if (!agentId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await characterApi.update(agentId, {
        character,
        memory_integrity: memoryIntegrity,
      })
      setOriginalCharacter(result.character)
      setSuccess('Character saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to save character:', err)
      setError('Failed to save character')
    } finally {
      setSaving(false)
    }
  }

  // Reset character
  const handleReset = async () => {
    if (!agentId) return

    setSaving(true)
    setError(null)

    try {
      const result = await characterApi.reset(agentId)
      setCharacter(result.character)
      setOriginalCharacter(result.character)
      setMemoryIntegrity(result.memory_integrity)
      setSuccess('Character reset to defaults')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to reset character:', err)
      setError('Failed to reset character')
    } finally {
      setSaving(false)
      setResetOpen(false)
    }
  }

  // Preview response
  const handlePreview = async () => {
    if (!agentId || !previewMessage.trim()) return

    setPreviewLoading(true)
    setPreviewResponse(null)

    try {
      const result = await characterApi.preview(agentId, previewMessage)
      if (result.preview_available) {
        setPreviewResponse(result.response || 'No response generated')
      } else {
        setPreviewResponse(
          `Preview not available: ${result.message || 'OpenAI API key not configured'}`
        )
      }
    } catch (err) {
      console.error('Failed to preview:', err)
      setPreviewResponse('Failed to generate preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Export character
  const handleExport = async (format: 'claw' | 'elizaos') => {
    if (!agentId) return

    setExporting(true)

    try {
      const data = await agentExportApi.export(agentId, { format })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${agent?.name || 'agent'}_${format}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess(`Exported as ${format} format`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Failed to export:', err)
      setError('Failed to export configuration')
    } finally {
      setExporting(false)
    }
  }

  // Import character
  const handleImport = async () => {
    if (!agentId || !importData.trim()) return

    setImporting(true)
    setError(null)

    try {
      const data = JSON.parse(importData)
      const result = await agentExportApi.import(agentId, data, { merge: true })
      setSuccess(`Imported ${result.format} configuration successfully`)
      setImportOpen(false)
      setImportData('')
      loadCharacter()
    } catch (err) {
      console.error('Failed to import:', err)
      if (err instanceof SyntaxError) {
        setError('Invalid JSON format')
      } else {
        setError('Failed to import configuration')
      }
    } finally {
      setImporting(false)
    }
  }

  // Update helpers
  const updateCharacter = (field: keyof CharacterConfig, value: unknown) => {
    setCharacter((prev) => ({ ...prev, [field]: value }))
  }

  const addToArray = (
    field: 'topics' | 'forbidden_topics' | 'adjectives' | 'knowledge',
    value: string
  ) => {
    if (!value.trim()) return
    setCharacter((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), value.trim()],
    }))
  }

  const removeFromArray = (
    field: 'topics' | 'forbidden_topics' | 'adjectives' | 'knowledge',
    index: number
  ) => {
    setCharacter((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }))
  }

  const addKnowledgeItem = () => {
    setCharacter((prev) => ({
      ...prev,
      knowledge: [...(prev.knowledge || []), ''],
    }))
  }

  const addExample = () => {
    setCharacter((prev) => ({
      ...prev,
      examples: [...(prev.examples || []), { user: '', assistant: '' }],
    }))
  }

  const updateExample = (index: number, field: 'user' | 'assistant', value: string) => {
    setCharacter((prev) => ({
      ...prev,
      examples: (prev.examples || []).map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      ),
    }))
  }

  const removeExample = (index: number) => {
    setCharacter((prev) => ({
      ...prev,
      examples: (prev.examples || []).filter((_, i) => i !== index),
    }))
  }

  // Demo mode message
  if (isDemo) {
    return (
      <div className="bg-muted/20 flex h-full items-center justify-center">
        <div className="max-w-md p-8 text-center">
          <User className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Character Editor</h2>
          <p className="text-muted-foreground">
            Character configuration is not available in demo mode. Sign in to define your
            agent&apos;s personality.
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading character...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Character Configuration</h1>
            <p className="text-muted-foreground">
              Define your agent&apos;s personality, knowledge, and behavior
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Export/Import buttons */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('claw')}>
                  GuardianClaw Format
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('elizaos')}>
                  ElizaOS Format
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Play className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="bg-destructive/10 text-destructive mb-4 flex items-center gap-2 rounded-lg p-3">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="identity" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="identity">
              <User className="mr-2 h-4 w-4" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="personality">
              <Sparkles className="mr-2 h-4 w-4" />
              Personality
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <Brain className="mr-2 h-4 w-4" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="safety">
              <Shield className="mr-2 h-4 w-4" />
              Safety
            </TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Agent Identity</CardTitle>
                <CardDescription>Basic information about your agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={character.name || ''}
                    onChange={(e) => updateCharacter('name', e.target.value)}
                    placeholder="Enter agent name..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio / Background</Label>
                  <Textarea
                    id="bio"
                    value={character.bio || ''}
                    onChange={(e) => updateCharacter('bio', e.target.value)}
                    placeholder="Describe your agent's background and context..."
                    rows={4}
                  />
                  <p className="text-muted-foreground text-xs">
                    Provide background information that helps define who your agent is.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Personality Tab */}
          <TabsContent value="personality" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personality Description</CardTitle>
                <CardDescription>
                  Define how your agent should behave and communicate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="personality">Personality</Label>
                  <Textarea
                    id="personality"
                    value={character.personality || ''}
                    onChange={(e) => updateCharacter('personality', e.target.value)}
                    placeholder="Describe your agent's personality, tone, and communication style..."
                    rows={6}
                  />
                  <p className="text-muted-foreground text-xs">
                    This is the core personality prompt that defines how your agent responds.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Personality Traits
                  </div>
                </CardTitle>
                <CardDescription>Adjectives that describe your agent</CardDescription>
              </CardHeader>
              <CardContent>
                <TagInput
                  tags={character.adjectives || []}
                  onAdd={(value) => addToArray('adjectives', value)}
                  onRemove={(index) => removeFromArray('adjectives', index)}
                  placeholder="Add a trait (e.g., friendly, professional, witty)..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Conversation Examples
                  </div>
                </CardTitle>
                <CardDescription>
                  Few-shot examples to guide your agent&apos;s responses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(character.examples || []).map((example, index) => (
                  <div key={index} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Example {index + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeExample(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label>User message</Label>
                      <Input
                        value={example.user}
                        onChange={(e) => updateExample(index, 'user', e.target.value)}
                        placeholder="What the user says..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Agent response</Label>
                      <Textarea
                        value={example.assistant}
                        onChange={(e) => updateExample(index, 'assistant', e.target.value)}
                        placeholder="How the agent should respond..."
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addExample} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Example
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Tab */}
          <TabsContent value="knowledge" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    Topics
                  </div>
                </CardTitle>
                <CardDescription>Topics your agent is knowledgeable about</CardDescription>
              </CardHeader>
              <CardContent>
                <TagInput
                  tags={character.topics || []}
                  onAdd={(value) => addToArray('topics', value)}
                  onRemove={(index) => removeFromArray('topics', index)}
                  placeholder="Add a topic (e.g., cryptocurrency, cooking, travel)..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Ban className="h-5 w-5" />
                    Forbidden Topics
                  </div>
                </CardTitle>
                <CardDescription>
                  Topics your agent should avoid or decline to discuss
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TagInput
                  tags={character.forbidden_topics || []}
                  onAdd={(value) => addToArray('forbidden_topics', value)}
                  onRemove={(index) => removeFromArray('forbidden_topics', index)}
                  placeholder="Add a forbidden topic..."
                  variant="destructive"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Knowledge Base
                  </div>
                </CardTitle>
                <CardDescription>
                  Specific facts or information your agent should know
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(character.knowledge || []).map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const newKnowledge = [...(character.knowledge || [])]
                        newKnowledge[index] = e.target.value
                        updateCharacter('knowledge', newKnowledge)
                      }}
                      placeholder="Enter a fact..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromArray('knowledge', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={addKnowledgeItem} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Knowledge Item
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Memory Integrity
                  </div>
                </CardTitle>
                <CardDescription>
                  Protect your agent&apos;s memory from tampering and injection attacks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Memory Integrity</Label>
                    <p className="text-muted-foreground text-sm">
                      Sign and verify memories using HMAC-SHA256
                    </p>
                  </div>
                  <Switch
                    checked={memoryIntegrity.enabled}
                    onCheckedChange={(checked) =>
                      setMemoryIntegrity((prev) => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>

                {memoryIntegrity.enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Verify on Read</Label>
                        <p className="text-muted-foreground text-sm">
                          Check signature when loading memories
                        </p>
                      </div>
                      <Switch
                        checked={memoryIntegrity.verify_on_read}
                        onCheckedChange={(checked) =>
                          setMemoryIntegrity((prev) => ({ ...prev, verify_on_read: checked }))
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Sign on Write</Label>
                        <p className="text-muted-foreground text-sm">
                          Sign new memories when storing
                        </p>
                      </div>
                      <Switch
                        checked={memoryIntegrity.sign_on_write}
                        onCheckedChange={(checked) =>
                          setMemoryIntegrity((prev) => ({ ...prev, sign_on_write: checked }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Minimum Trust Score</Label>
                        <span className="text-muted-foreground text-sm">
                          {memoryIntegrity.min_trust_score.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        value={[memoryIntegrity.min_trust_score]}
                        onValueChange={([value]) =>
                          setMemoryIntegrity((prev) => ({ ...prev, min_trust_score: value }))
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        className="py-2"
                      />
                      <p className="text-muted-foreground text-xs">
                        Memories below this trust score will be flagged
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview Character</DialogTitle>
              <DialogDescription>
                Test how your agent would respond with the current character configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test Message</Label>
                <Input
                  value={previewMessage}
                  onChange={(e) => setPreviewMessage(e.target.value)}
                  placeholder="Type a message to test..."
                  onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                />
              </div>
              <Button
                onClick={handlePreview}
                disabled={previewLoading || !previewMessage.trim()}
                className="w-full"
              >
                {previewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Generate Preview
              </Button>
              {previewResponse && (
                <div className="bg-muted rounded-lg p-4">
                  <Label className="text-muted-foreground mb-2 block text-xs">Response</Label>
                  <p className="whitespace-pre-wrap">{previewResponse}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Confirmation */}
        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Character?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all character configuration to defaults. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Configuration</DialogTitle>
              <DialogDescription>
                Paste a GuardianClaw or ElizaOS character.json configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON configuration here..."
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Supports both GuardianClaw export format and ElizaOS character.json format.
                Configuration will be merged with existing settings.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing || !importData.trim()}>
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Tag Input Component
function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  variant = 'default',
}: {
  tags: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
  placeholder: string
  variant?: 'default' | 'destructive'
}) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      onAdd(inputValue)
      setInputValue('')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <Badge
            key={index}
            variant={variant === 'destructive' ? 'destructive' : 'secondary'}
            className="px-2 py-1"
          >
            {tag}
            <button onClick={() => onRemove(index)} className="hover:text-foreground ml-2">
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <p className="text-muted-foreground text-xs">Press Enter to add</p>
    </div>
  )
}
