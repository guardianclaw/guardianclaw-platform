'use client'

import { FC, ReactNode, useMemo, useState, useEffect } from 'react'
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useConnection,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'

import '@solana/wallet-adapter-react-ui/styles.css'

const EXPECTED_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta'

/**
 * Detects Solana network mismatch and shows a non-dismissible banner.
 */
function NetworkGuard({ children }: { children: ReactNode }) {
  const { connection } = useConnection()
  const [mismatch, setMismatch] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkNetwork() {
      try {
        const genesisHash = await connection.getGenesisHash()

        // Known genesis hashes
        const GENESIS_MAP: Record<string, string> = {
          '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d': 'mainnet-beta',
          EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: 'devnet',
          '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY': 'testnet',
        }

        const detectedNetwork = GENESIS_MAP[genesisHash] || 'unknown'

        if (!cancelled && detectedNetwork !== EXPECTED_NETWORK) {
          setMismatch(detectedNetwork)
        } else if (!cancelled) {
          setMismatch(null)
        }
      } catch {
        // Can't detect network — don't block the user
        if (!cancelled) setMismatch(null)
      }
    }

    checkNetwork()
    return () => {
      cancelled = true
    }
  }, [connection])

  return (
    <>
      {mismatch && (
        <div className="fixed left-0 right-0 top-0 z-[100] bg-yellow-600 px-4 py-2 text-center text-sm font-medium text-black">
          You are connected to <strong>{mismatch}</strong>. Switch to{' '}
          <strong>{EXPECTED_NETWORK}</strong> to use the platform.
        </div>
      )}
      <div className={mismatch ? 'pt-10' : ''}>{children}</div>
    </>
  )
}

interface Props {
  children: ReactNode
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          <NetworkGuard>{children}</NetworkGuard>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
