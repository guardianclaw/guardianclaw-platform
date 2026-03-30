'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield,
  Lock,
  Server,
  Key,
  Mail,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Clock,
  FileCode,
  Github,
  ShieldCheck,
  Activity,
  Search,
  Code,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SecurityHero,
  SecurityPillars,
  AISafetySection,
  DataFlowDiagram,
} from '@/components/security'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const dataClassification = [
  {
    level: 'Public',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    examples: 'Product pages, documentation, public APIs',
    controls: 'None required',
  },
  {
    level: 'Internal',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
    examples: 'Aggregated metrics, system logs',
    controls: 'Access logging, internal only',
  },
  {
    level: 'Confidential',
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    examples: 'User agents, flow configurations',
    controls: 'Encryption at rest, RLS policies',
  },
  {
    level: 'Secret',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    examples: 'Session tokens, JWT secrets',
    controls: 'Short TTL, memory-only storage',
  },
  {
    level: 'Zero-Knowledge',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    examples: 'LLM API keys, user secrets',
    controls: 'Client-side encryption only',
  },
]

const securityOps = [
  {
    icon: Clock,
    title: 'Incident Response',
    description:
      'Security issues reported via disclosure policy are triaged and addressed by the core team.',
  },
  {
    icon: Activity,
    title: 'Monitoring',
    description:
      'Application-level logging and error tracking across API and agent runtime services.',
  },
  {
    icon: Search,
    title: 'Vulnerability Scanning',
    description:
      'Dependency auditing via automated tools. No formal penetration testing program yet.',
  },
  {
    icon: Code,
    title: 'Code Review',
    description: 'All changes reviewed before merge. Open source codebase allows public scrutiny.',
  },
]

export default function SecurityPage() {
  return (
    <div className="py-16 lg:py-24">
      {/* Section 1: Hero */}
      <SecurityHero />

      {/* Section 2: Pillars */}
      <SecurityPillars />

      {/* Section 3: AI Safety (CLAW + 4-Layer) */}
      <AISafetySection />

      {/* Section 4: Platform Security */}
      <section className="bg-muted/30 py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Platform Security</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Enterprise-grade infrastructure protecting your data and operations.
            </p>
          </motion.div>

          {/* Zero-Knowledge API Key Storage */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-16 max-w-4xl"
          >
            <div className="mb-8 text-center">
              <h3 className="mb-3 text-2xl font-bold">Zero-Knowledge API Key Storage</h3>
              <p className="text-muted-foreground mx-auto max-w-2xl">
                Your LLM API keys are encrypted on your device before leaving your browser. We never
                see your plaintext keys.
              </p>
            </div>

            <div className="bg-background rounded-2xl border p-8">
              <div className="grid gap-8 md:grid-cols-2">
                {/* Client Side */}
                <div className="space-y-4">
                  <div className="text-claw-500 flex items-center gap-2 font-semibold">
                    <Lock className="h-5 w-5" />
                    Your Browser (Client-Side)
                  </div>

                  <div className="space-y-3">
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-claw-500/10 text-claw-500 rounded px-2 py-0.5 font-mono text-xs">
                        1
                      </span>
                      <span className="text-sm">You enter your API key</span>
                    </div>
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-claw-500/10 text-claw-500 rounded px-2 py-0.5 font-mono text-xs">
                        2
                      </span>
                      <span className="text-sm">Request wallet signature</span>
                    </div>
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-claw-500/10 text-claw-500 rounded px-2 py-0.5 font-mono text-xs">
                        3
                      </span>
                      <span className="text-sm">Derive encryption key (PBKDF2-SHA256)</span>
                    </div>
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-claw-500/10 text-claw-500 rounded px-2 py-0.5 font-mono text-xs">
                        4
                      </span>
                      <span className="text-sm">Encrypt with AES-256-GCM</span>
                    </div>
                    <div className="bg-claw-500/10 border-claw-500/20 flex items-start gap-3 rounded-lg border p-3">
                      <span className="bg-claw-500/10 text-claw-500 rounded px-2 py-0.5 font-mono text-xs">
                        5
                      </span>
                      <span className="text-sm font-medium">Send only ciphertext to server</span>
                    </div>
                  </div>
                </div>

                {/* Server Side */}
                <div className="space-y-4">
                  <div className="text-muted-foreground flex items-center gap-2 font-semibold">
                    <Server className="h-5 w-5" />
                    Our Server (Cannot Decrypt)
                  </div>

                  <div className="space-y-3">
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">6</span>
                      <span className="text-sm">Store ciphertext (opaque blob)</span>
                    </div>
                    <div className="border-muted-foreground/30 rounded-lg border-2 border-dashed p-4 text-center">
                      <XCircle className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                      <span className="text-muted-foreground text-sm">
                        Server NEVER sees plaintext API key
                      </span>
                    </div>
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">7</span>
                      <span className="text-sm">On execution: Return ciphertext to client</span>
                    </div>
                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                      <span className="bg-muted rounded px-2 py-0.5 font-mono text-xs">8</span>
                      <span className="text-sm">Client decrypts locally, sends to LLM</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-claw-500/10 border-claw-500/20 mt-8 rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-claw-500 h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">
                    <strong>Result:</strong> Even if our servers were compromised, attackers could
                    not decrypt your API keys without your wallet signature.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Wallet-Based Authentication */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-16 max-w-4xl"
          >
            <div className="mb-8 text-center">
              <h3 className="mb-3 text-2xl font-bold">Wallet-Based Authentication</h3>
              <p className="text-muted-foreground mx-auto max-w-2xl">
                No passwords to steal. No emails to phish. Just cryptographic proof of ownership.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="bg-background rounded-2xl border p-6">
                <h4 className="mb-4 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="text-claw-500 h-5 w-5" />
                  What We Use
                </h4>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-claw-500 mt-1">&#8226;</span>
                    <span>
                      <strong>Ed25519 signatures</strong>: Cryptographically secure wallet
                      verification
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-claw-500 mt-1">&#8226;</span>
                    <span>
                      <strong>Nonce-based auth</strong>: 32 bytes random, 5-minute TTL
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-claw-500 mt-1">&#8226;</span>
                    <span>
                      <strong>Domain binding</strong>: Signatures only valid for guardianclaw.org
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-claw-500 mt-1">&#8226;</span>
                    <span>
                      <strong>JWT sessions</strong>: 1-hour lifetime, httpOnly cookies
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-claw-500 mt-1">&#8226;</span>
                    <span>
                      <strong>Session limits</strong>: Max 5 concurrent sessions per wallet
                    </span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                <h4 className="mb-4 flex items-center gap-2 font-semibold">
                  <XCircle className="h-5 w-5 text-red-500" />
                  What We Don&apos;t Use
                </h4>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-500">&#10005;</span>
                    <span>
                      <strong>Passwords</strong>: Nothing to leak or brute-force
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-500">&#10005;</span>
                    <span>
                      <strong>Email verification</strong>: No email = no phishing target
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-500">&#10005;</span>
                    <span>
                      <strong>SMS codes</strong>: No SIM-swap vulnerability
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-500">&#10005;</span>
                    <span>
                      <strong>Security questions</strong>: Easily guessable/social engineered
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 text-red-500">&#10005;</span>
                    <span>
                      <strong>OAuth providers</strong>: No third-party account dependencies
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Agent Runtime Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-16 max-w-4xl"
          >
            <div className="mb-8 text-center">
              <h3 className="mb-3 text-2xl font-bold">Agent Runtime Security</h3>
              <p className="text-muted-foreground mx-auto max-w-2xl">
                Your agents run in isolated containers with strict resource limits and network
                controls.
              </p>
            </div>

            <div className="bg-background rounded-2xl border p-8">
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <h4 className="mb-4 flex items-center gap-2 font-semibold">
                    <Server className="text-claw-500 h-5 w-5" />
                    Container Isolation (Modal.com)
                  </h4>
                  <ul className="text-muted-foreground space-y-2 text-sm">
                    <li>&#8226; Isolated filesystem (ephemeral)</li>
                    <li>&#8226; No persistent storage across executions</li>
                    <li>&#8226; No host network access</li>
                    <li>&#8226; No access to other containers</li>
                    <li>&#8226; Limited system calls (seccomp)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-4 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Resource Limits
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="bg-muted/50 flex justify-between rounded p-2">
                      <span className="text-muted-foreground">CPU</span>
                      <span className="font-mono">1 vCPU</span>
                    </div>
                    <div className="bg-muted/50 flex justify-between rounded p-2">
                      <span className="text-muted-foreground">Memory</span>
                      <span className="font-mono">512 MB</span>
                    </div>
                    <div className="bg-muted/50 flex justify-between rounded p-2">
                      <span className="text-muted-foreground">Execution Time</span>
                      <span className="font-mono">60 seconds</span>
                    </div>
                    <div className="bg-muted/50 flex justify-between rounded p-2">
                      <span className="text-muted-foreground">Disk</span>
                      <span className="font-mono">100 MB</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                  <h4 className="mb-2 font-medium text-green-600 dark:text-green-400">
                    Allowed Egress
                  </h4>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>&#8226; api.openai.com, api.anthropic.com</li>
                    <li>&#8226; openrouter.ai</li>
                    <li>&#8226; Vector DBs (Pinecone, Weaviate)</li>
                    <li>&#8226; User-defined webhooks (HTTPS only)</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <h4 className="mb-2 font-medium text-red-600 dark:text-red-400">
                    Blocked Egress
                  </h4>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    <li>&#8226; Internal networks (10.x, 172.16.x, 192.168.x)</li>
                    <li>&#8226; Cloud metadata (169.254.169.254)</li>
                    <li>&#8226; GuardianClaw infrastructure</li>
                    <li>&#8226; Localhost (127.0.0.1)</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Open Source Callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="bg-background flex flex-col items-start gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center">
              <div className="bg-claw-500/10 rounded-xl p-3">
                <Github className="text-claw-500 h-6 w-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Open Source &amp; Auditable</h4>
                <p className="text-muted-foreground text-sm">
                  GuardianClaw is MIT licensed. Every line of security code is publicly auditable on
                  GitHub.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/guardianclaw/guardianclaw-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Source <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section 5: Data Security */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="mx-auto max-w-4xl"
          >
            <motion.div variants={itemVariants} className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Data Security</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                Every piece of data is classified, encrypted, and protected according to its
                sensitivity.
              </p>
            </motion.div>

            {/* Data Classification Table */}
            <motion.div variants={itemVariants} className="mb-16">
              <h3 className="mb-6 text-xl font-bold">Data Classification</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-4 text-left font-semibold">Level</th>
                      <th className="px-4 py-4 text-left font-semibold">Examples</th>
                      <th className="px-4 py-4 text-left font-semibold">Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataClassification.map((item) => (
                      <tr key={item.level} className="border-b last:border-0">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${item.color}`} />
                            <span className={`font-medium ${item.textColor}`}>{item.level}</span>
                          </div>
                        </td>
                        <td className="text-muted-foreground px-4 py-4 text-sm">{item.examples}</td>
                        <td className="text-muted-foreground px-4 py-4 text-sm">{item.controls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Data Flow Diagram */}
            <motion.div variants={itemVariants} className="mb-16">
              <h3 className="mb-6 text-xl font-bold">Validation Pipeline</h3>
              <div className="bg-background rounded-2xl border p-6">
                <DataFlowDiagram />
              </div>
            </motion.div>

            {/* Encryption Details */}
            <motion.div variants={itemVariants}>
              <h3 className="mb-6 text-xl font-bold">Encryption Standards</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-background rounded-xl border p-5">
                  <div className="text-muted-foreground mb-1 text-sm font-medium">At Rest</div>
                  <div className="font-semibold">AES-256-GCM</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    All stored data encrypted with authenticated encryption
                  </p>
                </div>
                <div className="bg-background rounded-xl border p-5">
                  <div className="text-muted-foreground mb-1 text-sm font-medium">In Transit</div>
                  <div className="font-semibold">TLS 1.2+</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    All connections use modern TLS with strong cipher suites
                  </p>
                </div>
                <div className="bg-background rounded-xl border p-5">
                  <div className="text-muted-foreground mb-1 text-sm font-medium">
                    Key Derivation
                  </div>
                  <div className="font-semibold">PBKDF2-SHA256</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Wallet signature-based key derivation for zero-knowledge storage
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Section 6: Security Operations */}
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
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Security Operations</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                Continuous security practices built into our development and operations workflow.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 sm:grid-cols-2">
              {securityOps.map((op) => (
                <div
                  key={op.title}
                  className="bg-background hover:border-claw-500/30 rounded-2xl border p-6 transition-all"
                >
                  <op.icon className="text-claw-500 mb-3 h-6 w-6" />
                  <h3 className="mb-2 font-semibold">{op.title}</h3>
                  <p className="text-muted-foreground text-sm">{op.description}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Section 7: Responsible Disclosure (simplified) */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <Shield className="text-claw-500 mx-auto mb-4 h-10 w-10" />
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Responsible Disclosure</h2>
            <p className="text-muted-foreground mx-auto mb-8 max-w-xl text-lg">
              Found a vulnerability? We offer safe harbor for good-faith security research, 90-day
              fix windows, and credit in advisories.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/security/disclosure">
                  View Disclosure Policy <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="mailto:contact@guardianclaw.org">
                  <Mail className="mr-2 h-4 w-4" />
                  Report a Vulnerability
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section 8: Cross-Links CTA */}
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
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Learn More</h2>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 sm:grid-cols-3">
              <Link
                href="/compliance"
                className="bg-background hover:border-claw-500/30 group rounded-2xl border p-6 transition-all"
              >
                <ShieldCheck className="text-claw-500 mb-3 h-6 w-6" />
                <h3 className="mb-1 font-semibold">Compliance</h3>
                <p className="text-muted-foreground mb-3 text-sm">EU AI Act, OWASP, benchmarks</p>
                <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                  View details <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <Link
                href="/trust"
                className="bg-background hover:border-claw-500/30 group rounded-2xl border p-6 transition-all"
              >
                <Eye className="text-claw-500 mb-3 h-6 w-6" />
                <h3 className="mb-1 font-semibold">Trust Center</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Data practices, infrastructure, transparency
                </p>
                <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                  View details <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <Link
                href="/whitepaper"
                className="bg-background hover:border-claw-500/30 group rounded-2xl border p-6 transition-all"
              >
                <FileCode className="text-claw-500 mb-3 h-6 w-6" />
                <h3 className="mb-1 font-semibold">Whitepaper</h3>
                <p className="text-muted-foreground mb-3 text-sm">
                  Technical deep-dive into CLAW and 4-Layer
                </p>
                <span className="text-claw-500 flex items-center gap-1 text-sm transition-all group-hover:gap-2">
                  Read paper <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
