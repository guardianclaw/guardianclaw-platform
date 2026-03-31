/**
 * Solana Token Balance Service
 *
 * Provides functionality to read $GCLAW token balances from the Solana blockchain.
 * Uses the SPL Token program to query Associated Token Accounts.
 */

import { Connection, PublicKey } from '@solana/web3.js'

// $GCLAW token mint — set via GCLAW_MINT env var
// Placeholder until $GCLAW token is deployed — system program address
export const GCLAW_MINT = new PublicKey('11111111111111111111111111111111')

// Token decimals (SPL tokens typically use 6 or 9 decimals)
// This should be verified on-chain, but 6 is common for pump.fun tokens
export const TOKEN_DECIMALS = 6

// Simple in-memory cache (TTL: 60 seconds for balances)
const balanceCache = new Map<string, { balance: number; timestamp: number }>()
const CACHE_TTL_MS = 60_000 // 60 seconds

// Supply cache (TTL: 1 hour — supply changes infrequently)
const SUPPLY_CACHE_TTL_MS = 3_600_000 // 1 hour
const FALLBACK_SUPPLY = 1_000_000_000 // 1B tokens — last resort if RPC unavailable
let supplyCache: { supply: number; timestamp: number } | null = null

export interface TokenBalanceResult {
  balance: number // Token amount with decimals applied
  rawBalance: bigint // Raw on-chain amount
  decimals: number
  cached: boolean
  error?: string
}

/**
 * Get Associated Token Address for a wallet and mint
 * This is a simplified implementation that calculates the ATA deterministically
 */
async function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  // GCLAW uses Token-2022 program
  const TOKEN_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return address
}

/**
 * Parse token account data to extract balance
 * Token account layout: mint (32) + owner (32) + amount (8) + ...
 */
function parseTokenAccountBalance(data: Uint8Array): bigint {
  // Amount is at offset 64 (after mint and owner), 8 bytes little-endian
  if (data.length < 72) {
    return BigInt(0)
  }
  // Read 8 bytes as little-endian uint64
  const view = new DataView(data.buffer, data.byteOffset + 64, 8)
  return view.getBigUint64(0, true) // true = little-endian
}

/**
 * Get $GCLAW token balance for a wallet address
 *
 * @param rpcEndpoint - Solana RPC endpoint
 * @param walletAddress - User's wallet address (base58)
 * @returns Token balance result
 */
export async function getGuardianClawBalance(
  rpcEndpoint: string,
  walletAddress: string
): Promise<TokenBalanceResult> {
  // Check cache first
  const cacheKey = walletAddress
  const cached = balanceCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      balance: cached.balance,
      rawBalance: BigInt(Math.floor(cached.balance * Math.pow(10, TOKEN_DECIMALS))),
      decimals: TOKEN_DECIMALS,
      cached: true,
    }
  }

  try {
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const walletPubkey = new PublicKey(walletAddress)

    // Get the Associated Token Address for this wallet + mint
    const ata = await getAssociatedTokenAddress(GCLAW_MINT, walletPubkey)

    // Fetch the token account data
    const accountInfo = await connection.getAccountInfo(ata)

    if (!accountInfo || !accountInfo.data) {
      // Token account doesn't exist = 0 balance
      balanceCache.set(cacheKey, { balance: 0, timestamp: Date.now() })
      return {
        balance: 0,
        rawBalance: BigInt(0),
        decimals: TOKEN_DECIMALS,
        cached: false,
      }
    }

    // Parse the token account data
    const rawBalance = parseTokenAccountBalance(accountInfo.data)
    const balance = Number(rawBalance) / Math.pow(10, TOKEN_DECIMALS)

    // Update cache
    balanceCache.set(cacheKey, { balance, timestamp: Date.now() })

    return {
      balance,
      rawBalance,
      decimals: TOKEN_DECIMALS,
      cached: false,
    }
  } catch (err) {
    console.error('Failed to fetch token balance:', err)

    // Return cached value if available (stale cache)
    if (cached) {
      return {
        balance: cached.balance,
        rawBalance: BigInt(Math.floor(cached.balance * Math.pow(10, TOKEN_DECIMALS))),
        decimals: TOKEN_DECIMALS,
        cached: true,
        error: 'Using cached value due to RPC error',
      }
    }

    // No cache, return error state
    return {
      balance: 0,
      rawBalance: BigInt(0),
      decimals: TOKEN_DECIMALS,
      cached: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching balance',
    }
  }
}

/**
 * Alternative method using getTokenAccountsByOwner for more robust balance fetching
 * This handles wallets with multiple token accounts for the same mint
 */
export async function getGuardianClawBalanceViaOwner(
  rpcEndpoint: string,
  walletAddress: string
): Promise<TokenBalanceResult> {
  try {
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const walletPubkey = new PublicKey(walletAddress)

    const tokenAccounts = await connection.getTokenAccountsByOwner(walletPubkey, {
      mint: GCLAW_MINT,
    })

    if (tokenAccounts.value.length === 0) {
      return {
        balance: 0,
        rawBalance: BigInt(0),
        decimals: TOKEN_DECIMALS,
        cached: false,
      }
    }

    // Sum all token accounts (usually just one ATA, but handle edge cases)
    let totalRaw = BigInt(0)
    for (const account of tokenAccounts.value) {
      const amount = parseTokenAccountBalance(account.account.data)
      totalRaw += amount
    }

    const balance = Number(totalRaw) / Math.pow(10, TOKEN_DECIMALS)

    return {
      balance,
      rawBalance: totalRaw,
      decimals: TOKEN_DECIMALS,
      cached: false,
    }
  } catch (err) {
    return {
      balance: 0,
      rawBalance: BigInt(0),
      decimals: TOKEN_DECIMALS,
      cached: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export interface TokenSupplyResult {
  supply: number
  cached: boolean
  fallback: boolean
  error?: string
}

/**
 * Get total supply of $GCLAW token from on-chain data.
 * Uses aggressive caching (1h TTL) since supply rarely changes.
 * Falls back to cached value on RPC error, then to hardcoded 1B as last resort.
 */
export async function getTokenSupply(rpcEndpoint: string): Promise<TokenSupplyResult> {
  // Check cache first (1 hour TTL)
  if (supplyCache && Date.now() - supplyCache.timestamp < SUPPLY_CACHE_TTL_MS) {
    return {
      supply: supplyCache.supply,
      cached: true,
      fallback: false,
    }
  }

  try {
    const connection = new Connection(rpcEndpoint, 'confirmed')
    const supplyResponse = await connection.getTokenSupply(GCLAW_MINT)
    const supply = Number(supplyResponse.value.amount) / Math.pow(10, supplyResponse.value.decimals)

    // Update cache
    supplyCache = { supply, timestamp: Date.now() }

    return {
      supply,
      cached: false,
      fallback: false,
    }
  } catch (err) {
    console.warn('Failed to fetch token supply:', err instanceof Error ? err.message : err)

    // Fallback to stale cache
    if (supplyCache) {
      return {
        supply: supplyCache.supply,
        cached: true,
        fallback: false,
        error: 'Using stale cached supply due to RPC error',
      }
    }

    // Last resort: hardcoded fallback
    console.warn('No cached supply available, using fallback value:', FALLBACK_SUPPLY)
    return {
      supply: FALLBACK_SUPPLY,
      cached: false,
      fallback: true,
      error: 'Using fallback supply — RPC unavailable and no cache',
    }
  }
}

/**
 * Get the current finalized slot from the Solana network.
 * Used to snapshot the chain state when a proposal opens for voting.
 */
export async function getCurrentSlot(rpcEndpoint: string): Promise<number> {
  const connection = new Connection(rpcEndpoint, 'finalized')
  return connection.getSlot('finalized')
}

/**
 * Get $GCLAW token balance at a specific historical slot.
 * Requires an archival RPC endpoint (e.g. Helius) that supports historical queries.
 * No caching — snapshot balances are immutable and each wallet votes once.
 */
export async function getGuardianClawBalanceAtSlot(
  archiveRpcEndpoint: string,
  walletAddress: string,
  slot: number
): Promise<TokenBalanceResult> {
  try {
    const walletPubkey = new PublicKey(walletAddress)
    const ata = await getAssociatedTokenAddress(GCLAW_MINT, walletPubkey)

    // Use raw JSON-RPC to pass minContextSlot + specific slot config
    // Archival nodes (Helius, Triton) support historical getAccountInfo
    const response = await fetch(archiveRpcEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          ata.toBase58(),
          {
            encoding: 'base64',
            commitment: 'finalized',
            minContextSlot: slot,
          },
        ],
      }),
    })

    const json = (await response.json()) as {
      result?: {
        value?: { data?: [string, string] } | null
        context?: { slot: number }
      }
      error?: { message: string }
    }

    if (json.error) {
      throw new Error(`RPC error: ${json.error.message}`)
    }

    const accountData = json.result?.value?.data
    if (!accountData || !json.result?.value) {
      // No token account at that slot = 0 balance
      return {
        balance: 0,
        rawBalance: BigInt(0),
        decimals: TOKEN_DECIMALS,
        cached: false,
      }
    }

    // Decode base64 account data and parse balance
    const raw = Uint8Array.from(atob(accountData[0]), (c) => c.charCodeAt(0))
    const rawBalance = parseTokenAccountBalance(raw)
    const balance = Number(rawBalance) / Math.pow(10, TOKEN_DECIMALS)

    return {
      balance,
      rawBalance,
      decimals: TOKEN_DECIMALS,
      cached: false,
    }
  } catch (err) {
    console.error(`Failed to fetch balance at slot ${slot}:`, err)
    return {
      balance: 0,
      rawBalance: BigInt(0),
      decimals: TOKEN_DECIMALS,
      cached: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching historical balance',
    }
  }
}

/**
 * Clear the balance cache (useful for testing or force-refresh)
 */
export function clearBalanceCache(): void {
  balanceCache.clear()
  supplyCache = null
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: balanceCache.size,
    entries: Array.from(balanceCache.keys()),
  }
}
