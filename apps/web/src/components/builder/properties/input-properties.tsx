'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PropertyComponentProps } from '../properties-panel'

const inputTypes = [
  { value: 'user_message', label: 'User Message', description: 'Accept user input' },
  { value: 'api_call', label: 'API Call', description: 'Receive via API' },
  { value: 'webhook', label: 'Webhook', description: 'Trigger from webhook' },
]

export function InputProperties({ data, onChange }: PropertyComponentProps) {
  const config = (data.config as Record<string, unknown>) || {}

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  return (
    <div className="space-y-4">
      {/* Input Type */}
      <div className="space-y-2">
        <Label>Input Type</Label>
        <Select
          value={(data.inputType as string) || 'user_message'}
          onValueChange={(v) => onChange({ ...data, inputType: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {inputTypes.map((type) => (
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

      {/* Placeholder (for user_message) */}
      {data.inputType === 'user_message' && (
        <div className="space-y-2">
          <Label>Placeholder Text</Label>
          <Input
            value={(config.placeholder as string) || ''}
            onChange={(e) => handleConfigChange('placeholder', e.target.value)}
            placeholder="Type your message..."
          />
        </div>
      )}

      {/* Validation Pattern */}
      <div className="space-y-2">
        <Label>Validation Pattern (Regex)</Label>
        <Input
          value={(config.validation as string) || ''}
          onChange={(e) => handleConfigChange('validation', e.target.value)}
          placeholder="^.{1,1000}$"
        />
        <p className="text-muted-foreground text-xs">Optional regex to validate input format</p>
      </div>

      {/* Webhook URL (for webhook type) */}
      {data.inputType === 'webhook' && (
        <div className="space-y-2">
          <Label>Webhook Secret</Label>
          <Input
            value={(config.webhookSecret as string) || ''}
            onChange={(e) => handleConfigChange('webhookSecret', e.target.value)}
            placeholder="Optional secret for verification"
            type="password"
          />
        </div>
      )}
    </div>
  )
}
