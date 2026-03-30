import { MetadataRoute } from 'next'
import { getAllDocSlugs } from '@/lib/docs'
import { products } from '@/lib/products'
import { integrations } from '@/lib/integrations'

// Required for static export
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://guardianclaw.org'
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/integrations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/governance`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ]

  // Product pages
  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // Integration pages (top 20 for sitemap)
  const integrationPages: MetadataRoute.Sitemap = integrations.slice(0, 20).map((integration) => ({
    url: `${baseUrl}/integrations/${integration.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Documentation pages
  const docSlugs = getAllDocSlugs()
  const docPages: MetadataRoute.Sitemap = docSlugs.map((slug) => ({
    url: `${baseUrl}/docs/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Governance proposal pages

  // Use case pages
  const useCasePages: MetadataRoute.Sitemap = [
    { slug: 'crypto', name: 'Crypto & DeFi' },
    { slug: 'enterprise', name: 'Enterprise' },
    { slug: 'robotics', name: 'Robotics' },
  ].map((useCase) => ({
    url: `${baseUrl}/use-cases/${useCase.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...productPages, ...integrationPages, ...docPages, ...useCasePages]
}
