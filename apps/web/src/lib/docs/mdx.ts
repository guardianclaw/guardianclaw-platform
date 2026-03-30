/**
 * MDX Content Loader
 *
 * Handles loading and parsing of MDX documentation files.
 * Uses gray-matter for frontmatter parsing.
 *
 * File structure expected:
 * content/docs/
 * ├── introduction.mdx
 * ├── products/
 * │   └── memory-shield.mdx
 * └── integrations/
 *     └── voltagent.mdx
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { DocFrontmatter, DocPageWithContent, DocWithMetadata } from './types'

/** Base directory for documentation content */
const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs')

/** File extension for documentation files */
const FILE_EXTENSION = '.mdx'

/**
 * Resolves a slug to its file path.
 * Handles both root-level and nested slugs.
 *
 * @param slug - Document slug (e.g., 'introduction' or 'integrations/voltagent')
 * @returns Absolute path to the MDX file
 */
function getFilePath(slug: string): string {
  // Handle nested slugs (e.g., 'integrations/voltagent' -> 'integrations/voltagent.mdx')
  const filePath = path.join(CONTENT_DIR, `${slug}${FILE_EXTENSION}`)
  return filePath
}

/**
 * Checks if a documentation file exists for the given slug.
 *
 * @param slug - Document slug to check
 * @returns true if file exists, false otherwise
 */
export function docExists(slug: string): boolean {
  const filePath = getFilePath(slug)
  return fs.existsSync(filePath)
}

/**
 * Loads a single documentation page by slug.
 * Parses frontmatter and returns the content.
 *
 * @param slug - Document slug (e.g., 'introduction' or 'integrations/voltagent')
 * @returns DocPageWithContent if found, null otherwise
 */
export function getDocBySlug(slug: string): DocPageWithContent | null {
  const filePath = getFilePath(slug)

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    // Read and parse the file
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(fileContent)

    // Validate frontmatter has required fields
    const frontmatter = data as DocFrontmatter
    if (!frontmatter.title) {
      console.warn(`Warning: Missing title in frontmatter for ${slug}`)
      frontmatter.title = slug.split('/').pop() || slug
    }

    return {
      slug,
      title: frontmatter.title,
      description: frontmatter.description,
      content: content.trim(),
      frontmatter,
    }
  } catch (error) {
    console.error(`Error loading doc ${slug}:`, error)
    return null
  }
}

/**
 * Gets all documentation files recursively.
 * Used for sitemap generation and static paths.
 *
 * @returns Array of all document slugs
 */
export function getAllDocSlugsFromFiles(): string[] {
  const slugs: string[] = []

  function walkDir(dir: string, prefix: string = '') {
    if (!fs.existsSync(dir)) {
      return
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const newPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
        walkDir(entryPath, newPrefix)
      } else if (entry.isFile() && entry.name.endsWith(FILE_EXTENSION)) {
        // Add file slug (without extension)
        const fileName = entry.name.replace(FILE_EXTENSION, '')
        const slug = prefix ? `${prefix}/${fileName}` : fileName
        slugs.push(slug)
      }
    }
  }

  walkDir(CONTENT_DIR)
  return slugs
}

/**
 * Gets all documentation with full content and metadata.
 * Useful for search indexing or bulk operations.
 *
 * @returns Array of all documents with content
 */
export function getAllDocs(): DocWithMetadata[] {
  const slugs = getAllDocSlugsFromFiles()
  const docs: DocWithMetadata[] = []

  for (const slug of slugs) {
    const doc = getDocBySlug(slug)
    if (doc) {
      docs.push({
        slug: doc.slug,
        frontmatter: doc.frontmatter,
        content: doc.content,
      })
    }
  }

  return docs
}

/**
 * Gets the raw MDX content for a slug without parsing.
 * Used when you need to pass content to next-mdx-remote.
 *
 * @param slug - Document slug
 * @returns Raw file content or null if not found
 */
export function getRawContent(slug: string): string | null {
  const filePath = getFilePath(slug)

  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    console.error(`Error reading raw content for ${slug}:`, error)
    return null
  }
}

/**
 * Extracts frontmatter from raw MDX content.
 * Useful when you already have the raw content.
 *
 * @param rawContent - Raw MDX file content
 * @returns Parsed frontmatter and content
 */
export function parseFrontmatter(rawContent: string): {
  frontmatter: DocFrontmatter
  content: string
} {
  const { data, content } = matter(rawContent)
  return {
    frontmatter: data as DocFrontmatter,
    content: content.trim(),
  }
}
