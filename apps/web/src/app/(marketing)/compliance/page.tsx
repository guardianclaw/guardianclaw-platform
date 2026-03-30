'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Scale,
  Award,
  ArrowRight,
  ExternalLink,
  Target,
  Zap,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const benchmarkResults = [
  { name: 'HarmBench', score: 96.7, description: 'LLM safety benchmark' },
  { name: 'SafeAgentBench', score: 97.3, description: 'Agent safety benchmark' },
  { name: 'BadRobot', score: 99.3, description: 'Robotics safety benchmark' },
  { name: 'JailbreakBench', score: 97.0, description: 'Jailbreak resistance' },
]

const averageScore = benchmarkResults.reduce((acc, b) => acc + b.score, 0) / benchmarkResults.length

const owaspAgenticTop10 = [
  { id: 'ASI01', name: 'Agent Goal Hijack', coverage: 'full', component: 'CLAW Worth Gate' },
  {
    id: 'ASI02',
    name: 'Tool Misuse & Exploitation',
    coverage: 'full',
    component: 'CLAW Limits Gate',
  },
  {
    id: 'ASI03',
    name: 'Identity & Privilege Abuse',
    coverage: 'partial',
    component: 'Database Guard',
  },
  {
    id: 'ASI04',
    name: 'Supply Chain Vulnerabilities',
    coverage: 'partial',
    component: 'Memory Shield',
  },
  {
    id: 'ASI05',
    name: 'Unexpected Code Execution',
    coverage: 'none',
    component: 'Infrastructure-level',
  },
  { id: 'ASI06', name: 'Memory & Context Poisoning', coverage: 'full', component: 'Memory Shield' },
  {
    id: 'ASI07',
    name: 'Insecure Inter-Agent Comm',
    coverage: 'planned',
    component: 'Phase 3 roadmap',
  },
  {
    id: 'ASI08',
    name: 'Cascading Failures',
    coverage: 'partial',
    component: 'CLAW Credibility Gate',
  },
  {
    id: 'ASI09',
    name: 'Human Trust Exploitation',
    coverage: 'full',
    component: 'Fiduciary AI Module',
  },
  { id: 'ASI10', name: 'Rogue Agents', coverage: 'full', component: 'CLAW Protocol' },
]

const euAiActArticle5 = [
  { practice: 'Subliminal manipulation techniques', gate: 'CREDIBILITY Gate', status: 'covered' },
  { practice: 'Exploitation of vulnerabilities', gate: 'AVOIDANCE Gate', status: 'covered' },
  { practice: 'Social scoring systems', gate: 'LIMITS Gate', status: 'covered' },
  { practice: 'Real-time biometric identification', gate: 'CREDIBILITY Gate', status: 'covered' },
]

const testedModels = [
  { name: 'GPT-4o-mini', provider: 'OpenAI', score: 99.5 },
  { name: 'GPT-4o', provider: 'OpenAI', score: 98.0 },
  { name: 'Claude Sonnet 4', provider: 'Anthropic', score: 97.5 },
  { name: 'Qwen 2.5 72B', provider: 'Alibaba', score: 96.5 },
  { name: 'DeepSeek Chat', provider: 'DeepSeek', score: 99.0 },
  { name: 'Llama 3.3 70B', provider: 'Meta', score: 93.5 },
  { name: 'Mistral Small', provider: 'Mistral', score: 99.5 },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function getCoverageIcon(coverage: string) {
  switch (coverage) {
    case 'full':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case 'partial':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />
    case 'planned':
      return <Target className="h-5 w-5 text-blue-500" />
    default:
      return <div className="border-muted-foreground/30 h-5 w-5 rounded-full border-2" />
  }
}

function getCoverageLabel(coverage: string) {
  switch (coverage) {
    case 'full':
      return 'Full Coverage'
    case 'partial':
      return 'Partial'
    case 'planned':
      return 'Planned'
    default:
      return 'N/A'
  }
}

export default function CompliancePage() {
  const fullCoverage = owaspAgenticTop10.filter((i) => i.coverage === 'full').length
  const partialCoverage = owaspAgenticTop10.filter((i) => i.coverage === 'partial').length
  const coveragePercent = Math.round((fullCoverage * 10 + partialCoverage * 5) / 10)

  return (
    <div className="py-16 lg:py-24">
      {/* Hero Section */}
      <section className="container mx-auto mb-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="bg-claw-500/10 text-claw-500 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
            <FileCheck className="h-4 w-4" />
            <span className="text-sm font-medium">Compliance</span>
          </div>

          <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Compliance & Certifications
          </h1>

          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            GuardianClaw is designed to meet the highest standards of AI safety compliance, from EU
            AI Act requirements to OWASP security guidelines.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <div className="rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400">
              EU AI Act Aligned
            </div>
            <div className="rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400">
              OWASP Agentic AI Top 10
            </div>
            <div className="rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400">
              SOC 2 Ready
            </div>
          </div>
        </motion.div>
      </section>

      {/* Benchmark Results */}
      <section className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Benchmark Results</h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Validated against industry-standard safety benchmarks with an average score of{' '}
              <span className="text-claw-500 font-semibold">{averageScore.toFixed(1)}%</span>.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {benchmarkResults.map((benchmark) => (
              <motion.div
                key={benchmark.name}
                variants={itemVariants}
                className="bg-background rounded-2xl border p-6 text-center"
              >
                <div className="text-claw-500 mb-2 text-4xl font-bold">{benchmark.score}%</div>
                <div className="mb-1 font-semibold">{benchmark.name}</div>
                <div className="text-muted-foreground text-sm">{benchmark.description}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tested Models */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <h3 className="mb-6 text-center text-xl font-semibold">Models Tested</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {testedModels.map((model) => (
                <div
                  key={model.name}
                  className="bg-background flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <div className="text-sm font-medium">{model.name}</div>
                    <div className="text-muted-foreground text-xs">{model.provider}</div>
                  </div>
                  <div className="text-claw-500 text-sm font-semibold">{model.score}%</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* EU AI Act Section */}
      <section id="eu-ai-act" className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-8 flex items-center gap-4">
              <div className="rounded-xl bg-blue-500/10 p-3">
                <Scale className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">EU AI Act Compliance</h2>
                <p className="text-muted-foreground">Regulation (EU) 2024/1689</p>
              </div>
            </div>

            <div className="bg-background mb-8 rounded-2xl border p-6">
              <h3 className="mb-4 font-semibold">Article 5: Prohibited Practices</h3>
              <p className="text-muted-foreground mb-6">
                GuardianClaw&apos;s CLAW protocol implements detection and prevention for all
                Article 5 prohibited AI practices.
              </p>

              <div className="space-y-3">
                {euAiActArticle5.map((item) => (
                  <div
                    key={item.practice}
                    className="bg-muted/50 flex items-center justify-between rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
                      <span className="text-sm">{item.practice}</span>
                    </div>
                    <span className="bg-claw-500/10 text-claw-500 rounded-full px-2 py-1 text-xs">
                      {item.gate}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <Zap className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                <p className="text-sm">
                  <strong>High-Risk AI Classification:</strong> GuardianClaw helps organizations
                  using high-risk AI systems meet their conformity assessment requirements under
                  Article 43.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* OWASP Agentic AI Top 10 */}
      <section id="owasp" className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-8 flex items-center gap-4">
              <div className="rounded-xl bg-orange-500/10 p-3">
                <Shield className="h-8 w-8 text-orange-500" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">OWASP Agentic AI Top 10</h2>
                <p className="text-muted-foreground">
                  Coverage: {coveragePercent}% ({fullCoverage} full, {partialCoverage} partial)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-4 text-left font-semibold">ID</th>
                    <th className="px-4 py-4 text-left font-semibold">Threat</th>
                    <th className="px-4 py-4 text-left font-semibold">Coverage</th>
                    <th className="px-4 py-4 text-left font-semibold">Component</th>
                  </tr>
                </thead>
                <tbody>
                  {owaspAgenticTop10.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="text-muted-foreground px-4 py-4 font-mono text-sm">
                        {item.id}
                      </td>
                      <td className="px-4 py-4">{item.name}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {getCoverageIcon(item.coverage)}
                          <span className="text-sm">{getCoverageLabel(item.coverage)}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground px-4 py-4 text-sm">{item.component}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Full Coverage</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>Partial Coverage</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-blue-500" />
                <span>Planned</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="border-muted-foreground/30 h-4 w-4 rounded-full border-2" />
                <span>Not Applicable</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Framework Coverage */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">17 Framework Integrations</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                GuardianClaw integrates with the most popular AI agent frameworks, LLM providers,
                and specialized tools.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-background rounded-2xl border p-6">
                <h3 className="mb-4 font-semibold">Agent Frameworks</h3>
                <div className="flex flex-wrap gap-2">
                  {['OpenAI Agents', 'ElizaOS', 'VoltAgent', 'Moltbot'].map((f) => (
                    <span key={f} className="bg-muted rounded-full px-3 py-1 text-sm">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-background rounded-2xl border p-6">
                <h3 className="mb-4 font-semibold">LLM Providers</h3>
                <div className="flex flex-wrap gap-2">
                  {['OpenAI', 'Anthropic', 'OpenRouter', 'Ollama', 'vLLM'].map((f) => (
                    <span key={f} className="bg-muted rounded-full px-3 py-1 text-sm">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-background rounded-2xl border p-6">
                <h3 className="mb-4 font-semibold">Crypto AI</h3>
                <div className="flex flex-wrap gap-2">
                  {['ElizaOS', 'Solana Agent Kit', 'Virtuals GAME', 'ARC'].map((f) => (
                    <span key={f} className="bg-muted rounded-full px-3 py-1 text-sm">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-background rounded-2xl border p-6">
                <h3 className="mb-4 font-semibold">Security Tools</h3>
                <div className="flex flex-wrap gap-2">
                  {['Garak', 'PyRIT', 'Promptfoo', 'OWASP Tools'].map((f) => (
                    <span key={f} className="bg-muted rounded-full px-3 py-1 text-sm">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-background rounded-2xl border p-6">
                <h3 className="mb-4 font-semibold">Compliance</h3>
                <div className="flex flex-wrap gap-2">
                  {['EU AI Act', 'CSA AI Matrix', 'NIST AI RMF'].map((f) => (
                    <span key={f} className="bg-muted rounded-full px-3 py-1 text-sm">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CSA AI Controls Matrix */}
      <section id="csa" className="bg-muted/30 py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-8 flex items-center gap-4">
              <div className="rounded-xl bg-purple-500/10 p-3">
                <Shield className="h-8 w-8 text-purple-500" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">CSA AI Controls Matrix</h2>
                <p className="text-muted-foreground">Cloud Security Alliance AI Security</p>
              </div>
            </div>

            <div className="bg-background rounded-2xl border p-6">
              <p className="text-muted-foreground mb-6">
                GuardianClaw implements controls aligned with the Cloud Security Alliance AI
                Controls Matrix, providing comprehensive coverage across key security domains.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { domain: 'Data Security', coverage: 'Memory Shield, Database Guard' },
                  { domain: 'Model Security', coverage: 'CLAW Protocol validation' },
                  { domain: 'Application Security', coverage: 'Input/Output validators' },
                  { domain: 'Infrastructure Security', coverage: 'Deployment controls' },
                ].map((item) => (
                  <div
                    key={item.domain}
                    className="bg-muted/50 flex items-center gap-3 rounded-xl p-4"
                  >
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
                    <div>
                      <span className="font-medium">{item.domain}</span>
                      <p className="text-muted-foreground text-sm">{item.coverage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Certifications Roadmap */}
      <section id="certifications" className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-4xl"
          >
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Certification Roadmap</h2>
              <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                We&apos;re continuously working toward industry certifications to provide additional
                assurance of our security and compliance posture.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div className="bg-background rounded-2xl border p-6 text-center">
                <Award className="text-claw-500 mx-auto mb-4 h-10 w-10" />
                <h3 className="mb-2 font-semibold">SOC 2 Type II</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Comprehensive audit of security, availability, and confidentiality controls.
                </p>
                <span className="inline-block rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-500">
                  In Progress
                </span>
              </div>

              <div className="bg-background rounded-2xl border p-6 text-center">
                <Shield className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                <h3 className="mb-2 font-semibold">ISO 27001</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  International standard for information security management systems.
                </p>
                <span className="bg-muted text-muted-foreground inline-block rounded-full px-3 py-1 text-sm">
                  Planned 2026
                </span>
              </div>

              <div className="bg-background rounded-2xl border p-6 text-center">
                <FileCheck className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                <h3 className="mb-2 font-semibold">External Audit</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Independent penetration testing and security assessment.
                </p>
                <span className="bg-muted text-muted-foreground inline-block rounded-full px-3 py-1 text-sm">
                  Planned Q2 2026
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Need Compliance Documentation?</h2>
            <p className="text-muted-foreground mb-8 text-lg">
              We provide detailed compliance documentation and security questionnaire responses for
              enterprise customers.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/docs">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Read Documentation
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/security">
                  View Security
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/trust">
                  Trust Center
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a
                  href="https://github.com/guardianclaw/guardianclaw-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Source
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
