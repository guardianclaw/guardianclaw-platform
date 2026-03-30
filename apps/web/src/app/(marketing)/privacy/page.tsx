import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Lock, Eye, Trash2, Download, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy | GuardianClaw',
  description:
    'Learn how GuardianClaw protects your privacy with our zero-knowledge architecture and minimal data collection approach.',
}

const sections = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'data-we-collect', title: 'Data We Collect' },
  { id: 'data-we-dont-collect', title: "Data We Don't Collect" },
  { id: 'how-we-use-data', title: 'How We Use Your Data' },
  { id: 'data-security', title: 'Data Security' },
  { id: 'your-rights', title: 'Your Rights' },
  { id: 'data-retention', title: 'Data Retention' },
  { id: 'third-parties', title: 'Third-Party Services' },
  { id: 'changes', title: 'Changes to This Policy' },
  { id: 'contact', title: 'Contact Us' },
]

export default function PrivacyPage() {
  return (
    <div className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-12">
            <div className="text-claw-500 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Legal</span>
            </div>
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl">Privacy Policy</h1>
            <p className="text-muted-foreground text-lg">Last updated: January 10, 2026</p>
          </div>

          {/* Table of Contents */}
          <nav className="bg-muted/30 mb-12 rounded-2xl border p-6">
            <h2 className="mb-4 font-semibold">Table of Contents</h2>
            <ul className="space-y-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="prose prose-gray dark:prose-invert max-w-none">
            {/* Introduction */}
            <section id="introduction" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                At GuardianClaw, we believe privacy is a fundamental right, not a feature. Our
                platform is designed with a <strong>zero-knowledge architecture</strong> that
                minimizes data collection and maximizes your control over your information.
              </p>
              <p className="text-muted-foreground">
                This Privacy Policy explains how GuardianClaw (&quot;we,&quot; &quot;us,&quot; or
                &quot;our&quot;) collects, uses, and protects your information when you use our
                platform at guardianclaw.org and related services.
              </p>
            </section>

            {/* Data We Collect */}
            <section id="data-we-collect" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">2. Data We Collect</h2>
              <p className="text-muted-foreground mb-6">
                We follow the principle of <strong>data minimization</strong>. We only collect what
                is absolutely necessary to provide our services.
              </p>

              <div className="space-y-4">
                <div className="bg-background rounded-xl border p-4">
                  <h3 className="mb-2 font-semibold">Wallet Address</h3>
                  <p className="text-muted-foreground text-sm">
                    Your Solana wallet address serves as your pseudonymous identity. Wallet
                    addresses are public by nature on the blockchain.
                  </p>
                </div>

                <div className="bg-background rounded-xl border p-4">
                  <h3 className="mb-2 font-semibold">Agent Configurations</h3>
                  <p className="text-muted-foreground text-sm">
                    The agents you build, including node configurations and flow data. This data is
                    encrypted and associated with your wallet address.
                  </p>
                </div>

                <div className="bg-background rounded-xl border p-4">
                  <h3 className="mb-2 font-semibold">Usage Analytics</h3>
                  <p className="text-muted-foreground text-sm">
                    Aggregated, anonymized usage metrics to improve our platform. This includes page
                    views, feature usage, and error rates (never individual user behavior).
                  </p>
                </div>

                <div className="bg-background rounded-xl border p-4">
                  <h3 className="mb-2 font-semibold">Subscription Status</h3>
                  <p className="text-muted-foreground text-sm">
                    If you subscribe to a paid plan, we track your subscription tier and status for
                    access control purposes.
                  </p>
                </div>
              </div>
            </section>

            {/* Data We Don't Collect */}
            <section id="data-we-dont-collect" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">3. Data We Don&apos;t Collect</h2>
              <p className="text-muted-foreground mb-6">
                Unlike traditional platforms, GuardianClaw is designed to <strong>not</strong>{' '}
                collect sensitive personal information. We eliminate entire categories of data risk.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Lock, items: ['Passwords', 'Email addresses', 'Phone numbers'] },
                  { icon: Eye, items: ['Real names', 'Physical addresses', 'Government IDs'] },
                  { icon: Shield, items: ['Credit card data', 'Bank account info', 'SSN/Tax IDs'] },
                  {
                    icon: Trash2,
                    items: ['Biometric data', 'Location tracking', 'Device fingerprints'],
                  },
                ].map((group, idx) => (
                  <div key={idx} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                    <group.icon className="mb-3 h-5 w-5 text-red-500" />
                    <ul className="space-y-1">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="text-muted-foreground flex items-center gap-2 text-sm"
                        >
                          <span className="text-red-500">✕</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p className="text-muted-foreground mt-6 text-sm">
                By not collecting this data, we eliminate 100% of traditional PII risk and the
                entire PCI-DSS compliance limits.
              </p>
            </section>

            {/* How We Use Data */}
            <section id="how-we-use-data" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">4. How We Use Your Data</h2>
              <p className="text-muted-foreground mb-4">
                The limited data we collect is used exclusively for:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>Providing and maintaining our services</li>
                <li>Authenticating your access to your agents and data</li>
                <li>Processing your subscription and access tier</li>
                <li>Improving platform performance and reliability</li>
                <li>Preventing fraud and abuse</li>
                <li>Complying with legal obligations</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We <strong>never</strong> sell your data, use it for advertising, or share it with
                third parties for their marketing purposes.
              </p>
            </section>

            {/* Data Security */}
            <section id="data-security" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">5. Data Security</h2>
              <p className="text-muted-foreground mb-6">
                We implement industry-leading security measures to protect your data:
              </p>

              <div className="bg-claw-500/5 border-claw-500/20 mb-6 rounded-2xl border p-6">
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <Lock className="text-claw-500 h-5 w-5" />
                  Zero-Knowledge API Key Storage
                </h3>
                <p className="text-muted-foreground text-sm">
                  Your LLM API keys (OpenAI, Anthropic, etc.) are encrypted client-side before
                  leaving your browser. We <strong>never</strong> see your plaintext API keys. They
                  are encrypted using a key derived from your wallet signature with AES-256-GCM, and
                  only decrypted on your device when needed.
                </p>
              </div>

              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>All data encrypted in transit (TLS 1.3)</li>
                <li>All data encrypted at rest (AES-256)</li>
                <li>Row-level security (RLS) in our database</li>
                <li>Regular security audits and penetration testing</li>
                <li>SOC 2 Type II certification (in progress)</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section id="your-rights" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">6. Your Rights</h2>
              <p className="text-muted-foreground mb-6">
                Under GDPR and similar regulations, you have the following rights:
              </p>

              <div className="space-y-4">
                <div className="bg-background flex items-start gap-4 rounded-xl border p-4">
                  <Eye className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Right to Access</h3>
                    <p className="text-muted-foreground text-sm">
                      Request a copy of all data we hold about you.
                    </p>
                  </div>
                </div>

                <div className="bg-background flex items-start gap-4 rounded-xl border p-4">
                  <Download className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Right to Portability</h3>
                    <p className="text-muted-foreground text-sm">
                      Export your data in a machine-readable format (JSON).
                    </p>
                  </div>
                </div>

                <div className="bg-background flex items-start gap-4 rounded-xl border p-4">
                  <Trash2 className="text-claw-500 mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Right to Erasure</h3>
                    <p className="text-muted-foreground text-sm">
                      Request deletion of all your data. Note: Some data may be retained for legal
                      compliance (e.g., transaction records for tax purposes).
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-muted-foreground mt-6">
                To exercise these rights, contact us at{' '}
                <a href="mailto:privacy@guardianclaw.org" className="text-claw-500 hover:underline">
                  privacy@guardianclaw.org
                </a>
              </p>
            </section>

            {/* Data Retention */}
            <section id="data-retention" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">7. Data Retention</h2>
              <p className="text-muted-foreground mb-4">
                We retain your data only as long as necessary:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>
                  <strong>Account data:</strong> Until you request deletion
                </li>
                <li>
                  <strong>Agent configurations:</strong> Until you delete them or your account
                </li>
                <li>
                  <strong>Usage analytics:</strong> Aggregated data retained indefinitely
                  (non-personal)
                </li>
                <li>
                  <strong>Transaction records:</strong> 7 years (legal requirement)
                </li>
                <li>
                  <strong>Deletion audit logs:</strong> Retained for GDPR compliance proof
                </li>
              </ul>
            </section>

            {/* Third Parties */}
            <section id="third-parties" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">8. Third-Party Services</h2>
              <p className="text-muted-foreground mb-4">
                We use the following third-party services to operate our platform:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>
                  <strong>Cloudflare:</strong> CDN, DDoS protection, and edge computing
                </li>
                <li>
                  <strong>Supabase:</strong> Database and authentication infrastructure
                </li>
                <li>
                  <strong>Modal:</strong> Agent runtime execution (isolated containers)
                </li>
                <li>
                  <strong>Solana:</strong> Blockchain for authentication and payments
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                When you use LLM providers (OpenAI, Anthropic, etc.) through your agents, your
                prompts and responses are subject to their respective privacy policies. We recommend
                reviewing their policies before use.
              </p>
            </section>

            {/* Changes */}
            <section id="changes" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">9. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the new policy on this page and updating the &quot;Last
                updated&quot; date. We encourage you to review this policy periodically.
              </p>
            </section>

            {/* Contact */}
            <section id="contact" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">10. Contact Us</h2>
              <p className="text-muted-foreground mb-6">
                If you have any questions about this Privacy Policy or our data practices, please
                contact us:
              </p>

              <div className="bg-background rounded-2xl border p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Mail className="text-claw-500 h-5 w-5" />
                  <a
                    href="mailto:privacy@guardianclaw.org"
                    className="text-claw-500 font-medium hover:underline"
                  >
                    privacy@guardianclaw.org
                  </a>
                </div>
                <p className="text-muted-foreground text-sm">
                  We aim to respond to all privacy-related inquiries within 30 days.
                </p>
              </div>
            </section>
          </div>

          {/* Footer Links */}
          <div className="text-muted-foreground mt-16 flex flex-wrap gap-6 border-t pt-8 text-sm">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/security" className="hover:text-foreground transition-colors">
              Security
            </Link>
            <Link href="/compliance" className="hover:text-foreground transition-colors">
              Compliance
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
