"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DefaultVocabulary {
  id: string;
  name: string;
  description: string | null;
  code: string;
  wordCount: number;
  sortOrder: number;
}

interface DefaultVocabularyListProps {
  onSelect: (code: string) => void;
  className?: string;
}

interface DefaultVocabularyState {
  isLoading: boolean;
  data: DefaultVocabulary[];
  error: string | null;
}

/**
 * DefaultVocabularyList 组件
 * 显示默认词库列表，用户可点击选择
 * 
 * 功能特性：
 * - 自动加载默认词库
 * - 卡片式展示
 * - 点击选择自动填充密钥
 * - 显示词库信息（名称、描述、单词数）
 */
export function DefaultVocabularyList({
  onSelect,
  className,
}: DefaultVocabularyListProps) {
  const [state, setState] = useState<DefaultVocabularyState>({
    isLoading: true,
    data: [],
    error: null,
  });

  useEffect(() => {
    const fetchDefaultVocabularies = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        
        const response = await fetch("/api/share/defaults");
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          setState({
            isLoading: false,
            data: result.data,
            error: null,
          });
        } else {
          setState({
            isLoading: false,
            data: [],
            error: result.error || "加载失败",
          });
        }
      } catch (error) {
        setState({
          isLoading: false,
          data: [],
          error: "网络错误，请稍后重试",
        });
      }
    };

    fetchDefaultVocabularies();
  }, []);

  const handleSelect = (vocab: DefaultVocabulary) => {
    onSelect(vocab.code);
  };

  if (state.isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-sm font-medium">默认词库（推荐）</h3>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-sm font-medium">默认词库（推荐）</h3>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <p className="text-sm">{state.error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.data.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-sm font-medium">默认词库（推荐）</h3>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              暂无默认词库
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium">默认词库（推荐）</h3>
      <div className="grid gap-3">
        {state.data.map((vocab) => (
          <Card
            key={vocab.id}
            className="cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:border-primary/50 group"
            onClick={() => handleSelect(vocab)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium">
                      {vocab.name}
                    </CardTitle>
                    {vocab.description && (
                      <CardDescription className="text-xs mt-1">
                        {vocab.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="shrink-0"
                >
                  {vocab.wordCount.toLocaleString()} 词
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <code className="relative rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                    {vocab.code}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(vocab);
                  }}
                >
                  选择
                  <ChevronRight className="size-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * 默认词库数据（备用，当 API 不可用时）
 * 参考 AI_DEVELOPMENT_SPEC.md Section 3.4
 */
export const DEFAULT_VOCABULARY_DATA: DefaultVocabulary[] = [
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

/**
 * 简化的 DefaultVocabularyList 组件（使用静态数据）
 * 适用于离线模式或 API 不可用的情况
 */
export function DefaultVocabularyListStatic({
  onSelect,
  className,
}: DefaultVocabularyListProps) {
  const handleSelect = (vocab: DefaultVocabulary) => {
    onSelect(vocab.code);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium">默认词库（推荐）</h3>
      <div className="grid gap-3">
        {DEFAULT_VOCABULARY_DATA.map((vocab) => (
          <Card
            key={vocab.id}
            className="cursor-pointer transition-all duration-200 hover:bg-muted/50 hover:shadow-md hover:border-primary/50 group"
            onClick={() => handleSelect(vocab)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <BookOpen className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium">
                      {vocab.name}
                    </CardTitle>
                    {vocab.description && (
                      <CardDescription className="text-xs mt-1">
                        {vocab.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="shrink-0"
                >
                  {vocab.wordCount.toLocaleString()} 词
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <code className="relative rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                    {vocab.code}
                  </code>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(vocab);
                  }}
                >
                  选择
                  <ChevronRight className="size-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
