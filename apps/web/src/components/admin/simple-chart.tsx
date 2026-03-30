'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

export type ChartColor = 'claw' | 'blue' | 'green' | 'red' | 'yellow'

export interface SimpleChartProps {
  data: Array<{ [key: string]: unknown }>
  dataKey: string
  labelKey?: string
  color?: ChartColor
  height?: number
  maxItems?: number
  showLabels?: boolean
  formatValue?: (value: number) => string
  formatLabel?: (label: string) => string
}

const colorMap: Record<ChartColor, string> = {
  claw: 'bg-claw-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
}

const hoverColorMap: Record<ChartColor, string> = {
  claw: 'hover:bg-claw-400',
  blue: 'hover:bg-blue-400',
  green: 'hover:bg-green-400',
  red: 'hover:bg-red-400',
  yellow: 'hover:bg-yellow-400',
}

export function SimpleChart({
  data,
  dataKey,
  labelKey,
  color = 'claw',
  height = 96,
  maxItems = 30,
  showLabels = false,
  formatValue = (v) => v.toLocaleString(),
  formatLabel = (l) => l,
}: SimpleChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.slice(-maxItems).map((d, i) => ({
      value: Number(d[dataKey]) || 0,
      label: labelKey ? String(d[labelKey]) : `Item ${i + 1}`,
      originalIndex: i,
    }))
  }, [data, dataKey, labelKey, maxItems])

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map((d) => d.value), 1)
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-center text-sm"
        style={{ height }}
      >
        No data available
      </div>
    )
  }

  const barColor = colorMap[color]
  const barHoverColor = hoverColorMap[color]

  return (
    <div className="relative" style={{ height }}>
      {/* Tooltip */}
      {hoveredIndex !== null && chartData[hoveredIndex] && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded border px-2 py-1 text-xs shadow-lg"
          style={{
            bottom: '100%',
            left: `${(hoveredIndex / chartData.length) * 100}%`,
            transform: 'translateX(-50%)',
            marginBottom: 4,
          }}
        >
          <div className="font-medium">{formatValue(chartData[hoveredIndex].value)}</div>
          <div className="text-muted-foreground">{formatLabel(chartData[hoveredIndex].label)}</div>
        </div>
      )}

      {/* Chart */}
      <div className="flex h-full items-end gap-0.5">
        {chartData.map((item, i) => {
          const heightPercent = (item.value / maxValue) * 100
          return (
            <div
              key={i}
              className={cn(
                'flex-1 cursor-pointer rounded-t transition-all',
                barColor,
                barHoverColor,
                hoveredIndex === i ? 'opacity-100' : 'opacity-80'
              )}
              style={{
                height: `${heightPercent}%`,
                minHeight: item.value > 0 ? '2px' : '0',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          )
        })}
      </div>

      {/* X-axis labels */}
      {showLabels && chartData.length <= 12 && (
        <div className="text-muted-foreground mt-1 flex justify-between text-xs">
          {chartData.map((item, i) => (
            <span key={i} className="flex-1 truncate text-center">
              {formatLabel(item.label)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Utility functions for common value formatting
export const formatters = {
  number: (v: number) => v.toLocaleString(),
  percent: (v: number) => `${v.toFixed(1)}%`,
  currency: (v: number) => `$${v.toFixed(2)}`,
  compact: (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
    return v.toLocaleString()
  },
  ms: (v: number) => `${v.toFixed(0)}ms`,
}

// Utility functions for common label formatting
export const labelFormatters = {
  date: (l: string) => {
    try {
      return new Date(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return l
    }
  },
  time: (l: string) => {
    try {
      return new Date(l).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return l
    }
  },
  hour: (l: string) => {
    try {
      return new Date(l).toLocaleTimeString('en-US', { hour: 'numeric' })
    } catch {
      return l
    }
  },
}
