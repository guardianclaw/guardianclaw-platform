'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, History, MessageSquare, Key, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAgent } from '../context'
import { useFlowStore, useExecutionStore, FlowNode, FlowEdge } from '@/stores'
import {
  agentsApi,
  demoApi,
  conversationsApi,
  ApiError,
  TestResult,
  Conversation,
  ConversationMessage,
  MemoryStrategy,
} from '@/lib/api'
import { animateExecution } from '@/lib/execution-sync'
import {
  ConversationPanel,
  MessageList,
  ExecutionTracePanel,
  MEMORY_STRATEGIES,
  type Message,
  type ExecutionStep,
} from './components'
import { useLLMKey } from '@/hooks/use-llm-key'

export function TestPageClient() {
  const { agent, isDemo } = useAgent()
  const storeNodes = useFlowStore((s) => s.nodes)
  const storeEdges = useFlowStore((s) => s.edges)
  const loadFlow = useFlowStore((s) => s.loadFlow)
  const [flowInitialized, setFlowInitialized] = useState(false)

  // Execution store
  const startExecution = useExecutionStore((s) => s.startExecution)
  const stopExecution = useExecutionStore((s) => s.stopExecution)
  const setNodeStatus = useExecutionStore((s) => s.setNodeStatus)
  const setMultipleEdgesActive = useExecutionStore((s) => s.setMultipleEdgesActive)
  const clearExecution = useExecutionStore((s) => s.clearExecution)

  // LLM Key hook for BYOK (Bring Your Own Key)
  const {
    keys: llmKeys,
    loadingKeys: loadingLLMKeys,
    selectedKeyId,
    setSelectedKeyId,
    decryptKey,
    isDecrypting,
    decryptionError,
    hasUsableKey,
  } = useLLMKey()

  // UI state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [executionTrace, setExecutionTrace] = useState<ExecutionStep[]>([])
  const [showTrace, setShowTrace] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [conversationMode, setConversationMode] = useState<'sandbox' | 'persistent'>('sandbox')
  const [memoryStrategy, setMemoryStrategy] = useState<MemoryStrategy>('sliding_window')
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [showConversationPanel, setShowConversationPanel] = useState(false)

  // Animation callback
  const runAnimation = useCallback(
    async (trace: ExecutionStep[], nodes: FlowNode[], edges: FlowEdge[]) => {
      await animateExecution(trace, nodes, edges, {
        onNodeStatusChange: setNodeStatus,
        onEdgeActivate: setMultipleEdgesActive,
        onStepComplete: () => {},
      })
    },
    [setNodeStatus, setMultipleEdgesActive]
  )

  // Initialize flow store
  useEffect(() => {
    if (agent && !flowInitialized) {
      const hasFlow = storeNodes.length > 0
      if (!hasFlow && agent.flow?.nodes) {
        const flowNodes = (agent.flow.nodes || []) as FlowNode[]
        const flowEdges = (agent.flow.edges || []) as FlowEdge[]
        loadFlow(isDemo ? 'demo' : agent.id, agent.name, flowNodes, flowEdges)
      }
      setFlowInitialized(true)
    }
  }, [agent, isDemo, flowInitialized, storeNodes.length, loadFlow])

  // Load conversations list
  useEffect(() => {
    if (agent && !isDemo) {
      loadConversations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, isDemo])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get nodes/edges
  const nodes = storeNodes.length > 0 ? storeNodes : agent?.flow?.nodes || []
  const edges = storeEdges.length > 0 ? storeEdges : agent?.flow?.edges || []

  // Conversation handlers
  const loadConversations = async () => {
    if (!agent || isDemo) return

    setLoadingConversations(true)
    try {
      const data = await conversationsApi.list(agent.id, { limit: 20 })
      setConversations(data.conversations)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }

  const loadConversation = async (conversation: Conversation) => {
    if (!agent) return

    try {
      const data = await conversationsApi.get(agent.id, conversation.id)
      setActiveConversation(data)
      setConversationMode('persistent')
      setMemoryStrategy(data.memory_strategy)

      const loadedMessages: Message[] = data.messages.map((m: ConversationMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.created_at),
        blocked: m.blocked,
        blocked_reason: m.blocked_reason || undefined,
        latency_ms: m.latency_ms || undefined,
        gate: m.blocked_gate || undefined,
      }))

      setMessages(loadedMessages)
      setShowConversationPanel(false)
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  const createNewConversation = async () => {
    if (!agent || isDemo) return

    try {
      const newConv = await conversationsApi.create(agent.id, { memory_strategy: memoryStrategy })
      setConversations((prev) => [newConv, ...prev])
      setActiveConversation(newConv)
      setConversationMode('persistent')
      setMessages([])
      setShowConversationPanel(false)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const archiveConversation = async (conversationId: string) => {
    if (!agent) return

    try {
      await conversationsApi.delete(agent.id, conversationId)
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null)
        setConversationMode('sandbox')
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to archive conversation:', error)
    }
  }

  const switchToSandbox = () => {
    setActiveConversation(null)
    setConversationMode('sandbox')
    setMessages([])
    setExecutionTrace([])
    setShowConversationPanel(false)
  }

  // Message handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading || !agent?.id) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setExecutionTrace([])
    clearExecution()
    startExecution()

    setExecutionTrace([
      {
        step_id: 'pending',
        step_name: 'Processing...',
        step_type: 'init',
        category: 'system',
        status: 'running',
      },
    ])

    try {
      let blocked = false
      let assistantContent: string | null = null
      let reason: string | undefined
      let gate: string | undefined
      let claw: Message['claw']
      let latency_ms: number | undefined
      let trace: ExecutionStep[] | undefined

      // Decrypt LLM key if user has one selected (BYOK)
      let llmApiKey: string | undefined
      if (selectedKeyId && !isDemo) {
        llmApiKey = (await decryptKey(selectedKeyId)) || undefined
        // Key decryption might fail if user rejects signature
        // Continue without key (will use simulation mode)
      }

      if (conversationMode === 'persistent' && activeConversation && !isDemo) {
        const response = await conversationsApi.sendMessage(agent.id, activeConversation.id, {
          content: userMessage.content,
          flow: { nodes, edges },
          llmApiKey, // Pass decrypted key for BYOK
        })

        blocked = response.blocked
        assistantContent = response.response
        reason = response.reason
        gate = response.gate
        claw = response.claw
        latency_ms = response.latency_ms

        setActiveConversation((prev) =>
          prev
            ? {
                ...prev,
                message_count: prev.message_count + 2,
                last_message_at: new Date().toISOString(),
              }
            : null
        )

        if (response.trace?.steps) {
          trace = response.trace.steps.map((step) => ({
            step_id: step.step_id,
            step_name: step.step_name,
            step_type: step.step_type,
            category: step.category,
            status: step.status as ExecutionStep['status'],
            duration_ms: step.duration_ms,
            error: step.error,
          }))
        } else {
          trace = [
            {
              step_id: 'user_input',
              step_name: 'User Input',
              step_type: 'receive_input',
              category: 'input',
              status: 'success',
              duration_ms: 10,
            },
            {
              step_id: 'agent_execution',
              step_name: 'Agent Execution',
              step_type: 'process',
              category: 'process',
              status: blocked ? 'error' : 'success',
              duration_ms: latency_ms || 100,
              error: blocked ? reason : undefined,
            },
          ]
        }
      } else {
        const data: TestResult = isDemo
          ? await demoApi.test(userMessage.content, { nodes, edges })
          : await agentsApi.test(agent.id, userMessage.content, {
              flow: { nodes, edges },
              llmApiKey,
            })

        blocked = data.blocked
        assistantContent = data.response
        reason = data.reason
        gate = data.gate
        claw = data.claw
        latency_ms = data.latency_ms

        if (data.trace?.steps) {
          trace = data.trace.steps.map((step) => ({
            step_id: step.step_id,
            step_name: step.step_name,
            step_type: step.step_type,
            category: step.category,
            status: step.status as ExecutionStep['status'],
            duration_ms: step.duration_ms,
            error: step.error,
          }))
        } else {
          trace = [
            {
              step_id: 'user_input',
              step_name: 'User Input',
              step_type: 'receive_input',
              category: 'input',
              status: 'success',
              duration_ms: 10,
            },
            {
              step_id: 'agent_execution',
              step_name: 'Agent Execution',
              step_type: 'process',
              category: 'process',
              status: blocked ? 'error' : 'success',
              duration_ms: latency_ms || 100,
              error: blocked ? reason : undefined,
            },
          ]
        }
      }

      if (trace) {
        setExecutionTrace(trace)
        runAnimation(trace, nodes as FlowNode[], edges as FlowEdge[])
      }

      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: blocked ? 'system' : 'assistant',
        content: blocked
          ? `Blocked by GuardianClaw: ${reason || 'Content did not pass validation'}`
          : assistantContent || 'No response generated',
        timestamp: new Date(),
        blocked,
        blocked_reason: reason,
        gate,
        claw,
        latency_ms,
      }
      setMessages((prev) => [...prev, responseMessage])
    } catch (error: unknown) {
      let content: string
      if (error instanceof ApiError && error.status === 402) {
        content = 'Insufficient credits. Go to Profile → Credits to add funds.'
      } else {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        content = `Failed to process message: ${msg}`
      }
      setExecutionTrace([
        {
          step_id: 'error',
          step_name: 'Error',
          step_type: 'process',
          category: 'system',
          status: 'error',
          error: content,
        },
      ])
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'system', content, timestamp: new Date() },
      ])
    } finally {
      setLoading(false)
      stopExecution()
    }
  }

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading test sandbox...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Conversation Panel */}
      {showConversationPanel && !isDemo && (
        <ConversationPanel
          conversations={conversations}
          activeConversation={activeConversation}
          conversationMode={conversationMode}
          memoryStrategy={memoryStrategy}
          loadingConversations={loadingConversations}
          onCreateNew={createNewConversation}
          onSelectConversation={loadConversation}
          onArchiveConversation={archiveConversation}
          onSwitchToSandbox={switchToSandbox}
          onMemoryStrategyChange={setMemoryStrategy}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            {!isDemo && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConversationPanel(!showConversationPanel)}
              >
                <History className="mr-2 h-4 w-4" />
                {showConversationPanel ? 'Hide' : 'History'}
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {conversationMode === 'sandbox' ? (
                <>
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Sandbox
                </>
              ) : (
                <>
                  <History className="mr-1 h-3 w-3" />
                  {activeConversation?.title || 'Conversation'}
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {activeConversation && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>{activeConversation.message_count} messages</span>
                <Badge variant="secondary" className="text-[10px]">
                  {
                    MEMORY_STRATEGIES.find((s) => s.value === activeConversation.memory_strategy)
                      ?.label
                  }
                </Badge>
              </div>
            )}

            {/* LLM Key Selector (BYOK) */}
            {!isDemo && (
              <TooltipProvider>
                <div className="flex items-center gap-2">
                  {loadingLLMKeys ? (
                    <Badge variant="outline" className="text-xs">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Loading keys...
                    </Badge>
                  ) : llmKeys.length > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Key className="text-muted-foreground h-3 w-3" />
                          <Select
                            value={selectedKeyId || 'none'}
                            onValueChange={(v) => setSelectedKeyId(v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs">
                              <SelectValue placeholder="Select key" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">
                                No key (Sandbox)
                              </SelectItem>
                              {llmKeys.map((key) => (
                                <SelectItem key={key.id} value={key.id} className="text-xs">
                                  {key.provider} {key.key_preview}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select your LLM API key for real responses</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="cursor-pointer text-xs"
                          onClick={() => (window.location.href = '/app/settings')}
                        >
                          <Key className="mr-1 h-3 w-3" />
                          Add API Key
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add your LLM API key in Settings for real AI responses</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {isDecrypting && (
                    <Badge variant="secondary" className="text-xs">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Decrypting...
                    </Badge>
                  )}

                  {decryptionError && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="cursor-pointer text-xs">
                          Key error
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{decryptionError}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <MessageList
            ref={messagesEndRef}
            messages={messages}
            conversationMode={conversationMode}
          />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                conversationMode === 'sandbox'
                  ? 'Type a message to test your agent...'
                  : 'Continue the conversation...'
              }
              className="max-h-[200px] min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-claw-600 hover:bg-claw-700 self-end"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Execution Trace Panel */}
      <ExecutionTracePanel
        trace={executionTrace}
        showTrace={showTrace}
        onToggleTrace={() => setShowTrace(!showTrace)}
      />
    </div>
  )
}
