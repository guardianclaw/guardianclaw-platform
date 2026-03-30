// Re-export useAuth from the provider for backwards compatibility
export { useAuth } from '@/components/providers/auth-provider'

// Helper hook to get auth header
export function useAuthHeader() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('claw_token') : null

  return token ? { Authorization: `Bearer ${token}` } : {}
}
