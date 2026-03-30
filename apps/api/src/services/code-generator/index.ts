/**
 * Code Generator Service
 * Generates downloadable project scaffolds for agents
 */

import type { AgentData, GeneratedFile, TemplateGenerator, ExportOptions } from './types'
import { openaiAgentsTemplate } from './templates/openai-agents'
import { coinbaseTemplate } from './templates/coinbase'
import { solanaTemplate } from './templates/solana'
import { googleAdkTemplate } from './templates/google-adk'
import { virtualsTemplate } from './templates/virtuals'
import { elizaosTemplate } from './templates/elizaos'
import { sanitizeAgentName } from './utils'

// Re-export types
export type { AgentData, GeneratedFile, ExportOptions } from './types'

/**
 * Registry of all available template generators
 */
const templateRegistry: Map<string, TemplateGenerator> = new Map([
  ['openai_agents', openaiAgentsTemplate],
  ['coinbase_agentkit', coinbaseTemplate],
  ['solana_agent_kit', solanaTemplate],
  ['google_adk', googleAdkTemplate],
  ['virtuals_protocol', virtualsTemplate],
  ['elizaos', elizaosTemplate],
])

/**
 * Check if a framework has export support
 */
export function hasExportSupport(framework: string): boolean {
  return templateRegistry.has(framework)
}

/**
 * Get the output language for a framework
 */
export function getFrameworkLanguage(framework: string): 'python' | 'typescript' | null {
  const template = templateRegistry.get(framework)
  return template?.language ?? null
}

/**
 * Get list of supported frameworks
 */
export function getSupportedFrameworks(): string[] {
  return Array.from(templateRegistry.keys())
}

/**
 * Generate project files for an agent
 */
export function generateProjectFiles(agent: AgentData, options?: ExportOptions): GeneratedFile[] {
  const template = templateRegistry.get(agent.framework)

  if (!template) {
    throw new Error(`Export not supported for framework: ${agent.framework}`)
  }

  const files = template.generate(agent)

  // Optionally include flow.json
  if (options?.includeFlow && agent.flow) {
    files.push({
      path: 'flow.json',
      content: JSON.stringify(agent.flow, null, 2),
    })
  }

  return files
}

/**
 * Create a ZIP buffer from generated files
 * Uses a simple ZIP implementation suitable for Cloudflare Workers
 */
export async function createZipBuffer(
  files: GeneratedFile[],
  folderName: string
): Promise<Uint8Array> {
  // Simple ZIP file structure
  // Note: This is a minimal implementation for Cloudflare Workers
  // For production, consider using a more robust library

  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const centralDirectory: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const path = `${folderName}/${file.path}`
    const pathBytes = encoder.encode(path)
    const contentBytes = encoder.encode(file.content)

    // Local file header
    const localHeader = createLocalFileHeader(pathBytes, contentBytes)
    chunks.push(localHeader)

    // File content
    chunks.push(contentBytes)

    // Central directory entry
    const cdEntry = createCentralDirectoryEntry(pathBytes, contentBytes, offset)
    centralDirectory.push(cdEntry)

    offset += localHeader.length + contentBytes.length
  }

  // Central directory
  const cdOffset = offset
  let cdSize = 0
  for (const entry of centralDirectory) {
    chunks.push(entry)
    cdSize += entry.length
  }

  // End of central directory
  const eocd = createEndOfCentralDirectory(files.length, cdSize, cdOffset)
  chunks.push(eocd)

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let position = 0
  for (const chunk of chunks) {
    result.set(chunk, position)
    position += chunk.length
  }

  return result
}

/**
 * Create a local file header for ZIP
 */
function createLocalFileHeader(path: Uint8Array, content: Uint8Array): Uint8Array {
  const crc = crc32(content)
  const header = new Uint8Array(30 + path.length)
  const view = new DataView(header.buffer)

  // Signature
  view.setUint32(0, 0x04034b50, true)
  // Version needed
  view.setUint16(4, 20, true)
  // General worth bit flag
  view.setUint16(6, 0, true)
  // Compression method (0 = stored)
  view.setUint16(8, 0, true)
  // Last mod time
  view.setUint16(10, 0, true)
  // Last mod date
  view.setUint16(12, 0, true)
  // CRC-32
  view.setUint32(14, crc, true)
  // Compressed size
  view.setUint32(18, content.length, true)
  // Uncompressed size
  view.setUint32(22, content.length, true)
  // File name length
  view.setUint16(26, path.length, true)
  // Extra field length
  view.setUint16(28, 0, true)
  // File name
  header.set(path, 30)

  return header
}

/**
 * Create a central directory entry for ZIP
 */
function createCentralDirectoryEntry(
  path: Uint8Array,
  content: Uint8Array,
  localHeaderOffset: number
): Uint8Array {
  const crc = crc32(content)
  const entry = new Uint8Array(46 + path.length)
  const view = new DataView(entry.buffer)

  // Signature
  view.setUint32(0, 0x02014b50, true)
  // Version made by
  view.setUint16(4, 20, true)
  // Version needed
  view.setUint16(6, 20, true)
  // General worth bit flag
  view.setUint16(8, 0, true)
  // Compression method
  view.setUint16(10, 0, true)
  // Last mod time
  view.setUint16(12, 0, true)
  // Last mod date
  view.setUint16(14, 0, true)
  // CRC-32
  view.setUint32(16, crc, true)
  // Compressed size
  view.setUint32(20, content.length, true)
  // Uncompressed size
  view.setUint32(24, content.length, true)
  // File name length
  view.setUint16(28, path.length, true)
  // Extra field length
  view.setUint16(30, 0, true)
  // File comment length
  view.setUint16(32, 0, true)
  // Disk number start
  view.setUint16(34, 0, true)
  // Internal file attributes
  view.setUint16(36, 0, true)
  // External file attributes
  view.setUint32(38, 0, true)
  // Relative offset of local header
  view.setUint32(42, localHeaderOffset, true)
  // File name
  entry.set(path, 46)

  return entry
}

/**
 * Create end of central directory record
 */
function createEndOfCentralDirectory(
  fileCount: number,
  cdSize: number,
  cdOffset: number
): Uint8Array {
  const eocd = new Uint8Array(22)
  const view = new DataView(eocd.buffer)

  // Signature
  view.setUint32(0, 0x06054b50, true)
  // Number of this disk
  view.setUint16(4, 0, true)
  // Disk where central directory starts
  view.setUint16(6, 0, true)
  // Number of central directory records on this disk
  view.setUint16(8, fileCount, true)
  // Total number of central directory records
  view.setUint16(10, fileCount, true)
  // Size of central directory
  view.setUint32(12, cdSize, true)
  // Offset of start of central directory
  view.setUint32(16, cdOffset, true)
  // Comment length
  view.setUint16(20, 0, true)

  return eocd
}

/**
 * CRC-32 implementation
 */
function crc32(data: Uint8Array): number {
  const table = getCrc32Table()
  let crc = 0xffffffff

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff]
  }

  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Get or create CRC-32 lookup table
 */
let crc32Table: Uint32Array | null = null
function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table

  crc32Table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crc32Table[i] = c
  }

  return crc32Table
}

/**
 * Export an agent as a ZIP file
 */
export async function exportAgentAsZip(
  agent: AgentData,
  options?: ExportOptions
): Promise<{ buffer: Uint8Array; filename: string }> {
  const files = generateProjectFiles(agent, options)
  const folderName = sanitizeAgentName(agent.name)
  const buffer = await createZipBuffer(files, folderName)

  return {
    buffer,
    filename: `${folderName}.zip`,
  }
}
