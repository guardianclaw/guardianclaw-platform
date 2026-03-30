'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

const utilityTypes = [
  { value: 'delay', label: 'Delay', description: 'Pause execution' },
  { value: 'log', label: 'Log', description: 'Log data for debugging' },
]

const logLevels = [
  { value: 'debug', label: 'Debug', description: 'Verbose debugging info' },
  { value: 'info', label: 'Info', description: 'General information' },
  { value: 'warn', label: 'Warning', description: 'Potential issues' },
  { value: 'error', label: 'Error', description: 'Error conditions' },
]

export function UtilityProperties({ data, onChange }: PropertyComponentProps) {
  const config = (data.config as Record<string, unknown>) || {}
  const utilityType = (data.utilityType as string) || 'delay'

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  return (
    <div className="space-y-4">
      {/* Utility Type */}
      <div className="space-y-2">
        <Label>Utility Type</Label>
        <Select value={utilityType} onValueChange={(v) => onChange({ ...data, utilityType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {utilityTypes.map((type) => (
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

      {/* Delay properties */}
      {utilityType === 'delay' && (
        <>
          <div className="space-y-2">
            <Label>Delay Duration: {(config.seconds as number) || 1}s</Label>
            <Slider
              value={[(config.seconds as number) || 1]}
              onValueChange={([v]) => handleConfigChange('seconds', v)}
              min={0.1}
              max={60}
              step={0.1}
            />
            <p className="text-muted-foreground text-xs">Maximum delay is 60 seconds</p>
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <Label className="text-muted-foreground text-xs uppercase">Use Cases</Label>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li>• Rate limiting API calls</li>
              <li>• Throttling requests</li>
              <li>• Simulating processing time</li>
            </ul>
          </div>
        </>
      )}

      {/* Log properties */}
      {utilityType === 'log' && (
        <>
          <div className="space-y-2">
            <Label>Log Level</Label>
            <Select
              value={(config.level as string) || 'info'}
              onValueChange={(v) => handleConfigChange('level', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {logLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div>
                      <div className="font-medium">{level.label}</div>
                      <div className="text-muted-foreground text-xs">{level.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message Template</Label>
            <Textarea
              value={(config.message as string) || ''}
              onChange={(e) => handleConfigChange('message', e.target.value)}
              placeholder="Processing step: {{current_data}}"
              rows={3}
            />
            <p className="text-muted-foreground text-xs">
              Use {'{{variable}}'} for template substitution
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Include Data</Label>
              <p className="text-muted-foreground text-xs">Log current_data value</p>
            </div>
            <Switch
              checked={(config.includeData as boolean) || false}
              onCheckedChange={(v) => handleConfigChange('includeData', v)}
            />
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <Label className="text-muted-foreground text-xs uppercase">Note</Label>
            <p className="text-muted-foreground text-sm">
              Logs are captured in the execution trace and can be viewed in the test results for
              debugging purposes.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
