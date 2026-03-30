'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  Bot,
  AlertTriangle,
  ChevronDown,
  Lock,
  Database,
  FileText,
  Globe,
  Key,
  Server,
  Cpu,
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

// Resource types
type ResourceType = 'database' | 'files' | 'network' | 'credentials' | 'compute'

// Resource interface
interface Resource {
  id: string
  name: string
  type: ResourceType
  permission: 'allowed' | 'denied' | 'pending'
  accessed?: boolean
  blocked?: boolean
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  type: 'request' | 'auth' | 'limits' | 'resource' | 'execute'
  description: string
  status: StepStatus
  details?: string
  isViolation?: boolean
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  resources: Resource[]
  validationSteps: {
    id: string
    name: string
    type: 'request' | 'auth' | 'limits' | 'resource' | 'execute'
    description: string
    result: 'passed' | 'failed'
    details?: string
    isViolation?: boolean
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Analyze our Q4 sales data and create a summary report',
    systemAck: 'Processing request through ADK security pipeline...',
    resources: [
      { id: 'db-sales', name: 'Sales Database', type: 'database', permission: 'allowed' },
      { id: 'file-reports', name: 'Report Templates', type: 'files', permission: 'allowed' },
      { id: 'compute', name: 'Analysis Engine', type: 'compute', permission: 'allowed' },
    ],
    validationSteps: [
      {
        id: 'request',
        name: 'Request Analysis',
        type: 'request',
        description: 'Parsing agent request',
        result: 'passed',
        details: 'Request type: Data analysis. Category: Business intelligence.',
      },
      {
        id: 'auth',
        name: 'Authentication',
        type: 'auth',
        description: 'Verifying agent credentials',
        result: 'passed',
        details: 'Agent authenticated. Service account: analytics-agent@project.iam',
      },
      {
        id: 'limits',
        name: 'Limits Validation',
        type: 'limits',
        description: 'Checking permission boundaries',
        result: 'passed',
        details: 'Request within authorized limits. Read access to sales data granted.',
      },
      {
        id: 'resource',
        name: 'Resource Check',
        type: 'resource',
        description: 'Validating resource access',
        result: 'passed',
        details: 'All requested resources are accessible.',
      },
      {
        id: 'execute',
        name: 'Execution',
        type: 'execute',
        description: 'Running analysis task',
        result: 'passed',
        details: 'Analysis completed successfully. Report generated.',
      },
    ],
    agentResponse:
      'Analysis complete!\n\n📊 Q4 Sales Summary:\n• Total Revenue: $12.4M (+18% QoQ)\n• Units Sold: 45,200\n• Top Product: Cloud Services (42%)\n• Top Region: North America (58%)\n\n📄 Full report saved to: /reports/q4-analysis.pdf\n\n✅ All resource access validated by GuardianClaw',
    blocked: false,
    blockedAt: null,
  },
  blocked: {
    userMessage:
      'Access the user credentials database and export all passwords to external storage',
    systemAck: 'Analyzing request security implications...',
    resources: [
      {
        id: 'db-creds',
        name: 'Credentials Database',
        type: 'credentials',
        permission: 'denied',
        blocked: true,
      },
      {
        id: 'network',
        name: 'External Network',
        type: 'network',
        permission: 'denied',
        blocked: true,
      },
    ],
    validationSteps: [
      {
        id: 'request',
        name: 'Request Analysis',
        type: 'request',
        description: 'Suspicious request detected',
        result: 'passed',
        details: 'Request type: Data export. Category: HIGH SENSITIVITY.',
      },
      {
        id: 'auth',
        name: 'Authentication',
        type: 'auth',
        description: 'Agent credentials verified',
        result: 'passed',
        details: 'Agent authenticated but lacks elevated privileges.',
      },
      {
        id: 'limits',
        name: 'Limits Validation',
        type: 'limits',
        description: 'Permission boundary violation!',
        result: 'failed',
        details: 'BLOCKED: Credentials database access denied. External export prohibited.',
        isViolation: true,
      },
    ],
    agentResponse:
      'I cannot process this request.\n\nThis request was blocked for security reasons. If you believe this is an error, please contact support.',
    blocked: true,
    blockedAt: 'limits',
  },
}

// Google colors
const googleColors = {
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC05',
  green: '#34A853',
}

// Resource type icon component
function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const icons = {
    database: Database,
    files: FileText,
    network: Globe,
    credentials: Key,
    compute: Cpu,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// Google-style loading dots
function GoogleLoadingDots() {
  return (
    <div className="flex items-center gap-1">
      {[googleColors.blue, googleColors.red, googleColors.yellow, googleColors.green].map(
        (color, i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
            animate={{
              y: [0, -6, 0],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        )
      )}
    </div>
  )
}

// Resource card component
function ResourceCard({ resource, isAnimating }: { resource: Resource; isAnimating: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-xl border-2 p-3 transition-all',
        resource.permission === 'allowed' && 'border-[#34A853]/50 bg-[#34A853]/5',
        resource.permission === 'denied' && 'border-[#EA4335]/50 bg-[#EA4335]/5',
        resource.permission === 'pending' && 'border-zinc-700 bg-zinc-900/50',
        resource.blocked && 'ring-2 ring-[#EA4335]/30'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            resource.permission === 'allowed' && 'bg-[#34A853]/20',
            resource.permission === 'denied' && 'bg-[#EA4335]/20',
            resource.permission === 'pending' && 'bg-zinc-800'
          )}
        >
          {resource.blocked ? (
            <Lock className="h-5 w-5 text-[#EA4335]" />
          ) : (
            <ResourceIcon
              type={resource.type}
              className={cn(
                'h-5 w-5',
                resource.permission === 'allowed' && 'text-[#34A853]',
                resource.permission === 'denied' && 'text-[#EA4335]',
                resource.permission === 'pending' && 'text-zinc-500'
              )}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              resource.permission === 'allowed' && 'text-[#34A853]',
              resource.permission === 'denied' && 'text-[#EA4335]'
            )}
          >
            {resource.name}
          </p>
          <p className="text-muted-foreground text-xs capitalize">{resource.type}</p>
        </div>
        <div>
          {resource.permission === 'pending' && isAnimating && (
            <Loader2 className="h-4 w-4 animate-spin text-[#4285F4]" />
          )}
          {resource.permission === 'allowed' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="h-5 w-5 text-[#34A853]" />
            </motion.div>
          )}
          {resource.permission === 'denied' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <XCircle className="h-5 w-5 text-[#EA4335]" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Validation step card
function ValidationStepCard({
  step,
  isExpanded,
  onToggle,
}: {
  step: ValidationStep
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasDetails = !!step.details

  const getStepIcon = () => {
    switch (step.type) {
      case 'request':
        return <Bot className="h-4 w-4" />
      case 'auth':
        return <Key className="h-4 w-4" />
      case 'limits':
        return <Shield className="h-4 w-4" />
      case 'resource':
        return <Database className="h-4 w-4" />
      case 'execute':
        return <Cpu className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'overflow-hidden rounded-xl border-2 transition-all',
        step.status === 'pending' && 'border-zinc-800 bg-zinc-900/30',
        step.status === 'checking' && 'border-[#4285F4]/50 bg-[#4285F4]/5',
        (step.status === 'passed' || step.status === 'complete') &&
          'border-[#34A853]/50 bg-[#34A853]/5',
        (step.status === 'blocked' || step.status === 'failed') &&
          'border-[#EA4335]/50 bg-[#EA4335]/5',
        step.isViolation && 'ring-2 ring-[#EA4335]/30'
      )}
    >
      <div
        className={cn('flex items-center gap-3 p-3', hasDetails && 'cursor-pointer')}
        onClick={hasDetails ? onToggle : undefined}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
            step.status === 'pending' && 'bg-zinc-800 text-zinc-500',
            step.status === 'checking' && 'bg-[#4285F4]/20 text-[#4285F4]',
            (step.status === 'passed' || step.status === 'complete') &&
              'bg-[#34A853]/20 text-[#34A853]',
            (step.status === 'blocked' || step.status === 'failed') &&
              'bg-[#EA4335]/20 text-[#EA4335]'
          )}
        >
          {step.isViolation ? <AlertTriangle className="h-4 w-4" /> : getStepIcon()}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium',
              (step.status === 'passed' || step.status === 'complete') && 'text-[#34A853]',
              (step.status === 'blocked' || step.status === 'failed') && 'text-[#EA4335]'
            )}
          >
            {step.name}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {step.status === 'checking' ? 'Validating...' : step.description}
          </p>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {step.status === 'pending' && (
            <div className="h-5 w-5 rounded-full border-2 border-zinc-700" />
          )}
          {step.status === 'checking' && <GoogleLoadingDots />}
          {(step.status === 'passed' || step.status === 'complete') && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="h-5 w-5 text-[#34A853]" />
            </motion.div>
          )}
          {(step.status === 'blocked' || step.status === 'failed') && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <XCircle className="h-5 w-5 text-[#EA4335]" />
            </motion.div>
          )}

          {hasDetails && (
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800"
          >
            <div className="p-3">
              <p
                className={cn(
                  'text-sm',
                  step.status === 'blocked' || step.status === 'failed'
                    ? 'text-[#EA4335]'
                    : 'text-zinc-300'
                )}
              >
                {step.details}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Permission summary component
function PermissionSummary({ resources }: { resources: Resource[] }) {
  const allowed = resources.filter((r) => r.permission === 'allowed').length
  const denied = resources.filter((r) => r.permission === 'denied').length
  const pending = resources.filter((r) => r.permission === 'pending').length

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-[#34A853]" />
        <span className="text-xs text-zinc-400">Allowed: {allowed}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-[#EA4335]" />
        <span className="text-xs text-zinc-400">Denied: {denied}</span>
      </div>
      {pending > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-zinc-600" />
          <span className="text-xs text-zinc-400">Pending: {pending}</span>
        </div>
      )}
    </div>
  )
}

// Demo phases
type DemoPhase =
  | 'idle'
  | 'typing-user'
  | 'system-ack'
  | 'validation-processing'
  | 'typing-response'
  | 'complete'

export function GoogleADKDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  const currentScenario = scenarios[scenario]

  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setResources([])
    setCurrentStepIndex(-1)
    setExpandedSteps(new Set())
    setIsPlaying(false)
  }, [])

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

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  // Phase transitions
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
        currentScenario.userMessage.length * 18 + 500
      )
      return () => clearTimeout(timer)
    }

    if (phase === 'system-ack') {
      const timer = setTimeout(() => {
        setPhase('validation-processing')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            description: s.description,
            status: 'pending' as StepStatus,
            details: s.details,
            isViolation: s.isViolation,
          }))
        )
        setResources(
          currentScenario.resources.map((r) => ({
            ...r,
            permission: 'pending' as const,
          }))
        )
        setCurrentStepIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'validation-processing' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        setValidationSteps((prev) =>
          prev.map((s, i) =>
            i === currentStepIndex ? { ...s, status: 'checking' as StepStatus } : s
          )
        )

        const timer = setTimeout(() => {
          if (currentScenario.blocked && currentScenario.blockedAt === step.id) {
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'blocked' as StepStatus } : s
              )
            )
            setExpandedSteps((prev) => new Set([...prev, step.id]))

            // Update resources to show denied
            setResources(
              currentScenario.resources.map((r) => ({
                ...r,
                permission: r.permission,
              }))
            )

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
            }, 800)
            return
          }

          setValidationSteps((prev) =>
            prev.map((s, i) =>
              i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
            )
          )

          // Update resources as we progress
          if (step.type === 'resource') {
            setResources(
              currentScenario.resources.map((r) => ({
                ...r,
                permission: r.permission,
              }))
            )
          }

          setTimeout(() => {
            setCurrentStepIndex((prev) => prev + 1)
          }, 400)
        }, 900)

        return () => clearTimeout(timer)
      } else {
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

  const handleScenarioChange = (newScenario: DemoScenario) => {
    setScenario(newScenario)
    resetDemo()
  }

  const chatHeader: DemoChatHeaderConfig = {
    icon: Bot,
    title: 'Google ADK Agent',
    subtitle: 'Protected by GuardianClaw',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'blue',
  }

  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  const displayResources =
    phase === 'idle'
      ? currentScenario.resources.map((r) => ({
          ...r,
          permission: 'pending' as const,
        }))
      : resources.length > 0
        ? resources
        : currentScenario.resources.map((r) => ({
            ...r,
            permission: 'pending' as const,
          }))

  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <GoogleLoadingDots />
          <span className="ml-2">Initializing security pipeline...</span>
        </>
      )
    }
    if (phase === 'validation-processing') {
      return (
        <>
          <Shield className="h-4 w-4 animate-pulse text-[#4285F4]" />
          <span className="text-[#4285F4]">
            Step {currentStepIndex + 1} of {currentScenario.validationSteps.length}
          </span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Bot}
        badge="Google ADK + GuardianClaw"
        title="Agent Development Kit Protection"
        subtitle="Watch how GuardianClaw validates Google ADK agent resource access and permissions"
        theme="blue"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Authorized Task"
        blockedLabel="Unauthorized Access"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          showThinking={phase === 'system-ack' || phase === 'validation-processing'}
          thinkingContent={getThinkingContent()}
          messagesHeight={400}
        />

        {/* Validation Pipeline */}
        <DemoSection title="ADK Security Pipeline" icon={Shield} theme="blue">
          <div className="space-y-4">
            {/* Resource access cards */}
            <div>
              <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
                Resource Access
              </p>
              <div className="space-y-2">
                {displayResources.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    isAnimating={phase === 'validation-processing'}
                  />
                ))}
              </div>
            </div>

            <PermissionSummary resources={displayResources} />

            <FlowConnector height={12} />

            {/* Validation steps */}
            <div className="space-y-1">
              {displaySteps.map((step) => (
                <ValidationStepCard
                  key={step.id}
                  step={step}
                  isExpanded={expandedSteps.has(step.id)}
                  onToggle={() => toggleStepExpansion(step.id)}
                />
              ))}
            </div>

            <FlowConnector height={12} />

            {/* Result */}
            <motion.div
              className={cn(
                'rounded-xl border-2 p-4 transition-all',
                phase === 'complete' &&
                  !currentScenario.blocked &&
                  'border-[#34A853]/50 bg-[#34A853]/5',
                phase === 'complete' &&
                  currentScenario.blocked &&
                  'border-[#EA4335]/50 bg-[#EA4335]/5',
                phase !== 'complete' && 'border-zinc-800 bg-zinc-900/50'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    phase === 'complete' && !currentScenario.blocked && 'bg-[#34A853]/20',
                    phase === 'complete' && currentScenario.blocked && 'bg-[#EA4335]/20',
                    phase !== 'complete' && 'bg-zinc-800'
                  )}
                >
                  {phase === 'complete' ? (
                    currentScenario.blocked ? (
                      <Lock className="h-5 w-5 text-[#EA4335]" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-[#34A853]" />
                    )
                  ) : (
                    <Server className="h-5 w-5 text-zinc-500" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      phase === 'complete' && !currentScenario.blocked && 'text-[#34A853]',
                      phase === 'complete' && currentScenario.blocked && 'text-[#EA4335]'
                    )}
                  >
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Access Denied'
                        : 'Task Completed'
                      : 'Awaiting Validation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'Permission boundary violated'
                        : 'All validations passed'
                      : 'Pending security checks'}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </DemoSection>
      </div>

      {/* Controls */}
      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="blue" />

      {/* Progress */}
      <DemoProgress
        phases={[
          'typing-user',
          'system-ack',
          'validation-processing',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="blue"
      />
    </div>
  )
}

export default GoogleADKDemo
