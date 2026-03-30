'use client'

import { motion } from 'framer-motion'
import {
  Shield,
  ShieldCheck,
  Brain,
  Database,
  Lock,
  Key,
  Server,
  Fingerprint,
  Scale,
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const pillars = [
  {
    title: 'AI Safety',
    subtitle: 'Validating AI decisions before they become actions',
    color: 'claw',
    bgClass: 'bg-claw-500/5 border-claw-500/20',
    iconBg: 'bg-claw-500/10',
    iconColor: 'text-claw-500',
    icon: ShieldCheck,
    features: [
      { icon: Shield, label: 'CLAW Protocol', desc: '4-gate validation for every decision' },
      {
        icon: Brain,
        label: '4-Layer Defense',
        desc: 'L1 Input → L2 Seed → L3 Output → L4 Observer',
      },
      { icon: Database, label: 'Memory Shield', desc: 'Context injection attack protection' },
      {
        icon: ShieldCheck,
        label: 'Database Guard',
        desc: 'SQL/injection analysis and data exfiltration prevention',
      },
      {
        icon: Scale,
        label: 'Fiduciary Validator',
        desc: '6-step conflict detection and loyalty framework',
      },
    ],
  },
  {
    title: 'Platform Security',
    subtitle: 'Enterprise-grade infrastructure protection',
    color: 'blue',
    bgClass: 'bg-blue-500/5 border-blue-500/20',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    icon: Lock,
    features: [
      {
        icon: Key,
        label: 'Zero-Knowledge Crypto',
        desc: 'Client-side encryption, we never see your keys',
      },
      { icon: Fingerprint, label: 'Wallet Auth', desc: 'Ed25519 signatures, no passwords' },
      { icon: Server, label: 'Runtime Isolation', desc: 'Sandboxed containers with strict limits' },
      { icon: Lock, label: 'E2E Encryption', desc: 'AES-256-GCM at rest, TLS 1.2+ in transit' },
    ],
  },
]

export function SecurityPillars() {
  return (
    <section className="bg-muted/30 py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Our Approach to Security</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Two pillars working together: AI Safety validates agent behavior, Platform Security
            protects the infrastructure.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2"
        >
          {pillars.map((pillar) => (
            <motion.div
              key={pillar.title}
              variants={itemVariants}
              className={`rounded-2xl border p-8 ${pillar.bgClass}`}
            >
              <div className={`rounded-xl p-3 ${pillar.iconBg} mb-4 inline-block`}>
                <pillar.icon className={`h-7 w-7 ${pillar.iconColor}`} />
              </div>
              <h3 className="mb-2 text-2xl font-bold">{pillar.title}</h3>
              <p className="text-muted-foreground mb-6">{pillar.subtitle}</p>

              <div className="space-y-4">
                {pillar.features.map((feature) => (
                  <div key={feature.label} className="flex items-start gap-3">
                    <div className={`rounded-lg p-1.5 ${pillar.iconBg} mt-0.5`}>
                      <feature.icon className={`h-4 w-4 ${pillar.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{feature.label}</div>
                      <div className="text-muted-foreground text-xs">{feature.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
