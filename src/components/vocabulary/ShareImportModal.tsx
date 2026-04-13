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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, XIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewGroup {
  id: string;
  name: string;
  _count?: {
    words: number;
  };
}

interface DefaultVocabulary {
  id: string;
  name: string;
  description: string | null;
  code: string;
  wordCount: number;
  sortOrder: number;
}

interface ShareImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  error: string | null;
  data: {
    code?: string;
    name?: string;
    description?: string | null;
    wordCount?: number;
    shareType?: string;
    expiresAt?: string | null;
    maxUses?: number | null;
    usedCount?: number;
    creator?: string;
  } | null;
}

const DEFAULT_VOCABULARIES: DefaultVocabulary[] = [
  {
    id: "cet46",
    name: "大学英语四六级核心词汇",
    description: "包含 CET-4 和 CET-6 核心词汇，约 8000 词",
    code: "CET4-6-2026-VOCAB",
    wordCount: 8000,
    sortOrder: 1,
  },
  {
    id: "ielts",
    name: "雅思核心词汇",
    description: "雅思考试高频词汇，约 4000 词",
    code: "IELTS-2026-CORE-WORDS",
    wordCount: 4000,
    sortOrder: 2,
  },
  {
    id: "kaoyan",
    name: "考研核心词汇",
    description: "硕士研究生入学考试核心词汇，约 5500 词",
    code: "KAOYAN-2026-MAIN-VOCAB",
    wordCount: 5500,
    sortOrder: 3,
  },
];

export function ShareImportModal({
  isOpen,
  onClose,
  onSuccess,
}: ShareImportModalProps) {
  const [shareCode, setShareCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [createNewGroup, setCreateNewGroup] = useState(true);
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({
    isValidating: false,
    isValid: null,
    error: null,
    data: null,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateShareCode = useCallback(async (code: string) => {
    if (!code || code.length < 11) {
      setValidation({
        isValidating: false,
        isValid: null,
        error: null,
        data: null,
      });
      return;
    }

    setValidation((prev) => ({
      ...prev,
      isValidating: true,
      error: null,
    }));

    try {
      const response = await fetch(`/api/share/validate/${code}`);
      const data = await response.json();

      if (data.valid) {
        setValidation({
          isValidating: false,
          isValid: true,
          error: null,
          data: data.data,
        });
      } else {
        setValidation({
          isValidating: false,
          isValid: false,
          error: data.message || "密钥无效",
          data: null,
        });
      }
    } catch (err) {
      setValidation({
        isValidating: false,
        isValid: false,
        error: "验证失败，请稍后重试",
        data: null,
      });
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (shareCode && !createNewGroup) {
        validateShareCode(shareCode);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [shareCode, validateShareCode, createNewGroup]);

  useEffect(() => {
    if (isOpen && !createNewGroup) {
      setIsLoadingGroups(true);
      fetch("/api/review-groups")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setReviewGroups(data.data || []);
          }
          setIsLoadingGroups(false);
        })
        .catch(() => {
          setIsLoadingGroups(false);
        });
    }
  }, [isOpen, createNewGroup]);

  useEffect(() => {
    if (!isOpen) {
      setShareCode("");
      setCustomName("");
      setTargetGroupId("");
      setCreateNewGroup(true);
      setValidation({
        isValidating: false,
        isValid: null,
        error: null,
        data: null,
      });
      setError(null);
    }
  }, [isOpen]);

  const handleSelectDefaultVocabulary = (vocab: DefaultVocabulary) => {
    setShareCode(vocab.code);
    setCustomName(vocab.name);
    validateShareCode(vocab.code);
  };

  const handleImport = async () => {
    setError(null);

    if (!shareCode) {
      setError("请输入分享密钥");
      return;
    }

    if (!customName || customName.trim() === "") {
      setError("请输入自定义名称");
      return;
    }

    if (!createNewGroup && !targetGroupId) {
      setError("请选择目标分组");
      return;
    }

    if (validation.isValid === false) {
      setError(validation.error || "密钥验证失败");
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch("/api/share/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: shareCode,
          customName: customName.trim(),
          targetGroupId: createNewGroup ? undefined : targetGroupId,
          createNewGroup,
          skipExisting: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.message || "导入失败，请稍后重试");
      }
    } catch (err) {
      setError("网络错误，请稍后重试");
    } finally {
      setIsImporting(false);
    }
  };

  const formatShareCode = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
    const parts = cleaned.split("-");
    const formattedParts = parts.map((part) => part.slice(0, 3));
    return formattedParts.join("-").slice(0, 11);
  };

  const handleShareCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatShareCode(e.target.value);
    setShareCode(formatted);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg sm:text-xl">导入共享词库</DialogTitle>
          <DialogDescription className="text-sm">
            输入分享密钥或选择默认词库，将词汇导入到您的词库中
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          {error && (
            <div className="p-2 sm:p-3 text-xs sm:text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-2 sm:mb-3">默认词库（推荐）</h3>
              <div className="grid gap-2">
                {DEFAULT_VOCABULARIES.map((vocab) => (
                  <Card
                    key={vocab.id}
                    className={cn(
                      "cursor-pointer transition-all hover:bg-muted/50",
                      shareCode === vocab.code && "bg-muted border-primary"
                    )}
                    onClick={() => handleSelectDefaultVocabulary(vocab)}
                  >
                    <CardContent className="p-2 sm:p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-1">
                            <span className="font-medium text-sm sm:text-base truncate">{vocab.name}</span>
                            <Badge variant="secondary" className="w-fit text-xs">
                              {vocab.wordCount} 词
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {vocab.description}
                          </p>
                        </div>
                        {shareCode === vocab.code && (
                          <CheckIcon className="size-4 sm:size-5 text-primary flex-shrink-0 mt-1 sm:mt-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  或输入分享密钥
                </span>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shareCode" className="text-xs sm:text-sm">分享密钥</Label>
                <Input
                  id="shareCode"
                  placeholder="ABC-123-XYZ"
                  value={shareCode}
                  onChange={handleShareCodeChange}
                  maxLength={11}
                  className="font-mono uppercase tracking-wider text-sm sm:text-base"
                  disabled={isImporting}
                />
                {validation.isValidating && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    验证中...
                  </div>
                )}
                {validation.isValid === true && (
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckIcon className="size-3" />
                    <span className="truncate">密钥有效：{validation.data?.wordCount} 个单词</span>
                  </div>
                )}
                {validation.isValid === false && validation.error && (
                  <div className="text-xs text-destructive break-words">
                    {validation.error}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customName" className="text-xs sm:text-sm">词库名称</Label>
                <Input
                  id="customName"
                  placeholder="输入自定义词库名称"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={isImporting}
                  className="text-sm sm:text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">导入到分组</Label>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={createNewGroup}
                      onChange={() => setCreateNewGroup(true)}
                      disabled={isImporting}
                      className="size-4"
                    />
                    <span className="text-xs sm:text-sm">创建新分组</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!createNewGroup}
                      onChange={() => setCreateNewGroup(false)}
                      disabled={isImporting}
                      className="size-4"
                    />
                    <span className="text-xs sm:text-sm">导入到现有分组</span>
                  </label>
                </div>

                {!createNewGroup && (
                  <Select
                    value={targetGroupId}
                    onValueChange={setTargetGroupId}
                    disabled={isLoadingGroups || isImporting}
                  >
                    <SelectTrigger className="mt-2 w-full text-sm sm:text-base">
                      <SelectValue placeholder="选择目标分组" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {reviewGroups.length === 0 ? (
                        <SelectItem value="none" disabled>
                          暂无分组
                        </SelectItem>
                      ) : (
                        reviewGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id} className="text-sm">
                            <span className="truncate">{group.name}</span>
                            {group._count?.words !== undefined && (
                              <span className="text-muted-foreground ml-1">
                                ({group._count.words} 词)
                              </span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t mt-4 sm:mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isImporting}
            className="w-full sm:w-auto order-2 sm:order-1"
            size="sm"
          >
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              isImporting ||
              !shareCode ||
              !customName ||
              validation.isValid === false ||
              (!createNewGroup && !targetGroupId)
            }
            className="w-full sm:w-auto order-1 sm:order-2"
            size="sm"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                导入中...
              </>
            ) : (
              "导入词库"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
