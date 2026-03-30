import { describe, it, expect } from 'vitest'
import {
  walletAddressSchema,
  addAdminSchema,
  alertRuleSchema,
  updateAlertSchema,
  userSearchSchema,
  validateForm,
  getFirstError,
} from './admin'

describe('walletAddressSchema', () => {
  it('accepts valid Solana wallet address', () => {
    const validAddresses = [
      'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
      '7cVfgArCheMR6Cs4t6vz5rfnqd56vZq4ndaBrY5xkxXy',
      '11111111111111111111111111111111',
    ]

    validAddresses.forEach((address) => {
      const result = walletAddressSchema.safeParse(address)
      expect(result.success).toBe(true)
    })
  })

  it('rejects addresses shorter than 32 characters', () => {
    const result = walletAddressSchema.safeParse('DgyapGSZv9FqcK9eqcdJ3XqXSAP')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('at least 32')
    }
  })

  it('rejects addresses longer than 44 characters', () => {
    const result = walletAddressSchema.safeParse('DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GGxxx')
    expect(result.success).toBe(false)
  })

  it('rejects addresses with invalid characters', () => {
    const invalidAddresses = [
      'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3G0', // Contains 0
      'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3Gl', // Contains l
      'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GO', // Contains O
      'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GI', // Contains I
    ]

    invalidAddresses.forEach((address) => {
      const result = walletAddressSchema.safeParse(address)
      expect(result.success).toBe(false)
    })
  })

  it('rejects empty string', () => {
    const result = walletAddressSchema.safeParse('')
    expect(result.success).toBe(false)
  })
})

describe('addAdminSchema', () => {
  it('accepts valid input', () => {
    const result = addAdminSchema.safeParse({
      wallet_address: 'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
      role: 'admin',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid roles', () => {
    const roles = ['super_admin', 'admin', 'support', 'viewer']

    roles.forEach((role) => {
      const result = addAdminSchema.safeParse({
        wallet_address: 'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
        role,
      })
      expect(result.success).toBe(true)
    })
  })

  it('rejects invalid role', () => {
    const result = addAdminSchema.safeParse({
      wallet_address: 'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
      role: 'invalid_role',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing wallet_address', () => {
    const result = addAdminSchema.safeParse({
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing role', () => {
    const result = addAdminSchema.safeParse({
      wallet_address: 'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
    })
    expect(result.success).toBe(false)
  })
})

describe('alertRuleSchema', () => {
  const validRule = {
    name: 'High Error Rate',
    metric_name: 'error_rate',
    condition: 'gt' as const,
    threshold_value: 5,
    severity: 'warning' as const,
    cooldown_minutes: 15,
  }

  it('accepts valid rule', () => {
    const result = alertRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
  })

  it('accepts all valid conditions', () => {
    const conditions = ['gt', 'lt', 'gte', 'lte', 'eq', 'spike']

    conditions.forEach((condition) => {
      const result = alertRuleSchema.safeParse({
        ...validRule,
        condition,
      })
      expect(result.success).toBe(true)
    })
  })

  it('accepts all valid severities', () => {
    const severities = ['info', 'warning', 'critical']

    severities.forEach((severity) => {
      const result = alertRuleSchema.safeParse({
        ...validRule,
        severity,
      })
      expect(result.success).toBe(true)
    })
  })

  it('rejects name longer than 100 characters', () => {
    const result = alertRuleSchema.safeParse({
      ...validRule,
      name: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = alertRuleSchema.safeParse({
      ...validRule,
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects cooldown less than 1 minute', () => {
    const result = alertRuleSchema.safeParse({
      ...validRule,
      cooldown_minutes: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects cooldown more than 1440 minutes', () => {
    const result = alertRuleSchema.safeParse({
      ...validRule,
      cooldown_minutes: 1441,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional description', () => {
    const result = alertRuleSchema.safeParse({
      ...validRule,
      description: 'This rule monitors error rate',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null description', () => {
    const result = alertRuleSchema.safeParse({
      ...validRule,
      description: null,
    })
    expect(result.success).toBe(true)
  })

  it('defaults is_enabled to true', () => {
    const result = alertRuleSchema.safeParse(validRule)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_enabled).toBe(true)
    }
  })
})

describe('updateAlertSchema', () => {
  it('accepts acknowledged status', () => {
    const result = updateAlertSchema.safeParse({ status: 'acknowledged' })
    expect(result.success).toBe(true)
  })

  it('accepts resolved status', () => {
    const result = updateAlertSchema.safeParse({ status: 'resolved' })
    expect(result.success).toBe(true)
  })

  it('rejects active status', () => {
    const result = updateAlertSchema.safeParse({ status: 'active' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = updateAlertSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('userSearchSchema', () => {
  it('accepts valid query', () => {
    const result = userSearchSchema.safeParse({ query: 'DgyapGSZ' })
    expect(result.success).toBe(true)
  })

  it('rejects query shorter than 3 characters', () => {
    const result = userSearchSchema.safeParse({ query: 'ab' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('at least 3')
    }
  })

  it('rejects query longer than 44 characters', () => {
    const result = userSearchSchema.safeParse({ query: 'a'.repeat(45) })
    expect(result.success).toBe(false)
  })
})

describe('validateForm', () => {
  it('returns success with parsed data for valid input', () => {
    const result = validateForm(addAdminSchema, {
      wallet_address: 'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
      role: 'admin',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.wallet_address).toBe('DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG')
      expect(result.data.role).toBe('admin')
    }
  })

  it('returns errors object for invalid input', () => {
    const result = validateForm(addAdminSchema, {
      wallet_address: 'invalid',
      role: 'invalid',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors).toBeDefined()
      expect(Object.keys(result.errors).length).toBeGreaterThan(0)
    }
  })

  it('includes field path in error keys', () => {
    const result = validateForm(addAdminSchema, {
      wallet_address: 'x',
      role: 'admin',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors['wallet_address']).toBeDefined()
    }
  })
})

describe('getFirstError', () => {
  it('returns first error message', () => {
    const errors = {
      wallet_address: 'Invalid wallet',
      role: 'Invalid role',
    }

    const result = getFirstError(errors)
    expect(result).toBe('Invalid wallet')
  })

  it('returns fallback for empty errors', () => {
    const result = getFirstError({})
    expect(result).toBe('Validation failed')
  })
})
