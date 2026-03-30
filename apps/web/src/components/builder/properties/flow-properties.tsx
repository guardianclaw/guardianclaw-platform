'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { PropertyComponentProps } from '../properties-panel'

const flowTypes = [
  { value: 'router', label: 'Router', description: 'Route based on conditions' },
  { value: 'merge', label: 'Merge', description: 'Combine multiple branches' },
  { value: 'loop', label: 'Loop', description: 'Iterate over items' },
]

const mergeModes = [
  { value: 'first', label: 'First', description: 'Use first completed branch' },
  { value: 'all', label: 'All', description: 'Wait for all branches' },
  { value: 'concat', label: 'Concatenate', description: 'Combine all results' },
]

export function FlowProperties({ data, onChange }: PropertyComponentProps) {
  const config = (data.config as Record<string, unknown>) || {}
  const flowType = (data.flowType as string) || 'router'

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  return (
    <div className="space-y-4">
      {/* Flow Type */}
      <div className="space-y-2">
        <Label>Flow Type</Label>
        <Select value={flowType} onValueChange={(v) => onChange({ ...data, flowType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {flowTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-muted-foreground text-xs">{type.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Router properties */}
      {flowType === 'router' && (
        <>
          <div className="space-y-2">
            <Label>Default Branch</Label>
            <Input
              value={(config.defaultTarget as string) || ''}
              onChange={(e) => handleConfigChange('defaultTarget', e.target.value)}
              placeholder="Node ID for default route"
            />
            <p className="text-muted-foreground text-xs">Used when no conditions match</p>
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <Label className="text-muted-foreground text-xs uppercase">Conditions</Label>
            <p className="text-muted-foreground text-sm">
              Configure routing conditions in the flow by connecting to target nodes. Conditions are
              evaluated in order.
            </p>
          </div>
        </>
      )}

      {/* Merge properties */}
      {flowType === 'merge' && (
        <>
          <div className="space-y-2">
            <Label>Merge Mode</Label>
            <Select
              value={(config.mode as string) || 'first'}
              onValueChange={(v) => handleConfigChange('mode', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mergeModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    <div>
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-muted-foreground text-xs">{mode.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Wait for All</Label>
              <p className="text-muted-foreground text-xs">
                Wait for all branches before continuing
              </p>
            </div>
            <Switch
              checked={(config.waitForAll as boolean) || false}
              onCheckedChange={(v) => handleConfigChange('waitForAll', v)}
            />
          </div>
        </>
      )}

      {/* Loop properties */}
      {flowType === 'loop' && (
        <>
          <div className="space-y-2">
            <Label>Max Iterations: {(config.maxIterations as number) || 100}</Label>
            <Slider
              value={[(config.maxIterations as number) || 100]}
              onValueChange={([v]) => handleConfigChange('maxIterations', v)}
              min={1}
              max={1000}
              step={10}
            />
            <p className="text-muted-foreground text-xs">Safety limit to prevent infinite loops</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Collect Results</Label>
              <p className="text-muted-foreground text-xs">Gather results from each iteration</p>
            </div>
            <Switch
              checked={(config.collectResults as boolean) ?? true}
              onCheckedChange={(v) => handleConfigChange('collectResults', v)}
            />
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <Label className="text-muted-foreground text-xs uppercase">Input Format</Label>
            <p className="text-muted-foreground text-sm">
              Loop expects an array in <code className="bg-muted rounded px-1">current_data</code>.
              Each item is processed sequentially.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
