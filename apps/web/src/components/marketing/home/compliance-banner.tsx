'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, CheckCircle2, ExternalLink } from 'lucide-react'

const complianceItems = [
  {
    title: 'EU AI Act',
    description: 'Compliant with Article 9 requirements for high-risk AI systems',
    href: '/compliance#eu-ai-act',
    badge: 'Ready',
  },
  {
    title: 'OWASP LLM Top 10',
    description: 'Protection against all 10 categories of LLM vulnerabilities',
    href: '/compliance#owasp',
    badge: '10/10',
  },
  {
    title: 'CSA AI Controls',
    description: 'Mapped to Cloud Security Alliance AI security controls',
    href: '/compliance#csa',
    badge: 'Aligned',
  },
  {
    title: 'SOC 2',
    description: 'Enterprise-ready security controls and audit trails',
    href: '/compliance#certifications',
    badge: 'Ready',
  },
]

export function ComplianceBanner() {
  return (
    <section className="bg-muted/30 py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-5xl"
        >
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="bg-claw-500/10 text-claw-600 dark:text-claw-400 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
              <Shield className="h-4 w-4" />
              Compliance & Security
            </div>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Enterprise-Ready Compliance</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Built with regulatory requirements in mind. GuardianClaw helps you meet compliance
              obligations while maintaining development velocity.
            </p>
          </div>

          {/* Compliance Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {complianceItems.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Link
                  href={item.href}
                  className="bg-background hover:border-claw-500/30 group flex items-start gap-4 rounded-xl border p-6 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="text-claw-500 h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="group-hover:text-claw-500 font-semibold transition-colors">
                        {item.title}
                      </h3>
                      <span className="bg-claw-500/10 text-claw-600 dark:text-claw-400 rounded-full px-2 py-0.5 text-xs font-medium">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </div>
                  <ExternalLink className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Documentation Link */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <Link
              href="/compliance"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              View full compliance documentation →
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
