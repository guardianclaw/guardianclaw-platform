'use client'

/**
 * Add Connector Dialog
 *
 * Multi-step wizard for adding social platform connectors.
 * Step 1: Select platform
 * Step 2: Enter platform-specific credentials
 */

import { useState, useCallback } from 'react'
import {
  Twitter,
  MessageCircle,
  Send,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toolCredentialsApi } from '@/lib/api'
import { TwitterConfig, type TwitterConfigData } from './platform-configs/twitter-config'
import { DiscordConfig, type DiscordConfigData } from './platform-configs/discord-config'
import { TelegramConfig, type TelegramConfigData } from './platform-configs/telegram-config'

// Platform options
type PlatformType = 'twitter' | 'discord' | 'telegram'

const platforms: Array<{
  id: PlatformType
  toolType: string
  label: string
  description: string
  icon: typeof Twitter
  color: string
  bgColor: string
}> = [
  {
    id: 'twitter',
    toolType: 'twitter_api',
    label: 'Twitter / X',
    description: 'Post tweets from your agent',
    icon: Twitter,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10 hover:bg-sky-500/20',
  },
  {
    id: 'discord',
    toolType: 'discord_bot',
    label: 'Discord',
    description: 'Send messages to Discord channels',
    icon: MessageCircle,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/20',
  },
  {
    id: 'telegram',
    toolType: 'telegram_bot',
    label: 'Telegram',
    description: 'Send messages to Telegram chats',
    icon: Send,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
  },
]

export interface AddConnectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AddConnectorDialog({ open, onOpenChange, onSuccess }: AddConnectorDialogProps) {
  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null)

  // Form state
  const [twitterData, setTwitterData] = useState<TwitterConfigData>({ name: '', bearerToken: '' })
  const [discordData, setDiscordData] = useState<DiscordConfigData>({
    name: '',
    mode: 'webhook',
    credential: '',
  })
  const [telegramData, setTelegramData] = useState<TelegramConfigData>({ name: '', botToken: '' })

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset dialog
  const resetDialog = useCallback(() => {
    setStep(1)
    setSelectedPlatform(null)
    setTwitterData({ name: '', bearerToken: '' })
    setDiscordData({ name: '', mode: 'webhook', credential: '' })
    setTelegramData({ name: '', botToken: '' })
    setError(null)
    setSubmitting(false)
  }, [])

  // Handle dialog close
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetDialog()
      }
      onOpenChange(newOpen)
    },
    [onOpenChange, resetDialog]
  )

  // Handle platform selection
  const handlePlatformSelect = useCallback((platform: PlatformType) => {
    setSelectedPlatform(platform)
    setStep(2)
    setError(null)
  }, [])

  // Handle back to platform selection
  const handleBack = useCallback(() => {
    setStep(1)
    setError(null)
  }, [])

  // Validate form data
  const isFormValid = useCallback((): boolean => {
    if (!selectedPlatform) return false

    switch (selectedPlatform) {
      case 'twitter':
        return twitterData.name.trim().length > 0 && twitterData.bearerToken.trim().length > 0
      case 'discord':
        return discordData.name.trim().length > 0 && discordData.credential.trim().length > 0
      case 'telegram':
        return telegramData.name.trim().length > 0 && telegramData.botToken.trim().length > 0
      default:
        return false
    }
  }, [selectedPlatform, twitterData, discordData, telegramData])

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!selectedPlatform || !isFormValid()) return

    setSubmitting(true)
    setError(null)

    try {
      const platform = platforms.find((p) => p.id === selectedPlatform)
      if (!platform) throw new Error('Invalid platform')

      let name: string
      let credential: string
      let config: Record<string, unknown> = {}

      switch (selectedPlatform) {
        case 'twitter':
          name = twitterData.name.trim()
          credential = twitterData.bearerToken.trim()
          break
        case 'discord':
          name = discordData.name.trim()
          credential = discordData.credential.trim()
          config = {
            mode: discordData.mode,
            channelId: discordData.channelId,
          }
          break
        case 'telegram':
          name = telegramData.name.trim()
          credential = telegramData.botToken.trim()
          config = {
            defaultChatId: telegramData.defaultChatId,
          }
          break
        default:
          throw new Error('Invalid platform')
      }

      await toolCredentialsApi.create({
        tool_type: platform.toolType,
        name,
        credential,
        config,
      })

      setStep(3)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add connector'
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }, [selectedPlatform, isFormValid, twitterData, discordData, telegramData])

  // Handle success close
  const handleSuccessClose = useCallback(() => {
    handleOpenChange(false)
    onSuccess()
  }, [handleOpenChange, onSuccess])

  // Get current platform info
  const currentPlatform = selectedPlatform ? platforms.find((p) => p.id === selectedPlatform) : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Step 1: Platform Selection */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Add Connector</DialogTitle>
              <DialogDescription>Choose a platform to connect with your agent.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4">
              {platforms.map((platform) => {
                const Icon = platform.icon
                return (
                  <button
                    key={platform.id}
                    onClick={() => handlePlatformSelect(platform.id)}
                    className={cn(
                      'flex items-center gap-4 rounded-lg border p-4 text-left transition-colors',
                      platform.bgColor
                    )}
                  >
                    <div className="bg-background/50 rounded-lg p-2">
                      <Icon className={cn('h-6 w-6', platform.color)} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{platform.label}</div>
                      <div className="text-muted-foreground text-sm">{platform.description}</div>
                    </div>
                    <ArrowRight className="text-muted-foreground h-5 w-5" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Step 2: Platform Configuration */}
        {step === 2 && currentPlatform && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <currentPlatform.icon className={cn('h-5 w-5', currentPlatform.color)} />
                Connect {currentPlatform.label}
              </DialogTitle>
              <DialogDescription>
                Enter your credentials to connect this platform.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {selectedPlatform === 'twitter' && (
                <TwitterConfig data={twitterData} onChange={setTwitterData} />
              )}
              {selectedPlatform === 'discord' && (
                <DiscordConfig data={discordData} onChange={setDiscordData} />
              )}
              {selectedPlatform === 'telegram' && (
                <TelegramConfig data={telegramData} onChange={setTelegramData} />
              )}

              {error && (
                <div className="text-destructive bg-destructive/10 mt-4 flex items-center gap-2 rounded-lg p-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack} disabled={submitting}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={!isFormValid() || submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Connector
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Success */}
        {step === 3 && currentPlatform && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Connector Added
              </DialogTitle>
              <DialogDescription>
                Your {currentPlatform.label} connector is ready to use.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <div className={cn('mb-4 inline-flex rounded-full p-4', currentPlatform.bgColor)}>
                <currentPlatform.icon className={cn('h-8 w-8', currentPlatform.color)} />
              </div>
              <p className="text-muted-foreground text-sm">
                You can now use this connector in your flow&apos;s output nodes. Go to the Flow tab
                and add a {currentPlatform.label} output.
              </p>
            </div>

            <DialogFooter>
              <Button onClick={handleSuccessClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
