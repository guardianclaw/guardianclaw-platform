/**
 * DataTable Component
 *
 * A styled table component for displaying structured data in the whitepaper.
 * Supports headers, hover effects, striped rows, sticky headers, and responsive scrolling.
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import type { DataTableProps, DataTableColumn } from './types'

/**
 * Normalize headers to column definitions
 */
function normalizeHeaders(headers: string[] | DataTableColumn[]): DataTableColumn[] {
  if (headers.length === 0) return []

  if (typeof headers[0] === 'string') {
    return (headers as string[]).map((header) => ({
      header,
      align: 'left' as const,
    }))
  }

  return headers as DataTableColumn[]
}

/**
 * DataTable - Styled table for whitepaper data display
 *
 * @example
 * ```tsx
 * <DataTable
 *   headers={['Name', 'Value', 'Status']}
 *   rows={[
 *     ['Item 1', '100', <Badge>Active</Badge>],
 *     ['Item 2', '200', <Badge>Pending</Badge>],
 *   ]}
 *   highlightLast
 * />
 * ```
 */
export const DataTable = memo(function DataTable({
  headers,
  rows,
  highlightLast = false,
  striped = false,
  stickyHeader = false,
  caption,
  className,
}: DataTableProps) {
  const columns = normalizeHeaders(headers)

  if (columns.length === 0 || rows.length === 0) {
    return null
  }

  return (
    <div
      className={cn('my-6 overflow-x-auto rounded-xl border border-zinc-800', className)}
      role="region"
      aria-label={caption || 'Data table'}
      tabIndex={0}
    >
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
          <tr className="border-b border-zinc-800">
            {columns.map((column, i) => (
              <th
                key={i}
                scope="col"
                style={{ width: column.width }}
                className={cn(
                  'bg-zinc-900/80 px-4 py-3 font-semibold backdrop-blur-sm',
                  'text-zinc-300 first:rounded-tl-xl last:rounded-tr-xl',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.align === 'left' && 'text-left'
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => {
            const isLastRow = rowIndex === rows.length - 1
            const isHighlighted = highlightLast && isLastRow
            const isStriped = striped && rowIndex % 2 === 1

            return (
              <tr
                key={rowIndex}
                className={cn(
                  'border-b border-zinc-800/50 transition-colors duration-150',
                  isHighlighted && 'bg-claw-500/10 font-semibold',
                  isStriped && !isHighlighted && 'bg-zinc-900/30',
                  !isHighlighted && 'hover:bg-zinc-900/50'
                )}
              >
                {row.map((cell, cellIndex) => {
                  const column = columns[cellIndex]
                  return (
                    <td
                      key={cellIndex}
                      className={cn(
                        'px-4 py-3 text-zinc-400',
                        isHighlighted && 'text-zinc-200',
                        column?.align === 'center' && 'text-center',
                        column?.align === 'right' && 'text-right'
                      )}
                    >
                      {cell}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

DataTable.displayName = 'DataTable'

export default DataTable
