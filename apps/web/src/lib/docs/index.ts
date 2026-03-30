/**
 * Documentation System - Public API
 *
 * This module provides the public interface for the documentation system.
 * It abstracts the underlying MDX loading and navigation logic.
 *
 * IMPORTANT: This file is used by both client and server components.
 * Server-only functions (that use fs) are imported dynamically.
 *
 * Usage:
 * ```typescript
 * import { getDocPage, getAllDocSlugs, getDocNavigation } from '@/lib/docs'
 *
 * // Get navigation structure (client-safe)
 * const navigation = getDocNavigation()
 *
 * // Get all slugs (server-only in practice, but works during SSG)
 * const slugs = getAllDocSlugs()
 *
 * // Get a single page (server-only)
 * const page = getDocPage('integrations/voltagent')
 * ```
 */

// Re-export types for consumers
export type { DocPage, DocSection, DocFrontmatter, DocPageWithContent } from './types'

// Import navigation (client-safe - no fs usage)
import { docsNavigation, getAllSlugsFromNavigation, findPageInNavigation } from './navigation'
import type { DocPage, DocSection } from './types'

/**
 * Gets the documentation navigation structure.
 * This is client-safe and can be used in any component.
 *
 * @returns Array of navigation sections with their items
 */
export function getDocNavigation(): DocSection[] {
  return docsNavigation
}

// Re-export navigation for direct access if needed
export { docsNavigation }

/**
 * Gets all documentation slugs.
 * This uses static data and is client-safe during SSG.
 *
 * @returns Array of unique slugs, ordered by navigation
 */
export function getAllDocSlugs(): string[] {
  return getAllSlugsFromNavigation()
}

/**
 * Gets a documentation page by slug.
 *
 * NOTE: MDX loading requires Node.js fs module and only works on server.
 * Server components should use getDocPageServer() from './server' for MDX support.
 *
 * @param slug - Document slug (e.g., 'introduction' or 'integrations/voltagent')
 * @returns DocPage with content, or null if not found
 */
export function getDocPage(slug: string): (DocPage & { content: string }) | null {
  // Check if slug exists in navigation
  const navPage = findPageInNavigation(slug)
  if (navPage) {
    // Return a placeholder - actual content loaded by server functions
    return {
      slug: navPage.slug,
      title: navPage.title,
      description: navPage.description,
      content: `# ${navPage.title}\n\nLoading content...`,
    }
  }

  return null
}

/**
 * Check if a document exists in navigation.
 *
 * @param slug - Document slug to check
 * @returns true if slug exists in navigation
 */
export function hasDocContent(slug: string): boolean {
  return findPageInNavigation(slug) !== null
}

/**
 * Get migration status.
 * All documentation is now in MDX format.
 */
export function getMigrationStatus(): {
  total: number
  migrated: number
  legacy: number
  percentage: number
} {
  const allSlugs = getAllSlugsFromNavigation()

  return {
    total: allSlugs.length,
    migrated: allSlugs.length,
    legacy: 0,
    percentage: 100,
  }
}
