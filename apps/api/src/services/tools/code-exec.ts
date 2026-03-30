/**
 * Code Execution Tool Service
 *
 * Provides sandboxed code execution for agent flows using Modal.com.
 * Supports Python and JavaScript with configurable resource limits.
 *
 * Security features:
 * - gVisor-based container isolation via Modal Sandbox
 * - Configurable resource limits (memory, CPU, timeout)
 * - Network access disabled by default
 * - Output size limits to prevent memory exhaustion
 * - Code size validation
 *
 * @example
 * const result = await executeCode({
 *   language: 'python',
 *   code: 'print("Hello, World!")',
 *   timeout_ms: 5000,
 * })
 */

// ============================================
// TYPES
// ============================================

/**
 * Supported languages for code execution.
 */
export type CodeLanguage = 'python' | 'javascript'

/**
 * Code execution configuration.
 */
export interface CodeExecConfig {
  /** Programming language */
  language: CodeLanguage
  /** Code to execute */
  code: string
  /** Execution timeout in milliseconds (default: 30000, max: 30000) */
  timeout_ms?: number
  /** Memory limit in MB (default: 256, max: 512) */
  memory_mb?: number
  /** Allow network access (default: false) */
  allow_network?: boolean
  /** Input data available as INPUT variable in code */
  input_data?: string
}

/**
 * Error codes for code execution.
 *
 * Client-side validation (TypeScript):
 * - INVALID_LANGUAGE: Language not 'python' or 'javascript'
 * - MISSING_CODE: Empty code provided
 * - CODE_TOO_LARGE: Code exceeds size limit
 * - INVALID_TIMEOUT: Timeout outside allowed range
 * - INVALID_MEMORY: Memory outside allowed range
 *
 * Network errors (TypeScript):
 * - API_ERROR: Modal returned non-200 status
 * - API_TIMEOUT: Request to Modal timed out
 * - NETWORK_ERROR: Network failure reaching Modal
 *
 * Server-side errors (Modal Sandbox):
 * - DANGEROUS_CODE: Blocked security pattern detected
 * - TIMEOUT: Execution exceeded time limit
 * - EXECUTION_FAILED: Code ran but exited non-zero
 * - SANDBOX_ERROR: Infrastructure error in sandbox
 */
export type CodeExecErrorCode =
  // Client-side validation
  | 'INVALID_LANGUAGE'
  | 'MISSING_CODE'
  | 'CODE_TOO_LARGE'
  | 'INVALID_TIMEOUT'
  | 'INVALID_MEMORY'
  // Network errors
  | 'API_ERROR'
  | 'API_TIMEOUT'
  | 'NETWORK_ERROR'
  // Server-side errors (from Modal)
  | 'DANGEROUS_CODE'
  | 'TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'SANDBOX_ERROR'

/**
 * Code execution result.
 */
export interface CodeExecResult {
  /** Whether execution succeeded (exit code 0) */
  success: boolean
  /** Standard output from execution */
  stdout: string
  /** Standard error from execution */
  stderr: string
  /** Process exit code */
  exit_code: number
  /** Execution time in milliseconds */
  execution_time_ms: number
  /** Error message if failed */
  error?: string
  /** Error code for categorization */
  error_code?: CodeExecErrorCode
}

// ============================================
// CONFIGURATION
// ============================================

/** Modal runtime endpoint for code execution */
const MODAL_EXECUTE_CODE_URL = 'https://guardian-claw--claw-runtime-execute-code-web.modal.run'

/** Maximum code size in bytes */
const MAX_CODE_SIZE = 100_000 // 100KB

/** Maximum timeout in milliseconds */
const MAX_TIMEOUT_MS = 30_000 // 30 seconds

/** Maximum memory in MB */
const MAX_MEMORY_MB = 512

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000

/** Default memory in MB */
const DEFAULT_MEMORY_MB = 256

/** Request timeout for Modal API call */
const API_TIMEOUT_MS = 60_000 // 60 seconds (sandbox + overhead)

// ============================================
// VALIDATION
// ============================================

/**
 * Validation result type.
 */
export type CodeExecValidationResult = {
  valid: boolean
  error?: string
  errorCode?: CodeExecErrorCode
}

/**
 * Validate code execution configuration.
 */
export function validateCodeExecConfig(config: CodeExecConfig): CodeExecValidationResult {
  // Validate language
  if (!config.language || !['python', 'javascript'].includes(config.language)) {
    return {
      valid: false,
      error: `Invalid language: ${config.language}. Use 'python' or 'javascript'.`,
      errorCode: 'INVALID_LANGUAGE',
    }
  }

  // Validate code presence
  if (!config.code || config.code.trim().length === 0) {
    return {
      valid: false,
      error: 'Code is required',
      errorCode: 'MISSING_CODE',
    }
  }

  // Validate code size
  if (config.code.length > MAX_CODE_SIZE) {
    return {
      valid: false,
      error: `Code too large: ${config.code.length} bytes (max ${MAX_CODE_SIZE})`,
      errorCode: 'CODE_TOO_LARGE',
    }
  }

  // Validate timeout
  if (config.timeout_ms !== undefined) {
    if (config.timeout_ms < 1000 || config.timeout_ms > MAX_TIMEOUT_MS) {
      return {
        valid: false,
        error: `Invalid timeout: ${config.timeout_ms}ms (must be 1000-${MAX_TIMEOUT_MS})`,
        errorCode: 'INVALID_TIMEOUT',
      }
    }
  }

  // Validate memory
  if (config.memory_mb !== undefined) {
    if (config.memory_mb < 64 || config.memory_mb > MAX_MEMORY_MB) {
      return {
        valid: false,
        error: `Invalid memory: ${config.memory_mb}MB (must be 64-${MAX_MEMORY_MB})`,
        errorCode: 'INVALID_MEMORY',
      }
    }
  }

  return { valid: true }
}

// ============================================
// EXECUTION
// ============================================

/**
 * Execute code in a sandboxed environment via Modal.com.
 *
 * This function calls the Modal runtime endpoint which runs
 * the code in a gVisor-isolated container.
 *
 * @param config - Code execution configuration
 * @returns Execution result with stdout, stderr, exit code
 */
export async function executeCode(config: CodeExecConfig): Promise<CodeExecResult> {
  const startTime = Date.now()

  // Validate configuration
  const validation = validateCodeExecConfig(config)
  if (!validation.valid) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      exit_code: -1,
      execution_time_ms: Date.now() - startTime,
      error: validation.error,
      error_code: validation.errorCode,
    }
  }

  // Apply defaults
  const timeout_ms = config.timeout_ms ?? DEFAULT_TIMEOUT_MS
  const memory_mb = config.memory_mb ?? DEFAULT_MEMORY_MB
  const allow_network = config.allow_network ?? false

  // Build request body
  const requestBody = {
    language: config.language,
    code: config.code,
    timeout_ms,
    memory_mb,
    allow_network,
    input_data: config.input_data ?? null,
  }

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await fetch(MODAL_EXECUTE_CODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return {
        success: false,
        stdout: '',
        stderr: '',
        exit_code: -1,
        execution_time_ms: Date.now() - startTime,
        error: `Modal API error: ${response.status} - ${errorText}`,
        error_code: 'API_ERROR',
      }
    }

    const result = (await response.json()) as CodeExecResult

    // Add total latency (includes network overhead)
    return {
      ...result,
      execution_time_ms: Date.now() - startTime,
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        stdout: '',
        stderr: '',
        exit_code: -1,
        execution_time_ms: Date.now() - startTime,
        error: `API request timed out after ${API_TIMEOUT_MS}ms`,
        error_code: 'API_TIMEOUT',
      }
    }

    return {
      success: false,
      stdout: '',
      stderr: '',
      exit_code: -1,
      execution_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_code: 'NETWORK_ERROR',
    }
  }
}

// ============================================
// RESULT FORMATTING
// ============================================

/**
 * Format code execution result for LLM context.
 *
 * Creates a human-readable summary of the execution result
 * suitable for including in agent flow context.
 */
export function formatCodeExecResult(result: CodeExecResult): string {
  const parts: string[] = []

  if (result.success) {
    parts.push(`[CODE EXECUTION - SUCCESS]`)
    parts.push(`Exit code: ${result.exit_code}`)
    parts.push(`Execution time: ${result.execution_time_ms}ms`)

    if (result.stdout) {
      parts.push(`\nOutput:\n${result.stdout}`)
    }

    if (result.stderr) {
      parts.push(`\nWarnings/Errors:\n${result.stderr}`)
    }
  } else {
    parts.push(`[CODE EXECUTION - FAILED]`)
    parts.push(`Error: ${result.error || 'Unknown error'}`)

    if (result.stderr) {
      parts.push(`\nStderr:\n${result.stderr}`)
    }
  }

  return parts.join('\n')
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if the Modal code execution endpoint is available.
 */
export async function checkCodeExecHealth(): Promise<{
  available: boolean
  latency_ms?: number
  error?: string
}> {
  const startTime = Date.now()

  try {
    // Try a simple execution to verify the endpoint works
    const result = await executeCode({
      language: 'python',
      code: 'print("health check")',
      timeout_ms: 5000,
      memory_mb: 64,
    })

    return {
      available: result.success,
      latency_ms: Date.now() - startTime,
      error: result.success ? undefined : result.error,
    }
  } catch (error) {
    return {
      available: false,
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Escape code for safe transmission (removes null bytes, etc.)
 */
export function sanitizeCode(code: string): string {
  // Remove null bytes and other control characters except newline, tab
  // eslint-disable-next-line no-control-regex
  return code.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}
