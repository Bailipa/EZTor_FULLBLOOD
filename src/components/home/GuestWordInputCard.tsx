'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Database, Upload, AlertCircle, Search, Sparkles } from 'lucide-react';
import type { WordResult } from '@/types/api';
import { saveToStorage, loadFromStorage } from '@/lib/storage';

interface GuestWordInputCardProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setResults: (results: WordResult[] | ((prev: WordResult[]) => WordResult[])) => void;
  wordsInput: string;
  setWordsInput: (input: string | ((prev: string) => string)) => void;
}

interface NotFoundWord {
  word: string;
  suggestions?: string[];
}

export function GuestWordInputCard({
  isLoading,
  setIsLoading,
  setResults,
  wordsInput,
  setWordsInput,
}: GuestWordInputCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [notFoundWords, setNotFoundWords] = useState<NotFoundWord[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const savedWordsInput = loadFromStorage<string>('vocab_wordsInput', '');
    if (savedWordsInput) setWordsInput(savedWordsInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveToStorage('vocab_wordsInput', wordsInput);
  }, [wordsInput]);

  const handleProcess = async () => {
    if (isLoading) return;
    if (!wordsInput.trim()) return;

    const words = wordsInput
      .split('\n')
      .map((w) => w.trim().replace(/\s+/g, ' '))
      .filter((w) => w.length > 0);

    if (words.length > 50) {
      alert('单次最多只能查询 50 个单词或短语，请分批查询！');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setNotFoundWords([]);
    setPendingWords(words);
    setCompletedCount(0);

    try {
      const response = await fetch('/api/public-translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        const inputWordMap = new Map<string, string>();
        words.forEach(word => {
          inputWordMap.set(word.toLowerCase(), word);
        });

        const publicResults: WordResult[] = data.data.results.map((r: any) => ({
          word: inputWordMap.get(r.word.toLowerCase()) || r.word,
          phonetic: r.phonetic || undefined,
          pos: r.pos || undefined,
          translation: r.translation,
          example: r.example || undefined,
          exampleTranslation: r.exampleTranslation || undefined,
          isPublic: true,
        }));
        
        const foundWords = new Set(data.data.results.map((r: any) => r.word.toLowerCase()));
        const notFound = words.filter(w => !foundWords.has(w.toLowerCase()));
        
        const allResults: WordResult[] = [...publicResults];
        
        if (notFound.length > 0) {
          const notFoundWithSuggestions: NotFoundWord[] = await Promise.all(
            notFound.map(async (word) => {
              const suggestions = await findSimilarWords(word, data.data.results);
              return { word, suggestions };
            })
          );
          setNotFoundWords(notFoundWithSuggestions);
          
          const notFoundResults: WordResult[] = notFound.map((word) => ({
            word,
            phonetic: '',
            pos: '未收录',
            translation: '⚠️ 该词未在公共词库中收录，登录后可使用 AI 翻译',
            example: '',
            exampleTranslation: '',
            isPublic: false,
            isNotFound: true,
          }));
          
          allResults.push(...notFoundResults);
        }

        const orderedResults: WordResult[] = [];
        const resultMap = new Map<string, WordResult>();
        
        allResults.forEach(result => {
          resultMap.set(result.word.toLowerCase(), result);
        });
        
        words.forEach(word => {
          const normalizedWord = word.toLowerCase();
          if (resultMap.has(normalizedWord)) {
            orderedResults.push(resultMap.get(normalizedWord)!);
            resultMap.delete(normalizedWord);
          }
        });
        
        resultMap.forEach(result => {
          orderedResults.push(result);
        });

        setPendingWords([]);
        setResults(orderedResults);
        setCompletedCount(orderedResults.length);
        
        setWordsInput((prevInput) => {
          const lines = prevInput.split('\n');
          const foundSet = new Set(foundWords);
          return lines
            .filter((l) => {
              const normalized = l.trim().toLowerCase();
              return normalized && !foundSet.has(normalized);
            })
            .join('\n');
        });

        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'GUEST_TRANSLATE',
            metadata: {
              totalWords: words.length,
              foundWords: publicResults.length,
              notFoundWords: notFound.length,
              successRate: Math.round((publicResults.length / words.length) * 10000) / 100,
            }
          })
        }).catch(() => {});
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') console.error('Translation error:', error);
      alert(error.message || '查询失败，请稍后重试');
      
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'GUEST_TRANSLATE_ERROR',
          metadata: {
            error: error.message,
            wordCount: words.length,
          }
        })
      }).catch(() => {});
    } finally {
      setIsLoading(false);
      setPendingWords([]);
    }
  };

  const findSimilarWords = async (word: string, results: any[]): Promise<string[]> => {
    const allWords = results.map((r: any) => r.word);
    const suggestions: string[] = [];
    const lowerWord = word.toLowerCase();
    
    for (const w of allWords) {
      const lowerW = w.toLowerCase();
      if (lowerW.includes(lowerWord) || lowerWord.includes(lowerW)) {
        suggestions.push(w);
      } else if (levenshteinDistance(lowerWord, lowerW) <= 2) {
        suggestions.push(w);
      }
      if (suggestions.length >= 3) break;
    }
    
    return suggestions;
  };

  const levenshteinDistance = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleProcess();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setWordsInput(text);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Card className="overflow-hidden border-2 shadow-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            公共词库查词
            <span className="text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
              访客模式
            </span>
          </CardTitle>
          <CardDescription className="mt-1.5 text-xs sm:text-sm">
            从公共词库查询单词翻译。登录后可使用 AI 翻译、生词本等更多功能。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {isLoading ? (
          <div className="min-h-[150px] p-4 border rounded-md bg-muted/30 flex flex-wrap gap-2 content-start items-start relative overflow-visible" role="status" aria-live="polite" aria-label="正在查询中">
            {pendingWords.map((word, index) => (
              <span
                key={`${index}-${word}`}
                data-word={word.toLowerCase()}
                className="px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md text-sm font-medium shadow-sm animate-[fadeIn_0.25s_ease-in-out]"
              >
                {word}
              </span>
            ))}
              
              {pendingWords.length === 0 && (
                <div className="flex flex-col items-center justify-center w-full py-8 animate-[fadeIn_0.3s_ease-in-out]">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-green-500" />
                  </div>
                  <span className="text-muted-foreground text-sm font-medium">
                    查询完成
                  </span>
                  <span className="text-muted-foreground text-xs mt-1">
                    已找到 {completedCount} 个结果
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <Textarea
                placeholder={`输入要查询的单词或短语，每行一个...
例如：
apple
banana
orange`}
                className="min-h-[150px] resize-y pr-12"
                style={{ whiteSpace: 'pre-wrap' }}
                value={wordsInput}
                onChange={(e) => setWordsInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                aria-label="输入要查询的单词"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt"
                className="hidden"
                aria-label="从文件导入"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => fileInputRef.current?.click()}
                title="从文件导入"
                aria-label="从文件导入"
                disabled={isLoading}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              公共词库仅包含已收录的单词。登录后可使用 AI 翻译任意单词。
            </span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <span className="text-xs text-gray-400 dark:text-muted-foreground">
            支持 Ctrl+Enter 快捷查询
          </span>
          <Button
            onClick={handleProcess}
            disabled={isLoading || !wordsInput.trim()}
            className="gap-2"
            aria-label="从公共词库查询"
          >
            {isLoading ? (
              <>
                <Search className="h-4 w-4 animate-spin" />
                查询中...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                从公共词库查询
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {notFoundWords.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 mt-4 animate-[fadeIn_0.3s_ease-in-out]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              部分单词未找到
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notFoundWords.map((item, index) => (
              <div key={`${index}-${item.word}`} className="text-sm">
                <span className="font-medium text-foreground">{item.word}</span>
                {item.suggestions && item.suggestions.length > 0 && (
                  <span className="text-muted-foreground ml-2">
                    → 您是否想查: {item.suggestions.join(', ')}
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              💡 登录后可使用 AI 翻译任意单词，不受词库限制
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
