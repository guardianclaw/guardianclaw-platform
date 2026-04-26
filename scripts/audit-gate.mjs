#!/usr/bin/env node
// Production-tree CVE gate.
// Reads an `npm audit --omit=dev --json` payload (from stdin or a file path
// passed as argv[2]) and fails if any high/critical GHSA is not present in
// .github/audit-allowlist.json. The allowlist is the single source of truth
// for accepted backlog items; new vulns appearing in the tree must either be
// fixed or explicitly allowlisted with a rationale.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const allowlistPath = resolve(repoRoot, '.github/audit-allowlist.json')

async function readStream(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

let raw
const inputArg = process.argv[2]
if (inputArg && inputArg !== '-') {
  raw = await readFile(resolve(inputArg), 'utf8')
} else {
  raw = await readStream(process.stdin)
}

if (!raw.trim()) {
  console.error('No npm audit JSON received on stdin or file argument.')
  console.error('Usage: npm audit --omit=dev --json | node scripts/audit-gate.mjs')
  console.error('   or: node scripts/audit-gate.mjs path/to/audit.json')
  process.exit(2)
}

let auditJson
try {
  auditJson = JSON.parse(raw)
} catch (err) {
  console.error('Failed to parse npm audit output as JSON:', err.message)
  console.error(raw.slice(0, 500))
  process.exit(2)
}

const allowlist = JSON.parse(await readFile(allowlistPath, 'utf8'))
const allowed = new Map(allowlist.allowed_advisories.map((entry) => [entry.ghsa, entry]))

const advisories = []
const v = auditJson.vulnerabilities || {}
for (const [packageName, info] of Object.entries(v)) {
  if (!['high', 'critical'].includes(info.severity)) continue
  const viaList = Array.isArray(info.via) ? info.via : [info.via]
  for (const via of viaList) {
    if (typeof via !== 'object' || !via.url) continue
    if (!['high', 'critical'].includes(via.severity)) continue
    const match = via.url.match(/GHSA-[\w-]+/)
    if (!match) continue
    advisories.push({
      ghsa: match[0],
      severity: via.severity,
      package: via.name || packageName,
      title: via.title || '',
    })
  }
}

const seen = new Set()
const unique = advisories.filter((a) => {
  const key = `${a.ghsa}|${a.package}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

console.log(`Found ${unique.length} distinct high/critical advisories in production tree.`)

const unallowed = unique.filter((a) => !allowed.has(a.ghsa))
const stale = []
for (const entry of allowlist.allowed_advisories) {
  if (!unique.some((a) => a.ghsa === entry.ghsa)) stale.push(entry)
}

if (unallowed.length > 0) {
  console.error('\n=== UNALLOWED HIGH/CRITICAL ADVISORIES ===')
  for (const a of unallowed) {
    console.error(`  ${a.severity.toUpperCase()} ${a.ghsa} ${a.package} — ${a.title}`)
  }
  console.error(
    '\nFix the vulnerability or add an entry (with rationale + review_by) to .github/audit-allowlist.json.'
  )
  process.exit(1)
}

console.log('\n=== Allowlisted advisories accounted for ===')
for (const a of unique) {
  const entry = allowed.get(a.ghsa)
  console.log(
    `  ${a.severity.toUpperCase()} ${a.ghsa} ${a.package} — review_by ${entry.review_by}`
  )
}

if (stale.length > 0) {
  console.warn('\n=== Stale allowlist entries (no longer present in audit) ===')
  for (const entry of stale) {
    console.warn(`  ${entry.ghsa} ${entry.package} — remove from allowlist`)
  }
  // Stale entries are a warning, not a failure; the audit is the source of truth.
}

console.log('\nAudit gate passed.')
