'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Upload, AlertCircle, Search, Lightbulb, Sparkles } from 'lucide-react';
import { useTheme } from '@wrksz/themes/client';
import type { WordResult } from '@/types/api';
import { saveToStorage, loadFromStorage } from '@/lib/storage';

interface GuestWordInputCardProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showPos: boolean;
  showExample: boolean;
  results: WordResult[];
  setResults: (results: WordResult[] | ((prev: WordResult[]) => WordResult[])) => void;
  wordsInput: string;
  setWordsInput: (input: string | ((prev: string) => string)) => void;
  onFeatureClick: (featureName: string) => void;
}

interface NotFoundWord {
  word: string;
  suggestions?: string[];
}

interface FlyingWord {
  word: string;
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export function GuestWordInputCard({
  isLoading,
  setIsLoading,
  showPos,
  showExample,
  results,
  setResults,
  wordsInput,
  setWordsInput,
  onFeatureClick,
}: GuestWordInputCardProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [notFoundWords, setNotFoundWords] = useState<NotFoundWord[]>([]);
  const [flyingWords, setFlyingWords] = useState<FlyingWord[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const savedWordsInput = loadFromStorage<string>('vocab_wordsInput', '');
    if (savedWordsInput) setWordsInput(savedWordsInput);
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
    setFlyingWords([]);

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
        // 创建单词映射，用于保持输入的原始大小写和顺序
        const inputWordMap = new Map<string, string>();
        words.forEach(word => {
          inputWordMap.set(word.toLowerCase(), word);
        });

        // 处理公共词库结果，保持原始大小写
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
        
        // 先处理所有结果，然后按照原始输入顺序排序
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

        // 按照原始输入顺序排序结果
        const orderedResults: WordResult[] = [];
        const resultMap = new Map<string, WordResult>();
        
        // 先将所有结果放入map中，方便查找
        allResults.forEach(result => {
          resultMap.set(result.word.toLowerCase(), result);
        });
        
        // 按照原始输入顺序遍历，从map中取出对应的结果
        words.forEach(word => {
          const normalizedWord = word.toLowerCase();
          if (resultMap.has(normalizedWord)) {
            orderedResults.push(resultMap.get(normalizedWord)!);
            resultMap.delete(normalizedWord);
          }
        });
        
        // 处理剩下的结果（如果有的话）
        resultMap.forEach(result => {
          orderedResults.push(result);
        });

        // 显示动画并更新结果
        for (let i = 0; i < orderedResults.length; i++) {
          const word = orderedResults[i];
          const wordId = `fly-${Date.now()}-${i}`;
          
          const wordElement = document.querySelector(`[data-word="${word.word.toLowerCase().replace(/"/g, '\\"')}"]`);
          const rect = wordElement?.getBoundingClientRect();
          const startX = rect ? rect.left : 100 + (i * 50);
          const startY = rect ? rect.top : 200;
          
          const targetX = window.innerWidth - 100;
          const targetY = window.innerHeight - 100;
          
          setFlyingWords(prev => [...prev, { 
            word: word.word, 
            id: wordId, 
            startX, 
            startY,
            targetX,
            targetY
          }]);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          setPendingWords((prev) => 
            prev.filter((pw) => pw.toLowerCase() !== word.word.toLowerCase())
          );
          
          await new Promise(resolve => setTimeout(resolve, 800));
          
          setResults((prev) => {
            // 先将所有结果放入map中，方便查找
            const resultMap = new Map<string, WordResult>();
            prev.forEach((p) => resultMap.set(p.word.toLowerCase(), p));
            resultMap.set(word.word.toLowerCase(), word);
            
            // 按照原始输入顺序排序结果
            const orderedResults: WordResult[] = [];
            words.forEach(word => {
              const normalizedWord = word.toLowerCase();
              if (resultMap.has(normalizedWord)) {
                orderedResults.push(resultMap.get(normalizedWord)!);
              }
            });
            
            // 处理剩下的结果（如果有的话）
            resultMap.forEach((result, key) => {
              if (!words.some(word => word.toLowerCase() === key)) {
                orderedResults.push(result);
              }
            });
            
            return orderedResults;
          });
          
          setCompletedCount(prev => prev + 1);
          
          setFlyingWords(prev => prev.filter(fw => fw.id !== wordId));
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
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
      console.error('Translation error:', error);
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
      setFlyingWords([]);
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

  // 大小写一致性检查与规范化处理
  const normalizeCase = (text: string): string => {
    // 检查是否为需要保留大写的特殊情况
    const specialCases = [
      // 首字母缩写词
      /^[A-Z0-9]+$/, // 全大写的缩写词
      /^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/, // 驼峰命名法的专有名词
      // 常见的专有名词和品牌名称
      'AI', 'API', 'CSS', 'HTML', 'HTTP', 'HTTPS', 'JSON', 'JS', 'TS', 'UI', 'UX',
      'Google', 'Microsoft', 'Apple', 'Amazon', 'Facebook', 'Twitter', 'GitHub',
      'React', 'Next.js', 'Node.js', 'JavaScript', 'TypeScript'
    ];

    // 检查是否匹配特殊情况
    for (const casePattern of specialCases) {
      if (typeof casePattern === 'string' && text === casePattern) {
        return text;
      } else if (casePattern instanceof RegExp && casePattern.test(text)) {
        return text;
      }
    }

    // 对于其他情况，转换为小写
    return text.toLowerCase();
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
          <div className="min-h-[150px] p-4 border rounded-md bg-muted/30 flex flex-wrap gap-2 content-start items-start relative overflow-visible">
            <AnimatePresence>
              {pendingWords.map((word, index) => (
                <motion.div
                  key={`${index}-${word}`}
                  data-word={word.toLowerCase()}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.5,
                    y: -30,
                    filter: 'blur(4px)',
                    transition: { duration: 0.35, ease: 'easeOut' },
                  }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md text-sm font-medium shadow-sm"
                >
                  {word}
                </motion.div>
              ))}
            </AnimatePresence>
            
            <AnimatePresence>
              {flyingWords.map((fw, index) => {
                return (
                  <motion.div
                    key={fw.id}
                    className="fixed z-[9999] pointer-events-none"
                    initial={{ 
                      opacity: 0, 
                      scale: 0.95,
                      x: fw.startX || 0,
                      y: fw.startY || 0,
                    }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      scale: [0.95, 1, 1, 0.9],
                      x: [0, 20, 40, fw.targetX * 0.6],
                      y: [0, fw.targetY * 0.35, fw.targetY * 0.65, fw.targetY],
                    }}
                    transition={{ 
                      duration: 1.5, 
                      ease: [0.4, 0, 0.2, 1],
                      times: [0, 0.15, 0.7, 1],
                    }}
                    style={{
                      left: fw.startX,
                      top: fw.startY,
                    }}
                  >
                    <div
                      className="px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm"
                      style={{
                        background: mounted 
                          ? (isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.9)')
                          : 'rgba(0, 0, 0, 0.75)',
                        color: mounted 
                          ? (isDark ? 'white' : 'rgb(23, 23, 23)')
                          : 'white',
                        boxShadow: mounted 
                          ? (isDark ? '0 2px 8px rgba(0, 0, 0, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.1)')
                          : '0 2px 8px rgba(0, 0, 0, 0.15)',
                      }}
                    >
                      {fw.word}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
              
              {pendingWords.length === 0 && flyingWords.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center justify-center w-full py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3"
                  >
                    <Sparkles className="w-6 h-6 text-green-500" />
                  </motion.div>
                  <span className="text-muted-foreground text-sm font-medium">
                    查询完成
                  </span>
                  <span className="text-muted-foreground text-xs mt-1">
                    已找到 {completedCount} 个结果
                  </span>
                </motion.div>
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
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt"
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => fileInputRef.current?.click()}
                title="从文件导入"
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
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Search className="h-4 w-4" />
                </motion.div>
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

      <AnimatePresence>
        {notFoundWords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="mt-4"
          >
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lightbulb className="h-4 w-4" />
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
