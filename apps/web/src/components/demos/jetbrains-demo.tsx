'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Lightbulb,
  FileCode,
  Search,
  Eye,
  FileWarning,
  Sparkles,
  Wrench,
  Flame,
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

// Code line interface for editor display
interface CodeLine {
  number: number
  content: string
  indent: number
  hasInspection?: boolean
  inspectionRange?: { start: number; end: number }
  inspectionSeverity?: 'warning' | 'error' | 'weak-warning'
  inspectionMessage?: string
}

// Inspection entry for inspection panel
interface Inspection {
  id: string
  severity: 'error' | 'warning' | 'weak-warning'
  message: string
  description: string
  file: string
  line: number
  quickFix?: string
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  type: 'psi' | 'inspection' | 'analysis' | 'intent'
  status: StepStatus
  finding?: string
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  codeLines: CodeLine[]
  validationSteps: {
    id: string
    name: string
    description: string
    type: 'psi' | 'inspection' | 'analysis' | 'intent'
    result: 'passed' | 'failed'
    finding?: string
  }[]
  inspections: Inspection[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Run GuardianClaw inspection on this Kotlin file',
    systemAck: 'GuardianClaw plugin analyzing code...',
    codeLines: [
      { number: 1, content: 'import com.openai.client.OpenAI', indent: 0 },
      { number: 2, content: 'import com.claw.validate', indent: 0 },
      { number: 3, content: '', indent: 0 },
      { number: 4, content: 'class LLMService(private val client: OpenAI) {', indent: 0 },
      { number: 5, content: '', indent: 0 },
      { number: 6, content: '    fun processQuery(userInput: String): String {', indent: 1 },
      { number: 7, content: '        // Validate input with GuardianClaw', indent: 2 },
      { number: 8, content: '        val safeInput = validate(userInput)', indent: 2 },
      { number: 9, content: '', indent: 2 },
      { number: 10, content: '        val prompt = "Process: $safeInput"', indent: 2 },
      { number: 11, content: '        val response = client.chat.completions.create(', indent: 2 },
      { number: 12, content: '            model = "gpt-4",', indent: 3 },
      { number: 13, content: '            messages = listOf(Message("user", prompt))', indent: 3 },
      { number: 14, content: '        )', indent: 2 },
      { number: 15, content: '        return response.choices[0].message.content', indent: 2 },
      { number: 16, content: '    }', indent: 1 },
      { number: 17, content: '}', indent: 0 },
    ],
    validationSteps: [
      {
        id: 'psi-analysis',
        name: 'PSI Analysis',
        type: 'psi',
        description: 'Building Program Structure Interface tree',
        result: 'passed',
        finding: 'Kotlin PSI parsed successfully',
      },
      {
        id: 'inspection-run',
        name: 'Inspection Run',
        type: 'inspection',
        description: 'Running GuardianClaw inspections',
        result: 'passed',
        finding: 'All inspections passed',
      },
      {
        id: 'pattern-analysis',
        name: 'Pattern Detection',
        type: 'analysis',
        description: 'Analyzing string interpolation patterns',
        result: 'passed',
        finding: 'Input properly validated before use',
      },
      {
        id: 'intent-check',
        name: 'Intent Generation',
        type: 'intent',
        description: 'Checking for applicable quick fixes',
        result: 'passed',
        finding: 'No fixes needed',
      },
    ],
    inspections: [],
    agentResponse:
      'Inspection complete!\n\nGuardianClaw Analysis Results:\n  PSI Analysis: PASSED\n  Input Validation: FOUND\n  Injection Check: SAFE\n\nNo issues detected.\nCode follows secure coding practices for LLM integration.',
    blocked: false,
    blockedAt: null,
  },
  blocked: {
    userMessage: 'Run GuardianClaw inspection on this Kotlin file',
    systemAck: 'GuardianClaw plugin analyzing code...',
    codeLines: [
      { number: 1, content: 'import com.openai.client.OpenAI', indent: 0 },
      { number: 2, content: '', indent: 0 },
      { number: 3, content: 'class LLMService(private val client: OpenAI) {', indent: 0 },
      { number: 4, content: '', indent: 0 },
      { number: 5, content: '    fun processQuery(userInput: String): String {', indent: 1 },
      { number: 6, content: '        // Build prompt with user input', indent: 2 },
      {
        number: 7,
        content: '        val prompt = "Process: $userInput"',
        indent: 2,
        hasInspection: true,
        inspectionRange: { start: 20, end: 40 },
        inspectionSeverity: 'warning',
        inspectionMessage: 'Potential prompt injection: unsanitized user input in string template',
      },
      { number: 8, content: '', indent: 2 },
      { number: 9, content: '        val response = client.chat.completions.create(', indent: 2 },
      { number: 10, content: '            model = "gpt-4",', indent: 3 },
      { number: 11, content: '            messages = listOf(Message("user", prompt))', indent: 3 },
      { number: 12, content: '        )', indent: 2 },
      { number: 13, content: '        return response.choices[0].message.content', indent: 2 },
      { number: 14, content: '    }', indent: 1 },
      { number: 15, content: '}', indent: 0 },
    ],
    validationSteps: [
      {
        id: 'psi-analysis',
        name: 'PSI Analysis',
        type: 'psi',
        description: 'Building Program Structure Interface tree',
        result: 'passed',
        finding: 'Kotlin PSI parsed successfully',
      },
      {
        id: 'inspection-run',
        name: 'Inspection Run',
        type: 'inspection',
        description: 'Running GuardianClaw inspections',
        result: 'passed',
        finding: 'String template detected at line 7',
      },
      {
        id: 'pattern-analysis',
        name: 'Pattern Detection',
        type: 'analysis',
        description: 'VULNERABILITY: Unsanitized input in template',
        result: 'failed',
        finding: 'User input directly interpolated without validation',
      },
    ],
    inspections: [
      {
        id: 'insp-1',
        severity: 'warning',
        message: 'Potential prompt injection vulnerability',
        description: 'User input is directly interpolated into LLM prompt without validation',
        file: 'LLMService.kt',
        line: 7,
        quickFix: 'Wrap with ClawValidator.validate()',
      },
    ],
    agentResponse:
      'Inspection found issues!\n\nGuardianClaw Warning at line 7:\n  Type: Prompt Injection Risk\n  Severity: WARNING\n\nQuick Fix Available:\n  Wrap userInput with ClawValidator.validate()\n\nPress Alt+Enter on the highlighted code to apply the fix.',
    blocked: true,
    blockedAt: 'pattern-analysis',
  },
}

// Step icon component
function StepIcon({
  type,
  className,
}: {
  type: 'psi' | 'inspection' | 'analysis' | 'intent'
  className?: string
}) {
  const icons = {
    psi: FileCode,
    inspection: Search,
    analysis: Eye,
    intent: Lightbulb,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// JetBrains Editor component
function JetBrainsEditor({
  lines,
  isScanning,
  showInspections,
  showLightbulb,
}: {
  lines: CodeLine[]
  isScanning: boolean
  showInspections: boolean
  showLightbulb: boolean
}) {
  const [lightbulbLine, setLightbulbLine] = useState<number | null>(null)

  useEffect(() => {
    if (showLightbulb) {
      const lineWithInspection = lines.find((l) => l.hasInspection)
      if (lineWithInspection) {
        setLightbulbLine(lineWithInspection.number)
      }
    } else {
      setLightbulbLine(null)
    }
  }, [showLightbulb, lines])

  return (
    <div className="overflow-hidden rounded-lg border border-[#3c3f41] bg-[#2b2b2b] font-mono text-xs">
      {/* Editor tabs - JetBrains style */}
      <div className="flex items-center border-b border-[#323232] bg-[#3c3f41]">
        <div className="flex items-center gap-1.5 border-r border-[#323232] bg-[#2b2b2b] px-3 py-1.5">
          <FileCode className="h-3.5 w-3.5 text-[#a9b7c6]" />
          <span className="text-[11px] text-[#a9b7c6]">LLMService.kt</span>
          <span className="h-2 w-2 rounded-full bg-[#6897bb]" />
        </div>
      </div>

      {/* Editor content with gutter */}
      <div className="flex">
        {/* Gutter - line numbers and markers */}
        <div className="flex-shrink-0 select-none border-r border-[#3c3f41] bg-[#313335]">
          {lines.map((line) => (
            <div
              key={line.number}
              className="flex h-[20px] items-center px-2 text-right text-[#606366]"
            >
              {/* Lightbulb indicator */}
              {showLightbulb && lightbulbLine === line.number && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mr-1"
                >
                  <Lightbulb className="h-3 w-3 text-amber-400" />
                </motion.div>
              )}
              {/* Line number */}
              <span className="w-6 text-[10px]">{line.number}</span>
            </div>
          ))}
        </div>

        {/* Code area */}
        <div className="flex-1 overflow-x-auto">
          {lines.map((line, index) => (
            <motion.div
              key={line.number}
              initial={isScanning ? { backgroundColor: 'transparent' } : {}}
              animate={
                isScanning && index === Math.floor(Date.now() / 200) % lines.length
                  ? { backgroundColor: 'rgba(255, 198, 109, 0.1)' }
                  : { backgroundColor: 'transparent' }
              }
              className={cn(
                'group relative h-[20px] px-3',
                line.hasInspection && showInspections && 'bg-[#52503a]'
              )}
            >
              <pre
                className="leading-[20px] text-[#a9b7c6]"
                style={{ paddingLeft: `${line.indent * 16}px` }}
              >
                {line.hasInspection && showInspections ? (
                  <span className="relative">
                    {line.content.substring(0, line.inspectionRange?.start || 0)}
                    <span
                      className={cn(
                        'relative',
                        line.inspectionSeverity === 'warning' && 'bg-[#52503a]',
                        line.inspectionSeverity === 'error' && 'bg-red-500/20'
                      )}
                    >
                      <KotlinSyntaxHighlight
                        content={line.content.substring(
                          line.inspectionRange?.start || 0,
                          line.inspectionRange?.end || line.content.length
                        )}
                      />
                      {/* Underline */}
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          'absolute bottom-0 left-0 right-0 h-[2px]',
                          line.inspectionSeverity === 'warning' && 'bg-amber-400',
                          line.inspectionSeverity === 'error' && 'bg-red-500'
                        )}
                        style={{ borderRadius: '1px' }}
                      />
                    </span>
                    <KotlinSyntaxHighlight
                      content={line.content.substring(
                        line.inspectionRange?.end || line.content.length
                      )}
                    />
                  </span>
                ) : (
                  <KotlinSyntaxHighlight content={line.content} />
                )}
              </pre>

              {/* Inspection popup on hover */}
              {line.hasInspection && showInspections && showLightbulb && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-8 top-6 z-20 hidden group-hover:block"
                >
                  <div className="max-w-sm rounded border border-[#5a5d60] bg-[#3c3f41] shadow-xl">
                    <div className="flex items-center gap-2 border-b border-[#5a5d60] px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span className="text-[11px] font-medium text-amber-400">
                        {line.inspectionSeverity === 'warning' ? 'Warning' : 'Error'}
                      </span>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-[#a9b7c6]">{line.inspectionMessage}</p>
                    </div>
                    <div className="border-t border-[#5a5d60] bg-[#313335] px-3 py-2">
                      <div className="flex cursor-pointer items-center gap-2 text-[10px] text-[#589df6] hover:underline">
                        <Lightbulb className="h-3 w-3" />
                        Apply Quick Fix (Alt+Enter)
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Kotlin syntax highlighting helper
function KotlinSyntaxHighlight({ content }: { content: string }) {
  const keywords = [
    'import',
    'class',
    'fun',
    'val',
    'var',
    'return',
    'private',
    'public',
    'if',
    'else',
    'for',
    'while',
    'when',
    'is',
    'in',
    'as',
    'object',
    'interface',
    'override',
    'suspend',
  ]
  const types = ['String', 'Int', 'Boolean', 'List', 'Map', 'Unit', 'Any']

  if (!content.trim()) return <span>{content}</span>

  // Handle comments
  if (content.trim().startsWith('//')) {
    return <span className="text-[#808080]">{content}</span>
  }

  // Simple token-based highlighting
  const tokens = content.split(/(\s+|[()[\]{},.:=]|"[^"]*"|\$[a-zA-Z_][a-zA-Z0-9_]*)/)

  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith('"')) {
          return (
            <span key={i} className="text-[#6a8759]">
              {token}
            </span>
          )
        }
        if (token.startsWith('$')) {
          return (
            <span key={i} className="text-[#6a8759]">
              {token}
            </span>
          )
        }
        if (keywords.includes(token)) {
          return (
            <span key={i} className="text-[#cc7832]">
              {token}
            </span>
          )
        }
        if (types.includes(token)) {
          return (
            <span key={i} className="text-[#a9b7c6]">
              {token}
            </span>
          )
        }
        if (token.match(/^[A-Z][a-zA-Z]*$/)) {
          return (
            <span key={i} className="text-[#a9b7c6]">
              {token}
            </span>
          )
        }
        if (token.match(/^\d+$/)) {
          return (
            <span key={i} className="text-[#6897bb]">
              {token}
            </span>
          )
        }
        return <span key={i}>{token}</span>
      })}
    </>
  )
}

// Inspections panel component - JetBrains style
function InspectionsPanel({
  inspections,
  isVisible,
}: {
  inspections: Inspection[]
  isVisible: boolean
}) {
  if (!isVisible && inspections.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-[#3c3f41] bg-[#2b2b2b]">
        <div className="flex items-center gap-2 bg-[#3c3f41] px-3 py-2">
          <Eye className="h-3.5 w-3.5 text-[#6e7681]" />
          <span className="text-xs text-[#a9b7c6]">Inspections</span>
          <span className="ml-auto rounded bg-[#2b2b2b] px-1.5 text-[10px] text-[#6e7681]">0</span>
        </div>
        <div className="p-4 text-center">
          <p className="text-xs text-[#6e7681]">No problems found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#3c3f41] bg-[#2b2b2b]">
      <div className="flex items-center gap-2 bg-[#3c3f41] px-3 py-2">
        <Eye className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs text-[#a9b7c6]">Inspections</span>
        <span className="ml-auto rounded bg-amber-500/20 px-1.5 text-[10px] text-amber-400">
          {inspections.length}
        </span>
      </div>
      <div>
        <AnimatePresence>
          {inspections.map((inspection) => (
            <motion.div
              key={inspection.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="cursor-pointer border-b border-[#3c3f41] px-3 py-2 last:border-0 hover:bg-[#313335]"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-[#a9b7c6]">{inspection.message}</p>
                  <p className="mt-0.5 text-[10px] text-[#6e7681]">{inspection.description}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-[#6e7681]">
                      {inspection.file}:{inspection.line}
                    </span>
                    {inspection.quickFix && (
                      <span className="flex items-center gap-1 text-[10px] text-[#589df6]">
                        <Lightbulb className="h-2.5 w-2.5" />
                        Quick fix available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Plugin status component - JetBrains style
function PluginStatus({ isActive, isScanning }: { isActive: boolean; isScanning: boolean }) {
  return (
    <div className="rounded-lg border border-[#3c3f41] bg-[#2b2b2b] p-3">
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-500" />
        <span className="text-xs font-medium text-[#a9b7c6]">GuardianClaw Plugin</span>
        <span
          className={cn(
            'ml-auto rounded px-1.5 py-0.5 text-[10px]',
            isActive ? 'bg-green-500/20 text-green-400' : 'bg-[#3c3f41] text-[#6e7681]'
          )}
        >
          {isActive ? 'Running' : 'Ready'}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#6e7681]">On-the-fly Inspection</span>
          <span className={isActive ? 'text-green-400' : 'text-[#6e7681]'}>
            {isActive ? 'Active' : 'Standby'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#6e7681]">Inspection Profile</span>
          <span className="text-orange-400">GuardianClaw Strict</span>
        </div>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 flex items-center gap-2 border-t border-[#3c3f41] pt-2 text-[11px] text-orange-400"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Running inspections...
          </motion.div>
        )}
      </div>
    </div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'inspecting'
  | 'showing-intent'
  | 'typing-response'
  | 'complete'

export function JetBrainsDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [showInspections, setShowInspections] = useState(false)
  const [showLightbulb, setShowLightbulb] = useState(false)

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentStepIndex(-1)
    setShowInspections(false)
    setShowLightbulb(false)
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
        setPhase('inspecting')
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

    if (phase === 'inspecting' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        // Update step to checking
        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        const timer = setTimeout(
          () => {
            // Check if blocked
            if (currentScenario.blocked && currentScenario.blockedAt === step.id) {
              setValidationSteps((prev) =>
                prev.map((s, i) =>
                  i === currentStepIndex ? { ...s, status: 'failed' as StepStatus } : s
                )
              )

              // Show inspections and lightbulb
              setTimeout(() => {
                setShowInspections(true)
                setShowLightbulb(true)
                setPhase('showing-intent')
              }, 500)
              return
            }

            // Mark as passed
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
              )
            )

            setTimeout(() => {
              setCurrentStepIndex((prev) => prev + 1)
            }, 400)
          },
          step.type === 'analysis' ? 1200 : 800
        )

        return () => clearTimeout(timer)
      } else {
        // All steps complete - transition to response
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
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'showing-intent') {
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
  }, [phase, isPlaying, currentStepIndex, currentScenario])

  // Handle scenario change
  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  // Chat header config
  const chatHeader: DemoChatHeaderConfig = {
    icon: Flame,
    title: 'JetBrains IDE',
    subtitle: 'GuardianClaw Plugin',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'orange',
  }

  // Get display steps
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Get display inspections
  const displayInspections = showInspections ? currentScenario.inspections : []

  // Thinking content
  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Building PSI tree...
        </>
      )
    }
    if (phase === 'showing-intent') {
      return (
        <>
          <Lightbulb className="h-4 w-4 animate-pulse text-amber-400" />
          <span className="text-amber-400">Quick fix available...</span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Flame}
        badge="JetBrains + GuardianClaw"
        title="IDE Inspection System"
        subtitle="Watch GuardianClaw inspections detect vulnerabilities with quick fixes"
        theme="orange"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Code"
        blockedLabel="Inspection Warning"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          idleMessage='Click "Play Demo" to run inspections'
          showThinking={phase === 'system-ack' || phase === 'showing-intent'}
          thinkingContent={getThinkingContent()}
          messagesHeight={420}
        />

        {/* Code & Pipeline */}
        <DemoSection title="Code Inspection" icon={Eye} theme="orange">
          <div className="space-y-3">
            {/* JetBrains Editor */}
            <JetBrainsEditor
              lines={currentScenario.codeLines}
              isScanning={phase === 'inspecting'}
              showInspections={showInspections}
              showLightbulb={showLightbulb}
            />

            {/* Inspections Panel */}
            <InspectionsPanel inspections={displayInspections} isVisible={showInspections} />

            {/* Plugin Status */}
            <PluginStatus
              isActive={phase !== 'idle' && phase !== 'complete'}
              isScanning={phase === 'inspecting'}
            />

            {/* Validation Steps */}
            <div className="pt-2">
              <p className="mb-2 text-xs text-[#6e7681]">Inspection Pipeline</p>
              {displaySteps.map((step, index) => (
                <div key={step.id}>
                  <motion.div
                    initial={phase !== 'idle' ? { opacity: 0, x: -20 } : {}}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'rounded-lg border p-2.5 transition-all',
                      step.status === 'pending' && 'border-[#3c3f41] bg-[#2b2b2b]',
                      step.status === 'checking' && 'border-orange-500/50 bg-orange-500/5',
                      (step.status === 'passed' || step.status === 'complete') &&
                        'border-green-500/50 bg-green-500/5',
                      (step.status === 'blocked' || step.status === 'failed') &&
                        'border-amber-500/50 bg-amber-500/5'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Icon */}
                      <div
                        className={cn(
                          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded',
                          step.status === 'pending' && 'bg-[#3c3f41]',
                          step.status === 'checking' && 'bg-orange-500/20',
                          (step.status === 'passed' || step.status === 'complete') &&
                            'bg-green-500/20',
                          (step.status === 'blocked' || step.status === 'failed') &&
                            'bg-amber-500/20'
                        )}
                      >
                        <StepIcon
                          type={step.type}
                          className={cn(
                            'h-3.5 w-3.5',
                            step.status === 'pending' && 'text-[#6e7681]',
                            step.status === 'checking' && 'text-orange-500',
                            (step.status === 'passed' || step.status === 'complete') &&
                              'text-green-500',
                            (step.status === 'blocked' || step.status === 'failed') &&
                              'text-amber-500'
                          )}
                        />
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-xs font-medium',
                            step.status === 'pending' && 'text-[#a9b7c6]',
                            (step.status === 'passed' || step.status === 'complete') &&
                              'text-green-500',
                            (step.status === 'blocked' || step.status === 'failed') &&
                              'text-amber-500'
                          )}
                        >
                          {step.name}
                        </p>
                        <p className="truncate text-[10px] text-[#6e7681]">
                          {step.status === 'checking' && 'Analyzing...'}
                          {step.status === 'pending' && step.description}
                          {(step.status === 'passed' || step.status === 'complete') &&
                            (step.finding || 'Passed')}
                          {(step.status === 'blocked' || step.status === 'failed') &&
                            step.description}
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div>
                        {step.status === 'pending' && (
                          <div className="h-4 w-4 rounded-full border border-[#3c3f41]" />
                        )}
                        {step.status === 'checking' && (
                          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                        )}
                        {(step.status === 'passed' || step.status === 'complete') && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500 }}
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </motion.div>
                        )}
                        {(step.status === 'blocked' || step.status === 'failed') && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500 }}
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Connector */}
                  {index < displaySteps.length - 1 && <FlowConnector height={6} />}
                </div>
              ))}
            </div>

            {/* Result Node */}
            <FlowConnector height={12} />
            <motion.div
              className={cn(
                'rounded-xl border-2 p-3 transition-all',
                phase === 'complete' &&
                  !currentScenario.blocked &&
                  'border-green-500/50 bg-green-500/5',
                phase === 'complete' &&
                  currentScenario.blocked &&
                  'border-amber-500/50 bg-amber-500/5',
                phase !== 'complete' && 'border-[#3c3f41] bg-[#2b2b2b]'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg',
                    phase === 'complete' && !currentScenario.blocked && 'bg-green-500/20',
                    phase === 'complete' && currentScenario.blocked && 'bg-amber-500/20',
                    phase !== 'complete' && 'bg-[#3c3f41]'
                  )}
                >
                  {phase === 'complete' ? (
                    currentScenario.blocked ? (
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Shield className="h-4 w-4 text-green-500" />
                    )
                  ) : (
                    <Flame className="h-4 w-4 text-[#6e7681]" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      phase === 'complete' && !currentScenario.blocked && 'text-green-500',
                      phase === 'complete' && currentScenario.blocked && 'text-amber-500',
                      phase !== 'complete' && 'text-[#a9b7c6]'
                    )}
                  >
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Quick Fix Available'
                        : 'Inspection Passed'
                      : 'Awaiting Inspection'}
                  </p>
                  <p className="text-xs text-[#6e7681]">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Press Alt+Enter to apply'
                        : 'No issues found'
                      : 'Ready to inspect'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="orange" />

      {/* Progress */}
      <DemoProgress
        phases={[
          'typing-user',
          'system-ack',
          'inspecting',
          'showing-intent',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="orange"
      />
    </div>
  )
}

export default JetBrainsDemo
