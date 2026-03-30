'use client'

/**
 * Twitter Configuration Form
 *
 * Form for entering Twitter/X API credentials with Zod validation.
 */

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type TwitterConfigData, validateTwitterConfig } from './validation'

interface TwitterConfigProps {
  data: TwitterConfigData
  onChange: (data: TwitterConfigData) => void
  onValidationChange?: (valid: boolean) => void
}

export type { TwitterConfigData }

export function TwitterConfig({ data, onChange, onValidationChange }: TwitterConfigProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Validate on data change
  useEffect(() => {
    const result = validateTwitterConfig(data)
    setErrors(result.errors)
    onValidationChange?.(result.valid)
  }, [data, onValidationChange])

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const showError = (field: string) => touched[field] && errors[field]

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="twitter-name">Connection Name</Label>
        <Input
          id="twitter-name"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          onBlur={() => handleBlur('name')}
          placeholder="My Twitter Bot"
          aria-invalid={!!showError('name')}
          aria-describedby={showError('name') ? 'twitter-name-error' : undefined}
        />
        {showError('name') ? (
          <p id="twitter-name-error" className="text-destructive text-xs">
            {errors.name}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            A friendly name to identify this connection
          </p>
        )}
      </div>

      {/* Bearer Token */}
      <div className="space-y-2">
        <Label htmlFor="twitter-token">Bearer Token</Label>
        <Input
          id="twitter-token"
          type="password"
          value={data.bearerToken}
          onChange={(e) => onChange({ ...data, bearerToken: e.target.value })}
          onBlur={() => handleBlur('bearerToken')}
          placeholder="AAAA..."
          aria-invalid={!!showError('bearerToken')}
          aria-describedby={showError('bearerToken') ? 'twitter-token-error' : undefined}
        />
        {showError('bearerToken') ? (
          <p id="twitter-token-error" className="text-destructive text-xs">
            {errors.bearerToken}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Your Twitter API v2 Bearer Token with tweet write permissions
          </p>
        )}
      </div>

      {/* Help link */}
      <div className="pt-2">
        <a
          href="https://developer.twitter.com/en/portal/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Get credentials from Twitter Developer Portal
        </a>
      </div>

      {/* Info box */}
      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="mb-1 font-medium">Requirements</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>Twitter Developer Account with Elevated access</li>
          <li>Project with OAuth 2.0 enabled</li>
          <li>Bearer Token with tweet.write limits</li>
        </ul>
      </div>
    </div>
  )
}
