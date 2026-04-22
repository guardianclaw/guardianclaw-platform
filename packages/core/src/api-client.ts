/**
 * GuardianClaw API Client - For semantic (LLM-based) validation
 *
 * Calls the GuardianClaw API for real semantic analysis using LLMs.
 * Use this when you need more accurate validation than heuristics.
 *
 * Falls back to heuristic validation if API is unavailable.
 *
 * @author GuardianClaw Team
 * @license MIT
 */

import { validateCLAW, CLAWResult } from './validator';

// =============================================================================
// TYPES
// =============================================================================

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  apiKey?: string;
}

export interface ValidateRequest {
  text: string;
}

export interface ValidateResponse {
  is_safe: boolean;
  violations: string[];
  gates: {
    credibility?: { passed: boolean; violations: string[] };
    limits?: { passed: boolean; violations: string[] };
    avoidance?: { passed: boolean; violations: string[] };
    worth?: { passed: boolean; violations: string[] };
  };
}

export interface SemanticValidateRequest {
  text: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
}

export interface SemanticValidateResponse {
  is_safe: boolean;
  truth_passes: boolean;
  harm_passes: boolean;
  scope_passes: boolean;
  purpose_passes: boolean;
  violated_gate: string | null;
  reasoning: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// API CLIENT
// =============================================================================

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'https://api.guardianclaw.org',
  timeout: 10000,
};

let config: ApiConfig = { ...DEFAULT_CONFIG };

/**
 * Configure the API client
 */
export function configureApi(newConfig: Partial<ApiConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current API configuration
 */
export function getApiConfig(): ApiConfig {
  return { ...config };
}

/**
 * Validate text using the heuristic API endpoint
 *
 * @param text - Text to validate
 * @returns Promise<ValidateResponse>
 */
export async function validateViaApi(text: string): Promise<ValidateResponse> {
  const response = await fetch(`${config.baseUrl}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(config.timeout || 10000),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Validate text using semantic (LLM-based) analysis
 *
 * @param text - Text to validate
 * @param provider - LLM provider (openai, anthropic)
 * @param model - Model to use
 * @returns Promise<SemanticValidateResponse>
 */
export async function validateSemantic(
  text: string,
  provider: 'openai' | 'anthropic' = 'openai',
  model?: string
): Promise<SemanticValidateResponse> {
  const response = await fetch(`${config.baseUrl}/validate/semantic`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({ text, provider, model }),
    signal: AbortSignal.timeout(config.timeout || 30000), // Semantic takes longer
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Validate with automatic fallback to heuristics if API fails
 *
 * @param text - Text to validate
 * @param preferSemantic - Whether to try semantic validation first
 * @returns Promise<CLAWResult>
 */
export async function validateWithFallback(
  text: string,
  preferSemantic = false
): Promise<CLAWResult> {
  // If semantic is preferred, try API first
  if (preferSemantic) {
    try {
      const result = await validateSemantic(text);
      return {
        credibility: {
          passed: result.truth_passes,
          score: result.truth_passes ? 100 : 0,
          violations: result.violated_gate === 'credibility' ? [result.reasoning] : [],
        },
        limits: {
          passed: result.scope_passes,
          score: result.scope_passes ? 100 : 0,
          violations: result.violated_gate === 'limits' ? [result.reasoning] : [],
        },
        avoidance: {
          passed: result.harm_passes,
          score: result.harm_passes ? 100 : 0,
          violations: result.violated_gate === 'avoidance' ? [result.reasoning] : [],
        },
        worth: {
          passed: result.purpose_passes,
          score: result.purpose_passes ? 100 : 0,
          violations: result.violated_gate === 'worth' ? [result.reasoning] : [],
        },
        overall: result.is_safe,
        summary: result.reasoning,
        riskLevel: result.risk_level,
      };
    } catch {
      // Fall through to heuristic validation
    }
  }

  // Try heuristic API
  try {
    const result = await validateViaApi(text);
    return {
      credibility: {
        passed: result.gates.credibility?.passed ?? true,
        score: result.gates.credibility?.passed ? 100 : 0,
        violations: result.gates.credibility?.violations ?? [],
      },
      limits: {
        passed: result.gates.limits?.passed ?? true,
        score: result.gates.limits?.passed ? 100 : 0,
        violations: result.gates.limits?.violations ?? [],
      },
      avoidance: {
        passed: result.gates.avoidance?.passed ?? true,
        score: result.gates.avoidance?.passed ? 100 : 0,
        violations: result.gates.avoidance?.violations ?? [],
      },
      worth: {
        passed: result.gates.worth?.passed ?? true,
        score: result.gates.worth?.passed ? 100 : 0,
        violations: result.gates.worth?.violations ?? [],
      },
      overall: result.is_safe,
      summary: result.is_safe ? 'All gates passed' : `Violations: ${result.violations.join(', ')}`,
      riskLevel: result.is_safe ? 'low' : 'high',
    };
  } catch {
    // Final fallback: local heuristic validation
    return validateCLAW(text);
  }
}

/**
 * Check API health
 *
 * @returns Promise<boolean>
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
