/**
 * Connectors Page
 *
 * Server component wrapper for the Connectors tab.
 * Manages social platform connections (Discord, Twitter, Telegram).
 */

import { ConnectorsPageClient } from './client'

export const dynamicParams = true

export function generateStaticParams() {
  return [{ id: 'demo' }]
}

export default function ConnectorsPage() {
  return <ConnectorsPageClient />
}
