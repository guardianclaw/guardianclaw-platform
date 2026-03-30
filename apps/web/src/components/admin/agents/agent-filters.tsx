'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

export interface AgentFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  framework: string
  onFrameworkChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  suspended: string
  onSuspendedChange: (value: string) => void
  frameworks: string[]
  onClear: () => void
  hasFilters: boolean
}

export function AgentFilters({
  search,
  onSearchChange,
  framework,
  onFrameworkChange,
  status,
  onStatusChange,
  suspended,
  onSuspendedChange,
  frameworks,
  onClear,
  hasFilters,
}: AgentFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <div className="min-w-[200px] flex-1">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Select
        value={framework || 'all'}
        onValueChange={(v) => onFrameworkChange(v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Framework" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Frameworks</SelectItem>
          {frameworks.map((fw) => (
            <SelectItem key={fw} value={fw}>
              {fw}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={status || 'all'} onValueChange={(v) => onStatusChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="testing">Testing</SelectItem>
          <SelectItem value="deployed">Deployed</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={suspended || 'all'}
        onValueChange={(v) => onSuspendedChange(v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Suspended" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="true">Suspended Only</SelectItem>
          <SelectItem value="false">Active Only</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="mr-1 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
