'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Info,
  Lock,
  Database,
  Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import { agentsApi } from '@/lib/api'

// Protection levels with their configurations
const protectionLevels = [
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Basic safety checks only',
    icon: Shield,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    gates: { credibility: false, avoidance: true, limits: false, worth: false },
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Recommended for most use cases',
    icon: ShieldCheck,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    gates: { credibility: true, avoidance: true, limits: true, worth: false },
  },
  {
    value: 'maximum',
    label: 'Maximum',
    description: 'Full CLAW protocol for high-risk applications',
    icon: ShieldAlert,
    color: 'text-claw-500',
    bgColor: 'bg-claw-100',
    gates: { credibility: true, avoidance: true, limits: true, worth: true },
  },
]

// Available modules
const availableModules = [
  {
    id: 'fiduciary',
    name: 'Fiduciary Guard',
    description: 'Financial transaction protection for DeFi agents',
    icon: Lock,
    recommended: ['coinbase_agentkit', 'solana_agent_kit', 'virtuals_protocol'],
  },
  {
    id: 'memory_shield',
    name: 'Memory Shield',
    description: 'HMAC protection against memory injection attacks',
    icon: Database,
    recommended: ['coinbase_agentkit', 'solana_agent_kit', 'virtuals_protocol'],
  },
  {
    id: 'compliance',
    name: 'Compliance Checker',
    description: 'EU AI Act and regulatory compliance validation',
    icon: Scale,
    recommended: [],
  },
]

// CLAW gates
const gates = [
  {
    id: 'credibility',
    name: 'Credibility',
    letter: 'C',
    description: 'Verify factual accuracy and prevent misinformation',
    color: 'bg-blue-500',
  },
  {
    id: 'limits',
    name: 'Limits',
    letter: 'L',
    description: 'Assess potential harm to users, systems, or society',
    color: 'bg-red-500',
  },
  {
    id: 'avoidance',
    name: 'Avoidance',
    letter: 'A',
    description: 'Check if the request is within appropriate boundaries',
    color: 'bg-amber-500',
  },
  {
    id: 'worth',
    name: 'Worth',
    letter: 'W',
    description: 'Require clear beneficial purpose for all actions',
    color: 'bg-green-500',
  },
]

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full',
        'border-2 border-transparent transition-colors duration-200 ease-in-out',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-claw-600' : 'bg-input'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full',
          'bg-background shadow-lg ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}

export function GuardianClawPageClient() {
  const router = useRouter()
  const { agent, isDemo, refetch } = useAgent()

  // Local state for editing
  const [protectionLevel, setProtectionLevel] = useState<string>(
    agent?.claw_config?.protection_level || 'standard'
  )
  const [gateConfig, setGateConfig] = useState<Record<string, boolean>>(
    agent?.claw_config?.gates || { credibility: true, avoidance: true, limits: true, worth: false }
  )
  const [modules, setModules] = useState<Record<string, { enabled: boolean }>>(
    (agent?.claw_config as any)?.modules || {}
  )

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Check if there are unsaved changes
  const hasChanges =
    agent &&
    (protectionLevel !== agent.claw_config?.protection_level ||
      JSON.stringify(gateConfig) !== JSON.stringify(agent.claw_config?.gates) ||
      JSON.stringify(modules) !== JSON.stringify((agent.claw_config as any)?.modules || {}))

  // Handle protection level change (updates gates accordingly)
  const handleProtectionLevelChange = (level: string) => {
    setProtectionLevel(level)
    const levelConfig = protectionLevels.find((l) => l.value === level)
    if (levelConfig) {
      setGateConfig(levelConfig.gates)
    }
    setSuccess(false)
  }

  // Handle individual gate toggle
  const handleGateToggle = (gateId: string, enabled: boolean) => {
    setGateConfig((prev) => ({ ...prev, [gateId]: enabled }))
    setSuccess(false)
  }

  // Handle module toggle
  const handleModuleToggle = (moduleId: string, enabled: boolean) => {
    setModules((prev) => ({
      ...prev,
      [moduleId]: { enabled },
    }))
    setSuccess(false)
  }

  // Save changes
  const handleSave = useCallback(async () => {
    if (!agent || isDemo) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      await agentsApi.update(agent.id, {
        claw_config: {
          protection_level: protectionLevel as 'minimal' | 'standard' | 'maximum',
          gates: gateConfig as {
            credibility: boolean
            avoidance: boolean
            limits: boolean
            worth: boolean
          },
          modules,
        },
      })

      setSuccess(true)
      refetch()

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to save claw config:', err)
      setError(err.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }, [agent, isDemo, protectionLevel, gateConfig, modules, refetch])

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading claw config...</p>
        </div>
      </div>
    )
  }

  // Demo mode notice
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <Shield className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">GuardianClaw Config Not Available</h2>
          <p className="text-muted-foreground">
            Sign in to configure GuardianClaw protection for your agents.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="text-claw-500 h-6 w-6" />
            GuardianClaw Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure CLAW protection gates and security modules for {agent.name}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border-destructive/20 mb-6 rounded-lg border p-4">
            <p className="text-destructive flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
            <p className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Configuration saved successfully
            </p>
          </div>
        )}

        {/* Protection Level */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Protection Level</CardTitle>
            <CardDescription>Choose the overall protection level for your agent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {protectionLevels.map((level) => {
                const Icon = level.icon
                const isSelected = protectionLevel === level.value
                return (
                  <button
                    key={level.value}
                    onClick={() => handleProtectionLevelChange(level.value)}
                    className={cn(
                      'rounded-lg border-2 p-4 text-left transition-all',
                      isSelected
                        ? 'border-claw-500 bg-claw-50'
                        : 'border-border hover:border-muted-foreground/50'
                    )}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <div className={cn('rounded-lg p-2', level.bgColor)}>
                        <Icon className={cn('h-5 w-5', level.color)} />
                      </div>
                      <div>
                        <p className="font-semibold">{level.label}</p>
                        {isSelected && (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">{level.description}</p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* CLAW Gates */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              CLAW Protocol Gates
              <Badge variant="outline" className="ml-2">
                {Object.values(gateConfig).filter(Boolean).length}/4 Active
              </Badge>
            </CardTitle>
            <CardDescription>Fine-tune which validation gates are active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {gates.map((gate) => {
                const isEnabled = gateConfig[gate.id] ?? false
                return (
                  <div
                    key={gate.id}
                    className="bg-muted/50 flex items-center justify-between rounded-lg p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white',
                          isEnabled ? gate.color : 'bg-gray-300'
                        )}
                      >
                        {gate.letter}
                      </div>
                      <div>
                        <p className="font-medium">{gate.name} Gate</p>
                        <p className="text-muted-foreground text-sm">{gate.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleGateToggle(gate.id, checked)}
                    />
                  </div>
                )
              })}
            </div>

            {/* Info note */}
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-start gap-2 text-blue-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm">
                  All four gates must pass for an action to proceed. The Worth gate is recommended
                  for high-risk applications like DeFi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Modules */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Security Modules</CardTitle>
            <CardDescription>
              Enable additional security features for specialized protection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableModules.map((module) => {
                const isEnabled = modules[module.id]?.enabled ?? false
                const isRecommended = module.recommended.includes(agent.framework)
                const Icon = module.icon
                return (
                  <div
                    key={module.id}
                    className="bg-muted/50 flex items-center justify-between rounded-lg p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          isEnabled ? 'bg-claw-100 text-claw-600' : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{module.name}</p>
                          {isRecommended && (
                            <Badge variant="secondary" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-sm">{module.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleModuleToggle(module.id, checked)}
                    />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {hasChanges ? (
              <span className="text-amber-600">You have unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="bg-claw-600 hover:bg-claw-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  )
}
