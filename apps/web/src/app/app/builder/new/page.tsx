'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { agentsApi } from '@/lib/api'
import { Header } from '@/components/layout/header'
import { TEMPLATES, Template, ConfigField, getTemplateById } from '@/lib/templates'
import { buildAgentPayload, getGatesForProtectionLevel } from '@/lib/template-utils'

type Step = 'template' | 'config' | 'protection'

// Protection levels with CLAW gates
const protectionLevels = [
  {
    id: 'minimal' as const,
    name: 'Minimal',
    description: 'Basic harm prevention, lower latency',
    gates: getGatesForProtectionLevel('minimal'),
  },
  {
    id: 'standard' as const,
    name: 'Standard',
    description: 'Balanced protection for most use cases',
    gates: getGatesForProtectionLevel('standard'),
  },
  {
    id: 'maximum' as const,
    name: 'Maximum',
    description: 'Full CLAW protocol, highest safety',
    gates: getGatesForProtectionLevel('maximum'),
  },
]

export default function NewAgentPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [step, setStep] = useState<Step>('template')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('openai_agents')
  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({})
  const [protectionLevel, setProtectionLevel] = useState<string>('standard')

  // Get selected template
  const selectedTemplate = getTemplateById(selectedTemplateId)

  // Initialize config values when template changes
  useEffect(() => {
    if (selectedTemplate) {
      const defaults: Record<string, string | number | boolean> = {}
      Object.entries(selectedTemplate.requiredConfig).forEach(([key, field]) => {
        if (field.default !== undefined) {
          defaults[key] = field.default
        } else if (field.required) {
          defaults[key] = field.type === 'number' || field.type === 'slider' ? 0 : ''
        }
      })
      setConfigValues(defaults)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  const canProceed = () => {
    if (step === 'template') return selectedTemplateId !== null
    if (step === 'config' && selectedTemplate) {
      // Check all required fields
      return Object.entries(selectedTemplate.requiredConfig).every(([key, field]) => {
        if (!field.required) return true
        const value = configValues[key]
        if (typeof value === 'string') return value.trim().length > 0
        return value !== undefined && value !== null
      })
    }
    if (step === 'protection') return protectionLevel !== null
    return false
  }

  const handleNext = () => {
    console.log('[CreateAgent] handleNext called, step:', step, 'canProceed:', canProceed())
    setError(null)
    if (step === 'template') setStep('config')
    else if (step === 'config') setStep('protection')
    else if (step === 'protection') {
      console.log('[CreateAgent] Calling handleCreate...')
      handleCreate()
    }
  }

  const handleBack = () => {
    setError(null)
    if (step === 'config') setStep('template')
    else if (step === 'protection') setStep('config')
  }

  const handleConfigChange = (key: string, value: string | number | boolean) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleCreate = async () => {
    console.log('[CreateAgent] handleCreate called', {
      isAuthenticated,
      selectedTemplate: selectedTemplate?.id,
    })

    if (!isAuthenticated) {
      console.log('[CreateAgent] Not authenticated')
      setError('Please connect your wallet to create an agent.')
      return
    }

    if (!selectedTemplate) {
      console.log('[CreateAgent] No template selected')
      setError('Please select a template.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use centralized buildAgentPayload for consistency
      const payload = buildAgentPayload(
        selectedTemplate,
        configValues,
        protectionLevel as 'minimal' | 'standard' | 'maximum'
      )
      console.log('[CreateAgent] Payload built:', payload.name)

      const agent = await agentsApi.create(payload)
      console.log('[CreateAgent] Agent created:', agent.id)
      router.push(`/app/builder/${agent.id}/flow`)
    } catch (err) {
      console.error('Failed to create agent:', err)
      // Show more specific error message
      if (err instanceof Error) {
        if (err.message.includes('409') || err.message.includes('already exists')) {
          setError('An agent with this name already exists. Please choose a different name.')
        } else if (err.message.includes('403') || err.message.includes('limit')) {
          setError('Agent limit reached. Please upgrade your plan or delete existing agents.')
        } else if (err.message.includes('401') || err.message.includes('token')) {
          setError('Session expired. Please reconnect your wallet.')
        } else {
          setError(err.message || 'Failed to create agent. Please try again.')
        }
      } else {
        setError('Failed to create agent. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const stepIndex = step === 'template' ? 0 : step === 'config' ? 1 : 2

  // Render config field based on type
  const renderConfigField = (key: string, field: ConfigField) => {
    const value = configValues[key]

    switch (field.type) {
      case 'text':
        return (
          <Input
            id={key}
            value={(value as string) || ''}
            onChange={(e) => handleConfigChange(key, e.target.value)}
            placeholder={field.label}
          />
        )

      case 'textarea':
        return (
          <Textarea
            id={key}
            value={(value as string) || ''}
            onChange={(e) => handleConfigChange(key, e.target.value)}
            placeholder={field.label}
            rows={4}
          />
        )

      case 'select':
        return (
          <Select value={(value as string) || ''} onValueChange={(v) => handleConfigChange(key, v)}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'slider':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{field.min ?? 0}</span>
              <span className="font-medium">{value ?? field.default ?? 0}</span>
              <span className="text-muted-foreground">{field.max ?? 100}</span>
            </div>
            <Slider
              value={[(value as number) ?? (field.default as number) ?? 0]}
              onValueChange={([v]) => handleConfigChange(key, v)}
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
            />
          </div>
        )

      case 'number':
        return (
          <Input
            id={key}
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => handleConfigChange(key, parseFloat(e.target.value) || 0)}
            min={field.min}
            max={field.max}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container max-w-4xl flex-1 py-8">
        {/* Back link */}
        <Link
          href="/app/builder"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Link>

        {/* Title */}
        <h1 className="mb-2 text-3xl font-bold">Create New Agent</h1>
        <p className="text-muted-foreground mb-8">
          Choose an integration template and configure your agent
        </p>

        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {['Template', 'Configure', 'Protection'].map((label, i) => (
            <div key={label} className="flex items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                  i < stepIndex
                    ? 'bg-claw-500 text-white'
                    : i === stepIndex
                      ? 'bg-claw-500/20 text-claw-500 border-claw-500 border-2'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'ml-2 hidden text-sm sm:inline',
                  i === stepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
              {i < 2 && <div className="bg-border mx-2 h-px w-8" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="mb-8">
          {/* Step 1: Template Selection */}
          {step === 'template' && (
            <div className="space-y-6">
              {/* Frameworks */}
              <div>
                <h3 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
                  Agent Frameworks
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {TEMPLATES.filter((t) => t.category === 'frameworks').map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selectedTemplateId === template.id}
                      onSelect={() => setSelectedTemplateId(template.id)}
                    />
                  ))}
                </div>
              </div>

              {/* DeFi */}
              <div>
                <h3 className="text-muted-foreground mb-3 text-sm font-medium uppercase tracking-wide">
                  DeFi & Crypto
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {TEMPLATES.filter((t) => t.category === 'defi').map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selectedTemplateId === template.id}
                      onSelect={() => setSelectedTemplateId(template.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 'config' && selectedTemplate && (
            <div className="space-y-6">
              {/* Template info */}
              <div className="bg-muted/50 flex items-start gap-4 rounded-lg p-4">
                {selectedTemplate.logoUrl ? (
                  <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                    <Image
                      src={selectedTemplate.logoUrl}
                      alt={selectedTemplate.name}
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain dark:invert"
                      unoptimized
                    />
                  </div>
                ) : (
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                )}
                <div>
                  <h3 className="font-semibold">{selectedTemplate.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {selectedTemplate.longDescription || selectedTemplate.description}
                  </p>
                  {selectedTemplate.documentation && (
                    <a
                      href={selectedTemplate.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-claw-500 mt-2 inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      <Info className="h-3 w-3" />
                      View documentation
                    </a>
                  )}
                </div>
              </div>

              {/* Config fields */}
              <div className="space-y-4">
                {Object.entries(selectedTemplate.requiredConfig).map(([key, field]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.description && (
                      <p className="text-muted-foreground text-xs">{field.description}</p>
                    )}
                    {renderConfigField(key, field)}
                  </div>
                ))}
              </div>

              {/* Security modules preview */}
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 text-sm font-medium">Security Modules</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.securityModules
                    .filter((m) => m.enabled)
                    .map((module) => (
                      <Badge key={module.id} variant="secondary" className="text-xs">
                        {module.name}
                      </Badge>
                    ))}
                  {selectedTemplate.securityModules.filter((m) => m.enabled).length === 0 && (
                    <span className="text-muted-foreground text-sm">
                      No modules enabled by default
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  You can enable additional modules after creation
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Protection Level */}
          {step === 'protection' && (
            <RadioGroup value={protectionLevel} onValueChange={setProtectionLevel}>
              <div className="space-y-4">
                {protectionLevels.map((level) => (
                  <div
                    key={level.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors',
                      protectionLevel === level.id
                        ? 'border-claw-500 bg-claw-500/5'
                        : 'hover:border-foreground/20'
                    )}
                    onClick={() => setProtectionLevel(level.id)}
                  >
                    <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={level.id} className="cursor-pointer text-base font-medium">
                        {level.name}
                      </Label>
                      <p className="text-muted-foreground mb-3 text-sm">{level.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(level.gates).map(([gate, enabled]) => (
                          <span
                            key={gate}
                            className={cn(
                              'rounded px-2 py-1 text-xs capitalize',
                              enabled
                                ? 'bg-claw-500/20 text-claw-400'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {gate}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 'template' || loading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className="bg-claw-600 hover:bg-claw-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : step === 'protection' ? (
              <>
                Create Agent
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  )
}

// Template card component
function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: Template
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      className={cn(
        'hover:border-foreground/20 cursor-pointer transition-all',
        selected && 'border-claw-500 bg-claw-500/5'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-xl',
              selected ? 'bg-claw-500 text-white' : 'bg-muted'
            )}
          >
            {template.logoUrl ? (
              <Image
                src={template.logoUrl}
                alt={template.name}
                width={20}
                height={20}
                className={cn(
                  'h-5 w-5 object-contain',
                  selected ? 'brightness-0 invert' : 'dark:invert'
                )}
                loading="lazy"
                unoptimized
              />
            ) : (
              template.icon
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium">{template.name}</h3>
              {template.tags.includes('popular') && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Popular
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground line-clamp-2 text-sm">{template.description}</p>
          </div>
          {selected && <Check className="text-claw-500 h-5 w-5 shrink-0" />}
        </div>
      </CardContent>
    </Card>
  )
}
