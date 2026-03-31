/**
 * Tool Executor Service
 *
 * Orchestrates execution of tool nodes in agent flows.
 * Handles tool execution order, result aggregation, and error handling.
 *
 * Supported tool types:
 * - web_search: Web search using Serper/DuckDuckGo
 * - api_request: HTTP requests to external APIs
 * - code_exec: Sandboxed code execution (future)
 * - database: Database queries (future)
 *
 * @example
 * const result = await executeTool(toolConfig, context, credentials)
 */

import { type createClient } from '@supabase/supabase-js'
import { executeWebSearch } from './web-search'
import {
  executeApiRequest,
  resolveApiRequestConfig,
  formatResponseForContext,
  type ApiRequestConfig,
  type AuthConfig,
} from './api-request'
import { executeCode, formatCodeExecResult, sanitizeCode, type CodeLanguage } from './code-exec'
import { getDecryptedCredential, getDecryptedCredentialById } from '../../routes/tool-credentials'

// ============================================
// TYPES
// ============================================

/**
 * Tool types supported by the executor.
 */
export type ToolType = 'web_search' | 'api_request' | 'code_exec' | 'database'

/**
 * Tool node configuration from flow.
 */
export interface ToolNodeConfig {
  toolType: ToolType
  config: Record<string, unknown>
  label?: string
}

/**
 * Context for tool execution.
 */
export interface ToolExecutionContext {
  currentInput: string
  initialInput: string
  items?: unknown[]
  variables?: Record<string, unknown>
}

/**
 * Result of tool execution.
 */
export interface ToolExecutionResult {
  success: boolean
  output: unknown
  outputText?: string // Human-readable summary
  toolType: ToolType
  latencyMs: number
  error?: string
  errorCode?: string
}

/**
 * Credentials context for tool execution.
 */
export interface ToolCredentialsContext {
  supabase: ReturnType<typeof createClient>
  walletAddress: string
  serverSecret: string
}

// ============================================
// TEMPLATE VARIABLE RESOLUTION
// ============================================

/**
 * Resolve template variables in a string.
 * Supports: {{current_input}}, {{initial_input}}, {{items}}, {{var_name}}
 */
function resolveTemplateVariables(template: string, context: ToolExecutionContext): string {
  if (!template) return template

  return template
    .replace(/\{\{current_input\}\}/g, context.currentInput)
    .replace(/\{\{initial_input\}\}/g, context.initialInput)
    .replace(/\{\{items\}\}/g, JSON.stringify(context.items || []))
    .replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (context.variables && varName in context.variables) {
        const value = context.variables[varName]
        return typeof value === 'string' ? value : JSON.stringify(value)
      }
      return match // Keep original if not found
    })
}

// ============================================
// WEB SEARCH TOOL
// ============================================

/**
 * Execute web search tool.
 */
async function executeWebSearchTool(
  config: Record<string, unknown>,
  context: ToolExecutionContext,
  credentials: ToolCredentialsContext | null
): Promise<ToolExecutionResult> {
  const startTime = Date.now()

  // Get configuration
  const provider = (config.provider as string) || 'duckduckgo'
  const queryTemplate = (config.query as string) || '{{current_input}}'
  const maxResults = Math.min((config.max_results as number) || 5, 20)
  const timeout = (config.timeout as number) || 10000

  // Resolve query template
  const query = resolveTemplateVariables(queryTemplate, context)

  if (!query || query.trim().length === 0) {
    return {
      success: false,
      output: [],
      toolType: 'web_search',
      latencyMs: Date.now() - startTime,
      error: 'Search query is empty',
      errorCode: 'EMPTY_QUERY',
    }
  }

  // Get API key if using Serper
  let apiKey: string | undefined

  if ((provider === 'serper' || provider === 'google' || provider === 'bing') && credentials) {
    const credResult = await getDecryptedCredential(
      credentials.supabase,
      credentials.walletAddress,
      'serper',
      credentials.serverSecret
    )
    if (credResult) {
      apiKey = credResult.credential
    }
  }

  // Execute search
  const result = await executeWebSearch({
    provider: provider as 'serper' | 'duckduckgo' | 'google' | 'bing',
    query,
    numResults: maxResults,
    apiKey,
    timeout,
  })

  // Format results for downstream consumption
  const formattedResults = result.results.map((r) => ({
    title: r.title,
    href: r.link,
    body: r.snippet,
    position: r.position,
  }))

  // Create human-readable summary
  let outputText = ''
  if (result.success && result.results.length > 0) {
    outputText = `Found ${result.results.length} results for "${query}":\n\n`
    outputText += result.results
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
      .join('\n\n')
  } else if (result.success) {
    outputText = `No results found for "${query}"`
  }

  return {
    success: result.success,
    output: formattedResults,
    outputText,
    toolType: 'web_search',
    latencyMs: result.latencyMs,
    error: result.error,
    errorCode: result.errorCode,
  }
}

// ============================================
// API REQUEST TOOL
// ============================================

/**
 * Execute API request tool.
 *
 * Config options:
 * - method: HTTP method (GET, POST, PUT, PATCH, DELETE)
 * - url: Target URL (supports template variables)
 * - headers: Custom headers
 * - body: Request body (supports template variables)
 * - auth_type: 'none' | 'api_key' | 'bearer' | 'basic'
 * - credential_id: ID of stored credential to use
 * - extract_path: JSONPath to extract from response
 * - timeout: Request timeout in ms
 */
async function executeApiRequestTool(
  config: Record<string, unknown>,
  context: ToolExecutionContext,
  credentials: ToolCredentialsContext | null
): Promise<ToolExecutionResult> {
  const startTime = Date.now()

  // Extract configuration
  const method = ((config.method as string) || 'GET').toUpperCase() as
    | 'GET'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
  const urlTemplate = (config.url as string) || ''
  const headersConfig = (config.headers as Record<string, string>) || {}
  const bodyTemplate = config.body as string | undefined
  const authType = (config.auth_type as string) || 'none'
  const credentialId = config.credential_id as string | undefined
  const extractPath = config.extract_path as string | undefined
  const timeout = (config.timeout as number) || 30000

  // Validate URL is provided
  if (!urlTemplate || urlTemplate.trim().length === 0) {
    return {
      success: false,
      output: null,
      toolType: 'api_request',
      latencyMs: Date.now() - startTime,
      error: 'URL is required for API request',
      errorCode: 'MISSING_URL',
    }
  }

  // Build auth config
  let authConfig: AuthConfig = { type: 'none' }

  if (authType !== 'none' && credentials && credentialId) {
    // Fetch credential by specific ID (not by type)
    const storedCred = await getDecryptedCredentialById(
      credentials.supabase,
      credentials.walletAddress,
      credentialId,
      credentials.serverSecret
    )

    if (storedCred) {
      // Parse auth from stored credential config
      const credConfig = storedCred.config as Record<string, unknown>

      switch (authType) {
        case 'api_key':
          authConfig = {
            type: 'api_key',
            apiKey: storedCred.credential,
            apiKeyName: (credConfig.api_key_name as string) || 'X-API-Key',
            apiKeyPlacement: (credConfig.api_key_placement as 'header' | 'query') || 'header',
          }
          break

        case 'bearer':
          authConfig = {
            type: 'bearer',
            token: storedCred.credential,
          }
          break

        case 'basic': {
          // For basic auth, credential is stored as "username:password" (encrypted)
          // This ensures both username and password are encrypted at rest
          const basicParts = storedCred.credential.split(':')
          if (basicParts.length >= 2) {
            authConfig = {
              type: 'basic',
              username: basicParts[0],
              password: basicParts.slice(1).join(':'), // Handle passwords with ':'
            }
          } else {
            // Fallback: credential is just username, check config for password
            // (for backwards compatibility, but password in config is NOT secure)
            authConfig = {
              type: 'basic',
              username: storedCred.credential,
              password: (credConfig.password as string) || '',
            }
          }
          break
        }
      }
    } else {
      // Credential not found or not owned by user
      return {
        success: false,
        output: null,
        toolType: 'api_request',
        latencyMs: Date.now() - startTime,
        error: `Credential not found or not authorized: ${credentialId}`,
        errorCode: 'CREDENTIAL_NOT_FOUND',
      }
    }
  } else if (authType !== 'none') {
    // Auth requested but no credential_id provided
    // Check if auth info is directly in config (for testing or inline auth)
    if (config.auth_token) {
      authConfig = {
        type: 'bearer',
        token: config.auth_token as string,
      }
    } else if (config.api_key) {
      authConfig = {
        type: 'api_key',
        apiKey: config.api_key as string,
        apiKeyName: (config.api_key_name as string) || 'X-API-Key',
        apiKeyPlacement: (config.api_key_placement as 'header' | 'query') || 'header',
      }
    } else {
      // Auth type specified but no credentials available
      return {
        success: false,
        output: null,
        toolType: 'api_request',
        latencyMs: Date.now() - startTime,
        error: `Authentication required but no credentials provided. Set credential_id or inline auth.`,
        errorCode: 'AUTH_REQUIRED',
      }
    }
  }

  // Build request config
  const requestConfig: ApiRequestConfig = {
    method,
    url: urlTemplate,
    headers: headersConfig,
    body: bodyTemplate,
    auth: authConfig,
    timeout,
    extractJsonPath: extractPath,
    credentialId, // For rate limiting
  }

  // Resolve template variables
  const resolvedConfig = resolveApiRequestConfig(requestConfig, {
    currentInput: context.currentInput,
    initialInput: context.initialInput,
    items: context.items,
    variables: context.variables,
  })

  // Execute request
  const result = await executeApiRequest(resolvedConfig)

  // Format output for LLM context
  const outputText = formatResponseForContext(result, resolvedConfig)

  return {
    success: result.success,
    output: result.body,
    outputText,
    toolType: 'api_request',
    latencyMs: result.latencyMs,
    error: result.error,
    errorCode: result.errorCode,
  }
}

// ============================================
// CODE EXECUTION TOOL
// ============================================

/**
 * Execute code in a sandboxed environment.
 *
 * Uses Modal.com Sandbox (gVisor isolation) for secure execution.
 *
 * Config options:
 * - language: 'python' | 'javascript'
 * - code: Code to execute (supports {{variables}})
 * - timeout_ms: Execution timeout (default: 30000, max: 30000)
 * - memory_mb: Memory limit (default: 256, max: 512)
 * - allow_network: Enable network access (default: false)
 */
async function executeCodeExecTool(
  config: Record<string, unknown>,
  context: ToolExecutionContext,
  _credentials: ToolCredentialsContext | null
): Promise<ToolExecutionResult> {
  const startTime = Date.now()

  // Extract configuration
  const language = (config.language as string) || 'python'
  const codeTemplate = (config.code as string) || ''
  const timeout_ms = Math.min((config.timeout_ms as number) || 30000, 30000)
  const memory_mb = Math.min((config.memory_mb as number) || 256, 512)
  const allow_network = (config.allow_network as boolean) || false

  // Validate language
  if (!['python', 'javascript'].includes(language)) {
    return {
      success: false,
      output: null,
      toolType: 'code_exec',
      latencyMs: Date.now() - startTime,
      error: `Unsupported language: ${language}. Use 'python' or 'javascript'.`,
      errorCode: 'INVALID_LANGUAGE',
    }
  }

  // Validate code is provided
  if (!codeTemplate || codeTemplate.trim().length === 0) {
    return {
      success: false,
      output: null,
      toolType: 'code_exec',
      latencyMs: Date.now() - startTime,
      error: 'Code is required for execution',
      errorCode: 'MISSING_CODE',
    }
  }

  // Resolve template variables in code
  const code = resolveTemplateVariables(codeTemplate, context)

  // Sanitize code (remove null bytes, etc.)
  const sanitizedCode = sanitizeCode(code)

  // Prepare input data (current context as JSON string)
  const inputData = JSON.stringify({
    current_input: context.currentInput,
    initial_input: context.initialInput,
    items: context.items || [],
    variables: context.variables || {},
  })

  // Execute code via Modal Sandbox
  const result = await executeCode({
    language: language as CodeLanguage,
    code: sanitizedCode,
    timeout_ms,
    memory_mb,
    allow_network,
    input_data: inputData,
  })

  // Format output for LLM context
  const outputText = formatCodeExecResult(result)

  // Parse stdout as output (try JSON first, then string)
  let output: unknown = result.stdout
  if (result.stdout) {
    try {
      output = JSON.parse(result.stdout.trim())
    } catch {
      // Keep as string if not valid JSON
      output = result.stdout.trim()
    }
  }

  return {
    success: result.success,
    output,
    outputText,
    toolType: 'code_exec',
    latencyMs: result.execution_time_ms,
    error: result.error,
    errorCode: result.error_code,
  }
}

/**
 * Execute database tool (placeholder).
 */
async function executeDatabaseTool(
  _config: Record<string, unknown>,
  _context: ToolExecutionContext,
  _credentials: ToolCredentialsContext | null
): Promise<ToolExecutionResult> {
  // TODO: Implement in future sprint
  return {
    success: false,
    output: null,
    toolType: 'database',
    latencyMs: 0,
    error: 'Database tool not yet implemented.',
    errorCode: 'NOT_IMPLEMENTED',
  }
}

// ============================================
// MAIN EXECUTOR
// ============================================

/**
 * Execute a single tool node.
 *
 * @param toolConfig - Tool configuration from flow node
 * @param context - Execution context with inputs
 * @param credentials - Optional credentials context
 * @returns Tool execution result
 */
export async function executeTool(
  toolConfig: ToolNodeConfig,
  context: ToolExecutionContext,
  credentials: ToolCredentialsContext | null
): Promise<ToolExecutionResult> {
  const { toolType, config } = toolConfig

  switch (toolType) {
    case 'web_search':
      return executeWebSearchTool(config, context, credentials)

    case 'api_request':
      return executeApiRequestTool(config, context, credentials)

    case 'code_exec':
      return executeCodeExecTool(config, context, credentials)

    case 'database':
      return executeDatabaseTool(config, context, credentials)

    default:
      return {
        success: false,
        output: null,
        toolType: toolType as ToolType,
        latencyMs: 0,
        error: `Unknown tool type: ${toolType}`,
        errorCode: 'UNKNOWN_TOOL',
      }
  }
}

/**
 * Extract tool nodes from a flow.
 */
export function extractToolNodes(
  nodes: Array<{ type?: string; data?: Record<string, unknown> }>
): ToolNodeConfig[] {
  return nodes
    .filter((node) => node.type === 'tool')
    .map((node) => ({
      toolType: (node.data?.toolType as ToolType) || 'web_search',
      config: (node.data?.config as Record<string, unknown>) || {},
      label: node.data?.label as string | undefined,
    }))
}

/**
 * Execute all tool nodes in a flow.
 *
 * @param nodes - Flow nodes
 * @param context - Execution context
 * @param credentials - Optional credentials context
 * @returns Array of tool execution results
 */
export async function executeFlowTools(
  nodes: Array<{ type?: string; data?: Record<string, unknown> }>,
  context: ToolExecutionContext,
  credentials: ToolCredentialsContext | null
): Promise<ToolExecutionResult[]> {
  const toolNodes = extractToolNodes(nodes)
  const results: ToolExecutionResult[] = []

  // Execute tools sequentially (results from one can affect next)
  let currentContext = { ...context }

  for (const toolNode of toolNodes) {
    const result = await executeTool(toolNode, currentContext, credentials)
    results.push(result)

    // Update context with tool output for next tool
    if (result.success && result.output) {
      currentContext = {
        ...currentContext,
        currentInput: result.outputText || JSON.stringify(result.output),
        items: Array.isArray(result.output) ? result.output : [result.output],
      }
    }
  }

  return results
}

/**
 * Aggregate tool results into a context string for LLM.
 */
export function aggregateToolResults(results: ToolExecutionResult[]): string {
  if (results.length === 0) {
    return ''
  }

  const successfulResults = results.filter((r) => r.success)

  if (successfulResults.length === 0) {
    return ''
  }

  const parts: string[] = []

  for (const result of successfulResults) {
    if (result.outputText) {
      parts.push(`[${result.toolType.toUpperCase()} RESULTS]\n${result.outputText}`)
    }
  }

  return parts.join('\n\n---\n\n')
}
