'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  Server,
  Lock,
  Globe,
  Database,
  UserCheck,
  Trash2,
  Download,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrustDashboard } from '@/components/security'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const complianceCards = [
  {
    title: 'EU AI Act',
    metric: '100%',
    subtitle: 'Article 5 Prohibited Practices',
    href: '/compliance#eu-ai-act',
    color: 'border-claw-500/20 hover:border-claw-500/40',
  },
  {
    title: 'OWASP Agentic AI',
    metric: '65%',
    subtitle: 'Top 10 Coverage',
    href: '/compliance#owasp',
    color: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    title: 'CSA AI Controls',
    metric: 'Mapped',
    subtitle: 'AI Controls Matrix',
    href: '/compliance#csa',
    color: 'border-purple-500/20 hover:border-purple-500/40',
  },
]

const weCollect = [
  { label: 'Agent configurations', note: 'encrypted' },
  { label: 'Execution logs', note: 'anonymized' },
  { label: 'Usage metrics', note: 'aggregated' },
  { label: 'Wallet addresses', note: 'public keys only' },
]

const weDontCollect = [
  { label: 'LLM API keys', note: 'zero-knowledge' },
  { label: 'Conversation contents', note: 'never stored' },
  { label: 'Personally identifiable info', note: 'no PII' },
  { label: 'Emails or passwords', note: 'wallet auth only' },
]

const userRights = [
  { icon: UserCheck, label: 'Access', desc: 'Request a copy of your data' },
  { icon: Trash2, label: 'Deletion', desc: 'Request complete data removal' },
  { icon: Download, label: 'Export', desc: 'Download your data in JSON' },
  { icon: Repeat, label: 'Portability', desc: 'Transfer data to another service' },
]

const infrastructure = [
  { icon: Globe, label: 'Frontend', desc: 'Vercel, Global CDN', detail: 'Edge-optimized delivery' },
  { icon: Database, label: 'Database', desc: 'Supabase, US/EU', detail: 'Row-level security' },
  { icon: Server, label: 'Agent Runtime', desc: 'Modal.com, US', detail: 'Isolated containers' },
  {
    icon: Lock,
    label: 'Encryption',
    desc: 'AES-256-GCM + Ed25519',
    detail: 'Client-side key derivation',
  },
]

export default function TrustPage() {
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
            <span className="text-sm font-medium">Trust Center</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Trust &amp; Transparency
          </h1>

          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            Honest documentation of our security practices, data handling, and what we can verify
            today.
          </p>
        </motion.div>
      </section>

      {/* Certification Dashboard */}
      <section className="bg-muted/30 py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">What We Can Verify Today</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Transparent status of our security practices — what&apos;s real, and what&apos;s next.
            </p>
          </motion.div>

          <div className="mx-auto max-w-4xl">
            <TrustDashboard />
          </div>
        </div>
      </section>

      {/* Compliance & Standards */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Compliance &amp; Standards</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                How GuardianClaw aligns with major regulatory frameworks.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3"
            >
              {complianceCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className={`bg-background rounded-2xl border p-6 transition-all ${card.color} group`}
                >
                  <div className="text-claw-500 mb-1 text-3xl font-bold">{card.metric}</div>
                  <h3 className="mb-1 font-semibold">{card.title}</h3>
                  <p className="text-muted-foreground text-sm">{card.subtitle}</p>
                  <div className="text-claw-500 mt-4 flex items-center text-sm transition-all group-hover:gap-2">
                    View details <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Data Practices */}
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
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Data Practices</h2>
              <p className="text-muted-foreground text-lg">
                What we collect, what we don&apos;t, and your rights.
              </p>
            </motion.div>

            <div className="mb-10 grid gap-6 sm:grid-cols-2">
              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold text-green-600 dark:text-green-400">
                    What We Collect
                  </h3>
                </div>
                <ul className="space-y-3">
                  {weCollect.map((item) => (
                    <li key={item.label} className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                        {item.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6"
              >
                <div className="mb-4 flex items-center gap-2">
                  <EyeOff className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold text-red-600 dark:text-red-400">
                    What We DON&apos;T Collect
                  </h3>
                </div>
                <ul className="space-y-3">
                  {weDontCollect.map((item) => (
                    <li key={item.label} className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
                        {item.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* User Rights */}
            <motion.div variants={itemVariants}>
              <h3 className="mb-4 text-center font-semibold">Your Rights</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {userRights.map((right) => (
                  <div
                    key={right.label}
                    className="bg-background rounded-xl border p-4 text-center"
                  >
                    <right.icon className="text-claw-500 mx-auto mb-2 h-5 w-5" />
                    <div className="text-sm font-medium">{right.label}</div>
                    <div className="text-muted-foreground mt-1 text-xs">{right.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Infrastructure */}
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
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Infrastructure Overview</h2>
              <p className="text-muted-foreground text-lg">
                Where your data lives and how it&apos;s protected.
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {infrastructure.map((item) => (
                <div
                  key={item.label}
                  className="bg-background hover:border-claw-500/30 rounded-2xl border p-6 transition-all"
                >
                  <item.icon className="text-claw-500 mb-3 h-6 w-6" />
                  <h3 className="mb-1 font-semibold">{item.label}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                  <p className="text-muted-foreground/60 mt-1 text-xs">{item.detail}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-muted/30 py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Questions About Trust &amp; Compliance?
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              Get in touch with our team for security inquiries, compliance questions, or vendor
              assessments.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/contact">
                  Contact Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/security">Security Overview</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
