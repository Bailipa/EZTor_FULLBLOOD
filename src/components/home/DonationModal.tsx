'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Coffee, ExternalLink, Heart } from 'lucide-react'

interface DonationConfig {
  title: string
  description: string | null
  imageUrl: string | null
  linkUrl: string | null
  isActive: boolean
}

export function DonationButton() {
  const [config, setConfig] = useState<DonationConfig | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/donation')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setConfig(data.data)
        }
      }
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  if (!config?.isActive) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="shadow-sm shrink-0 h-8 w-8 sm:h-9 sm:w-9 text-pink-500 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30 border-pink-200 dark:border-pink-800/50"
          aria-label="支持开发者"
        >
          <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" aria-hidden="true" />
            {config.title}
          </DialogTitle>
          {config.description && <DialogDescription>{config.description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          {config.imageUrl && (
            <div className="rounded-lg overflow-hidden border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.imageUrl}
                alt="Donation QR code"
                className="w-full max-w-[280px] mx-auto"
                onError={(e) => {
                  const el = e.target as HTMLImageElement
                  const parent = el.parentElement
                  if (parent) {
                    parent.innerHTML =
                      '<p class="text-xs text-muted-foreground text-center py-8">图片加载失败，请稍后再试</p>'
                  }
                }}
              />
            </div>
          )}
          {config.linkUrl && (
            <a
              href={config.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full"
            >
              <Button
                variant="default"
                className="w-full bg-pink-500 hover:bg-pink-600 text-white gap-2"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                Buy me a coffee
              </Button>
            </a>
          )}
          <p className="text-xs text-center text-muted-foreground">
            感谢你的支持，这会帮助我持续维护和改进 EZTor
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
