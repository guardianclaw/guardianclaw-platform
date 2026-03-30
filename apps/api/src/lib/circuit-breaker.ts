/**
 * Circuit Breaker for Modal Runtime
 *
 * Prevents cascading failures when Modal is consistently down.
 * Three states: closed (normal) -> open (skip Modal 60s) -> half-open (one probe) -> closed/open.
 *
 * Uses KV for persistence across workers with memory fallback.
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerState {
  state: CircuitState
  failures: number
  last_failure: string | null
  opened_at: string | null
}

const FAILURE_THRESHOLD = 3
const OPEN_DURATION_MS = 60_000 // 60 seconds
const KV_KEY = 'circuit:modal'

// Per-worker in-memory state
let memoryState: CircuitBreakerState = {
  state: 'closed',
  failures: 0,
  last_failure: null,
  opened_at: null,
}

export class CircuitBreaker {
  private kv: KVNamespace | null

  constructor(kv: KVNamespace | null) {
    this.kv = kv
  }

  private async getState(): Promise<CircuitBreakerState> {
    if (this.kv) {
      try {
        const stored = await this.kv.get(KV_KEY, 'json')
        if (stored) return stored as CircuitBreakerState
      } catch {
        // fall through to memory
      }
    }
    return { ...memoryState }
  }

  private async setState(state: CircuitBreakerState): Promise<void> {
    memoryState = { ...state }
    if (this.kv) {
      try {
        await this.kv.put(KV_KEY, JSON.stringify(state), { expirationTtl: 300 })
      } catch {
        // memory is already set
      }
    }
  }

  /**
   * Check if the circuit allows a request through.
   * In half-open state, allows exactly one probe request.
   */
  async allowRequest(): Promise<boolean> {
    const state = await this.getState()

    if (state.state === 'closed') return true

    if (state.state === 'open') {
      const openedAt = state.opened_at ? new Date(state.opened_at).getTime() : 0
      if (Date.now() - openedAt >= OPEN_DURATION_MS) {
        // Transition to half-open for a single probe
        await this.setState({ ...state, state: 'half-open' })
        return true
      }
      return false
    }

    // half-open: a probe is already in flight, reject additional requests
    return false
  }

  /**
   * Record a successful request. Resets circuit to closed.
   */
  async recordSuccess(): Promise<void> {
    await this.setState({
      state: 'closed',
      failures: 0,
      last_failure: null,
      opened_at: null,
    })
  }

  /**
   * Record a failure. Opens circuit after threshold.
   */
  async recordFailure(): Promise<void> {
    const state = await this.getState()
    const newFailures = state.failures + 1

    if (state.state === 'half-open' || newFailures >= FAILURE_THRESHOLD) {
      await this.setState({
        state: 'open',
        failures: newFailures,
        last_failure: new Date().toISOString(),
        opened_at: new Date().toISOString(),
      })
      console.warn(`[circuit-breaker] Circuit OPENED after ${newFailures} failures`)
    } else {
      await this.setState({
        ...state,
        failures: newFailures,
        last_failure: new Date().toISOString(),
      })
    }
  }

  /**
   * Get current state for health checks.
   */
  async status(): Promise<CircuitBreakerState> {
    return this.getState()
  }
}
