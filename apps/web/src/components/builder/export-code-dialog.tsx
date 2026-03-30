'use client'

import { useState, useCallback } from 'react'
import {
  Download,
  FileCode2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Agent, agentsApi } from '@/lib/api'

interface ExportCodeDialogProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Framework metadata for display
const FRAMEWORK_INFO: Record<
  string,
  {
    label: string
    language: 'python' | 'typescript'
    description: string
    files: string[]
  }
> = {
  openai_agents: {
    label: 'OpenAI Agents SDK',
    language: 'python',
    description: 'Python project with OpenAI Agents and GuardianClaw guardrail',
    files: ['main.py', 'agent.py', 'claw_config.py', 'requirements.txt', '.env.example'],
  },
  coinbase_agentkit: {
    label: 'Coinbase AgentKit',
    language: 'typescript',
    description: 'TypeScript project with Coinbase AgentKit and fiduciary validation',
    files: ['src/index.ts', 'src/agent.ts', 'src/claw.config.ts', 'package.json', 'tsconfig.json'],
  },
  solana_agent_kit: {
    label: 'Solana Agent Kit',
    language: 'python',
    description: 'Python project for Solana blockchain interactions with spending limits',
    files: ['main.py', 'agent.py', 'claw_config.py', 'requirements.txt', '.env.example'],
  },
  google_adk: {
    label: 'Google ADK',
    language: 'python',
    description: 'Python project with Google Agent Development Kit',
    files: ['main.py', 'agent.py', 'claw_config.py', 'requirements.txt', '.env.example'],
  },
  virtuals_protocol: {
    label: 'Virtuals Protocol',
    language: 'python',
    description: 'Python project with Virtuals GAME SDK and fiduciary protection',
    files: ['main.py', 'agent.py', 'claw_config.py', 'requirements.txt', '.env.example'],
  },
  elizaos: {
    label: 'ElizaOS',
    language: 'typescript',
    description: 'TypeScript project with ElizaOS social agent framework',
    files: [
      'src/index.ts',
      'src/character.ts',
      'src/claw.config.ts',
      'package.json',
      'tsconfig.json',
    ],
  },
}

const SUPPORTED_FRAMEWORKS = Object.keys(FRAMEWORK_INFO)

export function ExportCodeDialog({ agent, open, onOpenChange }: ExportCodeDialogProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const frameworkInfo = FRAMEWORK_INFO[agent.framework]
  const isSupported = SUPPORTED_FRAMEWORKS.includes(agent.framework)

  const handleExport = useCallback(async () => {
    if (!isSupported) return

    setIsExporting(true)
    setExportResult(null)
    setErrorMessage(null)

    try {
      const { blob, filename } = await agentsApi.exportCode(agent.id)

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportResult('success')
    } catch (err) {
      console.error('Export failed:', err)
      setExportResult('error')
      setErrorMessage(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [agent.id, isSupported])

  const handleClose = useCallback(() => {
    setExportResult(null)
    setErrorMessage(null)
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5" />
            Export Code
          </DialogTitle>
          <DialogDescription>Download a ready-to-run project for your agent</DialogDescription>
        </DialogHeader>

        {!isSupported ? (
          <div className="py-4">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-500">Export Not Available</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Code export is not supported for the <strong>{agent.framework}</strong> framework.
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  Supported frameworks: {SUPPORTED_FRAMEWORKS.join(', ')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Framework info */}
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <FileCode2 className="text-primary h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{frameworkInfo.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {frameworkInfo.language === 'python' ? 'Python' : 'TypeScript'}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-sm">{frameworkInfo.description}</p>
              </div>
            </div>

            {/* Files preview */}
            <div className="bg-muted/30 rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="h-4 w-4" />
                <span>Project Files</span>
              </div>
              <div className="space-y-1">
                {frameworkInfo.files.map((file) => (
                  <div key={file} className="text-muted-foreground flex items-center gap-2 text-sm">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-mono text-xs">{file}</span>
                  </div>
                ))}
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">README.md</span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs">.gitignore</span>
                </div>
              </div>
            </div>

            {/* Result messages */}
            {exportResult === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Download started successfully!</span>
              </div>
            )}

            {exportResult === 'error' && (
              <div className="bg-destructive/10 border-destructive/20 flex items-start gap-2 rounded-lg border p-3">
                <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-sm">
                  <p className="text-destructive font-medium">Export Failed</p>
                  <p className="text-muted-foreground">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {exportResult === 'success' ? 'Done' : 'Cancel'}
          </Button>
          {isSupported && exportResult !== 'success' && (
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download ZIP
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
