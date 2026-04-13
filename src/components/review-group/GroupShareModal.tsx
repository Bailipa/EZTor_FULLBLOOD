"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Check,
  Loader2,
  Share2,
  RefreshCw,
  Trash2,
  BarChart3,
  Calendar,
  BookOpen,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewGroup {
  id: string;
  name: string;
  _count?: {
    words: number;
  };
  createdAt?: string;
}

interface ShareData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  importedCount: number;
  viewCount: number;
  isActive: boolean;
  createdAt: string;
}

interface GroupShareModalProps {
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GroupShareModal({
  groupId,
  isOpen,
  onClose,
}: GroupShareModalProps) {
  const [group, setGroup] = useState<ReviewGroup | null>(null);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // 分享配置
  const [shareName, setShareName] = useState("");
  const [shareDescription, setShareDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const fetchGroupInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/review-groups/${groupId}`);
      const data = await res.json();
      if (data.success) {
        setGroup(data.data);
        if (!shareName) {
          setShareName(`${data.data.name}的词库`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch group info", error);
    }
  }, [groupId, shareName]);

  const fetchShareData = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/list`);
      const data = await res.json();
      if (data.success && Array.isArray(data.shares)) {
        const share = data.shares.find((s: ShareData) => s.reviewGroupId === groupId);
        setShareData(share || null);
      }
    } catch (error) {
      console.error("Failed to fetch share data", error);
    }
  }, [groupId]);

  useEffect(() => {
    if (isOpen && groupId) {
      fetchGroupInfo();
      fetchShareData();
    }
  }, [isOpen, groupId, fetchGroupInfo, fetchShareData]);

  const handleCreateShare = async () => {
    if (!group) return;

    setIsCreating(true);
    try {
      const requestBody: any = {
        reviewGroupId: groupId,
        name: shareName || `${group.name}的词库`,
        description: shareDescription || null,
      };

      if (expiresAt) {
        requestBody.expiresAt = new Date(expiresAt).toISOString();
      }

      if (maxUses && parseInt(maxUses) > 0) {
        requestBody.maxUses = parseInt(maxUses);
      }

      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      if (data.success) {
        await fetchShareData();
      } else {
        alert(data.message || "创建失败，请稍后重试");
      }
    } catch (error) {
      console.error("Failed to create share", error);
      alert("创建失败，请稍后重试");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!shareData?.code) return;

    try {
      await navigator.clipboard.writeText(shareData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy", error);
    }
  };

  const handleRevoke = async () => {
    if (!shareData?.id) return;

    if (!confirm("确定要撤销该分享吗？撤销后密钥将失效。")) {
      return;
    }

    setIsRevoking(true);
    try {
      const res = await fetch(`/api/share/${shareData.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        await fetchShareData();
      } else {
        alert(data.message || "撤销失败，请稍后重试");
      }
    } catch (error) {
      console.error("Failed to revoke", error);
      alert("撤销失败，请稍后重试");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRegenerate = async () => {
    if (!shareData?.id) return;

    if (!confirm("确定要重新生成密钥吗？原密钥将失效。")) {
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/share/${shareData.id}/regenerate`, {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        await fetchShareData();
        setCopied(false);
      } else {
        alert(data.message || "重新生成失败，请稍后重试");
      }
    } catch (error) {
      console.error("Failed to regenerate", error);
      alert("重新生成失败，请稍后重试");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleViewStats = () => {
    if (!shareData?.id) return;
    // TODO: 打开统计面板
    alert("统计功能开发中...");
  };

  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return "永久有效";
    const date = new Date(expiresAt);
    return date.toLocaleDateString("zh-CN");
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg sm:text-xl">分享分组词库</DialogTitle>
          <DialogDescription className="text-sm">
            生成分享密钥，让其他用户可以导入该分组的词汇
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : group ? (
          <div className="space-y-4 sm:space-y-6">
            {/* A. 分组信息展示 */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm sm:text-base">{group.name}</h3>
                    <Badge variant="secondary">
                      <BookOpen className="size-3 mr-1" />
                      {group._count?.words || 0} 词
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span>
                        创建于 {group.createdAt ? new Date(group.createdAt).toLocaleDateString("zh-CN") : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B. 分享配置选项（仅在未创建分享时显示） */}
            {!shareData && (
              <Card>
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

            {/* C & D. 密钥生成/展示区域 */}
            {shareData ? (
              <Card className={cn(!shareData.isActive && "border-destructive/50 bg-destructive/5")}>
                <CardContent className="p-4 space-y-4">
                  {/* 密钥展示 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs sm:text-sm">分享密钥</Label>
                      <div className="flex items-center gap-2">
                        {!shareData.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            已撤销
                          </Badge>
                        )}
                        {isExpired(shareData.expiresAt) && (
                          <Badge variant="destructive" className="text-xs">
                            已过期
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg sm:text-xl text-center tracking-wider break-all">
                        {shareData.code}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyCode}
                        disabled={!shareData.isActive}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="size-4 text-green-600" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                    {copied && (
                      <div className="text-xs text-green-600 text-center">
                        密钥已复制到剪贴板
                      </div>
                    )}
                  </div>

                  {/* 分享统计信息 */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">查看次数</div>
                      <div className="text-lg font-semibold">{shareData.viewCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">导入次数</div>
                      <div className="text-lg font-semibold">{shareData.importedCount}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">使用次数</div>
                      <div className="text-lg font-semibold">
                        {shareData.maxUses ? `${shareData.usedCount}/${shareData.maxUses}` : shareData.usedCount}
                      </div>
                    </div>
                  </div>

                  {/* 有效期信息 */}
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span>有效期至：{formatExpiration(shareData.expiresAt)}</span>
                    </div>
                    {shareData.maxUses && (
                      <div className="flex items-center gap-1">
                        <Link2 className="size-3" />
                        <span>剩余次数：{shareData.maxUses - shareData.usedCount}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* C. 密钥生成按钮 */
              <Button
                onClick={handleCreateShare}
                disabled={isCreating || !shareName}
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
                    生成分享密钥
                  </>
                )}
              </Button>
            )}

            {/* E. 管理操作 */}
            {shareData && (
              <Card>
                <CardContent className="p-4">
                  <Label className="text-xs sm:text-sm mb-3 block">管理操作</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCopyCode}
                      disabled={!shareData.isActive}
                      className="text-sm"
                      size="sm"
                    >
                      <Copy className="mr-2 size-3" />
                      复制密钥
                    </Button>
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
                      variant="outline"
                      onClick={handleViewStats}
                      disabled={!shareData.isActive}
                      className="text-sm col-span-2 sm:col-span-1"
                      size="sm"
                    >
                      <BarChart3 className="mr-2 size-3" />
                      查看统计
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleRevoke}
                      disabled={!shareData.isActive || isRevoking}
                      className="text-sm col-span-2 sm:col-span-2"
                      size="sm"
                    >
                      <Trash2 className="mr-2 size-3" />
                      {isRevoking ? "撤销中..." : "撤销分享"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            加载失败，请稍后重试
          </div>
        )}

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
