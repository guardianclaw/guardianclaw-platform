/**
 * Mock external API services for testing
 * Includes Modal.com, OpenAI, and Solana RPC mocks
 */

import { vi } from 'vitest'

// ============================================================================
// Modal.com Runtime Mocks
// ============================================================================

export interface ModalExecutionResult {
  blocked: boolean
  response: string | null
  trace?: {
    steps: Array<{
      name: string
      status: 'success' | 'error' | 'skipped'
      duration_ms: number
      output?: unknown
    }>
    total_duration_ms: number
  }
  claw?: {
    input?: { passed: boolean; violations: string[] }
    output?: { passed: boolean; violations: string[] }
  }
}

export interface ModalHealthResult {
  status: 'healthy' | 'unhealthy'
  version: string
}

export function createModalRuntimeMock() {
  return {
    execute: vi.fn().mockResolvedValue({
      blocked: false,
      response: 'Mock response from Modal runtime',
      trace: {
        steps: [
          { name: 'input_validation', status: 'success', duration_ms: 5 },
          { name: 'llm_call', status: 'success', duration_ms: 150 },
          { name: 'output_validation', status: 'success', duration_ms: 5 },
        ],
        total_duration_ms: 160,
      },
    } as ModalExecutionResult),

    health: vi.fn().mockResolvedValue({
      status: 'healthy',
      version: '2.23.0',
    } as ModalHealthResult),

    validateInput: vi.fn().mockResolvedValue({
      passed: true,
      violations: [],
    }),

    validateOutput: vi.fn().mockResolvedValue({
      passed: true,
      violations: [],
    }),

    // Configure blocked response
    mockBlocked: (gate: string, violations: string[]) => {
      return {
        blocked: true,
        response: null,
        claw: {
          input: gate === 'input' ? { passed: false, violations } : undefined,
          output: gate === 'output' ? { passed: false, violations } : undefined,
        },
      }
    },

    // Configure error
    mockError: (message: string) => {
      return { error: message }
    },

    __reset: function () {
      this.execute.mockClear()
      this.health.mockClear()
      this.validateInput.mockClear()
      this.validateOutput.mockClear()
    },
  }
}

// ============================================================================
// OpenAI API Mocks
// ============================================================================

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenAIChatCompletion {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: 'stop' | 'length' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export function createOpenAIMock() {
  return {
    createChatCompletion: vi.fn().mockImplementation(
      async (
        _messages: OpenAIChatMessage[],
        model = 'gpt-4o-mini'
      ): Promise<OpenAIChatCompletion> => ({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mock response from OpenAI.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70,
        },
      })
    ),

    // Mock specific response
    mockResponse: (content: string) => ({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion' as const,
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: { role: 'assistant' as const, content },
          finish_reason: 'stop' as const,
        },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
    }),

    // Mock error response
    mockError: (status: number, message: string) => {
      const error = new Error(message) as Error & { status: number }
      error.status = status
      return error
    },

    __reset: function () {
      this.createChatCompletion.mockClear()
    },
  }
}

// ============================================================================
// Solana RPC Mocks
// ============================================================================

export interface SolanaTokenAccount {
  pubkey: string
  account: {
    data: {
      parsed: {
        info: {
          mint: string
          owner: string
          tokenAmount: {
            amount: string
            decimals: number
            uiAmount: number
          }
        }
      }
    }
  }
}

export interface SolanaRPCResponse<T> {
  jsonrpc: '2.0'
  id: number
  result: T
}

export function createSolanaRPCMock() {
  const GCLAW_MINT = process.env.NEXT_PUBLIC_GCLAW_MINT || ''
  const TOKEN_DECIMALS = 6

  return {
    // Get token accounts by owner
    getTokenAccountsByOwner: vi.fn().mockImplementation(
      async (owner: string): Promise<SolanaRPCResponse<{ value: SolanaTokenAccount[] }>> => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          value: [
            {
              pubkey: `${owner.slice(0, 8)}...ata`,
              account: {
                data: {
                  parsed: {
                    info: {
                      mint: GCLAW_MINT,
                      owner,
                      tokenAmount: {
                        amount: '1000000000', // 1000 tokens
                        decimals: TOKEN_DECIMALS,
                        uiAmount: 1000,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      })
    ),

    // Get account info (for single token account)
    getAccountInfo: vi.fn().mockResolvedValue({
      jsonrpc: '2.0',
      id: 1,
      result: { value: null },
    }),

    // Mock specific balance
    mockBalance: (amount: number) => ({
      jsonrpc: '2.0' as const,
      id: 1,
      result: {
        value: [
          {
            pubkey: 'mock-ata',
            account: {
              data: {
                parsed: {
                  info: {
                    mint: GCLAW_MINT,
                    owner: 'mock-owner',
                    tokenAmount: {
                      amount: String(amount * 10 ** TOKEN_DECIMALS),
                      decimals: TOKEN_DECIMALS,
                      uiAmount: amount,
                    },
                  },
                },
              },
            },
          },
        ],
      },
    }),

    // Mock no token accounts
    mockNoAccounts: () => ({
      jsonrpc: '2.0' as const,
      id: 1,
      result: { value: [] },
    }),

    // Mock RPC error
    mockError: (code: number, message: string) => ({
      jsonrpc: '2.0' as const,
      id: 1,
      error: { code, message },
    }),

    __reset: function () {
      this.getTokenAccountsByOwner.mockClear()
      this.getAccountInfo.mockClear()
    },
  }
}

// ============================================================================
// Fetch Mock Helper
// ============================================================================

export function createFetchMock() {
  return vi
    .fn()
    .mockImplementation(async (url: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      const urlStr = url.toString()

      // Default mock responses based on URL patterns
      if (urlStr.includes('modal.run')) {
        return new Response(
          JSON.stringify({
            blocked: false,
            response: 'Mock Modal response',
          }),
          { status: 200 }
        )
      }

      if (urlStr.includes('api.openai.com')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Mock OpenAI response' } }],
          }),
          { status: 200 }
        )
      }

      if (urlStr.includes('solana')) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { value: [] },
          }),
          { status: 200 }
        )
      }

      // Default 404
      return new Response('Not Found', { status: 404 })
    })
}

// ============================================================================
// Combined Mock Setup
// ============================================================================

export function createAllExternalMocks() {
  return {
    modal: createModalRuntimeMock(),
    openai: createOpenAIMock(),
    solana: createSolanaRPCMock(),
    fetch: createFetchMock(),
  }
}
