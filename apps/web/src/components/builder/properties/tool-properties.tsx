'use client'

import { useState, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Globe,
  Search,
  Terminal,
  Database,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PropertyComponentProps } from '../properties-panel'

// Tool type definitions with metadata
const toolTypes = [
  {
    value: 'api_request',
    label: 'API Request',
    description: 'Call external REST APIs',
    icon: Globe,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  {
    value: 'web_search',
    label: 'Web Search',
    description: 'Search the web for information',
    icon: Search,
    color: 'text-green-500',
    bgColor: 'bg-green-50 border-green-200',
  },
  {
    value: 'code_exec',
    label: 'Code Execution',
    description: 'Run code in a sandboxed environment',
    icon: Terminal,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  {
    value: 'database',
    label: 'Database',
    description: 'Query SQL databases',
    icon: Database,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 border-orange-200',
  },
]

// HTTP methods for API requests
const httpMethods = [
  { value: 'GET', label: 'GET', description: 'Retrieve data', hasBody: false },
  { value: 'POST', label: 'POST', description: 'Create resource', hasBody: true },
  { value: 'PUT', label: 'PUT', description: 'Replace resource', hasBody: true },
  { value: 'PATCH', label: 'PATCH', description: 'Update resource', hasBody: true },
  { value: 'DELETE', label: 'DELETE', description: 'Remove resource', hasBody: false },
]

// Search providers
const searchProviders = [
  { value: 'duckduckgo', label: 'DuckDuckGo', description: 'Privacy-focused search' },
  { value: 'google', label: 'Google', description: 'Comprehensive results' },
  { value: 'bing', label: 'Bing', description: 'Microsoft search' },
]

// Code execution languages
const codeLanguages = [
  { value: 'python', label: 'Python', description: 'Python 3.11+' },
  { value: 'javascript', label: 'JavaScript', description: 'Node.js runtime' },
]

// Database types
const databaseTypes = [
  { value: 'postgresql', label: 'PostgreSQL', placeholder: 'postgresql://user:pass@host:5432/db' },
  { value: 'mysql', label: 'MySQL', placeholder: 'mysql://user:pass@host:3306/db' },
  { value: 'sqlite', label: 'SQLite', placeholder: 'sqlite:///path/to/db.sqlite' },
]

// SQL operations
const sqlOperations = [
  { value: 'select', label: 'SELECT', description: 'Read data' },
  { value: 'insert', label: 'INSERT', description: 'Create records' },
  { value: 'update', label: 'UPDATE', description: 'Modify records' },
  { value: 'delete', label: 'DELETE', description: 'Remove records' },
  { value: 'execute', label: 'EXECUTE', description: 'Custom SQL' },
]

// Validation helpers
function isValidUrl(url: string): boolean {
  if (!url) return true // Empty is valid (not filled yet)
  try {
    new URL(url)
    return true
  } catch {
    // Check for template variables
    if (url.includes('{{') && url.includes('}}')) return true
    return false
  }
}

function isValidJson(json: string): boolean {
  if (!json || !json.trim()) return true // Empty is valid
  try {
    JSON.parse(json)
    return true
  } catch {
    return false
  }
}

// Reusable validation indicator component
function ValidationIndicator({
  isValid,
  validMessage,
  invalidMessage,
}: {
  isValid: boolean
  validMessage: string
  invalidMessage: string
}) {
  return (
    <div className="mt-1 flex items-center gap-1">
      {isValid ? (
        <>
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span className="text-xs text-green-600">{validMessage}</span>
        </>
      ) : (
        <>
          <AlertCircle className="text-destructive h-3 w-3" />
          <span className="text-destructive text-xs">{invalidMessage}</span>
        </>
      )}
    </div>
  )
}

// Info banner component for each tool type
function ToolInfoBanner({ toolType }: { toolType: string }) {
  const tool = toolTypes.find((t) => t.value === toolType)
  if (!tool) return null

  const Icon = tool.icon

  const infoContent: Record<string, { title: string; description: string }> = {
    api_request: {
      title: 'External API Integration',
      description:
        'Make HTTP requests to external services. Supports authentication headers, request bodies, and automatic response parsing.',
    },
    web_search: {
      title: 'Web Search',
      description:
        'Search the web for real-time information. Uses DuckDuckGo by default for privacy. Results are returned as structured data.',
    },
    code_exec: {
      title: 'Sandboxed Code Execution',
      description:
        'Execute Python or JavaScript code safely. Uses RestrictedPython for security. Access input via "input_data" variable.',
    },
    database: {
      title: 'Database Query',
      description:
        'Execute SQL queries against PostgreSQL, MySQL, or SQLite databases. SELECT queries are validated for safety.',
    },
  }

  const info = infoContent[toolType]
  if (!info) return null

  return (
    <div className={cn('rounded-lg border p-3', tool.bgColor)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-5 w-5', tool.color)} />
        <div>
          <p className="text-sm font-medium">{info.title}</p>
          <p className="text-muted-foreground mt-1 text-xs">{info.description}</p>
        </div>
      </div>
    </div>
  )
}

// Toggle with label component
function ToggleWithLabel({
  label,
  description,
  checked,
  onCheckedChange,
  variant = 'default',
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  variant?: 'default' | 'warning'
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Switch checked={checked} onCheckedChange={onCheckedChange} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{checked ? 'Enabled' : 'Disabled'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// Main component
export function ToolProperties({ data, onChange }: PropertyComponentProps) {
  const config = useMemo(() => (data.config as Record<string, unknown>) || {}, [data.config])
  const toolType = (data.toolType as string) || 'api_request'

  // Local validation state for real-time feedback
  const [urlTouched, setUrlTouched] = useState(false)
  const [headersTouched, setHeadersTouched] = useState(false)
  const [bodyTouched, setBodyTouched] = useState(false)

  // Helper to update config
  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      onChange({
        ...data,
        config: { ...config, [key]: value },
      })
    },
    [data, config, onChange]
  )

  // Validation memoization
  const urlValid = useMemo(() => isValidUrl((config.url as string) || ''), [config.url])
  const headersValid = useMemo(
    () => isValidJson((config.headers as string) || ''),
    [config.headers]
  )
  const bodyValid = useMemo(() => isValidJson((config.body as string) || ''), [config.body])

  // Get current HTTP method config
  const currentMethod = httpMethods.find((m) => m.value === (config.method || 'GET'))
  const showBody = currentMethod?.hasBody ?? false

  return (
    <div className="space-y-4">
      {/* Tool Type Selector */}
      <div className="space-y-2">
        <Label>Tool Type</Label>
        <Select value={toolType} onValueChange={(v) => onChange({ ...data, toolType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {toolTypes.map((type) => {
              const Icon = type.icon
              return (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', type.color)} />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-muted-foreground text-xs">{type.description}</div>
                    </div>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Info Banner */}
      <ToolInfoBanner toolType={toolType} />

      {/* ============================================ */}
      {/* API REQUEST CONFIGURATION                   */}
      {/* ============================================ */}
      {toolType === 'api_request' && (
        <div className="space-y-4">
          {/* HTTP Method */}
          <div className="space-y-2">
            <Label>HTTP Method</Label>
            <Select
              value={(config.method as string) || 'GET'}
              onValueChange={(v) => handleConfigChange('method', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {httpMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-mono text-xs',
                          method.hasBody ? 'border-blue-300' : 'border-green-300'
                        )}
                      >
                        {method.value}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{method.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Endpoint URL</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Supports template variables like {'{{current_input}}'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={(config.url as string) || ''}
              onChange={(e) => {
                handleConfigChange('url', e.target.value)
                setUrlTouched(true)
              }}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://api.example.com/endpoint"
              className={cn('font-mono text-sm', urlTouched && !urlValid && 'border-destructive')}
            />
            {urlTouched && (config.url as string) && (
              <ValidationIndicator
                isValid={urlValid}
                validMessage="Valid URL"
                invalidMessage="Invalid URL format"
              />
            )}
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Headers (JSON)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>HTTP headers as JSON object. Example:</p>
                    <code className="text-xs">{`{"Authorization": "Bearer token"}`}</code>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              value={(config.headers as string) || ''}
              onChange={(e) => {
                handleConfigChange('headers', e.target.value)
                setHeadersTouched(true)
              }}
              onBlur={() => setHeadersTouched(true)}
              placeholder='{"Content-Type": "application/json"}'
              rows={3}
              className={cn(
                'font-mono text-sm',
                headersTouched && !headersValid && 'border-destructive'
              )}
            />
            {headersTouched && (config.headers as string) && (
              <ValidationIndicator
                isValid={headersValid}
                validMessage="Valid JSON"
                invalidMessage="Invalid JSON format"
              />
            )}
          </div>

          {/* Request Body (conditional) */}
          {showBody && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Request Body (JSON)</Label>
                <Badge variant="outline" className="text-xs">
                  {config.method as string}
                </Badge>
              </div>
              <Textarea
                value={(config.body as string) || ''}
                onChange={(e) => {
                  handleConfigChange('body', e.target.value)
                  setBodyTouched(true)
                }}
                onBlur={() => setBodyTouched(true)}
                placeholder='{"key": "value"}'
                rows={5}
                className={cn(
                  'font-mono text-sm',
                  bodyTouched && !bodyValid && 'border-destructive'
                )}
              />
              {bodyTouched && (config.body as string) && (
                <ValidationIndicator
                  isValid={bodyValid}
                  validMessage="Valid JSON"
                  invalidMessage="Invalid JSON format"
                />
              )}
              <p className="text-muted-foreground text-xs">
                Supports template variables: {'{{current_input}}'}, {'{{initial_input}}'}
              </p>
            </div>
          )}

          {/* Timeout */}
          <div className="space-y-2">
            <Label>Timeout: {((config.timeout as number) || 30000) / 1000}s</Label>
            <Slider
              value={[(config.timeout as number) || 30000]}
              onValueChange={([v]) => handleConfigChange('timeout', v)}
              min={5000}
              max={120000}
              step={5000}
            />
            <p className="text-muted-foreground text-xs">
              Maximum wait time for response (5s - 120s)
            </p>
          </div>

          {/* Fail on Error */}
          <ToggleWithLabel
            label="Fail on Error"
            description="Block flow execution if request fails"
            checked={(config.fail_on_error as boolean) !== false}
            onCheckedChange={(checked) => handleConfigChange('fail_on_error', checked)}
          />
        </div>
      )}

      {/* ============================================ */}
      {/* WEB SEARCH CONFIGURATION                    */}
      {/* ============================================ */}
      {toolType === 'web_search' && (
        <div className="space-y-4">
          {/* Search Provider */}
          <div className="space-y-2">
            <Label>Search Provider</Label>
            <Select
              value={(config.provider as string) || 'duckduckgo'}
              onValueChange={(v) => handleConfigChange('provider', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {searchProviders.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    <div>
                      <div className="font-medium">{provider.label}</div>
                      <div className="text-muted-foreground text-xs">{provider.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search Query */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Search Query</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground h-3 w-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Leave empty to use {'{{current_input}}'} as query</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              value={(config.query as string) || ''}
              onChange={(e) => handleConfigChange('query', e.target.value)}
              placeholder="{{current_input}}"
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Template variables: {'{{current_input}}'}, {'{{initial_input}}'}
            </p>
          </div>

          {/* Max Results */}
          <div className="space-y-2">
            <Label>Max Results: {(config.max_results as number) || 5}</Label>
            <Slider
              value={[(config.max_results as number) || 5]}
              onValueChange={([v]) => handleConfigChange('max_results', v)}
              min={1}
              max={20}
              step={1}
            />
            <p className="text-muted-foreground text-xs">
              Number of search results to return (1-20)
            </p>
          </div>

          {/* Fail on Error */}
          <ToggleWithLabel
            label="Fail on Error"
            description="Block flow if search fails"
            checked={(config.fail_on_error as boolean) === true}
            onCheckedChange={(checked) => handleConfigChange('fail_on_error', checked)}
          />

          {/* Output Preview */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2">
              <Info className="text-muted-foreground h-4 w-4" />
              <span className="text-sm font-medium">Output Format</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Results are stored in <code>items</code> and <code>current_input</code> as an array of
              objects with:
            </p>
            <ul className="text-muted-foreground ml-4 mt-1 list-disc text-xs">
              <li>
                <code>title</code> - Page title
              </li>
              <li>
                <code>href</code> - Page URL
              </li>
              <li>
                <code>body</code> - Snippet text
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* CODE EXECUTION CONFIGURATION                */}
      {/* ============================================ */}
      {toolType === 'code_exec' && (
        <div className="space-y-4">
          {/* Language */}
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={(config.language as string) || 'python'}
              onValueChange={(v) => handleConfigChange('language', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {codeLanguages.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <div>
                      <div className="font-medium">{lang.label}</div>
                      <div className="text-muted-foreground text-xs">{lang.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Code Editor */}
          <div className="space-y-2">
            <Label>Code</Label>
            <Textarea
              value={(config.code as string) || ''}
              onChange={(e) => handleConfigChange('code', e.target.value)}
              placeholder={
                (config.language as string) === 'python'
                  ? '# Access input via input_data\nresult = input_data.upper()'
                  : '// Access input via input_data\nresult = input_data.toUpperCase()'
              }
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Set <code>result</code> to return a value. Available: <code>input_data</code>,{' '}
              <code>items</code>
            </p>
          </div>

          {/* Security Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">Sandboxed Execution</p>
                <p className="mt-1 text-xs text-amber-700">
                  Code runs in RestrictedPython with limited builtins. File system, network, and
                  dangerous operations are blocked.
                </p>
              </div>
            </div>
          </div>

          {/* Timeout */}
          <div className="space-y-2">
            <Label>Timeout: {((config.timeout as number) || 5000) / 1000}s</Label>
            <Slider
              value={[(config.timeout as number) || 5000]}
              onValueChange={([v]) => handleConfigChange('timeout', v)}
              min={1000}
              max={30000}
              step={1000}
            />
            <p className="text-muted-foreground text-xs">Maximum execution time (1s - 30s)</p>
          </div>

          {/* Fail on Error */}
          <ToggleWithLabel
            label="Fail on Error"
            description="Block flow if code execution fails"
            checked={(config.fail_on_error as boolean) !== false}
            onCheckedChange={(checked) => handleConfigChange('fail_on_error', checked)}
          />
        </div>
      )}

      {/* ============================================ */}
      {/* DATABASE CONFIGURATION                      */}
      {/* ============================================ */}
      {toolType === 'database' && (
        <div className="space-y-4">
          {/* Database Type */}
          <div className="space-y-2">
            <Label>Database Type</Label>
            <Select
              value={(config.db_type as string) || 'postgresql'}
              onValueChange={(v) => handleConfigChange('db_type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {databaseTypes.map((db) => (
                  <SelectItem key={db.value} value={db.value}>
                    <div className="font-medium">{db.label}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Connection String */}
          <div className="space-y-2">
            <Label>Connection String</Label>
            <Input
              type="password"
              value={(config.connection_string as string) || ''}
              onChange={(e) => handleConfigChange('connection_string', e.target.value)}
              placeholder={
                databaseTypes.find((db) => db.value === (config.db_type || 'postgresql'))
                  ?.placeholder || 'postgresql://user:pass@host:5432/db'
              }
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Database URL with credentials. Stored securely.
            </p>
          </div>

          {/* Operation */}
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select
              value={(config.operation as string) || 'select'}
              onValueChange={(v) => handleConfigChange('operation', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sqlOperations.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {op.label}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{op.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SQL Query */}
          <div className="space-y-2">
            <Label>SQL Query</Label>
            <Textarea
              value={(config.query as string) || ''}
              onChange={(e) => handleConfigChange('query', e.target.value)}
              placeholder={
                (config.operation as string) === 'select'
                  ? 'SELECT * FROM users WHERE id = :user_id'
                  : 'UPDATE users SET name = :name WHERE id = :id'
              }
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Use <code>:param</code> syntax for parameters. Template variables supported.
            </p>
          </div>

          {/* Query Parameters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Query Parameters (JSON)</Label>
              <Badge variant="outline" className="text-xs">
                Optional
              </Badge>
            </div>
            <Textarea
              value={(config.params as string) || ''}
              onChange={(e) => handleConfigChange('params', e.target.value)}
              placeholder='{"user_id": "{{current_input}}"}'
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          {/* Security Warning for non-SELECT */}
          {(config.operation as string) !== 'select' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Write Operation</p>
                  <p className="mt-1 text-xs text-red-700">
                    This operation modifies data. Ensure proper input validation and use
                    parameterized queries to prevent SQL injection.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Timeout */}
          <div className="space-y-2">
            <Label>Timeout: {((config.timeout as number) || 30000) / 1000}s</Label>
            <Slider
              value={[(config.timeout as number) || 30000]}
              onValueChange={([v]) => handleConfigChange('timeout', v)}
              min={5000}
              max={120000}
              step={5000}
            />
          </div>

          {/* Fail on Error */}
          <ToggleWithLabel
            label="Fail on Error"
            description="Block flow if query fails"
            checked={(config.fail_on_error as boolean) !== false}
            onCheckedChange={(checked) => handleConfigChange('fail_on_error', checked)}
          />
        </div>
      )}

      {/* ============================================ */}
      {/* STATUS INDICATOR (All tools)                */}
      {/* ============================================ */}
      <div className="mt-4 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700">Tool Configured</span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {toolType === 'api_request' &&
            `${config.method || 'GET'} request to ${(config.url as string) || 'URL not set'}`}
          {toolType === 'web_search' &&
            `Search via ${(config.provider as string) || 'DuckDuckGo'}, max ${(config.max_results as number) || 5} results`}
          {toolType === 'code_exec' &&
            `${(config.language as string) || 'Python'} code, ${((config.timeout as number) || 5000) / 1000}s timeout`}
          {toolType === 'database' &&
            `${(config.operation as string)?.toUpperCase() || 'SELECT'} on ${(config.db_type as string) || 'PostgreSQL'}`}
        </p>
      </div>
    </div>
  )
}
