// Companion to scripts/check_pattern_parity.py.
//
// Reads a JSON request from stdin of the form:
//
//   { "family": "<name>", "inputs": ["<text>", ...] }
//
// Loads the matching pattern file at patterns/regex/<name>.json, builds
// JavaScript RegExp objects for every pattern in the family with the
// declared flags, and writes a JSON response of the form:
//
//   { "verdicts": [true, false, ...] }
//
// where each entry is the any-pattern-matches verdict for the corresponding
// input. Exits non-zero if the family is missing or if any pattern fails to
// compile under JavaScript's RegExp constructor.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const regexDir = resolve(root, 'patterns', 'regex')

function readStdin() {
  return new Promise((res, rej) => {
    let buf = ''
    process.stdin.on('data', (chunk) => {
      buf += chunk
    })
    process.stdin.on('end', () => res(buf))
    process.stdin.on('error', rej)
  })
}

const raw = await readStdin()
const { family, inputs } = JSON.parse(raw)
const familyPath = resolve(regexDir, `${family}.json`)
const familyData = JSON.parse(readFileSync(familyPath, 'utf8'))
if (familyData.kind !== 'regex') {
  process.stderr.write(`not a regex family: ${family}\n`)
  process.exit(1)
}

const flags = familyData.flags || ''
const compiled = familyData.items.map((source) => {
  try {
    return new RegExp(source, flags)
  } catch (err) {
    process.stderr.write(
      `failed to compile ${family}/${JSON.stringify(source)}: ${err.message}\n`,
    )
    process.exit(1)
  }
})

const verdicts = inputs.map((input) =>
  compiled.some((regex) => regex.test(input)),
)

process.stdout.write(JSON.stringify({ verdicts }))
