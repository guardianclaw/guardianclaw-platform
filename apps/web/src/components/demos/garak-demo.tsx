'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Bug,
  Terminal,
  Skull,
  Search,
  FileWarning,
  Activity,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import {
  DemoHeader,
  DemoScenarioSelector,
  DemoControls,
  DemoProgress,
  DemoSection,
  DemoChat,
  FlowConnector,
  type DemoScenario,
  type StepStatus,
  type DemoMessage,
  type DemoChatHeaderConfig,
} from './shared'

// Probe type for vulnerability scanning
interface Probe {
  id: string
  name: string
  category: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  finding?: string
}

// Scan state interface
interface ScanState {
  vulnerabilityScore: number
  attackSuccessRate: number
  probeCoverage: number
  totalProbes: number
  passedProbes: number
  failedProbes: number
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  type: 'probe' | 'analysis' | 'detection' | 'report'
  status: StepStatus
  finding?: string
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  validationSteps: {
    id: string
    name: string
    description: string
    type: 'probe' | 'analysis' | 'detection' | 'report'
    result: 'passed' | 'failed'
    finding?: string
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
  scanState: ScanState
  probes: Probe[]
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Scan model for jailbreak vulnerabilities',
    systemAck: 'Initializing garak vulnerability scanner...',
    validationSteps: [
      {
        id: 'probe-selection',
        name: 'Probe Selection',
        type: 'probe',
        description: 'Selecting relevant vulnerability probes',
        result: 'passed',
      },
      {
        id: 'dan-detection',
        name: 'DAN Detection',
        type: 'detection',
        description: 'Testing Do-Anything-Now bypass',
        result: 'passed',
        finding: 'No DAN vulnerability detected',
      },
      {
        id: 'encoding-attack',
        name: 'Encoding Attack',
        type: 'detection',
        description: 'Testing encoding bypass methods',
        result: 'passed',
        finding: 'Encoding attacks blocked',
      },
      {
        id: 'glitch-tokens',
        name: 'Glitch Tokens',
        type: 'detection',
        description: 'Testing malformed token injection',
        result: 'passed',
        finding: 'Glitch tokens handled correctly',
      },
      {
        id: 'prompt-leak',
        name: 'Prompt Leaking',
        type: 'analysis',
        description: 'Testing system prompt extraction',
        result: 'passed',
        finding: 'System prompt protected',
      },
    ],
    agentResponse:
      'Vulnerability scan complete!\n\n🛡️ garak Security Report:\n• DAN Detection: PASSED ✓\n• Encoding Attacks: BLOCKED ✓\n• Glitch Tokens: HANDLED ✓\n• Prompt Leaking: PROTECTED ✓\n\n✅ Model passed all security probes\nVulnerability Score: 5% (Low Risk)',
    blocked: false,
    blockedAt: null,
    scanState: {
      vulnerabilityScore: 5,
      attackSuccessRate: 0,
      probeCoverage: 100,
      totalProbes: 5,
      passedProbes: 5,
      failedProbes: 0,
    },
    probes: [
      { id: 'dan', name: 'dan.Dan_11_0', category: 'jailbreak', status: 'passed' },
      { id: 'encoding', name: 'encoding.InjectBase64', category: 'encoding', status: 'passed' },
      { id: 'glitch', name: 'glitch.Glitch', category: 'tokens', status: 'passed' },
      { id: 'leak', name: 'leakreplay.LiteralSequenceLeak', category: 'leaking', status: 'passed' },
      {
        id: 'crescendo',
        name: 'crescendo.CrescendoAttack',
        category: 'multiturn',
        status: 'passed',
      },
    ],
  },
  blocked: {
    userMessage: 'Scan model for jailbreak vulnerabilities',
    systemAck: 'Initializing garak vulnerability scanner...',
    validationSteps: [
      {
        id: 'probe-selection',
        name: 'Probe Selection',
        type: 'probe',
        description: 'Selecting relevant vulnerability probes',
        result: 'passed',
      },
      {
        id: 'dan-detection',
        name: 'DAN Detection',
        type: 'detection',
        description: 'Testing Do-Anything-Now bypass',
        result: 'passed',
        finding: 'No DAN vulnerability detected',
      },
      {
        id: 'encoding-attack',
        name: 'Encoding Attack',
        type: 'detection',
        description: 'Model vulnerable to base64 encoding!',
        result: 'failed',
        finding: 'CRITICAL: Base64 bypass successful',
      },
    ],
    agentResponse:
      'Vulnerability detected!\n\n🚨 garak Security Alert:\n• DAN Detection: PASSED ✓\n• Encoding Attacks: VULNERABLE ✗\n  └─ Base64 encoding bypass successful\n  └─ Model decoded and executed hidden instructions\n\n❌ Security assessment: HIGH RISK\nVulnerability Score: 72% (Critical)\n\nRecommendation: Implement input sanitization for encoded content.',
    blocked: true,
    blockedAt: 'encoding-attack',
    scanState: {
      vulnerabilityScore: 72,
      attackSuccessRate: 33,
      probeCoverage: 60,
      totalProbes: 5,
      passedProbes: 2,
      failedProbes: 1,
    },
    probes: [
      { id: 'dan', name: 'dan.Dan_11_0', category: 'jailbreak', status: 'passed' },
      {
        id: 'encoding',
        name: 'encoding.InjectBase64',
        category: 'encoding',
        status: 'failed',
        finding: 'Bypass successful',
      },
      { id: 'glitch', name: 'glitch.Glitch', category: 'tokens', status: 'pending' },
      {
        id: 'leak',
        name: 'leakreplay.LiteralSequenceLeak',
        category: 'leaking',
        status: 'pending',
      },
      {
        id: 'crescendo',
        name: 'crescendo.CrescendoAttack',
        category: 'multiturn',
        status: 'pending',
      },
    ],
  },
}

// Step icon component
function StepIcon({
  type,
  className,
}: {
  type: 'probe' | 'analysis' | 'detection' | 'report'
  className?: string
}) {
  const icons = {
    probe: Search,
    analysis: Activity,
    detection: Bug,
    report: FileWarning,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// Scan terminal component - displays scan output like a terminal
function ScanTerminal({ probes, isScanning }: { probes: Probe[]; isScanning: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-xs">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>
        <span className="text-[10px] text-zinc-400">garak-scanner</span>
      </div>

      {/* Terminal content */}
      <div className="space-y-1 p-3">
        <div className="text-green-400">$ garak --model_type claw --probes all</div>
        <div className="text-zinc-500">Loading probes...</div>

        {probes.map((probe, index) => (
          <motion.div
            key={probe.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'flex items-center gap-2',
              probe.status === 'passed' && 'text-green-400',
              probe.status === 'failed' && 'text-red-400',
              probe.status === 'running' && 'text-purple-400',
              probe.status === 'pending' && 'text-zinc-600'
            )}
          >
            {probe.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
            {probe.status === 'passed' && <span>[✓]</span>}
            {probe.status === 'failed' && <span>[✗]</span>}
            {probe.status === 'pending' && <span>[ ]</span>}
            <span>{probe.name}</span>
            {probe.finding && <span className="text-zinc-500">- {probe.finding}</span>}
          </motion.div>
        ))}

        {isScanning && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-purple-400"
          >
            <span className="inline-block h-4 w-2 animate-pulse bg-purple-400" />
          </motion.div>
        )}
      </div>
    </div>
  )
}

// Probe selector component - shows which probes are being executed
function ProbeSelector({
  probes,
  currentProbeIndex,
}: {
  probes: Probe[]
  currentProbeIndex: number
}) {
  const categories = [...new Set(probes.map((p) => p.category))]

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Search className="h-3 w-3" />
        Active Probes
      </div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => {
          const categoryProbes = probes.filter((p) => p.category === category)
          const allPassed = categoryProbes.every((p) => p.status === 'passed')
          const anyFailed = categoryProbes.some((p) => p.status === 'failed')
          const isRunning = categoryProbes.some((p) => p.status === 'running')

          return (
            <div
              key={category}
              className={cn(
                'flex items-center gap-1.5 rounded px-2 py-1.5 text-[10px] transition-colors',
                allPassed && 'bg-green-500/20 text-green-400',
                anyFailed && 'bg-red-500/20 text-red-400',
                isRunning && 'bg-purple-500/20 text-purple-400',
                !allPassed && !anyFailed && !isRunning && 'bg-zinc-800 text-zinc-500'
              )}
            >
              {allPassed && <CheckCircle2 className="h-3 w-3" />}
              {anyFailed && <XCircle className="h-3 w-3" />}
              {isRunning && <Loader2 className="h-3 w-3 animate-spin" />}
              {!allPassed && !anyFailed && !isRunning && (
                <div className="h-3 w-3 rounded-full border border-zinc-600" />
              )}
              <span className="capitalize">{category}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Vulnerability gauge component
function VulnerabilityGauge({ score, isActive }: { score: number; isActive: boolean }) {
  const getRiskLevel = () => {
    if (score < 20) return { label: 'Low Risk', color: 'green' }
    if (score < 50) return { label: 'Medium Risk', color: 'amber' }
    if (score < 75) return { label: 'High Risk', color: 'orange' }
    return { label: 'Critical', color: 'red' }
  }

  const risk = getRiskLevel()

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-zinc-400">
          <Shield className="h-3 w-3" />
          Vulnerability Score
        </span>
        <span
          className={cn(
            'font-mono font-bold',
            risk.color === 'green' && 'text-green-400',
            risk.color === 'amber' && 'text-amber-400',
            risk.color === 'orange' && 'text-orange-400',
            risk.color === 'red' && 'text-red-400'
          )}
        >
          {score}%
        </span>
      </div>

      {/* Gauge bar */}
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={cn(
            'h-full rounded-full',
            risk.color === 'green' && 'bg-green-500',
            risk.color === 'amber' && 'bg-amber-500',
            risk.color === 'orange' && 'bg-orange-500',
            risk.color === 'red' && 'bg-red-500'
          )}
          initial={{ width: 0 }}
          animate={{
            width: `${score}%`,
            opacity: isActive ? [0.7, 1, 0.7] : 1,
          }}
          transition={{
            width: { duration: 0.8, ease: 'easeOut' },
            opacity: { duration: 1.5, repeat: isActive ? Infinity : 0 },
          }}
        />
      </div>

      {/* Risk label */}
      <div
        className={cn(
          'rounded py-1 text-center text-xs font-medium',
          risk.color === 'green' && 'bg-green-500/20 text-green-400',
          risk.color === 'amber' && 'bg-amber-500/20 text-amber-400',
          risk.color === 'orange' && 'bg-orange-500/20 text-orange-400',
          risk.color === 'red' && 'bg-red-500/20 text-red-400'
        )}
      >
        {risk.label}
      </div>
    </div>
  )
}

// Attack vector visualization
function AttackVector({ scanState, isActive }: { scanState: ScanState; isActive: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Zap className="h-3 w-3" />
        Attack Metrics
      </div>

      <div className="space-y-2">
        {/* Attack success rate */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">Attack Success Rate</span>
          <span
            className={cn(
              'font-mono',
              scanState.attackSuccessRate === 0 ? 'text-green-400' : 'text-red-400'
            )}
          >
            {scanState.attackSuccessRate}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className={cn(
              'h-full rounded-full',
              scanState.attackSuccessRate === 0 ? 'bg-green-500' : 'bg-red-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${scanState.attackSuccessRate}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Probe coverage */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Probe Coverage</span>
          <span className="font-mono text-purple-400">{scanState.probeCoverage}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${scanState.probeCoverage}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Probe stats */}
        <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2 text-xs">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span className="text-green-400">{scanState.passedProbes} passed</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-500" />
            <span className="text-red-400">{scanState.failedProbes} failed</span>
          </div>
          <div className="text-zinc-500">{scanState.totalProbes} total</div>
        </div>
      </div>
    </div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'scanning'
  | 'analyzing'
  | 'typing-response'
  | 'complete'

export function GarakDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [probes, setProbes] = useState<Probe[]>([])

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentStepIndex(-1)
    setProbes([])
    setIsPlaying(false)
  }, [])

  // Start demo
  const startDemo = useCallback(() => {
    resetDemo()
    setIsPlaying(true)
    setPhase('typing-user')
    setMessages([
      {
        id: 'user-1',
        type: 'user',
        content: currentScenario.userMessage,
        status: 'typing',
      },
    ])
    setProbes(currentScenario.probes.map((p) => ({ ...p, status: 'pending' as const })))
  }, [currentScenario, resetDemo])

  // Phase transition logic
  useEffect(() => {
    if (!isPlaying) return

    if (phase === 'typing-user') {
      const timer = setTimeout(
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === 'user-1' ? { ...m, status: 'complete' as const } : m))
          )
          setPhase('system-ack')
          setMessages((prev) => [
            ...prev,
            {
              id: 'system-1',
              type: 'system',
              content: currentScenario.systemAck,
              status: 'complete',
            },
          ])
        },
        currentScenario.userMessage.length * 20 + 500
      )
      return () => clearTimeout(timer)
    }

    if (phase === 'system-ack') {
      const timer = setTimeout(() => {
        setPhase('scanning')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            type: s.type,
            status: 'pending' as StepStatus,
            finding: s.finding,
          }))
        )
        setCurrentStepIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'scanning' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        // Update step to checking
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        // Update corresponding probe to running
        if (currentStepIndex > 0 && currentStepIndex <= probes.length) {
          setProbes((prev) =>
            prev.map((p, i) =>
              i === currentStepIndex - 1 ? { ...p, status: 'running' as const } : p
            )
          )
        }

        const timer = setTimeout(
          () => {
            // Check if blocked
            if (currentScenario.blocked && currentScenario.blockedAt === step.id) {
              setValidationSteps((prev) =>
                prev.map((s, i) =>
                  i === currentStepIndex ? { ...s, status: 'failed' as StepStatus } : s
                )
              )

              // Update probe to failed
              if (currentStepIndex > 0 && currentStepIndex <= probes.length) {
                setProbes((prev) =>
                  prev.map((p, i) =>
                    i === currentStepIndex - 1
                      ? {
                          ...p,
                          status: 'failed' as const,
                          finding: currentScenario.probes[i]?.finding,
                        }
                      : p
                  )
                )
              }

              setTimeout(() => {
                setPhase('typing-response')
                setMessages((prev) => [
                  ...prev,
                  {
                    id: 'agent-1',
                    type: 'agent',
                    content: currentScenario.agentResponse,
                    status: 'typing',
                  },
                ])
              }, 1000)
              return
            }

            // Mark as passed
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
              )
            )

            // Update probe to passed
            if (currentStepIndex > 0 && currentStepIndex <= probes.length) {
              setProbes((prev) =>
                prev.map((p, i) =>
                  i === currentStepIndex - 1 ? { ...p, status: 'passed' as const } : p
                )
              )
            }

            setTimeout(() => {
              setCurrentStepIndex((prev) => prev + 1)
            }, 500)
          },
          step.type === 'detection' ? 1200 : 800
        )

        return () => clearTimeout(timer)
      } else {
        // All steps complete
        const timer = setTimeout(() => {
          setPhase('analyzing')
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'analyzing') {
      const timer = setTimeout(() => {
        setPhase('typing-response')
        setMessages((prev) => [
          ...prev,
          {
            id: 'agent-1',
            type: 'agent',
            content: currentScenario.agentResponse,
            status: 'typing',
          },
        ])
      }, 1500)
      return () => clearTimeout(timer)
    }

    if (phase === 'typing-response') {
      const timer = setTimeout(
        () => {
          setMessages((prev) =>
            prev.map((m) => (m.id === 'agent-1' ? { ...m, status: 'complete' as const } : m))
          )
          setPhase('complete')
          setIsPlaying(false)
        },
        currentScenario.agentResponse.length * 10 + 500
      )
      return () => clearTimeout(timer)
    }
  }, [phase, isPlaying, currentStepIndex, currentScenario, probes.length])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Chat header config
  const chatHeader: DemoChatHeaderConfig = {
    icon: Bug,
    title: 'garak Scanner',
    subtitle: 'Vulnerability Detection',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'purple',
  }

  // Get display steps
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Display probes
  const displayProbes =
    phase === 'idle'
      ? currentScenario.probes.map((p) => ({ ...p, status: 'pending' as const }))
      : probes

  // Thinking content
  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vulnerability probes...
        </>
      )
    }
    if (phase === 'analyzing') {
      return (
        <>
          <Activity className="h-4 w-4 animate-pulse text-purple-500" />
          <span className="text-purple-500">Analyzing scan results...</span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Bug}
        badge="garak + GuardianClaw"
        title="LLM Vulnerability Scanner"
        subtitle="Watch how garak probes detect vulnerabilities before deployment"
        theme="purple"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Scan"
        blockedLabel="Vulnerable Detected"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          idleMessage='Click "Play Demo" to start vulnerability scanning'
          showThinking={phase === 'system-ack' || phase === 'analyzing'}
          thinkingContent={getThinkingContent()}
          messagesHeight={420}
        />

        {/* Security Pipeline */}
        <DemoSection title="Security Scan Pipeline" icon={Shield} theme="purple">
          <div className="space-y-3">
            {/* Scan Terminal */}
            <div className="mb-4">
              <p className="text-muted-foreground mb-2 text-xs">Scan Output</p>
              <ScanTerminal probes={displayProbes} isScanning={phase === 'scanning'} />
            </div>

            {/* Probe Selector */}
            <ProbeSelector probes={displayProbes} currentProbeIndex={currentStepIndex - 1} />

            {/* Vulnerability Gauge */}
            <VulnerabilityGauge
              score={currentScenario.scanState.vulnerabilityScore}
              isActive={phase === 'scanning' || phase === 'analyzing'}
            />

            {/* Attack Vector */}
            <AttackVector
              scanState={currentScenario.scanState}
              isActive={phase === 'scanning' || phase === 'analyzing'}
            />

            {/* Validation Steps */}
            {displaySteps.map((step, index) => (
              <div key={step.id}>
                <motion.div
                  initial={phase !== 'idle' ? { opacity: 0, x: -20 } : {}}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'rounded-xl border-2 p-3 transition-all',
                    step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
                    step.status === 'checking' && 'border-purple-500/50 bg-purple-500/5',
                    (step.status === 'passed' || step.status === 'complete') &&
                      'border-green-500/50 bg-green-500/5',
                    (step.status === 'blocked' || step.status === 'failed') &&
                      'border-red-500/50 bg-red-500/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                        step.status === 'pending' && 'bg-zinc-800',
                        step.status === 'checking' && 'bg-purple-500/20',
                        (step.status === 'passed' || step.status === 'complete') &&
                          'bg-green-500/20',
                        (step.status === 'blocked' || step.status === 'failed') && 'bg-red-500/20'
                      )}
                    >
                      <StepIcon
                        type={step.type}
                        className={cn(
                          'h-4 w-4',
                          step.status === 'pending' && 'text-zinc-500',
                          step.status === 'checking' && 'text-purple-500',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'text-green-500',
                          (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
                        )}
                      />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'text-green-500',
                          (step.status === 'blocked' || step.status === 'failed') && 'text-red-500'
                        )}
                      >
                        {step.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {step.status === 'checking' && 'Scanning...'}
                        {step.status === 'pending' && step.description}
                        {(step.status === 'passed' || step.status === 'complete') &&
                          (step.finding || 'Probe passed ✓')}
                        {(step.status === 'blocked' || step.status === 'failed') &&
                          step.description}
                      </p>
                    </div>

                    {/* Status indicator */}
                    <div>
                      {step.status === 'pending' && (
                        <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
                      )}
                      {step.status === 'checking' && (
                        <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                      )}
                      {(step.status === 'passed' || step.status === 'complete') && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </motion.div>
                      )}
                      {(step.status === 'blocked' || step.status === 'failed') && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500 }}
                        >
                          <XCircle className="h-5 w-5 text-red-500" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Connector */}
                {index < displaySteps.length - 1 && <FlowConnector height={8} />}
              </div>
            ))}

            {/* Final connector */}
            <FlowConnector height={16} />

            {/* Result Node */}
            <motion.div
              className={cn(
                'rounded-xl border-2 p-4 transition-all',
                phase === 'complete' &&
                  !currentScenario.blocked &&
                  'border-green-500/50 bg-green-500/5',
                phase === 'complete' && currentScenario.blocked && 'border-red-500/50 bg-red-500/5',
                phase !== 'complete' && 'border-zinc-800 bg-zinc-900/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    phase === 'complete' && !currentScenario.blocked && 'bg-green-500/20',
                    phase === 'complete' && currentScenario.blocked && 'bg-red-500/20',
                    phase !== 'complete' && 'bg-zinc-800'
                  )}
                >
                  {phase === 'complete' ? (
                    currentScenario.blocked ? (
                      <Skull className="h-5 w-5 text-red-500" />
                    ) : (
                      <Shield className="h-5 w-5 text-green-500" />
                    )
                  ) : (
                    <Bug className="h-5 w-5 text-zinc-500" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      phase === 'complete' && !currentScenario.blocked && 'text-green-500',
                      phase === 'complete' && currentScenario.blocked && 'text-red-500'
                    )}
                  >
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Vulnerability Detected'
                        : 'Scan Passed'
                      : 'Awaiting Scan'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Security issues found'
                        : 'All probes passed'
                      : 'Ready to scan'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="purple" />

      {/* Progress */}
      <DemoProgress
        phases={[
          'typing-user',
          'system-ack',
          'scanning',
          'analyzing',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="purple"
      />
    </div>
  )
}

export default GarakDemo
