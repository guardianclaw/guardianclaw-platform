'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { agentsApi, ApiError } from '@/lib/api'
import { TEMPLATES, Template, SecurityModule, getTemplateById } from '@/lib/templates'
import {
  buildAgentPayload,
  getDefaultProtectionLevel,
  getDefaultModulesForTemplate,
} from '@/lib/template-utils'
import { ArrowLeft, Check, Shield, Loader2 } from 'lucide-react'

interface CreateAgentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = 'template' | 'config' | 'modules'

export function CreateAgentDialog({ open, onOpenChange }: CreateAgentDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('template')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Config state
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({})

  // Modules state
  const [modules, setModules] = useState<SecurityModule[]>([])

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    // Initialize config with defaults
    const defaultConfig: Record<string, string | number | boolean> = {}
    Object.entries(template.requiredConfig).forEach(([key, field]) => {
      if (field.default !== undefined) {
        defaultConfig[key] = field.default
      }
    })
    setConfig(defaultConfig)
    // Use template-utils to get properly configured modules for this template
    const defaultModules = getDefaultModulesForTemplate(template)
    const modulesWithDefaults = template.securityModules.map((m) => ({
      ...m,
      enabled: defaultModules[m.id]?.enabled ?? m.enabled,
    }))
    setModules(modulesWithDefaults)
    setStep('config')
  }

  const handleModuleToggle = (moduleId: string) => {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, enabled: !m.enabled } : m)))
  }

  const handleSubmit = async () => {
    if (!selectedTemplate) return

    const name = config.name as string
    if (!name?.trim()) {
      setError('Agent name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Determine protection level based on template category
      const protectionLevel = getDefaultProtectionLevel(selectedTemplate)

      // Build complete payload using template-utils
      const payload = buildAgentPayload(selectedTemplate, config, protectionLevel)

      // Override modules with user-configured values
      payload.claw_config.modules = modules.reduce(
        (acc, m) => ({
          ...acc,
          [m.id]: { enabled: m.enabled },
        }),
        {}
      )

      const agent = await agentsApi.create(payload)

      // Reset form
      resetForm()

      // Close dialog and navigate to builder
      onOpenChange(false)
      router.push(`/app/builder/${agent.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to create agent')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setStep('template')
    setSelectedTemplate(null)
    setConfig({})
    setModules([])
    setError(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  const goBack = () => {
    if (step === 'config') setStep('template')
    else if (step === 'modules') setStep('config')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('sm:max-w-[600px]', step === 'template' && 'sm:max-w-[700px]')}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== 'template' && (
              <Button variant="ghost" size="icon" onClick={goBack} className="h-6 w-6">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle>
              {step === 'template' && 'Select Template'}
              {step === 'config' && `Configure ${selectedTemplate?.name}`}
              {step === 'modules' && 'Security Modules'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {step === 'template' && 'Choose a template to get started quickly'}
            {step === 'config' && 'Configure your agent settings'}
            {step === 'modules' && 'Enable security modules to protect your agent'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Template Selection */}
        {step === 'template' && (
          <div className="grid max-h-[400px] grid-cols-2 gap-3 overflow-y-auto py-4">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={cn(
                  'flex flex-col items-start rounded-lg border p-4 text-left transition-all',
                  'hover:border-claw-500 hover:bg-claw-500/5',
                  'focus:ring-claw-500 focus:outline-none focus:ring-2'
                )}
              >
                <div className="mb-2 flex items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    {template.logoUrl ? (
                      <Image
                        src={template.logoUrl}
                        alt={template.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain dark:invert"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <span className="text-lg">{template.icon}</span>
                    )}
                  </div>
                  <span className="font-medium">{template.name}</span>
                </div>
                <p className="text-muted-foreground line-clamp-2 text-sm">{template.description}</p>
                <div className="mt-2 flex gap-1">
                  {template.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 'config' && selectedTemplate && (
          <div className="max-h-[400px] space-y-4 overflow-y-auto py-4">
            {Object.entries(selectedTemplate.requiredConfig).map(([key, field]) => (
              <div key={key} className="grid gap-2">
                <Label htmlFor={key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {field.type === 'text' && (
                  <Input
                    id={key}
                    value={(config[key] as string) || ''}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    disabled={isLoading}
                  />
                )}

                {field.type === 'textarea' && (
                  <Textarea
                    id={key}
                    value={(config[key] as string) || ''}
                    onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                    disabled={isLoading}
                    rows={3}
                  />
                )}

                {field.type === 'select' && field.options && (
                  <Select
                    value={(config[key] as string) || ''}
                    onValueChange={(value) => setConfig({ ...config, [key]: value })}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === 'slider' && (
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[Number(config[key]) || Number(field.default) || 0]}
                      onValueChange={([value]) => setConfig({ ...config, [key]: value })}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm">
                      {Number(config[key]) || field.default}
                    </span>
                  </div>
                )}

                {field.type === 'number' && (
                  <Input
                    id={key}
                    type="number"
                    value={(config[key] as number) || ''}
                    onChange={(e) => setConfig({ ...config, [key]: parseInt(e.target.value) || 0 })}
                    min={field.min}
                    max={field.max}
                    disabled={isLoading}
                  />
                )}

                {field.description && (
                  <p className="text-muted-foreground text-xs">{field.description}</p>
                )}
              </div>
            ))}

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}

        {/* Step 3: Security Modules */}
        {step === 'modules' && (
          <div className="max-h-[400px] space-y-3 overflow-y-auto py-4">
            {modules.map((module) => (
              <div
                key={module.id}
                className={cn(
                  'flex items-start gap-4 rounded-lg border p-4 transition-all',
                  module.enabled && 'border-claw-500 bg-claw-500/5'
                )}
              >
                <Switch
                  checked={module.enabled}
                  onCheckedChange={() => handleModuleToggle(module.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield
                      className={cn(
                        'h-4 w-4',
                        module.enabled ? 'text-claw-500' : 'text-muted-foreground'
                      )}
                    />
                    <span className="font-medium">{module.name}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">{module.description}</p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    SDK: {module.sdkClass}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>

          {step === 'config' && (
            <Button onClick={() => setStep('modules')} disabled={isLoading}>
              Next: Security Modules
            </Button>
          )}

          {step === 'modules' && (
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create Agent
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
