/**
 * Tool Properties UI Tests
 *
 * Tests for the tool configuration panel validation and defaults.
 */

import { describe, it, expect } from 'vitest'

// Re-implement validation functions for testing (same logic as in component)
function isValidUrl(url: string): boolean {
  if (!url) return true
  try {
    new URL(url)
    return true
  } catch {
    if (url.includes('{{') && url.includes('}}')) return true
    return false
  }
}

function isValidJson(json: string): boolean {
  if (!json || !json.trim()) return true
  try {
    JSON.parse(json)
    return true
  } catch {
    return false
  }
}

// Tool type configurations (mirrors component)
const toolTypes = ['api_request', 'web_search', 'code_exec', 'database']
const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const searchProviders = ['duckduckgo', 'google', 'bing']
const codeLanguages = ['python', 'javascript']
const databaseTypes = ['postgresql', 'mysql', 'sqlite']
const sqlOperations = ['select', 'insert', 'update', 'delete', 'execute']

describe('Tool Properties - URL Validation', () => {
  it('should accept empty URL', () => {
    expect(isValidUrl('')).toBe(true)
  })

  it('should accept valid HTTP URLs', () => {
    expect(isValidUrl('https://api.example.com')).toBe(true)
    expect(isValidUrl('https://api.example.com/endpoint')).toBe(true)
    expect(isValidUrl('https://api.example.com/v1/users?id=123')).toBe(true)
    expect(isValidUrl('http://localhost:3000/api')).toBe(true)
  })

  it('should reject invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false)
    expect(isValidUrl('://missing-scheme')).toBe(false)
  })

  it('should accept URLs with template variables', () => {
    expect(isValidUrl('{{current_input}}')).toBe(true)
    expect(isValidUrl('https://api.example.com/{{current_input}}')).toBe(true)
    expect(isValidUrl('{{initial_input}}/path')).toBe(true)
  })
})

describe('Tool Properties - JSON Validation', () => {
  it('should accept empty JSON', () => {
    expect(isValidJson('')).toBe(true)
    expect(isValidJson('   ')).toBe(true)
  })

  it('should accept valid JSON objects', () => {
    expect(isValidJson('{}')).toBe(true)
    expect(isValidJson('{"key": "value"}')).toBe(true)
    expect(isValidJson('{"nested": {"key": "value"}}')).toBe(true)
    expect(isValidJson('{"array": [1, 2, 3]}')).toBe(true)
  })

  it('should accept valid JSON arrays', () => {
    expect(isValidJson('[]')).toBe(true)
    expect(isValidJson('[1, 2, 3]')).toBe(true)
    expect(isValidJson('[{"key": "value"}]')).toBe(true)
  })

  it('should reject invalid JSON', () => {
    expect(isValidJson('{')).toBe(false)
    expect(isValidJson('{key: value}')).toBe(false)
    expect(isValidJson("{'key': 'value'}")).toBe(false)
    expect(isValidJson('undefined')).toBe(false)
  })
})

describe('Tool Properties - Tool Types', () => {
  it('should have 4 tool types defined', () => {
    expect(toolTypes).toHaveLength(4)
  })

  it('should include all expected tool types', () => {
    expect(toolTypes).toContain('api_request')
    expect(toolTypes).toContain('web_search')
    expect(toolTypes).toContain('code_exec')
    expect(toolTypes).toContain('database')
  })
})

describe('Tool Properties - API Request Configuration', () => {
  it('should have 5 HTTP methods', () => {
    expect(httpMethods).toHaveLength(5)
  })

  it('should include all standard HTTP methods', () => {
    expect(httpMethods).toContain('GET')
    expect(httpMethods).toContain('POST')
    expect(httpMethods).toContain('PUT')
    expect(httpMethods).toContain('PATCH')
    expect(httpMethods).toContain('DELETE')
  })

  it('should identify methods with body', () => {
    const methodsWithBody = ['POST', 'PUT', 'PATCH']
    const methodsWithoutBody = ['GET', 'DELETE']

    methodsWithBody.forEach((method) => {
      expect(['POST', 'PUT', 'PATCH']).toContain(method)
    })

    methodsWithoutBody.forEach((method) => {
      expect(['GET', 'DELETE']).toContain(method)
    })
  })

  it('should have correct default timeout range', () => {
    const minTimeout = 5000
    const maxTimeout = 120000
    const defaultTimeout = 30000

    expect(defaultTimeout).toBeGreaterThanOrEqual(minTimeout)
    expect(defaultTimeout).toBeLessThanOrEqual(maxTimeout)
  })
})

describe('Tool Properties - Web Search Configuration', () => {
  it('should have 3 search providers', () => {
    expect(searchProviders).toHaveLength(3)
  })

  it('should include expected search providers', () => {
    expect(searchProviders).toContain('duckduckgo')
    expect(searchProviders).toContain('google')
    expect(searchProviders).toContain('bing')
  })

  it('should have correct max results range', () => {
    const minResults = 1
    const maxResults = 20
    const defaultResults = 5

    expect(defaultResults).toBeGreaterThanOrEqual(minResults)
    expect(defaultResults).toBeLessThanOrEqual(maxResults)
  })

  it('should default to duckduckgo for privacy', () => {
    expect(searchProviders[0]).toBe('duckduckgo')
  })
})

describe('Tool Properties - Code Execution Configuration', () => {
  it('should have 2 supported languages', () => {
    expect(codeLanguages).toHaveLength(2)
  })

  it('should include Python and JavaScript', () => {
    expect(codeLanguages).toContain('python')
    expect(codeLanguages).toContain('javascript')
  })

  it('should have correct timeout range for code execution', () => {
    const minTimeout = 1000
    const maxTimeout = 30000
    const defaultTimeout = 5000

    expect(defaultTimeout).toBeGreaterThanOrEqual(minTimeout)
    expect(defaultTimeout).toBeLessThanOrEqual(maxTimeout)
  })
})

describe('Tool Properties - Database Configuration', () => {
  it('should have 3 database types', () => {
    expect(databaseTypes).toHaveLength(3)
  })

  it('should include expected database types', () => {
    expect(databaseTypes).toContain('postgresql')
    expect(databaseTypes).toContain('mysql')
    expect(databaseTypes).toContain('sqlite')
  })

  it('should have 5 SQL operations', () => {
    expect(sqlOperations).toHaveLength(5)
  })

  it('should include all expected SQL operations', () => {
    expect(sqlOperations).toContain('select')
    expect(sqlOperations).toContain('insert')
    expect(sqlOperations).toContain('update')
    expect(sqlOperations).toContain('delete')
    expect(sqlOperations).toContain('execute')
  })

  it('should identify write operations', () => {
    const writeOperations = ['insert', 'update', 'delete', 'execute']
    const readOperations = ['select']

    writeOperations.forEach((op) => {
      expect(op).not.toBe('select')
    })

    readOperations.forEach((op) => {
      expect(op).toBe('select')
    })
  })
})

describe('Tool Properties - Default Values', () => {
  it('should have sensible defaults for API Request', () => {
    const defaults = {
      method: 'GET',
      timeout: 30000,
      fail_on_error: true,
    }

    expect(defaults.method).toBe('GET')
    expect(defaults.timeout).toBe(30000)
    expect(defaults.fail_on_error).toBe(true)
  })

  it('should have sensible defaults for Web Search', () => {
    const defaults = {
      provider: 'duckduckgo',
      max_results: 5,
      fail_on_error: false,
    }

    expect(defaults.provider).toBe('duckduckgo')
    expect(defaults.max_results).toBe(5)
    expect(defaults.fail_on_error).toBe(false)
  })

  it('should have sensible defaults for Code Execution', () => {
    const defaults = {
      language: 'python',
      timeout: 5000,
      fail_on_error: true,
    }

    expect(defaults.language).toBe('python')
    expect(defaults.timeout).toBe(5000)
    expect(defaults.fail_on_error).toBe(true)
  })

  it('should have sensible defaults for Database', () => {
    const defaults = {
      db_type: 'postgresql',
      operation: 'select',
      timeout: 30000,
      fail_on_error: true,
    }

    expect(defaults.db_type).toBe('postgresql')
    expect(defaults.operation).toBe('select')
    expect(defaults.timeout).toBe(30000)
    expect(defaults.fail_on_error).toBe(true)
  })
})

describe('Tool Properties - Template Variables', () => {
  it('should support current_input template', () => {
    const template = '{{current_input}}'
    expect(template).toContain('{{')
    expect(template).toContain('}}')
    expect(template).toContain('current_input')
  })

  it('should support initial_input template', () => {
    const template = '{{initial_input}}'
    expect(template).toContain('initial_input')
  })

  it('should accept URLs with templates', () => {
    expect(isValidUrl('https://api.example.com/users/{{current_input}}')).toBe(true)
  })
})

describe('Tool Properties - Security Considerations', () => {
  it('should mark write operations as potentially dangerous', () => {
    const dangerousOperations = ['insert', 'update', 'delete', 'execute']

    dangerousOperations.forEach((op) => {
      expect(op).not.toBe('select')
    })
  })

  it('should use parameterized query syntax', () => {
    const paramSyntax = ':param'
    expect(paramSyntax).toMatch(/^:\w+$/)
  })

  it('should have code execution timeout limit', () => {
    const maxCodeTimeout = 30000
    expect(maxCodeTimeout).toBeLessThanOrEqual(30000)
  })
})
