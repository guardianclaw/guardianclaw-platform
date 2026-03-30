import { Coins, Building2, Bot, type LucideIcon } from 'lucide-react'

export interface UseCase {
  slug: string
  name: string
  tagline: string
  icon: LucideIcon
  color: string
  heroImage?: string
  challenge: {
    title: string
    description: string
    problems: string[]
  }
  solution: {
    title: string
    description: string
    benefits: string[]
  }
  products: string[] // product slugs
}

export const useCases: UseCase[] = [
  {
    slug: 'crypto',
    name: 'Crypto & DeFi',
    tagline: 'Secure AI agents for blockchain operations',
    icon: Coins,
    color: 'amber',
    challenge: {
      title: 'The Wild West of AI Trading',
      description: `AI agents managing cryptocurrency face unique risks: irreversible transactions,
flash loan attacks, and malicious smart contracts. A single compromised decision can result
in immediate, permanent financial loss.`,
      problems: [
        'Irreversible blockchain transactions',
        'Honeypot tokens and rug pulls',
        'Flash loan and sandwich attacks',
        'Wallet draining vulnerabilities',
        'Regulatory compliance requirements',
      ],
    },
    solution: {
      title: 'Defense-in-Depth for DeFi',
      description: `GuardianClaw provides multiple layers of protection for crypto AI agents:
pre-transaction validation, real-time risk assessment, and fiduciary safeguards that
ensure agents act in the user's best interest.`,
      benefits: [
        'Token safety checks (honeypot detection)',
        'Transaction simulation before execution',
        'Slippage and price impact validation',
        'Token security analysis (GoPlus API)',
        'Memory protection against address injection',
      ],
    },
    products: ['transaction-simulator', 'memory-shield', 'fiduciary-ai'],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise AI',
    tagline: 'Compliant AI for regulated industries',
    icon: Building2,
    color: 'blue',
    challenge: {
      title: 'AI in Regulated Environments',
      description: `Enterprises deploying AI agents face strict regulatory requirements:
GDPR, SOC 2, HIPAA, and industry-specific regulations. Every AI decision must be
auditable, explainable, and compliant.`,
      problems: [
        'Data privacy and GDPR compliance',
        'Audit trail requirements',
        'Prompt injection and data exfiltration',
        'Shadow AI and unauthorized usage',
        'Model hallucination in critical processes',
      ],
    },
    solution: {
      title: 'Enterprise-Grade AI Governance',
      description: `GuardianClaw integrates with your existing security stack to provide
centralized AI governance. Every prompt, response, and decision is validated,
logged, and traceable.`,
      benefits: [
        'OWASP Agentic AI coverage (65%)',
        'EU AI Act compliance ready',
        'Complete audit trails with retention policies',
        'SQL injection and data exfiltration prevention',
        'Memory integrity verification',
      ],
    },
    products: ['memory-shield', 'database-guard'],
  },
  {
    slug: 'robotics',
    name: 'Robotics & Embodied AI',
    tagline: 'Physical world safety for AI systems',
    icon: Bot,
    color: 'orange',
    challenge: {
      title: 'When AI Meets the Physical World',
      description: `AI-controlled robots and physical systems can cause real-world avoidance.
A misaligned command can result in injury, property damage, or worse. Safety isn't
optional: it's ISO-mandated.`,
      problems: [
        'Physical safety compliance (ISO/TS 15066)',
        'Real-time constraint enforcement',
        'Emergency stop reliability',
        'Human-robot interaction safety',
        'Unpredictable AI behavior in physical contexts',
      ],
    },
    solution: {
      title: 'ISO-Compliant Robotics Safety',
      description: `GuardianClaw enforces physical safety constraints at the command level.
Before any motion command executes, it's validated against ISO/TS 15066 contact force
limits across 29 body regions.`,
      benefits: [
        'ISO/TS 15066 compliant contact force limits',
        '29 body region force/pressure validation',
        'Pre-configured presets (Tesla Optimus, Atlas, Figure 02)',
        'Balance monitoring and fall detection',
        'CLAW validation for humanoid actions',
      ],
    },
    products: ['humanoid-safety'],
  },
]

export function getUseCase(slug: string): UseCase | undefined {
  return useCases.find((uc) => uc.slug === slug)
}

export function getUseCaseColors(color: string): { bg: string; text: string; gradient: string } {
  const colors: Record<string, { bg: string; text: string; gradient: string }> = {
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-500',
      gradient: 'from-amber-500/20 to-amber-600/5',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      gradient: 'from-blue-500/20 to-blue-600/5',
    },
    orange: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-500',
      gradient: 'from-orange-500/20 to-orange-600/5',
    },
  }
  return colors[color] || colors.blue
}
