"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { ProgressBar, useProgress } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

interface ReviewGroup {
  id: string;
  name: string;
  _count?: {
    ReviewGroupWord: number;
  };
}

interface DefaultVocabulary {
  id: string;
  name: string;
  description: string | null;
  code: string;
  wordCount: number;
  sortOrder: number;
  groupName?: string;
}

interface Word {
  id: string;
  word: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  example: string | null;
  exampleTranslation: string | null;
  correctCount: number;
  incorrectCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface ShareImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data?: {
    groupId: string;
    groupName: string;
    newWords: Word[];
  }) => void;
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

interface DefaultVocabularyState {
  isLoading: boolean;
  data: DefaultVocabulary[];
  error: string | null;
}

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
  const [importProgress, setImportProgress] = useState(0);
  const [importStep, setImportStep] = useState("");
  const [defaultVocabularies, setDefaultVocabularies] = useState<DefaultVocabularyState>({
    isLoading: true,
    data: [],
    error: null,
  });
  
  const isImportingRef = useRef(false);

  const importProgressController = useProgress({
    autoStart: false,
  });

  // 获取默认词库列表
  useEffect(() => {
    if (isOpen) {
      const fetchDefaultVocabularies = async () => {
        try {
          setDefaultVocabularies((prev) => ({ ...prev, isLoading: true, error: null }));
          const response = await fetch("/api/share/defaults");
          const result = await response.json();

          if (result.success && Array.isArray(result.data)) {
            setDefaultVocabularies({
              isLoading: false,
              data: result.data,
              error: null,
            });
          } else {
            setDefaultVocabularies({
              isLoading: false,
              data: [],
              error: result.error || "加载失败",
            });
          }
        } catch (err) {
          setDefaultVocabularies({
            isLoading: false,
            data: [],
            error: "网络错误",
          });
        }
      };

      fetchDefaultVocabularies();
    }
  }, [isOpen]);

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
      } else if (data.error === '请先登录' || data.success === false && data.error === '未登录') {
        // 401 error - user not logged in, show login prompt
        setValidation({
          isValidating: false,
          isValid: null,
          error: "请先登录后再验证密钥",
          data: null,
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
      if (shareCode) {
        validateShareCode(shareCode);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [shareCode, validateShareCode]);

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
    setImportProgress(0);
    setImportStep("");

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

    isImportingRef.current = true;
    setIsImporting(true);
    importProgressController.start();

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

      if (!response.ok) {
        if (response.status === 401) {
          const errorData = await response.json();
          throw new Error(errorData.error || "请先登录");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取响应");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let lastProgressData: any = null;
      let finalResult: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          try {
            const parsed = JSON.parse(trimmed);
            
            if (parsed.progress !== undefined) {
              setImportProgress(parsed.progress);
              importProgressController.setProgress(parsed.progress);
              lastProgressData = parsed;
            }
            if (parsed.step) {
              setImportStep(parsed.step);
            }
            if (parsed.success !== undefined) {
              finalResult = parsed;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.progress !== undefined) {
            setImportProgress(parsed.progress);
            importProgressController.setProgress(parsed.progress);
          }
          if (parsed.step) {
            setImportStep(parsed.step);
          }
          if (parsed.success !== undefined) {
            finalResult = parsed;
          }
        } catch (e) {
          // Ignore parse errors on remaining buffer
        }
      }

      if (finalResult) {
        if (finalResult.success) {
          importProgressController.complete();
          onSuccess({
            groupId: finalResult.data.groupId,
            groupName: finalResult.data.groupName,
            newWords: finalResult.data.newWords || []
          });
          onClose();
        } else {
          let errorMessage = '';
          
          if (finalResult.step) {
            errorMessage = `【${finalResult.step}】`;
          }
          
          if (finalResult.message) {
            errorMessage += finalResult.message;
          } else {
            errorMessage += '导入失败';
          }
          
          if (finalResult.suggestion) {
            errorMessage += `\n\n💡 建议：${finalResult.suggestion}`;
          }
          
          if (finalResult.details && process.env.NODE_ENV === 'development') {
            errorMessage += `\n\n技术细节：${finalResult.details}`;
          }
          
          if (finalResult.error) {
            errorMessage += `\n错误代码：${finalResult.error}`;
          }
          
          importProgressController.error();
          setError(errorMessage);
        }
      } else {
        importProgressController.error();
        setError("导入完成但未收到有效响应，请检查词库是否已导入");
      }
    } catch (err: any) {
      importProgressController.error();
      let errorMessage = '网络错误';
      
      if (err.message) {
        if (err.message === '请先登录' || err.message === '未登录') {
          errorMessage = '请先登录后再导入词库\n\n💡 建议：点击右上角的登录按钮进行登录';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = '网络连接失败：无法连接到服务器\n\n💡 建议：请检查网络连接或刷新页面后重试';
        } else if (err.message.includes('timeout')) {
          errorMessage = '请求超时：导入操作响应时间过长\n\n💡 建议：词汇数量较多时请耐心等待，或尝试分批导入';
        } else {
          errorMessage = `网络错误：${err.message}\n\n💡 建议：请检查网络连接后重试`;
        }
      }
      
      setError(errorMessage);
    } finally {
      isImportingRef.current = false;
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
            <div className="p-2 sm:p-3 text-xs sm:text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20 space-y-1">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle shrink-0 mt-0.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" x2="12" y1="8" y2="12"></line>
                  <line x1="12" x2="12.01" y1="16" y2="16"></line>
                </svg>
                <div className="flex-1 whitespace-pre-wrap break-words">
                  {error.split('\n\n').map((line, i) => (
                    <div key={i} className={i > 0 ? 'mt-2' : ''}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isImporting && (
            <div className="space-y-3">
              <ProgressBar
                value={importProgressController.progress}
                status={importProgressController.status}
                label="导入进度"
                subLabel={importStep || "准备导入..."}
                showPercentage
                showIcon
                size="md"
              />
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            <div>
              <h3 className="text-xs sm:text-sm font-medium mb-2 sm:mb-3">默认词库（推荐）</h3>
              {defaultVocabularies.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-2 sm:p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : defaultVocabularies.error ? (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="p-2 sm:p-3">
                    <p className="text-xs sm:text-sm text-destructive">{defaultVocabularies.error}</p>
                  </CardContent>
                </Card>
              ) : defaultVocabularies.data.length === 0 ? (
                <Card>
                  <CardContent className="p-2 sm:p-3">
                    <p className="text-xs sm:text-sm text-muted-foreground text-center">暂无默认词库</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {defaultVocabularies.data.map((vocab: DefaultVocabulary) => (
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
              )}
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
                            {group._count?.ReviewGroupWord !== undefined && (
                              <span className="text-muted-foreground ml-1">
                                ({group._count.ReviewGroupWord} 词)
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
              isImportingRef.current ||
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
