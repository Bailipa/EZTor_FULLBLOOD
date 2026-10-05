'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Share2,
  RefreshCw,
  Trash2,
  Calendar,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShareCodeDisplay } from '@/components/share/ShareCodeDisplay'

interface ReviewGroup {
  id: string
  name: string
  _count?: {
    ReviewGroupWord: number
  }
  createdAt?: string
}

interface ShareData {
  id: string
  code: string
  name: string
  description: string | null
  expiresAt: string | null
  maxUses: number | null
  usedCount: number
  importedCount: number
  viewCount: number
  isActive: boolean
  createdAt: string
  reviewGroupId?: string
}

interface GroupShareModalProps {
  groupId: string
  isOpen: boolean
  onClose: () => void
}

export function GroupShareModal({ groupId, isOpen, onClose }: GroupShareModalProps) {
  const [group, setGroup] = useState<ReviewGroup | null>(null)
  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const activeRef = useRef(false)
  const requestRef = useRef(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadRetry, setLoadRetry] = useState(0)

  // 分享配置
  const [shareName, setShareName] = useState('')
  const [shareDescription, setShareDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [maxUses, setMaxUses] = useState('')

  const fetchGroupInfo = useCallback(async () => {
    const request = requestRef.current
    try {
      const res = await fetch(`/api/review-groups/${groupId}`)
      const data = await res.json()
      if (!activeRef.current || request !== requestRef.current) return
      if (!res.ok || !data.success) { setLoadError('词库信息加载失败，请重试'); return }
      if (data.success) {
        setGroup(data.data)
        setShareName((current) => current || `${data.data.name}的词库`)
      }
    } catch (error) {
      if (activeRef.current && request === requestRef.current) setLoadError('词库信息加载失败，请重试')
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch group info', error)
    }
  }, [groupId])

  const fetchShareData = useCallback(async () => {
    const request = requestRef.current
    try {
      const res = await fetch(`/api/share/list`)
      const data = await res.json()
      if (!activeRef.current || request !== requestRef.current) return
      if (!res.ok || !data.success || !Array.isArray(data.shares)) { setLoadError('分享信息加载失败，请重试'); return }
      if (data.success && Array.isArray(data.shares)) {
        const share = data.shares.find((s: ShareData) => s.reviewGroupId === groupId)
        setShareData(share || null)
      }
    } catch (error) {
      if (activeRef.current && request === requestRef.current) setLoadError('分享信息加载失败，请重试')
      if (process.env.NODE_ENV === 'development') console.error('Failed to fetch share data', error)
    }
  }, [groupId])

  useEffect(() => {
    activeRef.current = isOpen
    requestRef.current += 1
    const request = requestRef.current
    if (isOpen && groupId) {
      setGroup(null)
      setShareData(null)
      setShareName('')
      setLoadError(null)
      setIsCreating(false)
      setIsRevoking(false)
      setIsRegenerating(false)
      setIsLoading(true)
      Promise.all([fetchGroupInfo(), fetchShareData()]).finally(() => {
        if (activeRef.current && request === requestRef.current) setIsLoading(false)
      })
    }
    return () => { activeRef.current = false; requestRef.current += 1 }
  }, [isOpen, groupId, loadRetry, fetchGroupInfo, fetchShareData])

  const handleCreateShare = async () => {
    const request = requestRef.current
    if (!group) return

    setIsCreating(true)
    try {
      const requestBody: Record<string, unknown> = {
        reviewGroupId: groupId,
        name: shareName || `${group.name}的词库`,
        description: shareDescription || null,
      }

      if (expiresAt) {
        requestBody.expiresAt = new Date(expiresAt).toISOString()
      }

      if (maxUses && parseInt(maxUses) > 0) {
        requestBody.maxUses = parseInt(maxUses)
      }

      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()
      if (!activeRef.current || request !== requestRef.current) return

      if (data.success) {
        await fetchShareData()
      } else {
        toast.error(data.message || '创建失败，请稍后重试')
      }
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      if (process.env.NODE_ENV === 'development') console.error('Failed to create share', error)
      toast.error('创建失败，请稍后重试')
    } finally {
      if (activeRef.current && request === requestRef.current) setIsCreating(false)
    }
  }

  const handleRevoke = async () => {
    const request = requestRef.current
    if (!shareData?.id) return

    if (!confirm('确定要撤销该分享吗？撤销后分享码将失效。')) {
      return
    }

    setIsRevoking(true)
    try {
      const res = await fetch(`/api/share/${shareData.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!activeRef.current || request !== requestRef.current) return

      if (data.success) {
        await fetchShareData()
      } else {
        toast.error(data.message || '撤销失败，请稍后重试')
      }
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      if (process.env.NODE_ENV === 'development') console.error('Failed to revoke', error)
      toast.error('撤销失败，请稍后重试')
    } finally {
      if (activeRef.current && request === requestRef.current) setIsRevoking(false)
    }
  }

  const handleRegenerate = async () => {
    const request = requestRef.current
    if (!shareData?.id) return

    if (!confirm('确定要重新生成分享码吗？原分享码将失效。')) {
      return
    }

    setIsRegenerating(true)
    try {
      const res = await fetch(`/api/share/${shareData.id}/regenerate`, {
        method: 'POST',
      })

      const data = await res.json()
      if (!activeRef.current || request !== requestRef.current) return

      if (data.success) {
        await fetchShareData()
      } else {
        toast.error(data.message || '重新生成失败，请稍后重试')
      }
    } catch (error) {
      if (!activeRef.current || request !== requestRef.current) return
      if (process.env.NODE_ENV === 'development') console.error('Failed to regenerate', error)
      toast.error('重新生成失败，请稍后重试')
    } finally {
      if (activeRef.current && request === requestRef.current) setIsRegenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg sm:text-xl">分享自定义词库</DialogTitle>
          <DialogDescription className="text-sm">
            先确认名称与有效期，再生成分享码。好友可用分享码预览并导入。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : group && !loadError ? (
          <div className="space-y-4 sm:space-y-6">
            {/* A. 分组信息展示 */}
            <Card className="border-0 bg-transparent shadow-none">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm sm:text-base min-w-0 break-words">{group.name}</h3>
                    <Badge variant="secondary">
                      <BookOpen className="size-3 mr-1" />
                      {group._count?.ReviewGroupWord || 0} 词
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span>
                        创建于{' '}
                        {group.createdAt
                          ? new Date(group.createdAt).toLocaleDateString('zh-CN')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B. 分享配置选项（仅在未创建分享时显示） */}
            {!shareData && (
              <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="shareName" className="text-xs sm:text-sm">
                      分享名称
                    </Label>
                    <Input
                      id="shareName"
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      placeholder={`${group.name}的词库`}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shareDescription" className="text-xs sm:text-sm">
                      分享描述（可选）
                    </Label>
                    <Input
                      id="shareDescription"
                      value={shareDescription}
                      onChange={(e) => setShareDescription(e.target.value)}
                      placeholder="简单描述这个词库"
                      className="text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiresAt" className="text-xs sm:text-sm">
                        有效期
                      </Label>
                      <Input
                        id="expiresAt"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxUses" className="text-xs sm:text-sm">
                        使用次数限制
                      </Label>
                      <Input
                        id="maxUses"
                        type="number"
                        min="1"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        placeholder="不限制"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* C & D. 分享码生成/展示区域 */}
            {shareData ? (
              <Card className={cn(!shareData.isActive && 'border-destructive/50 bg-destructive/5')}>
                <CardContent className="p-4 space-y-4">
                  <ShareCodeDisplay code={shareData.code} isActive={shareData.isActive} expiresAt={shareData.expiresAt} maxUses={shareData.maxUses} usedCount={shareData.usedCount} />

                  {/* 分享统计信息 */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">查看次数</div>
                      <div className="text-lg font-semibold">{shareData.viewCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">导入次数</div>
                      <div className="text-lg font-semibold">{shareData.importedCount}</div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            ) : (
              /* C. 分享码生成按钮 */
              <Button
                onClick={handleCreateShare}
                disabled={isCreating || !shareName.trim()}
                className="w-full"
                size="lg"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 size-4" />
                    生成分享码
                  </>
                )}
              </Button>
            )}

            {/* E. 管理操作 */}
            {shareData && (
              <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="p-4">
                  <Label className="text-xs sm:text-sm mb-3 block">管理操作</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={!shareData.isActive || isRegenerating}
                      className="text-sm"
                      size="sm"
                    >
                      <RefreshCw className="mr-2 size-3" />
                      重新生成
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRevoke}
                      disabled={!shareData.isActive || isRevoking}
                      className="text-sm"
                      size="sm"
                    >
                      <Trash2 className="mr-2 size-3" />
                      {isRevoking ? '撤销中...' : '撤销分享'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <p role="alert">{loadError || '词库加载失败'}</p>
            <Button variant="outline" className="mt-3" onClick={() => setLoadRetry((value) => value + 1)}>重新加载</Button>
          </div>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
