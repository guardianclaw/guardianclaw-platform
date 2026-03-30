/**
 * Documentation System - Server-Only Functions
 *
 * This module contains functions that require Node.js fs module.
 * These can ONLY be used in:
 * - Server Components
 * - Route Handlers
 * - Server Actions
 * - generateStaticParams
 * - generateMetadata
 *
 * DO NOT import this file in client components or 'use client' files.
 *
 * Usage:
 * ```typescript
 * // In a Server Component or Route Handler
 * import { getDocPageServer, getAllDocSlugsServer } from '@/lib/docs/server'
 *
 * const page = getDocPageServer('integrations/voltagent')
 * ```
 */

import { getDocBySlug, docExists, getAllDocSlugsFromFiles } from './mdx'
import { findPageInNavigation, getAllSlugsFromNavigation } from './navigation'
import type { DocPage } from './types'

/**
 * Gets a documentation page by slug with MDX support.
 * Server-only function that can load MDX files from disk.
 *
 * Resolution order:
 * 1. Try to load from MDX file in content/docs/
 * 2. Return placeholder if in navigation but no content
 *
 * @param slug - Document slug (e.g., 'introduction' or 'integrations/voltagent')
 * @returns DocPage with content, or null if not found
 */
export function getDocPageServer(slug: string): (DocPage & { content: string }) | null {
  // First, try to load from MDX file
  if (docExists(slug)) {
    const mdxDoc = getDocBySlug(slug)
    if (mdxDoc) {
      return {
        slug: mdxDoc.slug,
        title: mdxDoc.title,
        description: mdxDoc.description,
        content: mdxDoc.content,
      }
    }
  }

  // Check if slug exists in navigation but has no content yet
  const navPage = findPageInNavigation(slug)
  if (navPage) {
    return {
      slug: navPage.slug,
      title: navPage.title,
      description: navPage.description,
      content: `# ${navPage.title}\n\nThis page content is not yet available.\n\nPlease check back soon.`,
    }
  }

  return null
}

/**
 * Gets all documentation slugs including MDX files.
 * Server-only function that can scan the filesystem.
 *
 * @returns Array of unique slugs, ordered by navigation
 */
export function getAllDocSlugsServer(): string[] {
  const navSlugs = getAllSlugsFromNavigation()
  const mdxSlugs = getAllDocSlugsFromFiles()

  const allSlugs = new Set([...navSlugs, ...mdxSlugs])

  const ordered: string[] = []
  for (const slug of navSlugs) {
    if (allSlugs.has(slug)) {
      ordered.push(slug)
      allSlugs.delete(slug)
    }
  }

  for (const slug of allSlugs) {
    ordered.push(slug)
  }

  return ordered
}

/**
 * Check if a document has MDX content.
 * Server-only function that can check the filesystem.
 *
 * @param slug - Document slug to check
 * @returns true if MDX file exists
 */
export function isMigratedToMDX(slug: string): boolean {
  return docExists(slug)
}

/**
 * Get migration status with accurate MDX file counts.
 * Server-only function that scans the filesystem.
 */
export function getMigrationStatusServer(): {
  total: number
  migrated: number
  legacy: number
  percentage: number
} {
  const allSlugs = getAllSlugsFromNavigation()
  const migrated = allSlugs.filter((slug) => docExists(slug)).length

  return {
    total: allSlugs.length,
    migrated,
    legacy: allSlugs.length - migrated,
    percentage: Math.round((migrated / allSlugs.length) * 100),
  }
}
