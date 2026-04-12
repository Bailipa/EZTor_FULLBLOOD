'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Languages, Copy, ClipboardPaste } from 'lucide-react';
import { useAnalytics } from '@/lib/analytics';

const MAX_LENGTH = 8000;

export function TranslateOnlyCard() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClearConfirm, setIsClearConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const { trackTranslateOnly } = useAnalytics();

  const charCount = input.length;
  const isOverLimit = charCount > MAX_LENGTH;
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const startFakeProgress = () => {
    setProgress(0);
    let current = 0;
    
    progressIntervalRef.current = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current >= 90) {
        current = 90 + Math.random() * 5;
      }
      setProgress(Math.min(current, 95));
    }, 300);
  };

  const finishProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  };

  const handleTranslate = async () => {
    if (isLoading) return;
    if (!input.trim()) return;
    setIsClearConfirm(false);

    setIsLoading(true);
    startFakeProgress();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/translate-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Translation failed');
        } else {
          throw new Error('Translation service temporarily unavailable. Please try again later.');
        }
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Translation failed');
      }
      
      setResult(data.data?.translation || '');
      finishProgress();
      trackTranslateOnly(input.length);
    } catch (error: unknown) {
      const err = error as Error;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setProgress(0);
      if (err.name === 'AbortError') {
        alert('Translation request timed out. Please try again.');
      } else {
        alert(err.message || 'Translation failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const handleCopy = async () => {
    if (!result.trim()) return;
    try {
      await navigator.clipboard.writeText(result);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      alert('复制失败，请手动复制');
    }
  };

  const handleClear = () => {
    if (!isClearConfirm) {
      setIsClearConfirm(true);
      return;
    }
    setInput('');
    setResult('');
    setIsClearConfirm(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setIsClearConfirm(false);
    } catch (error) {
      alert('无法读取剪贴板内容');
    }
  };

  return (
    <Card className="border-2 shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Translate Only
            </CardTitle>
            <CardDescription className="mt-1.5 text-xs sm:text-sm">
              中英互译，最多 {charCount}/{MAX_LENGTH} 字符，仅返回翻译文本，不写入生词本
            </CardDescription>
          </div>
          <CollapsibleTrigger asChild>
            <Button
              variant={isOpen ? 'secondary' : 'outline'}
              size="sm"
              className="gap-1.5 sm:gap-2 h-8 text-xs sm:text-sm px-2.5 sm:px-3"
            >
              {isOpen ? '收起' : '打开'}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <div className="relative">
              <Textarea
                placeholder="请输入中文或英文..."
                className="min-h-[110px] resize-y"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setIsClearConfirm(false);
                }}
                onKeyDown={handleKeyDown}
              />

            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handlePaste}>
                <ClipboardPaste className="w-4 h-4 mr-1" />
                粘贴
              </Button>
              <Button variant="outline" onClick={handleClear}>
                {isClearConfirm ? '再按一次' : '清空'}
              </Button>
              <Button onClick={handleTranslate} disabled={isLoading || !input.trim() || isOverLimit}>
                {isLoading ? '翻译中...' : '开始翻译'}
              </Button>
            </div>
            
            {isLoading && (
              <div className="space-y-1.5">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 w-full animate-progress-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  AI 正在翻译{progress < 95 ? '...' : '，即将完成！'}
                </p>
              </div>
            )}
            
            {result && (
              <div className="rounded-md border bg-gray-50 dark:bg-muted/50 p-3">
                <div className="flex justify-end mb-2">
                  <Button
                    variant={isCopied ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-2.5 text-xs gap-1.5"
                    onClick={handleCopy}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {isCopied ? '已复制' : '复制'}
                  </Button>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{result}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
