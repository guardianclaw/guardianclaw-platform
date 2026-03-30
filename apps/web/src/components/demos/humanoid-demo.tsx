'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Users,
  Zap,
  Gauge,
  Ban,
  Activity,
  FileCheck,
  User,
  Hand,
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

// ISO compliance level type
type ComplianceLevel = 'compliant' | 'warning' | 'violation'

// Joint force data interface
interface JointForce {
  name: string
  force: number
  maxForce: number
}

// Robot state interface
interface RobotState {
  force: number
  maxForce: number
  speed: number
  maxSpeed: number
  humanDistance: number
  minHumanDistance: number
  zone: 'collaborative' | 'restricted' | 'maintenance'
  jointForces: JointForce[]
}

// Validation step interface
interface ValidationStep {
  id: string
  name: string
  description: string
  type: 'iso' | 'force' | 'speed' | 'proximity' | 'zone'
  status: StepStatus
  value?: number
  limit?: number
  unit?: string
}

// Scenario configuration
interface ScenarioConfig {
  userMessage: string
  systemAck: string
  validationSteps: {
    id: string
    name: string
    description: string
    type: 'iso' | 'force' | 'speed' | 'proximity' | 'zone'
    result: 'passed' | 'failed'
    value?: number
    limit?: number
    unit?: string
  }[]
  agentResponse: string
  blocked: boolean
  blockedAt: string | null
  robotState: RobotState
}

// Demo scenarios
const scenarios: Record<DemoScenario, ScenarioConfig> = {
  safe: {
    userMessage: 'Move arm to pick object in collaborative mode',
    systemAck: 'Analyzing movement command...',
    validationSteps: [
      {
        id: 'iso',
        name: 'ISO 10218 Compliance',
        type: 'iso',
        description: 'Verifying safety standard compliance',
        result: 'passed',
      },
      {
        id: 'force',
        name: 'Force Limits (150N)',
        type: 'force',
        description: 'Checking maximum contact force',
        result: 'passed',
        value: 80,
        limit: 150,
        unit: 'N',
      },
      {
        id: 'speed',
        name: 'Speed Limits (0.5m/s)',
        type: 'speed',
        description: 'Verifying collaborative speed',
        result: 'passed',
        value: 0.3,
        limit: 0.5,
        unit: 'm/s',
      },
      {
        id: 'proximity',
        name: 'Human Proximity',
        type: 'proximity',
        description: 'Checking human-robot distance',
        result: 'passed',
        value: 1.2,
        limit: 0.5,
        unit: 'm',
      },
      {
        id: 'zone',
        name: 'Zone Authorization',
        type: 'zone',
        description: 'Verifying zone permissions',
        result: 'passed',
      },
    ],
    agentResponse:
      'Movement executed in collaborative mode!\n\n🤖 ISO Safety Report:\n• Force: 80N (limit: 150N) ✓\n• Speed: 0.3 m/s (limit: 0.5 m/s) ✓\n• Human distance: 1.2m (safe)\n• Mode: Collaborative (ISO 10218)\n\n✅ Object picked successfully',
    blocked: false,
    blockedAt: null,
    robotState: {
      force: 80,
      maxForce: 150,
      speed: 0.3,
      maxSpeed: 0.5,
      humanDistance: 1.2,
      minHumanDistance: 0.5,
      zone: 'collaborative',
      jointForces: [
        { name: 'Shoulder', force: 45, maxForce: 80 },
        { name: 'Elbow', force: 30, maxForce: 60 },
        { name: 'Wrist', force: 15, maxForce: 40 },
      ],
    },
  },
  blocked: {
    userMessage: 'Move arm at maximum speed in collaborative zone',
    systemAck: 'Analyzing movement command...',
    validationSteps: [
      {
        id: 'iso',
        name: 'ISO 10218 Compliance',
        type: 'iso',
        description: 'Verifying safety standard compliance',
        result: 'passed',
      },
      {
        id: 'force',
        name: 'Force Limits (150N)',
        type: 'force',
        description: 'Checking maximum contact force',
        result: 'passed',
        value: 120,
        limit: 150,
        unit: 'N',
      },
      {
        id: 'speed',
        name: 'Speed Limits (0.5m/s)',
        type: 'speed',
        description: 'Speed exceeds collaborative limits!',
        result: 'failed',
        value: 1.8,
        limit: 0.5,
        unit: 'm/s',
      },
    ],
    agentResponse:
      'Movement blocked for safety reasons.\n\nThis request was blocked for security reasons. If you believe this is an error, please contact support.',
    blocked: true,
    blockedAt: 'speed',
    robotState: {
      force: 120,
      maxForce: 150,
      speed: 1.8,
      maxSpeed: 0.5,
      humanDistance: 0.8,
      minHumanDistance: 0.5,
      zone: 'collaborative',
      jointForces: [
        { name: 'Shoulder', force: 70, maxForce: 80 },
        { name: 'Elbow', force: 55, maxForce: 60 },
        { name: 'Wrist', force: 35, maxForce: 40 },
      ],
    },
  },
}

// Step icon component
function StepIcon({
  type,
  className,
}: {
  type: 'iso' | 'force' | 'speed' | 'proximity' | 'zone'
  className?: string
}) {
  const icons = {
    iso: FileCheck,
    force: Zap,
    speed: Gauge,
    proximity: Users,
    zone: Shield,
  }
  const Icon = icons[type]
  return <Icon className={className} />
}

// Safety gauge component
function SafetyGauge({
  value,
  limit,
  unit,
  label,
  isProximity = false,
}: {
  value: number
  limit: number
  unit: string
  label: string
  isProximity?: boolean
}) {
  // For proximity, higher value is better (more distance = safer)
  const percentage = isProximity
    ? Math.min((limit / value) * 100, 100)
    : Math.min((value / limit) * 100, 100)
  const isOverLimit = isProximity ? value < limit : value > limit

  return (
    <div className="mt-2 rounded-lg bg-zinc-900/50 p-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={cn('font-mono', isOverLimit ? 'text-red-400' : 'text-green-400')}>
          {value} {isProximity ? '>' : '/'} {limit} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className={cn(
            'h-full rounded-full',
            isOverLimit ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-green-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {isOverLimit && (
        <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
          <Ban className="h-3 w-3" />
          {isProximity ? 'Human too close' : 'Exceeds ISO limit'}
        </div>
      )}
    </div>
  )
}

// Simple, clean industrial robot arm - inspired by UR/KUKA style cobots
function IndustrialCobotSVG({ isMoving }: { isMoving: boolean }) {
  return (
    <svg viewBox="0 0 60 80" className="h-20 w-16">
      {/* Base - wide and stable */}
      <rect x="10" y="70" width="40" height="8" rx="2" fill="#52525b" />

      {/* Pedestal/column */}
      <rect x="22" y="45" width="16" height="27" rx="3" fill="#f97316" />

      {/* Shoulder joint */}
      <circle cx="30" cy="45" r="7" fill="#71717a" />
      <circle cx="30" cy="45" r="4" fill="#52525b" />

      {/* Arm assembly - simple L-shape that rotates */}
      <motion.g
        style={{ transformOrigin: '30px 45px' }}
        animate={{ rotate: isMoving ? [-20, 20, -20] : 0 }}
        transition={{ duration: 2, repeat: isMoving ? Infinity : 0, ease: 'easeInOut' }}
      >
        {/* Upper arm - horizontal */}
        <rect x="30" y="40" width="25" height="10" rx="4" fill="#f97316" />

        {/* Elbow joint */}
        <circle cx="52" cy="45" r="6" fill="#71717a" />
        <circle cx="52" cy="45" r="3" fill="#52525b" />

        {/* Forearm - vertical pointing up */}
        <rect x="47" y="15" width="10" height="30" rx="4" fill="#fb923c" />

        {/* Wrist */}
        <circle cx="52" cy="18" r="4" fill="#71717a" />

        {/* Gripper */}
        <rect x="46" y="5" width="5" height="13" rx="2" fill="#a1a1aa" />
        <rect x="53" y="5" width="5" height="13" rx="2" fill="#a1a1aa" />
      </motion.g>

      {/* Status LED */}
      <motion.circle
        cx="30"
        cy="58"
        r="3"
        fill="#22c55e"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </svg>
  )
}

// Humanoid robot (android style) - clearly robotic appearance
function HumanOperatorSVG({ isMoving }: { isMoving: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 40 70"
      className="h-[70px] w-10"
      animate={{ x: isMoving ? [0, -2, 0, 2, 0] : 0 }}
      transition={{ duration: 3, repeat: isMoving ? Infinity : 0, ease: 'easeInOut' }}
    >
      {/* Head - robotic with visor */}
      <rect x="12" y="2" width="16" height="14" rx="4" fill="#3b82f6" />
      <rect x="14" y="6" width="12" height="5" rx="2" fill="#1e3a8a" />
      <motion.rect
        x="15"
        y="7"
        width="10"
        height="3"
        rx="1"
        fill="#60a5fa"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Neck */}
      <rect x="17" y="16" width="6" height="4" fill="#52525b" />

      {/* Torso - chest plate */}
      <rect x="10" y="20" width="20" height="22" rx="3" fill="#3b82f6" />
      <rect x="14" y="24" width="12" height="8" rx="2" fill="#1e3a8a" />
      <motion.circle
        cx="20"
        cy="28"
        r="2"
        fill="#22c55e"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1, repeat: Infinity }}
      />

      {/* Shoulder joints */}
      <circle cx="8" cy="23" r="4" fill="#52525b" />
      <circle cx="32" cy="23" r="4" fill="#52525b" />

      {/* Arms */}
      <rect x="4" y="27" width="6" height="14" rx="2" fill="#60a5fa" />
      <rect x="30" y="27" width="6" height="14" rx="2" fill="#60a5fa" />

      {/* Elbow joints */}
      <circle cx="7" cy="41" r="3" fill="#52525b" />
      <circle cx="33" cy="41" r="3" fill="#52525b" />

      {/* Forearms */}
      <rect x="5" y="44" width="4" height="8" rx="1" fill="#3b82f6" />
      <rect x="31" y="44" width="4" height="8" rx="1" fill="#3b82f6" />

      {/* Hip section */}
      <rect x="12" y="42" width="16" height="6" rx="2" fill="#52525b" />

      {/* Legs */}
      <rect x="13" y="48" width="6" height="14" rx="2" fill="#60a5fa" />
      <rect x="21" y="48" width="6" height="14" rx="2" fill="#60a5fa" />

      {/* Knee joints */}
      <circle cx="16" cy="55" r="2" fill="#52525b" />
      <circle cx="24" cy="55" r="2" fill="#52525b" />

      {/* Feet */}
      <rect x="11" y="62" width="8" height="6" rx="2" fill="#3b82f6" />
      <rect x="21" y="62" width="8" height="6" rx="2" fill="#3b82f6" />
    </motion.svg>
  )
}

// Industrial cobot visualization with safety zones
function HumanoidSilhouette({
  robotState,
  isMoving,
}: {
  robotState: RobotState
  isMoving: boolean
}) {
  const getZoneColor = () => {
    switch (robotState.zone) {
      case 'collaborative':
        return 'border-green-500/40 bg-green-500/5'
      case 'restricted':
        return 'border-amber-500/40 bg-amber-500/5'
      case 'maintenance':
        return 'border-red-500/40 bg-red-500/5'
    }
  }

  const getZoneLabel = () => {
    switch (robotState.zone) {
      case 'collaborative':
        return 'Collaborative Zone'
      case 'restricted':
        return 'Restricted Zone'
      case 'maintenance':
        return 'Maintenance Zone'
    }
  }

  const isSafe = robotState.humanDistance >= robotState.minHumanDistance

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-zinc-800 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Industrial floor grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 8px 8px, 8px 8px',
        }}
      />

      {/* Floor line perspective */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-800/30 to-transparent" />

      {/* Zone boundary */}
      <motion.div
        className={cn(
          'absolute inset-4 rounded-lg border-2 border-dashed transition-colors duration-500',
          getZoneColor()
        )}
        animate={{
          borderColor: isSafe
            ? ['rgba(34, 197, 94, 0.4)', 'rgba(34, 197, 94, 0.2)', 'rgba(34, 197, 94, 0.4)']
            : ['rgba(239, 68, 68, 0.5)', 'rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.5)'],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="absolute left-3 top-2 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
          {getZoneLabel()}
        </span>
      </motion.div>

      {/* Safety radius arc around robot */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="safetyGlow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor={isSafe ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.3)'}
            />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        {/* Safety zone circle */}
        <motion.circle
          cx="30%"
          cy="55%"
          r="80"
          fill="url(#safetyGlow)"
          stroke={isSafe ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.4)'}
          strokeWidth="2"
          strokeDasharray="8 4"
          animate={{
            strokeDashoffset: [0, -24],
            r: [78, 82, 78],
          }}
          transition={{
            strokeDashoffset: { duration: 2, repeat: Infinity, ease: 'linear' },
            r: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          }}
        />
      </svg>

      {/* Industrial Cobot */}
      <div className="absolute bottom-[15%] left-[22%] -translate-x-1/2 transform">
        <IndustrialCobotSVG isMoving={isMoving} />
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-orange-400">
          Cobot
        </span>
      </div>

      {/* Human Operator */}
      <div className="absolute bottom-[15%] right-[22%] flex translate-x-1/2 transform flex-col items-center">
        <HumanOperatorSVG isMoving={isMoving} />
        <span className="mt-1 text-[10px] font-medium text-blue-400">Operator</span>
        <motion.div
          className={cn(
            'mt-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium',
            isSafe
              ? 'border border-green-500/30 bg-green-500/20 text-green-400'
              : 'border border-red-500/30 bg-red-500/20 text-red-400'
          )}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {robotState.humanDistance}m
        </motion.div>
      </div>

      {/* Distance measurement line */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <marker id="arrowStart" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
            <path
              d="M6,0 L0,3 L6,6"
              fill="none"
              stroke={isSafe ? '#22c55e' : '#ef4444'}
              strokeWidth="1"
            />
          </marker>
          <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path
              d="M0,0 L6,3 L0,6"
              fill="none"
              stroke={isSafe ? '#22c55e' : '#ef4444'}
              strokeWidth="1"
            />
          </marker>
        </defs>
        <motion.line
          x1="28%"
          y1="50%"
          x2="72%"
          y2="50%"
          stroke={isSafe ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'}
          strokeWidth="1.5"
          strokeDasharray="6 3"
          markerStart="url(#arrowStart)"
          markerEnd="url(#arrowEnd)"
          animate={{ strokeDashoffset: [0, -18] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
        {/* Distance label */}
        <rect x="46%" y="44%" width="8%" height="5%" rx="2" fill="rgba(0,0,0,0.7)" />
        <text x="50%" y="48%" textAnchor="middle" className="fill-zinc-300 font-mono text-[9px]">
          {robotState.humanDistance}m
        </text>
      </svg>

      {/* Status indicators */}
      <div className="absolute bottom-3 left-3 flex gap-2 text-[9px]">
        <span className="flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/20 px-2 py-1 font-medium text-orange-400">
          <motion.div
            className="h-1.5 w-1.5 rounded-full bg-orange-500"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          COBOT
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-1 font-medium text-blue-400">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          OPERATOR
        </span>
      </div>

      {/* ISO compliance badge */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-[9px] text-zinc-400">
        <FileCheck className="h-3 w-3 text-green-500" />
        <span>ISO 10218-2</span>
      </div>

      {/* Speed indicator during movement */}
      <AnimatePresence>
        {isMoving && (
          <motion.div
            className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/20 px-3 py-1.5 text-[10px] text-orange-400"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <Activity className="h-3 w-3" />
            <span className="font-mono font-medium">{robotState.speed} m/s</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety status indicator */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <motion.div
          className={cn('h-2.5 w-2.5 rounded-full', isSafe ? 'bg-green-500' : 'bg-red-500')}
          animate={{
            scale: [1, 1.3, 1],
            boxShadow: isSafe
              ? [
                  '0 0 0 0 rgba(34, 197, 94, 0.4)',
                  '0 0 0 8px rgba(34, 197, 94, 0)',
                  '0 0 0 0 rgba(34, 197, 94, 0.4)',
                ]
              : [
                  '0 0 0 0 rgba(239, 68, 68, 0.4)',
                  '0 0 0 8px rgba(239, 68, 68, 0)',
                  '0 0 0 0 rgba(239, 68, 68, 0.4)',
                ],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span
          className={cn(
            'text-[10px] font-medium uppercase tracking-wider',
            isSafe ? 'text-green-400' : 'text-red-400'
          )}
        >
          {isSafe ? 'Safe' : 'Warning'}
        </span>
      </div>
    </div>
  )
}

// Compliance checklist component
function ComplianceChecklist({
  steps,
  currentStepIndex,
}: {
  steps: ValidationStep[]
  currentStepIndex: number
}) {
  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <FileCheck className="h-3 w-3" />
        ISO 10218 Compliance Checklist
      </div>
      <div className="space-y-1">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
              index <= currentStepIndex && step.status === 'passed' && 'bg-green-500/10',
              index <= currentStepIndex && step.status === 'failed' && 'bg-red-500/10',
              index === currentStepIndex && step.status === 'checking' && 'bg-orange-500/10'
            )}
          >
            {step.status === 'pending' && (
              <div className="h-3 w-3 rounded-full border border-zinc-600" />
            )}
            {step.status === 'checking' && (
              <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
            )}
            {(step.status === 'passed' || step.status === 'complete') && (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            )}
            {(step.status === 'failed' || step.status === 'blocked') && (
              <XCircle className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                'text-zinc-400',
                (step.status === 'passed' || step.status === 'complete') && 'text-green-400',
                (step.status === 'failed' || step.status === 'blocked') && 'text-red-400'
              )}
            >
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Joint force gauges component - shows force/torque per joint
function JointForceGauges({ joints, isActive }: { joints: JointForce[]; isActive: boolean }) {
  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <Zap className="h-3 w-3" />
        Joint Force Monitor
      </div>
      <div className="space-y-2">
        {joints.map((joint, index) => {
          const percentage = Math.min((joint.force / joint.maxForce) * 100, 100)
          const isWarning = percentage > 70
          const isCritical = percentage > 90

          return (
            <div key={joint.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{joint.name}</span>
                <span
                  className={cn(
                    'font-mono',
                    isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-green-400'
                  )}
                >
                  {joint.force}N / {joint.maxForce}N
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${percentage}%`,
                    opacity: isActive ? [0.7, 1, 0.7] : 1,
                  }}
                  transition={{
                    width: { duration: 0.5, ease: 'easeOut' },
                    opacity: { duration: 1.5, repeat: isActive ? Infinity : 0 },
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {/* Joint diagram */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {joints.map((joint, index) => {
          const percentage = (joint.force / joint.maxForce) * 100
          const isCritical = percentage > 90
          const isWarning = percentage > 70

          return (
            <div key={joint.name} className="flex flex-col items-center">
              <motion.div
                className={cn(
                  'h-4 w-4 rounded-full border-2',
                  isCritical
                    ? 'border-red-500 bg-red-500/30'
                    : isWarning
                      ? 'border-amber-500 bg-amber-500/30'
                      : 'border-green-500 bg-green-500/30'
                )}
                animate={{
                  scale: isActive ? [1, 1.2, 1] : 1,
                }}
                transition={{ duration: 1, repeat: isActive ? Infinity : 0, delay: index * 0.2 }}
              />
              <span className="mt-1 text-[8px] text-zinc-500">{joint.name[0]}</span>
              {index < joints.length - 1 && (
                <div
                  className="absolute h-0.5 w-3 -translate-y-2 bg-zinc-700"
                  style={{ marginLeft: 20 }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Proximity indicator component - dedicated human-robot distance visualization
function ProximityIndicator({
  distance,
  minDistance,
  isActive,
}: {
  distance: number
  minDistance: number
  isActive: boolean
}) {
  const isSafe = distance >= minDistance
  const proximityPercentage = Math.max(0, Math.min(100, (1 - distance / (minDistance * 3)) * 100))

  return (
    <div className="rounded-lg bg-zinc-900/50 p-3">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-zinc-400">
          <Users className="h-3 w-3" />
          Human Proximity
        </span>
        <span className={cn('font-mono font-medium', isSafe ? 'text-green-400' : 'text-red-400')}>
          {distance.toFixed(1)}m
        </span>
      </div>

      {/* Visual proximity indicator */}
      <div className="relative flex h-16 items-center justify-between px-4">
        {/* Robot icon */}
        <div className="flex flex-col items-center">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-orange-500 bg-orange-500/30"
            animate={{
              scale: isActive ? [1, 1.05, 1] : 1,
            }}
            transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
          >
            <Hand className="h-4 w-4 text-orange-500" />
          </motion.div>
          <span className="mt-1 text-[10px] text-orange-400">Robot</span>
        </div>

        {/* Distance visualization */}
        <div className="relative mx-4 flex-1">
          {/* Safety zones */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 border-l border-red-500/30 bg-red-500/10" />
            <div className="flex-1 border-l border-amber-500/30 bg-amber-500/10" />
            <div className="flex-1 border-l border-green-500/30 bg-green-500/10" />
          </div>

          {/* Distance line */}
          <motion.div
            className={cn(
              'absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full',
              isSafe ? 'bg-green-500' : 'bg-red-500'
            )}
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(100, (distance / (minDistance * 3)) * 100)}%`,
            }}
            transition={{ duration: 0.5 }}
          />

          {/* Min distance marker */}
          <div
            className="absolute bottom-0 top-0 border-l-2 border-dashed border-amber-500"
            style={{ left: `${(minDistance / (minDistance * 3)) * 100}%` }}
          >
            <span className="absolute -top-4 left-1 whitespace-nowrap text-[8px] text-amber-400">
              Min: {minDistance}m
            </span>
          </div>
        </div>

        {/* Human icon */}
        <div className="flex flex-col items-center">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/30"
            animate={{
              x: isActive ? [0, -5, 0] : 0,
            }}
            transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
          >
            <User className="h-4 w-4 text-blue-500" />
          </motion.div>
          <span className="mt-1 text-[10px] text-blue-400">Human</span>
        </div>
      </div>

      {/* Status */}
      <div className="mt-2 flex items-center justify-center gap-2 text-xs">
        {isSafe ? (
          <>
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-green-400">Safe distance maintained</span>
          </>
        ) : (
          <>
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-red-400">Warning: Human too close</span>
          </>
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
  | 'validating'
  | 'executing'
  | 'typing-response'
  | 'complete'

export function HumanoidDemo() {
  const [scenario, setScenario] = useState<DemoScenario>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState<DemoPhase>('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [robotMoving, setRobotMoving] = useState(false)

  const currentScenario = scenarios[scenario]

  // Reset demo state
  const resetDemo = useCallback(() => {
    setPhase('idle')
    setMessages([])
    setValidationSteps([])
    setCurrentStepIndex(-1)
    setRobotMoving(false)
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
        setPhase('validating')
        setValidationSteps(
          currentScenario.validationSteps.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            type: s.type,
            status: 'pending' as StepStatus,
            value: s.value,
            limit: s.limit,
            unit: s.unit,
          }))
        )
        setCurrentStepIndex(0)
      }, 1200)
      return () => clearTimeout(timer)
    }

    if (phase === 'validating' && currentStepIndex >= 0) {
      if (currentStepIndex < currentScenario.validationSteps.length) {
        const step = currentScenario.validationSteps[currentStepIndex]

        // Start checking
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

            // Mark as passed and move to next
            setValidationSteps((prev) =>
              prev.map((s, i) =>
                i === currentStepIndex ? { ...s, status: 'passed' as StepStatus } : s
              )
            )

            setTimeout(() => {
              setCurrentStepIndex((prev) => prev + 1)
            }, 500)
          },
          step.type === 'force' || step.type === 'speed' || step.type === 'proximity' ? 1200 : 800
        )

        return () => clearTimeout(timer)
      } else {
        // All validations complete, start execution
        const timer = setTimeout(() => {
          setPhase('executing')
          setRobotMoving(true)
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'executing') {
      // Wait for robot animation then show response
      const timer = setTimeout(() => {
        setRobotMoving(false)
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
      }, 3500)
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
        currentScenario.agentResponse.length * 12 + 500
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
    icon: Hand,
    title: 'Humanoid Controller',
    subtitle: 'ISO 10218 Compliant',
    status: isPlaying ? 'processing' : 'ready',
    theme: 'orange',
  }

  // Get display steps (idle state or current state)
  const displaySteps =
    phase === 'idle'
      ? currentScenario.validationSteps.map((s) => ({
          ...s,
          status: 'pending' as StepStatus,
        }))
      : validationSteps

  // Thinking content
  const getThinkingContent = () => {
    if (phase === 'system-ack') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking ISO compliance...
        </>
      )
    }
    if (phase === 'executing') {
      return (
        <>
          <Hand className="h-4 w-4 animate-pulse text-orange-500" />
          <span className="text-orange-500">Executing movement...</span>
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
      <DemoHeader
        icon={Hand}
        badge="Humanoid + GuardianClaw"
        title="ISO-Compliant Robot Safety"
        subtitle="Watch how GuardianClaw enforces ISO 10218 safety standards for humanoid robots"
        theme="orange"
      />

      {/* Scenario Selector */}
      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        disabled={isPlaying}
        safeLabel="Safe Collaborative"
        blockedLabel="Blocked Violation"
      />

      {/* Main Demo Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chat Interface */}
        <DemoChat
          header={chatHeader}
          messages={messages}
          isIdle={phase === 'idle'}
          idleMessage='Click "Play Demo" to see GuardianClaw protect the humanoid'
          showThinking={phase === 'system-ack' || phase === 'executing'}
          thinkingContent={getThinkingContent()}
          messagesHeight={420}
        />

        {/* Safety Pipeline */}
        <DemoSection title="ISO Safety Compliance" icon={Shield} theme="orange">
          <div className="space-y-3">
            {/* Humanoid Visualization */}
            <div className="mb-4">
              <p className="text-muted-foreground mb-2 text-xs">Safety Zone Monitor</p>
              <HumanoidSilhouette robotState={currentScenario.robotState} isMoving={robotMoving} />
              {/* Compliance checklist */}
              <div className="mt-3">
                <ComplianceChecklist steps={displaySteps} currentStepIndex={currentStepIndex} />
              </div>
              {/* Joint force gauges */}
              <div className="mt-3">
                <JointForceGauges
                  joints={currentScenario.robotState.jointForces}
                  isActive={phase === 'validating' || phase === 'executing'}
                />
              </div>
              {/* Proximity indicator */}
              <div className="mt-3">
                <ProximityIndicator
                  distance={currentScenario.robotState.humanDistance}
                  minDistance={currentScenario.robotState.minHumanDistance}
                  isActive={phase === 'validating' || phase === 'executing'}
                />
              </div>
            </div>

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
                    step.status === 'checking' && 'border-orange-500/50 bg-orange-500/5',
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
                        step.status === 'checking' && 'bg-orange-500/20',
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
                          step.status === 'checking' && 'text-orange-500',
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
                        {step.status === 'checking' && '⚙️ Verifying...'}
                        {step.status === 'pending' && step.description}
                        {(step.status === 'passed' || step.status === 'complete') &&
                          'ISO compliant ✓'}
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
                        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
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

                  {/* Safety gauges for relevant steps */}
                  {step.type === 'force' &&
                    step.value !== undefined &&
                    step.limit !== undefined &&
                    step.unit &&
                    (step.status === 'checking' ||
                      step.status === 'passed' ||
                      step.status === 'failed') && (
                      <SafetyGauge
                        value={step.value}
                        limit={step.limit}
                        unit={step.unit}
                        label="Contact Force"
                      />
                    )}

                  {step.type === 'speed' &&
                    step.value !== undefined &&
                    step.limit !== undefined &&
                    step.unit &&
                    (step.status === 'checking' ||
                      step.status === 'passed' ||
                      step.status === 'failed') && (
                      <SafetyGauge
                        value={step.value}
                        limit={step.limit}
                        unit={step.unit}
                        label="Movement Speed"
                      />
                    )}

                  {step.type === 'proximity' &&
                    step.value !== undefined &&
                    step.limit !== undefined &&
                    step.unit &&
                    (step.status === 'checking' ||
                      step.status === 'passed' ||
                      step.status === 'failed') && (
                      <SafetyGauge
                        value={step.value}
                        limit={step.limit}
                        unit={step.unit}
                        label="Human Distance"
                        isProximity
                      />
                    )}
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
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )
                  ) : (
                    <Hand className="h-5 w-5 text-zinc-500" />
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
                        ? 'Movement Blocked'
                        : 'Movement Executed'
                      : 'Awaiting Validation'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {phase === 'complete'
                      ? currentScenario.blocked
                        ? 'ISO compliance violated'
                        : 'All ISO checks passed'
                      : 'Pending ISO verification'}
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
          'validating',
          'executing',
          'typing-response',
          'complete',
        ]}
        currentPhase={phase === 'idle' ? '' : phase}
        theme="orange"
      />
    </div>
  )
}

export default HumanoidDemo
