import { Metadata } from 'next'
import {
  HeroSection,
  ProductsGrid,
  IntegrationsCarousel,
  HowItWorks,
  UseCasesSection,
  ComplianceBanner,
  CTASection,
} from '@/components/marketing/home'

export const metadata: Metadata = {
  title: 'GuardianClaw | Decision Firewall for AI Agents',
  description:
    'Build, deploy, and protect AI agents with enterprise-grade safety. The CLAW protocol validates every input and output to stop jailbreaks, prevent harmful actions, and ensure compliance.',
  openGraph: {
    title: 'GuardianClaw | Decision Firewall for AI Agents',
    description: 'Build, deploy, and protect AI agents with enterprise-grade safety.',
    type: 'website',
    url: 'https://guardianclaw.org',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuardianClaw | Decision Firewall for AI Agents',
    description: 'Build, deploy, and protect AI agents with enterprise-grade safety.',
  },
}

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProductsGrid />
      <IntegrationsCarousel />
      <HowItWorks />
      <UseCasesSection />
      <ComplianceBanner />
      <CTASection />
    </>
  )
}
