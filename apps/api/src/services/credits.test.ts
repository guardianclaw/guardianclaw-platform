import { describe, it, expect } from 'vitest'
import {
  calculateCredits,
  validateMinimumDeposit,
  getBalanceWarningLevel,
  parseSolTransfer,
  parseTokenTransfer,
  formatBalance,
  COST_PER_EXECUTION,
  GCLAW_BONUS,
  MIN_DEPOSIT_USD,
  TOKEN_MINTS,
  TOKEN_DECIMALS,
} from './credits'

describe('Credits Service', () => {
  // ============================================
  // Constants
  // ============================================
  describe('Constants', () => {
    it('should have correct cost per execution', () => {
      expect(COST_PER_EXECUTION).toBe(0.003)
    })

    it('should have correct GCLAW bonus (20%)', () => {
      expect(GCLAW_BONUS).toBe(1.2)
    })

    it('should have correct minimum deposit ($3)', () => {
      expect(MIN_DEPOSIT_USD).toBe(3.0)
    })

    it('should have correct token mints', () => {
      expect(TOKEN_MINTS.USDC).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      expect(TOKEN_MINTS.GCLAW).toBe(process.env.GCLAW_MINT || '')
    })

    it('should have correct token decimals', () => {
      expect(TOKEN_DECIMALS.SOL).toBe(9)
      expect(TOKEN_DECIMALS.USDC).toBe(6)
      expect(TOKEN_DECIMALS.GCLAW).toBe(6)
    })
  })

  // ============================================
  // calculateCredits
  // ============================================
  describe('calculateCredits', () => {
    it('should calculate credits for SOL without bonus', () => {
      const result = calculateCredits('SOL', 1, 150)
      expect(result.creditsUsd).toBe(150)
      expect(result.bonus).toBe(1.0)
    })

    it('should calculate credits for USDC without bonus', () => {
      const result = calculateCredits('USDC', 100, 1)
      expect(result.creditsUsd).toBe(100)
      expect(result.bonus).toBe(1.0)
    })

    it('should apply 20% bonus for GCLAW', () => {
      const result = calculateCredits('GCLAW', 10000, 0.001)
      expect(result.creditsUsd).toBe(12) // $10 * 1.2
      expect(result.bonus).toBe(1.2)
    })

    it('should handle fractional amounts', () => {
      const result = calculateCredits('SOL', 0.5, 150)
      expect(result.creditsUsd).toBe(75)
    })

    it('should handle zero amount', () => {
      const result = calculateCredits('SOL', 0, 150)
      expect(result.creditsUsd).toBe(0)
    })

    it('should handle low price tokens', () => {
      const result = calculateCredits('GCLAW', 1000000, 0.00001)
      expect(result.creditsUsd).toBe(12) // $10 * 1.2
    })
  })

  // ============================================
  // validateMinimumDeposit
  // ============================================
  describe('validateMinimumDeposit', () => {
    it('should accept deposit above minimum', () => {
      const result = validateMinimumDeposit(5)
      expect(result.valid).toBe(true)
      expect(result.minimum).toBe(3)
      expect(result.provided).toBe(5)
    })

    it('should accept deposit at exactly minimum', () => {
      const result = validateMinimumDeposit(3)
      expect(result.valid).toBe(true)
    })

    it('should reject deposit below minimum', () => {
      const result = validateMinimumDeposit(2.99)
      expect(result.valid).toBe(false)
      expect(result.provided).toBe(2.99)
    })

    it('should reject zero deposit', () => {
      const result = validateMinimumDeposit(0)
      expect(result.valid).toBe(false)
    })

    it('should reject negative deposit', () => {
      const result = validateMinimumDeposit(-5)
      expect(result.valid).toBe(false)
    })
  })

  // ============================================
  // getBalanceWarningLevel
  // ============================================
  describe('getBalanceWarningLevel', () => {
    it('should return normal for 100+ executions', () => {
      expect(getBalanceWarningLevel(100)).toBe('normal')
      expect(getBalanceWarningLevel(1000)).toBe('normal')
      expect(getBalanceWarningLevel(10000)).toBe('normal')
    })

    it('should return low for 10-99 executions', () => {
      expect(getBalanceWarningLevel(99)).toBe('low')
      expect(getBalanceWarningLevel(50)).toBe('low')
      expect(getBalanceWarningLevel(10)).toBe('low')
    })

    it('should return critical for <10 executions', () => {
      expect(getBalanceWarningLevel(9)).toBe('critical')
      expect(getBalanceWarningLevel(5)).toBe('critical')
      expect(getBalanceWarningLevel(1)).toBe('critical')
      expect(getBalanceWarningLevel(0)).toBe('critical')
    })

    it('should handle edge cases', () => {
      expect(getBalanceWarningLevel(9)).toBe('critical')
      expect(getBalanceWarningLevel(10)).toBe('low')
      expect(getBalanceWarningLevel(99)).toBe('low')
      expect(getBalanceWarningLevel(100)).toBe('normal')
    })
  })

  // ============================================
  // formatBalance
  // ============================================
  describe('formatBalance', () => {
    it('should format balance with 4 decimal places', () => {
      expect(formatBalance(10.5)).toBe('$10.5000')
      expect(formatBalance(0.003)).toBe('$0.0030')
      expect(formatBalance(100)).toBe('$100.0000')
    })

    it('should handle zero', () => {
      expect(formatBalance(0)).toBe('$0.0000')
    })

    it('should handle small amounts', () => {
      expect(formatBalance(0.0001)).toBe('$0.0001')
    })
  })

  // ============================================
  // parseSolTransfer
  // ============================================
  describe('parseSolTransfer', () => {
    it('should parse valid SOL transfer instruction', () => {
      const instructions = [
        {
          programId: '11111111111111111111111111111111',
          parsed: {
            type: 'transfer',
            info: {
              source: 'SenderWallet123',
              destination: 'TreasuryWallet456',
              lamports: 500000000, // 0.5 SOL
            },
          },
        },
      ]

      const result = parseSolTransfer(instructions)
      expect(result).not.toBeNull()
      expect(result?.source).toBe('SenderWallet123')
      expect(result?.destination).toBe('TreasuryWallet456')
      expect(result?.lamports).toBe(500000000)
    })

    it('should return null for empty instructions', () => {
      const result = parseSolTransfer([])
      expect(result).toBeNull()
    })

    it('should return null for non-system program', () => {
      const instructions = [
        {
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          parsed: {
            type: 'transfer',
            info: {
              source: 'SenderWallet123',
              destination: 'TreasuryWallet456',
              lamports: 500000000,
            },
          },
        },
      ]

      const result = parseSolTransfer(instructions)
      expect(result).toBeNull()
    })

    it('should return null for non-transfer type', () => {
      const instructions = [
        {
          programId: '11111111111111111111111111111111',
          parsed: {
            type: 'createAccount',
            info: {
              source: 'SenderWallet123',
              destination: 'TreasuryWallet456',
              lamports: 500000000,
            },
          },
        },
      ]

      const result = parseSolTransfer(instructions)
      expect(result).toBeNull()
    })

    it('should return null for missing parsed data', () => {
      const instructions = [
        {
          programId: '11111111111111111111111111111111',
        },
      ]

      const result = parseSolTransfer(instructions as unknown)
      expect(result).toBeNull()
    })

    it('should handle multiple instructions and find the transfer', () => {
      const instructions = [
        {
          programId: 'ComputeBudget111111111111111111111111111111',
          parsed: { type: 'setComputeUnitLimit', info: {} },
        },
        {
          programId: '11111111111111111111111111111111',
          parsed: {
            type: 'transfer',
            info: {
              source: 'SenderWallet123',
              destination: 'TreasuryWallet456',
              lamports: 500000000,
            },
          },
        },
      ]

      const result = parseSolTransfer(instructions as unknown)
      expect(result).not.toBeNull()
      expect(result?.lamports).toBe(500000000)
    })
  })

  // ============================================
  // parseTokenTransfer
  // ============================================
  describe('parseTokenTransfer', () => {
    it('should parse valid transferChecked instruction', () => {
      const instructions = [
        {
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          parsed: {
            type: 'transferChecked',
            info: {
              mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              source: 'SourceAta123',
              destination: 'DestAta456',
              tokenAmount: { amount: '50000000' },
              authority: 'OwnerWallet789',
            },
          },
        },
      ]

      const result = parseTokenTransfer(instructions)
      expect(result).not.toBeNull()
      expect(result?.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      expect(result?.amount).toBe(50000000)
      expect(result?.authority).toBe('OwnerWallet789')
    })

    it('should parse valid transfer instruction with amount field', () => {
      const instructions = [
        {
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          parsed: {
            type: 'transfer',
            info: {
              source: 'SourceAta123',
              destination: 'DestAta456',
              amount: '1000000000',
              authority: 'OwnerWallet789',
            },
          },
        },
      ]

      const result = parseTokenTransfer(instructions)
      expect(result).not.toBeNull()
      expect(result?.amount).toBe(1000000000)
    })

    it('should return null for non-token program', () => {
      const instructions = [
        {
          programId: '11111111111111111111111111111111',
          parsed: {
            type: 'transferChecked',
            info: {},
          },
        },
      ]

      const result = parseTokenTransfer(instructions)
      expect(result).toBeNull()
    })

    it('should return null for non-transfer type', () => {
      const instructions = [
        {
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          parsed: {
            type: 'approve',
            info: {},
          },
        },
      ]

      const result = parseTokenTransfer(instructions)
      expect(result).toBeNull()
    })

    it('should return null for empty instructions', () => {
      const result = parseTokenTransfer([])
      expect(result).toBeNull()
    })

    it('should handle both program and programId fields', () => {
      const instructions = [
        {
          program: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          parsed: {
            type: 'transfer',
            info: {
              amount: '1000000',
              authority: 'Owner',
              source: 'Source',
              destination: 'Dest',
            },
          },
        },
      ]

      const result = parseTokenTransfer(instructions)
      expect(result).not.toBeNull()
    })
  })

  // ============================================
  // Execution count calculations
  // ============================================
  describe('Execution calculations', () => {
    it('should calculate correct executions from balance', () => {
      const balanceUsd = 10.5
      const executions = Math.floor(balanceUsd / COST_PER_EXECUTION)
      expect(executions).toBe(3500)
    })

    it('should calculate correct executions for minimum deposit', () => {
      const executions = Math.floor(MIN_DEPOSIT_USD / COST_PER_EXECUTION)
      expect(executions).toBe(1000)
    })

    it('should calculate correct executions with GCLAW bonus', () => {
      const baseDeposit = 3
      const withBonus = baseDeposit * GCLAW_BONUS
      const executions = Math.floor(withBonus / COST_PER_EXECUTION)
      // Due to floating-point precision, 3 * 1.2 = 3.5999999... which floors to 1199
      expect(executions).toBeGreaterThanOrEqual(1199)
      expect(executions).toBeLessThanOrEqual(1200)
    })
  })
})
