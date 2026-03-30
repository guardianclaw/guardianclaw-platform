/**
 * Mock Supabase client for testing
 * Provides chainable query builder pattern matching the real Supabase client
 */

import { vi } from 'vitest'

// Type definitions for mock responses
export interface MockSupabaseResponse<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
  count?: number
}

// Query builder that supports chaining
export class MockQueryBuilder<T = unknown> {
  private _data: T | T[] | null = null
  private _error: { message: string; code?: string } | null = null
  private _single = false
  private _count: number | null = null

  // Configure the mock response
  mockResolve(data: T | T[] | null): this {
    this._data = data
    this._error = null
    return this
  }

  mockReject(message: string, code?: string): this {
    this._data = null
    this._error = { message, code }
    return this
  }

  mockCount(count: number): this {
    this._count = count
    return this
  }

  // Chainable methods
  select(_columns?: string): this {
    return this
  }

  insert(_data: Partial<T> | Partial<T>[]): this {
    return this
  }

  update(_data: Partial<T>): this {
    return this
  }

  upsert(_data: Partial<T> | Partial<T>[]): this {
    return this
  }

  delete(): this {
    return this
  }

  eq(_column: string, _value: unknown): this {
    return this
  }

  neq(_column: string, _value: unknown): this {
    return this
  }

  gt(_column: string, _value: unknown): this {
    return this
  }

  gte(_column: string, _value: unknown): this {
    return this
  }

  lt(_column: string, _value: unknown): this {
    return this
  }

  lte(_column: string, _value: unknown): this {
    return this
  }

  like(_column: string, _pattern: string): this {
    return this
  }

  ilike(_column: string, _pattern: string): this {
    return this
  }

  is(_column: string, _value: unknown): this {
    return this
  }

  in(_column: string, _values: unknown[]): this {
    return this
  }

  order(_column: string, _options?: { ascending?: boolean }): this {
    return this
  }

  limit(_count: number): this {
    return this
  }

  range(_from: number, _to: number): this {
    return this
  }

  single(): this {
    this._single = true
    return this
  }

  maybeSingle(): this {
    this._single = true
    return this
  }

  // Terminal methods that return the result
  async then<TResult>(onfulfilled?: (value: MockSupabaseResponse<T>) => TResult): Promise<TResult> {
    const response: MockSupabaseResponse<T> = {
      data: this._single && Array.isArray(this._data) ? (this._data[0] ?? null) : (this._data as T),
      error: this._error,
      count: this._count ?? undefined,
    }
    return onfulfilled ? onfulfilled(response) : (response as unknown as TResult)
  }
}

// Table-specific mock data storage
type TableName =
  | 'profiles'
  | 'auth_sessions'
  | 'agents'
  | 'deployments'
  | 'api_keys'
  | 'llm_keys'
  | 'subscriptions'
  | 'agent_events'
  | 'usage_daily'
  | 'proposals'
  | 'votes'
  | 'comments'
  | 'conversations'
  | 'conversation_messages'
  | 'conversation_context'

// Mock Supabase client factory
export function createMockSupabaseClient() {
  const tableBuilders = new Map<TableName, MockQueryBuilder>()

  const mockClient = {
    from: vi.fn((table: TableName) => {
      if (!tableBuilders.has(table)) {
        tableBuilders.set(table, new MockQueryBuilder())
      }
      return tableBuilders.get(table)!
    }),

    // RPC call support
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),

    // Helper to configure table responses
    __setTableResponse: <T>(table: TableName, data: T | T[] | null, error?: string) => {
      const builder = new MockQueryBuilder<T>()
      if (error) {
        builder.mockReject(error)
      } else {
        builder.mockResolve(data)
      }
      tableBuilders.set(table, builder as MockQueryBuilder)
      return builder
    },

    // Helper to get table builder for assertions
    __getTableBuilder: (table: TableName) => tableBuilders.get(table),

    // Reset all mocks
    __reset: () => {
      tableBuilders.clear()
      mockClient.from.mockClear()
      mockClient.rpc.mockClear()
    },
  }

  return mockClient
}

// Convenience type for the mock client
export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>

// Factory to create client with preset responses
export function createMockSupabaseWithData(
  tableData: Partial<Record<TableName, unknown[]>>
): MockSupabaseClient {
  const client = createMockSupabaseClient()

  for (const [table, data] of Object.entries(tableData)) {
    client.__setTableResponse(table as TableName, data)
  }

  return client
}
