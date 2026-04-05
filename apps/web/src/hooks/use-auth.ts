// Re-export useAuth from the provider for backwards compatibility
export { useAuth } from '@/components/providers/auth-provider'

/** @deprecated Auth is now handled via httpOnly cookies. No manual header needed. */
export function useAuthHeader() {
  return {}
}
