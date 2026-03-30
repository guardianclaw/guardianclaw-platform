'use client'

/**
 * Code Examples Component
 *
 * Displays code snippets for integrating with the agent API.
 * Supports Python, JavaScript, and cURL examples.
 */

import { useState } from 'react'
import { Code, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ============================================
// TYPES
// ============================================

export interface CodeExamplesProps {
  /** The API endpoint URL */
  endpoint: string
}

// ============================================
// HELPERS
// ============================================

function generatePythonCode(endpoint: string): string {
  return `import requests

response = requests.post(
    "${endpoint}",
    headers={"X-API-Key": "YOUR_API_KEY"},
    json={"message": "Hello, world!"}
)

print(response.json())`
}

function generateJavaScriptCode(endpoint: string): string {
  return `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "X-API-Key": "YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ message: "Hello, world!" }),
});

const data = await response.json();
console.log(data);`
}

function generateCurlCode(endpoint: string): string {
  return `curl -X POST "${endpoint}" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello, world!"}'`
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface CodeBlockProps {
  code: string
  language: string
  onCopy: () => void
  copied: boolean
}

function CodeBlock({ code, language, onCopy, copied }: CodeBlockProps) {
  return (
    <div className="relative">
      <pre
        className="bg-muted overflow-x-auto rounded-lg p-4 text-sm"
        aria-label={`${language} code example`}
      >
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2"
        onClick={onCopy}
        aria-label={copied ? 'Copied!' : `Copy ${language} code`}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CodeExamples({ endpoint }: CodeExamplesProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const pythonCode = generatePythonCode(endpoint)
  const javascriptCode = generateJavaScriptCode(endpoint)
  const curlCode = generateCurlCode(endpoint)

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" aria-hidden="true" />
          Code Examples
        </CardTitle>
        <CardDescription>Quick start examples for integrating your agent</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="python" className="w-full">
          <TabsList aria-label="Programming language tabs">
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>
          <TabsContent value="python" className="mt-4">
            <CodeBlock
              code={pythonCode}
              language="Python"
              onCopy={() => handleCopy(pythonCode, 'python')}
              copied={copied === 'python'}
            />
          </TabsContent>
          <TabsContent value="javascript" className="mt-4">
            <CodeBlock
              code={javascriptCode}
              language="JavaScript"
              onCopy={() => handleCopy(javascriptCode, 'javascript')}
              copied={copied === 'javascript'}
            />
          </TabsContent>
          <TabsContent value="curl" className="mt-4">
            <CodeBlock
              code={curlCode}
              language="cURL"
              onCopy={() => handleCopy(curlCode, 'curl')}
              copied={copied === 'curl'}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
