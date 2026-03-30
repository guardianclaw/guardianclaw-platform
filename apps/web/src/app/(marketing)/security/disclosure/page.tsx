'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, Mail, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DisclosureTimeline } from '@/components/security'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const inScope = [
  'guardianclaw.org web application',
  '@guardianclaw/core npm package',
  'guardianclaw PyPI package',
  'GuardianClaw API endpoints',
  '$GCLAW smart contracts',
]

const outOfScope = [
  'Social engineering attacks',
  'Denial of service (DoS/DDoS)',
  'Physical access attacks',
  'Third-party services and dependencies',
  'Spam or phishing campaigns',
]

const severityLevels = [
  {
    level: 'Critical',
    cvss: '9.0–10.0',
    response: '24–48 hours',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    borderColor: 'border-red-500/20',
  },
  {
    level: 'High',
    cvss: '7.0–8.9',
    response: '3–5 days',
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500/20',
  },
  {
    level: 'Medium',
    cvss: '4.0–6.9',
    response: '1–2 weeks',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    borderColor: 'border-yellow-500/20',
  },
  {
    level: 'Low',
    cvss: '0.1–3.9',
    response: '2–4 weeks',
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500/20',
  },
]

const safeHarborConditions = [
  'Act in good faith and avoid privacy violations, data destruction, or service interruption',
  'Only interact with accounts you own or have explicit permission to test',
  'Report vulnerabilities promptly and provide sufficient detail to reproduce',
  'Do not disclose vulnerability details publicly until the fix has been released',
]

export default function DisclosurePage() {
  return (
    <div className="py-16 lg:py-24">
      {/* Hero */}
      <section className="container mx-auto mb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Vulnerability Disclosure Policy</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Responsible Security Research
          </h1>

          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            We value the work of security researchers. If you&apos;ve found a vulnerability, we want
            to hear about it.
          </p>
        </motion.div>
      </section>

      {/* Limits */}
      <section className="bg-muted/30 py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="mx-auto max-w-4xl"
          >
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Limits</h2>
              <p className="text-muted-foreground text-lg">
                What&apos;s covered by our vulnerability disclosure program.
              </p>
            </motion.div>

            <div className="grid gap-6 sm:grid-cols-2">
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6"
              >
                <h3 className="mb-4 font-semibold text-green-600 dark:text-green-400">In Limits</h3>
                <ul className="space-y-3">
                  {inScope.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6"
              >
                <h3 className="mb-4 font-semibold text-red-600 dark:text-red-400">Out of Limits</h3>
                <ul className="space-y-3">
                  {outOfScope.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex-shrink-0 text-red-500">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Reporting Process */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Reporting Process</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              From initial report to coordinated disclosure — here&apos;s how we handle security
              issues.
            </p>
          </motion.div>

          <DisclosureTimeline />
        </div>
      </section>

      {/* Safe Harbor */}
      <section className="bg-muted/30 py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="mx-auto max-w-3xl"
          >
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Safe Harbor</h2>
              <p className="text-muted-foreground text-lg">
                We won&apos;t take legal action against security researchers who follow these
                guidelines.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-background rounded-2xl border p-8">
              <div className="space-y-4">
                {safeHarborConditions.map((condition) => (
                  <div key={condition} className="flex items-start gap-3">
                    <CheckCircle2 className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{condition}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
                <p className="text-muted-foreground text-sm">
                  <strong className="text-blue-600 dark:text-blue-400">Note:</strong> This safe
                  harbor applies only to legal claims under our control. It does not bind third
                  parties or provide immunity from laws that apply regardless of our policies.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Severity Classification */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="mx-auto max-w-4xl"
          >
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Severity Classification</h2>
              <p className="text-muted-foreground text-lg">
                We use CVSS v3.1 to classify vulnerability severity.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-4 text-left font-semibold">Severity</th>
                    <th className="px-4 py-4 text-left font-semibold">CVSS Score</th>
                    <th className="px-4 py-4 text-left font-semibold">Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {severityLevels.map((level) => (
                    <tr key={level.level} className="border-b last:border-0">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${level.color}`} />
                          <span className={`font-medium ${level.textColor}`}>{level.level}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground px-4 py-4 font-mono text-sm">
                        {level.cvss}
                      </td>
                      <td className="text-muted-foreground px-4 py-4 text-sm">{level.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-4 text-right">
              <a
                href="https://www.first.org/cvss/calculator/3.1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
              >
                CVSS v3.1 Calculator <ExternalLink className="h-3 w-3" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Security Advisories */}
      <section className="bg-muted/30 py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Security Advisories</h2>
            <div className="py-16">
              <Shield className="text-muted-foreground/30 mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No advisories published yet.</p>
              <p className="text-muted-foreground/60 mt-1 text-sm">
                Published advisories will appear here.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Report a Vulnerability</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Found something? Let us know and help make AI agents safer for everyone.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <a href="mailto:contact@guardianclaw.org">
                  <Mail className="mr-2 h-4 w-4" />
                  contact@guardianclaw.org
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/security">
                  Back to Security <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
