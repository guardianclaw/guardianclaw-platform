/**
 * CodeBlock Component
 *
 * A styled code block component for displaying code snippets in the whitepaper.
 * Supports syntax highlighting placeholder, copy button, line numbers, and line highlighting.
 */

'use client'

import { memo, useState, useCallback } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CodeBlockProps } from './types'

/**
 * Language display names for common languages
 */
const LANGUAGE_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  bash: 'Bash',
  shell: 'Shell',
  json: 'JSON',
  yaml: 'YAML',
  sql: 'SQL',
  rust: 'Rust',
  go: 'Go',
  plaintext: 'Text',
}

/**
 * Get display name for a language
 */
function getLanguageDisplayName(language: string): string {
  return LANGUAGE_NAMES[language.toLowerCase()] || language.toUpperCase()
}

/**
 * CodeBlock - Styled code display for whitepaper
 *
 * @example
 * ```tsx
 * <CodeBlock
 *   code="const x = 1;"
 *   language="typescript"
 *   showLineNumbers
 *   highlightLines={[2, 3]}
 *   copyable
 * />
 * ```
 */
export const CodeBlock = memo(function CodeBlock({
  code,
  language = 'plaintext',
  showLineNumbers = false,
  highlightLines = [],
  filename,
  copyable = true,
  maxHeight,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }, [code])

  const lines = code.split('\n')
  const highlightSet = new Set(highlightLines)

  return (
    <div
      className={cn(
        'my-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Language badge */}
          <span className="font-mono text-xs text-zinc-500">
            {getLanguageDisplayName(language)}
          </span>

          {/* Filename if provided */}
          {filename && (
            <>
              <span className="text-zinc-700">•</span>
              <span className="font-mono text-xs text-zinc-400">{filename}</span>
            </>
          )}
        </div>

        {/* Copy button */}
        {copyable && (
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs',
              'transition-colors duration-150',
              copied
                ? 'bg-green-500/10 text-green-400'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            )}
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Code content */}
      <div
        className="overflow-x-auto"
        style={{ maxHeight }}
        role="region"
        aria-label="Code block"
        tabIndex={0}
      >
        <pre className="p-4">
          <code className="font-mono text-sm">
            {lines.map((line, index) => {
              const lineNumber = index + 1
              const isHighlighted = highlightSet.has(lineNumber)

              return (
                <div
                  key={index}
                  className={cn(
                    'leading-relaxed',
                    isHighlighted && 'bg-claw-500/10 border-claw-500 -mx-4 border-l-2 px-4'
                  )}
                >
                  {showLineNumbers && (
                    <span
                      className={cn(
                        'mr-4 inline-block w-8 select-none text-right',
                        isHighlighted ? 'text-claw-400' : 'text-zinc-600'
                      )}
                      aria-hidden="true"
                    >
                      {lineNumber}
                    </span>
                  )}
                  <span className={cn(isHighlighted ? 'text-zinc-200' : 'text-zinc-300')}>
                    {line || ' '}
                  </span>
                </div>
              )
            })}
          </code>
        </pre>
      </div>
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'

export default CodeBlock
