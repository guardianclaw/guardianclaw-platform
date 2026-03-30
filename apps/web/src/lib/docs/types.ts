/**
 * Documentation Types
 *
 * Core type definitions for the documentation system.
 * These types define the structure of documentation pages,
 * navigation sections, and MDX frontmatter.
 */

/**
 * Frontmatter schema for MDX documentation files.
 * This is parsed from the YAML header of each .mdx file.
 */
export interface DocFrontmatter {
  /** Page title displayed in navigation and browser tab */
  title: string
  /** Brief description for SEO and page headers */
  description: string
  /** Category for grouping (e.g., 'integrations', 'products') */
  category?: string
  /** Sort order within the category (lower = higher in list) */
  order?: number
  /** ISO date string of last content update */
  lastUpdated?: string
  /** Related documentation slugs for cross-linking */
  related?: string[]
  /** Custom OG image path for social sharing */
  ogImage?: string
  /** Whether to show table of contents */
  toc?: boolean
}

/**
 * Represents a single documentation page.
 * Used throughout the docs system for rendering and navigation.
 */
export interface DocPage {
  /** URL-safe identifier (e.g., 'integrations/voltagent') */
  slug: string
  /** Display title */
  title: string
  /** Brief description */
  description?: string
  /** Raw MDX/Markdown content (only present when content is loaded) */
  content?: string
}

/**
 * Extended DocPage with required content field.
 * Used when a page's content has been loaded from disk.
 */
export interface DocPageWithContent extends DocPage {
  /** Raw MDX/Markdown content */
  content: string
  /** Parsed frontmatter metadata */
  frontmatter: DocFrontmatter
}

/**
 * Navigation section grouping related documentation pages.
 * Used to build the sidebar navigation structure.
 */
export interface DocSection {
  /** Section heading displayed in sidebar */
  title: string
  /** Pages within this section */
  items: DocPage[]
}

/**
 * Result of getAllDocs() - includes content and metadata
 */
export interface DocWithMetadata {
  slug: string
  frontmatter: DocFrontmatter
  content: string
}

/**
 * Configuration for the MDX loader
 */
export interface MDXLoaderConfig {
  /** Base directory for content files */
  contentDir: string
  /** File extension to look for */
  extension: string
}
