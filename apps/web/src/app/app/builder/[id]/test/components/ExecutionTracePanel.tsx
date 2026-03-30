'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ExecutionStep {
  step_id: string
  step_name: string
  step_type: string
  category: string
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped'
  duration_ms?: number
  error?: string
}

interface ExecutionTracePanelProps {
  trace: ExecutionStep[]
  showTrace: boolean
  onToggleTrace: () => void
}

export function ExecutionTracePanel({ trace, showTrace, onToggleTrace }: ExecutionTracePanelProps) {
  return (
    <div className="bg-muted/30 w-80 overflow-y-auto border-l">
      <div className="border-b p-4">
        <button
          onClick={onToggleTrace}
          className="flex w-full items-center gap-2 text-sm font-medium"
        >
          {showTrace ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Execution Trace
        </button>
      </div>

      {showTrace && trace.length > 0 && (
        <div className="space-y-2 p-4">
          {trace.map((step, index) => (
            <TraceStep key={step.step_id} step={step} isLast={index === trace.length - 1} />
          ))}
        </div>
      )}

      {showTrace && trace.length === 0 && (
        <div className="text-muted-foreground p-4 text-center text-sm">
          Send a message to see the execution trace
        </div>
      )}
    </div>
  )
}

interface TraceStepProps {
  step: ExecutionStep
  isLast: boolean
}

function TraceStep({ step, isLast }: TraceStepProps) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="flex flex-col items-center">
        <StepIndicator status={step.status} />
        {!isLast && <div className="bg-border h-8 w-0.5" />}
      </div>

      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">{step.step_name}</span>
          {step.duration_ms !== undefined && (
            <span className="text-muted-foreground text-xs">{step.duration_ms.toFixed(0)}ms</span>
          )}
        </div>
        <span className="text-muted-foreground text-xs capitalize">
          {step.step_type.replace(/_/g, ' ')}
        </span>
        {step.category && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            {step.category}
          </Badge>
        )}
        {step.error && <p className="mt-1 text-xs text-red-500">{step.error}</p>}
      </div>
    </div>
  )
}

function StepIndicator({ status }: { status: ExecutionStep['status'] }) {
  return (
    <div
      className={cn(
        'h-3 w-3 rounded-full border-2',
        status === 'success' && 'border-green-500 bg-green-500',
        status === 'error' && 'border-red-500 bg-red-500',
        status === 'running' && 'animate-pulse border-yellow-500 bg-yellow-500',
        status === 'skipped' && 'border-gray-400 bg-gray-400',
        status === 'pending' && 'border-gray-300'
      )}
    />
  )
}
