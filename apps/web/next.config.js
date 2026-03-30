const path = require('path')

/**
 * Security Configuration
 * Reference: SECURITY_SPEC.md Section 8.1 and 8.2
 */

const isDev = process.env.NODE_ENV === 'development'

/**
 * Content Security Policy configuration
 *
 * Production CSP is stricter:
 * - No 'unsafe-eval' (only needed for dev hot reload)
 *
 * Development CSP is more permissive:
 * - Includes 'unsafe-eval' for hot module replacement
 *
 * Both require 'unsafe-inline' for Next.js inline scripts
 */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self'
    https://api.guardianclaw.org
    wss://api.guardianclaw.org
    https://*.solana.com
    https://*.helius-rpc.com
    https://api.openai.com
    https://api.anthropic.com
    https://openrouter.ai
    ${isDev ? 'ws://localhost:3000' : ''};
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  ${isDev ? '' : 'upgrade-insecure-requests;'}
`.replace(/\s{2,}/g, ' ').trim()

/**
 * Security headers configuration
 * Reference: SECURITY_SPEC.md Section 8.2
 *
 * All headers follow OWASP recommendations:
 * https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
 */
const securityHeaders = [
  {
    // Prevent clickjacking attacks by denying framing
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    // Enable XSS filter in legacy browsers (modern browsers use CSP)
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    // Control Referer header to prevent information leakage
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    // Disable unnecessary browser features
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
  },
  {
    // Enforce HTTPS with HSTS (1 year, include subdomains, preload eligible)
    // Only in production to avoid issues with local development
    key: 'Strict-Transport-Security',
    value: isDev ? '' : 'max-age=31536000; includeSubDomains; preload'
  },
  {
    // Content Security Policy
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy
  }
].filter(header => header.value !== '') // Remove empty headers (HSTS in dev)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['guardianclaw.org'],
    unoptimized: true,
  },
  // Monorepo root for file tracing (resolve to absolute path)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Type checking configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  // Redirects for legacy whitepaper MDX pages to new single-page whitepaper
  async redirects() {
    return [
      // Whitepaper legacy MDX → new single-page whitepaper
      {
        source: '/docs/whitepaper',
        destination: '/whitepaper',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/problem',
        destination: '/whitepaper#the-problem',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/architecture',
        destination: '/whitepaper#architecture',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/products',
        destination: '/whitepaper#products',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/compliance',
        destination: '/whitepaper#compliance',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/platform',
        destination: '/whitepaper#platform',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/validation',
        destination: '/whitepaper#validation',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/integrations',
        destination: '/whitepaper#integrations',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/competitive',
        destination: '/whitepaper#competitive',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/token',
        destination: '/whitepaper#token',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/governance',
        destination: '/whitepaper#governance',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/research',
        destination: '/whitepaper#research',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/team',
        destination: '/whitepaper#team',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/conclusion',
        destination: '/whitepaper#conclusion',
        permanent: true,
      },
      {
        source: '/docs/whitepaper/references',
        destination: '/whitepaper#references',
        permanent: true,
      },
      // About page removed — redirect to whitepaper
      {
        source: '/about',
        destination: '/whitepaper',
        permanent: true,
      },
    ]
  },
  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
