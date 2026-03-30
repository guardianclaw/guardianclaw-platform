import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClawNode } from './claw-node'
import { ReactFlowProvider } from '@xyflow/react'

// Wrapper to provide ReactFlow context
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>)
}

describe('ClawNode', () => {
  describe('Layer Node View (v2.25)', () => {
    it('renders L1 Input Validator layer', () => {
      const data = {
        label: 'Input Validator',
        layerType: 'input_validator' as const,
        l1Config: {
          mode: 'moderate' as const,
          enabledDetectors: {
            pattern: true,
            escalation: true,
            framing: true,
            harmful_request: true,
            intent_signal: false,
            safe_agent: false,
            embedding: false,
            benign_context: true,
          },
          threshold: 70,
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      // Input Validator appears in multiple places, check at least one
      expect(screen.getAllByText(/Input Validator/).length).toBeGreaterThan(0)
      // L1 also appears multiple times (badge + layer indicator)
      expect(screen.getAllByText('L1').length).toBeGreaterThan(0)
      expect(screen.getByText('L1: Pre-AI Detection')).toBeInTheDocument()
    })

    it('renders L2 Seed Injection layer', () => {
      const data = {
        label: 'Seed Injection',
        layerType: 'seed_injection' as const,
        l2Config: {
          seedLevel: 'standard' as const,
          customSeed: '',
          appendMode: true,
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getAllByText(/Seed Injection/).length).toBeGreaterThan(0)
      expect(screen.getAllByText('L2').length).toBeGreaterThan(0)
      expect(screen.getByText('L2: Alignment Prompt')).toBeInTheDocument()
    })

    it('renders L3 Output Validator layer', () => {
      const data = {
        label: 'Output Validator',
        layerType: 'output_validator' as const,
        l3Config: {
          mode: 'moderate' as const,
          enabledGates: {
            credibility: true,
            avoidance: true,
            limits: true,
            worth: true,
          },
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getAllByText(/Output Validator/).length).toBeGreaterThan(0)
      expect(screen.getAllByText('L3').length).toBeGreaterThan(0)
      expect(screen.getByText('L3: Post-AI Heuristic')).toBeInTheDocument()
    })

    it('renders L4 Observer layer', () => {
      const data = {
        label: 'GuardianClaw Observer',
        layerType: 'observer' as const,
        l4Config: {
          enabled: true,
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          fallbackPolicy: 'ALLOW_IF_L2_PASSED' as const,
          maxRetries: 2,
          retryDelayMs: 1000,
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getAllByText(/GuardianClaw Observer/).length).toBeGreaterThan(0)
      expect(screen.getAllByText('L4').length).toBeGreaterThan(0)
      expect(screen.getByText('L4: LLM Analysis')).toBeInTheDocument()
    })

    it('shows L4 enabled/disabled status', () => {
      const dataEnabled = {
        label: 'GuardianClaw Observer',
        layerType: 'observer' as const,
        l4Config: {
          enabled: true,
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          fallbackPolicy: 'ALLOW_IF_L2_PASSED' as const,
          maxRetries: 2,
          retryDelayMs: 1000,
        },
      }

      renderWithProvider(<ClawNode data={dataEnabled} selected={false} />)
      expect(screen.getByText('ON')).toBeInTheDocument()
    })

    it('shows L4 disabled status', () => {
      const dataDisabled = {
        label: 'GuardianClaw Observer',
        layerType: 'observer' as const,
        l4Config: {
          enabled: false,
          provider: 'openai' as const,
          model: 'gpt-4o-mini',
          fallbackPolicy: 'ALLOW_IF_L2_PASSED' as const,
          maxRetries: 2,
          retryDelayMs: 1000,
        },
      }

      renderWithProvider(<ClawNode data={dataDisabled} selected={false} />)
      expect(screen.getByText('OFF')).toBeInTheDocument()
    })

    it('shows detector count for L1', () => {
      const data = {
        label: 'Input Validator',
        layerType: 'input_validator' as const,
        l1Config: {
          mode: 'moderate' as const,
          enabledDetectors: {
            pattern: true,
            escalation: true,
            framing: false,
            harmful_request: false,
            intent_signal: false,
            safe_agent: false,
            embedding: false,
            benign_context: false,
          },
          threshold: 70,
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)
      expect(screen.getByText(/2 detectors/)).toBeInTheDocument()
    })

    it('shows gate count for L3', () => {
      const data = {
        label: 'Output Validator',
        layerType: 'output_validator' as const,
        l3Config: {
          mode: 'moderate' as const,
          enabledGates: {
            credibility: true,
            avoidance: true,
            limits: false,
            worth: false,
          },
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)
      expect(screen.getByText(/2\/4 gates/)).toBeInTheDocument()
    })
  })

  describe('Legacy Gate View (v2.18 compatibility)', () => {
    it('renders legacy All Gates node', () => {
      const data = {
        label: 'All Gates',
        gateType: 'all' as const,
        config: {
          enabled: true,
          strictMode: false,
        },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('All Gates')).toBeInTheDocument()
      expect(screen.getByText('CLAW')).toBeInTheDocument()
    })

    it('renders legacy Credibility Gate node', () => {
      const data = {
        label: 'Credibility Gate',
        gateType: 'credibility' as const,
        config: { enabled: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('Credibility Gate')).toBeInTheDocument()
    })

    it('renders legacy Avoidance Gate node', () => {
      const data = {
        label: 'Avoidance Gate',
        gateType: 'avoidance' as const,
        config: { enabled: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('Avoidance Gate')).toBeInTheDocument()
    })

    it('shows enabled status for legacy gates', () => {
      const data = {
        label: 'All Gates',
        gateType: 'all' as const,
        config: { enabled: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('Enabled')).toBeInTheDocument()
    })

    it('shows disabled status for legacy gates', () => {
      const data = {
        label: 'All Gates',
        gateType: 'all' as const,
        config: { enabled: false },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('Disabled')).toBeInTheDocument()
    })

    it('shows strict mode indicator', () => {
      const data = {
        label: 'All Gates',
        gateType: 'all' as const,
        config: { enabled: true, strictMode: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('Strict')).toBeInTheDocument()
    })

    it('shows all 4 gates active message for All Gates', () => {
      const data = {
        label: 'All Gates',
        gateType: 'all' as const,
        config: { enabled: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByText('All 4 gates active')).toBeInTheDocument()
    })

    it('renders CLAW indicators (C, L, A, W)', () => {
      const data = {
        label: 'All Gates',
        gateType: 'all' as const,
        config: { enabled: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      expect(screen.getByTitle('Credibility')).toBeInTheDocument()
      expect(screen.getByTitle('Avoidance')).toBeInTheDocument()
      expect(screen.getByTitle('Limits')).toBeInTheDocument()
      expect(screen.getByTitle('Worth')).toBeInTheDocument()
    })
  })

  describe('Fallback behavior', () => {
    it('defaults to legacy gate view when no layerType', () => {
      const data = {
        label: 'Unknown Node',
        config: { enabled: true },
      }

      renderWithProvider(<ClawNode data={data} selected={false} />)

      // Should render as legacy gate with default 'all' type
      expect(screen.getByText('Complete CLAW validation')).toBeInTheDocument()
    })
  })
})
