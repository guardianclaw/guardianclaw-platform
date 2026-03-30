'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { PropertyComponentProps } from '../properties-panel'

const memoryTypes = [
  { value: 'buffer', label: 'Buffer', description: 'Short-term conversation memory' },
  { value: 'vector', label: 'Vector', description: 'Long-term semantic memory' },
  { value: 'summary', label: 'Summary', description: 'Compressed conversation summary' },
]

const bufferOperations = [
  { value: 'add', label: 'Add', description: 'Add message to buffer' },
  { value: 'get', label: 'Get', description: 'Retrieve buffer contents' },
  { value: 'clear', label: 'Clear', description: 'Clear all messages' },
]

const vectorOperations = [
  { value: 'store', label: 'Store', description: 'Store with embedding' },
  { value: 'search', label: 'Search', description: 'Find similar content' },
  { value: 'clear', label: 'Clear', description: 'Clear vector store' },
]

const summaryModels = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast, cost-effective' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Higher quality' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku', description: 'Fast, accurate' },
]

export function MemoryProperties({ data, onChange }: PropertyComponentProps) {
  const config = (data.config as Record<string, unknown>) || {}
  const memoryType = (data.memoryType as string) || 'buffer'

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  return (
    <div className="space-y-4">
      {/* Memory Type */}
      <div className="space-y-2">
        <Label>Memory Type</Label>
        <Select value={memoryType} onValueChange={(v) => onChange({ ...data, memoryType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {memoryTypes.map((type) => (
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

      {/* Buffer properties */}
      {memoryType === 'buffer' && (
        <>
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select
              value={(config.operation as string) || 'get'}
              onValueChange={(v) => handleConfigChange('operation', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bufferOperations.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    <div>
                      <div className="font-medium">{op.label}</div>
                      <div className="text-muted-foreground text-xs">{op.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Buffer Size: {(config.bufferSize as number) || 10} messages</Label>
            <Slider
              value={[(config.bufferSize as number) || 10]}
              onValueChange={([v]) => handleConfigChange('bufferSize', v)}
              min={1}
              max={50}
              step={1}
            />
            <p className="text-muted-foreground text-xs">Maximum messages to keep in memory</p>
          </div>
        </>
      )}

      {/* Vector properties */}
      {memoryType === 'vector' && (
        <>
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select
              value={(config.operation as string) || 'search'}
              onValueChange={(v) => handleConfigChange('operation', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vectorOperations.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    <div>
                      <div className="font-medium">{op.label}</div>
                      <div className="text-muted-foreground text-xs">{op.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(config.operation === 'search' || !config.operation) && (
            <>
              <div className="space-y-2">
                <Label>Top K Results: {(config.topK as number) || 5}</Label>
                <Slider
                  value={[(config.topK as number) || 5]}
                  onValueChange={([v]) => handleConfigChange('topK', v)}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Similarity Threshold: {((config.threshold as number) || 0.7).toFixed(2)}
                </Label>
                <Slider
                  value={[(config.threshold as number) || 0.7]}
                  onValueChange={([v]) => handleConfigChange('threshold', v)}
                  min={0}
                  max={1}
                  step={0.05}
                />
                <p className="text-muted-foreground text-xs">
                  Minimum similarity score (0-1) for results
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Summary properties */}
      {memoryType === 'summary' && (
        <>
          <div className="space-y-2">
            <Label>Summarization Model</Label>
            <Select
              value={(config.model as string) || 'gpt-4o-mini'}
              onValueChange={(v) => handleConfigChange('model', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {summaryModels.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div>
                      <div className="font-medium">{model.label}</div>
                      <div className="text-muted-foreground text-xs">{model.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Max Summary Length: {(config.maxLength as number) || 500} chars</Label>
            <Slider
              value={[(config.maxLength as number) || 500]}
              onValueChange={([v]) => handleConfigChange('maxLength', v)}
              min={100}
              max={2000}
              step={100}
            />
          </div>

          <div className="bg-muted/50 space-y-2 rounded-lg p-3">
            <Label className="text-muted-foreground text-xs uppercase">How it works</Label>
            <p className="text-muted-foreground text-sm">
              Summarizes the conversation buffer into a compressed form. Useful for long
              conversations to reduce token usage.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
