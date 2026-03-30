/**
 * Code Generator Utilities
 * Helper functions for code generation and file sanitization
 */

/**
 * Sanitize a string to be used as a valid Python/JS identifier
 */
export function sanitizeIdentifier(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'agent'
  )
}

/**
 * Sanitize agent name for use in filenames and identifiers
 */
export function sanitizeAgentName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'agent'
  )
}

/**
 * Convert snake_case to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Escape string for use in Python string literal
 */
export function escapePythonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Escape string for use in JavaScript/TypeScript string literal
 */
export function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
}

/**
 * Format Python dict from JavaScript object
 */
export function toPythonDict(obj: Record<string, unknown>, indent: number = 0): string {
  const spaces = '    '.repeat(indent)
  const innerSpaces = '    '.repeat(indent + 1)

  const entries = Object.entries(obj).map(([key, value]) => {
    const formattedValue = formatPythonValue(value, indent + 1)
    return `${innerSpaces}'${key}': ${formattedValue}`
  })

  if (entries.length === 0) {
    return '{}'
  }

  return `{\n${entries.join(',\n')}\n${spaces}}`
}

/**
 * Format a value for Python code
 */
export function formatPythonValue(value: unknown, indent: number = 0): string {
  if (value === null || value === undefined) {
    return 'None'
  }
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'string') {
    return `'${escapePythonString(value)}'`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => formatPythonValue(v, indent))
    return `[${items.join(', ')}]`
  }
  if (typeof value === 'object') {
    return toPythonDict(value as Record<string, unknown>, indent)
  }
  return String(value)
}

/**
 * Format JavaScript/TypeScript object literal
 */
export function toJsObject(obj: Record<string, unknown>, indent: number = 0): string {
  const spaces = '  '.repeat(indent)
  const innerSpaces = '  '.repeat(indent + 1)

  const entries = Object.entries(obj).map(([key, value]) => {
    const formattedValue = formatJsValue(value, indent + 1)
    // Use quotes only if key needs them
    const formattedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`
    return `${innerSpaces}${formattedKey}: ${formattedValue}`
  })

  if (entries.length === 0) {
    return '{}'
  }

  return `{\n${entries.join(',\n')}\n${spaces}}`
}

/**
 * Format a value for JavaScript/TypeScript code
 */
export function formatJsValue(value: unknown, indent: number = 0): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value === 'boolean') {
    return String(value)
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'string') {
    return `'${escapeJsString(value)}'`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => formatJsValue(v, indent))
    return `[${items.join(', ')}]`
  }
  if (typeof value === 'object') {
    return toJsObject(value as Record<string, unknown>, indent)
  }
  return String(value)
}

/**
 * Extract CLAW gates configuration from claw_config
 */
export function extractGates(clawConfig: Record<string, unknown>): Record<string, boolean> {
  const gates = clawConfig.gates as Record<string, boolean> | undefined
  return {
    credibility: gates?.credibility ?? true,
    avoidance: gates?.avoidance ?? true,
    limits: gates?.limits ?? true,
    worth: gates?.worth ?? true,
  }
}

/**
 * Get seed level from config (minimal, standard, full)
 */
export function getSeedLevel(config: Record<string, unknown>): string {
  return (config.seed_level as string) || (config.seedLevel as string) || 'standard'
}

/**
 * Generate .gitignore content
 */
export function generateGitignore(language: 'python' | 'typescript'): string {
  const common = `# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
`

  if (language === 'python') {
    return `${common}
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual environments
venv/
ENV/
env/
.venv/

# Testing
.pytest_cache/
.coverage
htmlcov/
`
  }

  return `${common}
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
build/
.next/
out/

# TypeScript
*.tsbuildinfo
`
}

/**
 * Generate .env.example content
 */
export function generateEnvExample(vars: string[]): string {
  const lines = vars.map((v) => `${v}=`)
  return `# Copy this file to .env and fill in your values\n\n${lines.join('\n')}\n`
}
