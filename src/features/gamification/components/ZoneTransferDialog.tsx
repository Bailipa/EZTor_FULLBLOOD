'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowRightLeft, Users, Check } from 'lucide-react'
import { ZONE_TRANSFER_COST, ZONE_TRANSFER_COOLDOWN_DAYS } from '@/features/gamification/constants'

interface Zone {
  id: string
  name: string
  memberCount: number
  maxMembers: number
}

interface ZoneTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentZoneId: string
  canTransfer: boolean
  transferCooldownRemaining: number
  onSuccess?: () => void
}

export function ZoneTransferDialog({
  open,
  onOpenChange,
  currentZoneId,
  canTransfer,
  transferCooldownRemaining,
  onSuccess,
}: ZoneTransferDialogProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [transferring, setTransferring] = useState(false)
  const [error, setError] = useState('')

  const fetchZones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/game/zone?available=true')
      const data = await res.json()
      if (data.success) {
        setZones(data.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchZones()
      setSelectedZoneId(null)
      setError('')
    }
  }, [open, fetchZones])

  const handleTransfer = async () => {
    if (!selectedZoneId) return

    setTransferring(true)
    setError('')
    try {
      const res = await fetch('/api/game/zone/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetZoneId: selectedZoneId }),
      })
      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        onSuccess?.()
      } else {
        setError(data.error || '转移失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setTransferring(false)
    }
  }

  const cooldownDays = Math.ceil(transferCooldownRemaining / (24 * 60 * 60))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            战区转移
          </DialogTitle>
          <DialogDescription>
            消耗 {ZONE_TRANSFER_COST} 战力转移到其他战区。冷却期 {ZONE_TRANSFER_COOLDOWN_DAYS} 天。
          </DialogDescription>
        </DialogHeader>

        {!canTransfer && transferCooldownRemaining > 0 && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
            转移冷却中，还需 {cooldownDays} 天
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {zones.map((zone) => {
              const isCurrent = zone.id === currentZoneId
              const isFull = zone.memberCount >= zone.maxMembers
              const isSelected = zone.id === selectedZoneId
              const disabled = isCurrent || isFull || !canTransfer

              return (
                <button
                  key={zone.id}
                  onClick={() => !disabled && setSelectedZoneId(zone.id)}
                  disabled={disabled}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    disabled
                      ? 'opacity-50 cursor-not-allowed border-border'
                      : isSelected
                        ? 'border-primary bg-primary/5 cursor-pointer'
                        : 'border-border hover:border-primary/50 cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{zone.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          当前
                        </span>
                      )}
                      {isFull && !isCurrent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          已满
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Users className="w-3 h-3" />
                      <span>{zone.memberCount}/{zone.maxMembers}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={handleTransfer}
          disabled={!selectedZoneId || transferring || !canTransfer}
          className="w-full"
        >
          {transferring ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              转移中...
            </>
          ) : (
            `确认转移（-${ZONE_TRANSFER_COST} 战力）`
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
