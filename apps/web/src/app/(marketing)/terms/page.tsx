import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, AlertTriangle, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service | GuardianClaw',
  description: 'Terms and conditions for using the GuardianClaw platform and services.',
}

const sections = [
  { id: 'acceptance', title: 'Acceptance of Terms' },
  { id: 'eligibility', title: 'Eligibility' },
  { id: 'account', title: 'Your Account' },
  { id: 'services', title: 'Our Services' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'intellectual-property', title: 'Intellectual Property' },
  { id: 'third-party', title: 'Third-Party Services' },
  { id: 'payment', title: 'Payment Terms' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'limitation', title: 'Limitation of Liability' },
  { id: 'indemnification', title: 'Indemnification' },
  { id: 'termination', title: 'Termination' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'changes', title: 'Changes to Terms' },
  { id: 'contact', title: 'Contact' },
]

export default function TermsPage() {
  return (
    <div className="py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-12">
            <div className="text-claw-500 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">Legal</span>
            </div>
            <h1 className="mb-4 text-4xl font-bold sm:text-5xl">Terms of Service</h1>
            <p className="text-muted-foreground text-lg">Last updated: January 10, 2026</p>
          </div>

          {/* Important Notice */}
          <div className="mb-12 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-yellow-500" />
              <div>
                <h2 className="mb-2 font-semibold">Please Read Carefully</h2>
                <p className="text-muted-foreground text-sm">
                  By accessing or using GuardianClaw, you agree to be bound by these Terms of
                  Service. If you do not agree to these terms, please do not use our services.
                </p>
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <nav className="bg-muted/30 mb-12 rounded-2xl border p-6">
            <h2 className="mb-4 font-semibold">Table of Contents</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="prose prose-gray dark:prose-invert max-w-none">
            {/* Acceptance */}
            <section id="acceptance" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground mb-4">
                These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement
                between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and
                GuardianClaw (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
                &quot;our&quot;) governing your access to and use of the GuardianClaw platform,
                including our website at guardianclaw.org, APIs, and related services (collectively,
                the &quot;Services&quot;).
              </p>
              <p className="text-muted-foreground">
                By connecting your wallet, accessing, or using our Services, you acknowledge that
                you have read, understood, and agree to be bound by these Terms and our{' '}
                <Link href="/privacy" className="text-claw-500 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            {/* Eligibility */}
            <section id="eligibility" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">2. Eligibility</h2>
              <p className="text-muted-foreground mb-4">To use our Services, you must:</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>
                  Be at least 18 years of age or the age of legal majority in your jurisdiction
                </li>
                <li>Have the legal capacity to enter into a binding agreement</li>
                <li>Not be prohibited from using the Services under applicable laws</li>
                <li>Not be located in a jurisdiction where use of our Services is prohibited</li>
                <li>Have a compatible Solana wallet for authentication</li>
              </ul>
            </section>

            {/* Account */}
            <section id="account" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">3. Your Account</h2>
              <p className="text-muted-foreground mb-4">
                Your Solana wallet address serves as your unique identifier on our platform. You are
                responsible for:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>Maintaining the security of your wallet and private keys</li>
                <li>All activities that occur under your wallet address</li>
                <li>Immediately notifying us of any unauthorized use</li>
                <li>Ensuring your wallet signature authentication is secure</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We are not responsible for any loss or damage arising from your failure to protect
                your wallet credentials.
              </p>
            </section>

            {/* Services */}
            <section id="services" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">4. Our Services</h2>
              <p className="text-muted-foreground mb-4">GuardianClaw provides:</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>A visual builder for creating AI agents with safety guardrails</li>
                <li>
                  The CLAW (Credibility-Limits-Avoidance-Worth) protocol for AI decision validation
                </li>
                <li>APIs for integrating GuardianClaw safety into your applications</li>
                <li>Agent deployment and hosting services</li>
                <li>Governance participation through the $GCLAW token</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                We reserve the right to modify, suspend, or discontinue any part of our Services at
                any time, with or without notice.
              </p>
            </section>

            {/* Acceptable Use */}
            <section id="acceptable-use" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">5. Acceptable Use</h2>
              <p className="text-muted-foreground mb-4">You agree NOT to use our Services to:</p>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
                <ul className="text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Create agents that generate illegal, harmful, or malicious content
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Bypass or attempt to bypass GuardianClaw safety guardrails
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Engage in fraud, phishing, or deceptive practices
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Infringe on intellectual property rights of others
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Attempt to gain unauthorized access to our systems
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Interfere with the operation of our Services
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Violate applicable laws or regulations
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-red-500">✕</span>
                    Resell or redistribute our Services without authorization
                  </li>
                </ul>
              </div>
              <p className="text-muted-foreground mt-4">
                We reserve the right to suspend or terminate your access for violations of these
                terms without prior notice.
              </p>
            </section>

            {/* Intellectual Property */}
            <section id="intellectual-property" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">6. Intellectual Property</h2>
              <p className="text-muted-foreground mb-4">
                <strong>Our Property:</strong> The GuardianClaw platform, including its code,
                design, documentation, and branding, is owned by GuardianClaw Team. Portions of our
                codebase are open-source under the MIT License.
              </p>
              <p className="text-muted-foreground mb-4">
                <strong>Your Property:</strong> You retain ownership of the agents you create,
                including your custom configurations and flows. By using our Services, you grant us
                a limited license to host and execute your agents as part of the service.
              </p>
              <p className="text-muted-foreground">
                <strong>Open Source:</strong> Our open-source components are available under the MIT
                License at{' '}
                <a
                  href="https://github.com/guardianclaw/guardianclaw-platform"
                  className="text-claw-500 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/guardianclaw/guardianclaw-platform
                </a>
                .
              </p>
            </section>

            {/* Third Party */}
            <section id="third-party" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">7. Third-Party Services</h2>
              <p className="text-muted-foreground mb-4">
                Our Services integrate with third-party providers, including:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>
                  <strong>LLM Providers:</strong> OpenAI, Anthropic, and others (you provide your
                  own API keys)
                </li>
                <li>
                  <strong>Blockchain:</strong> Solana network for authentication and payments
                </li>
                <li>
                  <strong>Infrastructure:</strong> Cloudflare, Supabase, Modal
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Your use of these third-party services is subject to their respective terms and
                privacy policies. We are not responsible for the practices or content of third-party
                services.
              </p>
            </section>

            {/* Payment */}
            <section id="payment" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">8. Payment Terms</h2>
              <p className="text-muted-foreground mb-4">
                Certain features require a paid subscription. Payment terms include:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>Payments are processed in cryptocurrency (SOL, USDC, or $GCLAW)</li>
                <li>Subscriptions renew automatically unless cancelled</li>
                <li>Prices are subject to change with 30 days notice</li>
                <li>Refunds are generally not provided for cryptocurrency payments</li>
                <li>$GCLAW token payments receive a 20% discount on subscription pricing</li>
              </ul>
            </section>

            {/* Disclaimers */}
            <section id="disclaimers" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">9. Disclaimers</h2>
              <div className="bg-muted/30 rounded-2xl border p-6">
                <p className="text-muted-foreground mb-4">
                  <strong>
                    THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                    WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                  </strong>
                </p>
                <p className="text-muted-foreground mb-4">We do not warrant that:</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-2">
                  <li>The Services will meet your specific requirements</li>
                  <li>The Services will be uninterrupted, timely, secure, or error-free</li>
                  <li>AI safety guardrails will prevent all harmful outputs</li>
                  <li>Results from using the Services will be accurate or reliable</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  AI systems, including those protected by GuardianClaw, can produce unexpected or
                  undesired outputs. You are responsible for reviewing and validating all
                  AI-generated content before use.
                </p>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section id="limitation" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">10. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-4">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>
                  We shall not be liable for any indirect, incidental, special, consequential, or
                  punitive damages
                </li>
                <li>
                  Our total liability shall not exceed the amount you paid us in the 12 months
                  preceding the claim
                </li>
                <li>We are not liable for any loss of cryptocurrency, tokens, or digital assets</li>
                <li>We are not liable for actions taken by AI agents you create or deploy</li>
              </ul>
            </section>

            {/* Indemnification */}
            <section id="indemnification" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">11. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify, defend, and hold harmless GuardianClaw and its team members
                from any claims, damages, losses, or expenses (including legal fees) arising from:
                your use of the Services, your violation of these Terms, your AI agents&apos;
                outputs or actions, or your infringement of any third-party rights.
              </p>
            </section>

            {/* Termination */}
            <section id="termination" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">12. Termination</h2>
              <p className="text-muted-foreground mb-4">
                Either party may terminate this agreement at any time:
              </p>
              <ul className="text-muted-foreground list-inside list-disc space-y-2">
                <li>You may stop using our Services at any time</li>
                <li>We may suspend or terminate your access for Terms violations</li>
                <li>We may terminate for any reason with 30 days notice</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Upon termination, your right to use the Services ceases immediately. You may request
                export of your data before termination.
              </p>
            </section>

            {/* Governing Law */}
            <section id="governing-law" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">13. Governing Law</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with applicable law,
                without regard to conflict of law principles. Any disputes arising from these Terms
                shall be resolved through binding arbitration, except where prohibited by law.
              </p>
            </section>

            {/* Changes */}
            <section id="changes" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">14. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these Terms from time to time. We will notify you of material changes
                by posting the updated Terms on this page with a new &quot;Last updated&quot; date.
                Your continued use of the Services after changes constitutes acceptance of the new
                Terms.
              </p>
            </section>

            {/* Contact */}
            <section id="contact" className="mb-12">
              <h2 className="mb-4 text-2xl font-bold">15. Contact</h2>
              <p className="text-muted-foreground mb-6">
                For questions about these Terms, please contact us:
              </p>

              <div className="bg-background rounded-2xl border p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Mail className="text-claw-500 h-5 w-5" />
                  <a
                    href="mailto:legal@guardianclaw.org"
                    className="text-claw-500 font-medium hover:underline"
                  >
                    legal@guardianclaw.org
                  </a>
                </div>
                <p className="text-muted-foreground text-sm">
                  We aim to respond to all inquiries within 10 business days.
                </p>
              </div>
            </section>
          </div>

          {/* Footer Links */}
          <div className="text-muted-foreground mt-16 flex flex-wrap gap-6 border-t pt-8 text-sm">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
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
