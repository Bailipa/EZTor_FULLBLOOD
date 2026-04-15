'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Upload, Sparkles, Globe } from 'lucide-react';
import { useTheme } from '@wrksz/themes/client';
import type { WordResult, ReviewGroup } from '@/types/api';
import { saveToStorage, loadFromStorage } from '@/lib/storage';
import { useAnalytics } from '@/lib/analytics';
import { isSentence } from '@/lib/sentenceDetector';

interface WordInputCardProps {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  showPos: boolean;
  showExample: boolean;
  groups: ReviewGroup[];
  selectedTargetGroupId: string;
  setSelectedTargetGroupId: (id: string) => void;
  results: WordResult[];
  setResults: (results: WordResult[] | ((prev: WordResult[]) => WordResult[])) => void;
  wordsInput: string;
  setWordsInput: (input: string | ((prev: string) => string)) => void;
}

interface FlyingWord {
  word: string;
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

export function WordInputCard({
  isLoading,
  setIsLoading,
  showPos,
  showExample,
  groups,
  selectedTargetGroupId,
  setSelectedTargetGroupId,
  results,
  setResults,
  wordsInput,
  setWordsInput,
}: WordInputCardProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [rawStreamText, setRawStreamText] = useState('');
  const [pendingWords, setPendingWords] = useState<string[]>([]);
  const [flyingWords, setFlyingWords] = useState<FlyingWord[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [inputStatus, setInputStatus] = useState<{ type: 'normal' | 'non-english' | 'sentence'; message: string }>({ type: 'normal', message: '' });
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isDark = resolvedTheme === 'dark';
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animatedWordsRef = useRef<Set<string>>(new Set());
  const { trackTranslate } = useAnalytics();

  useEffect(() => {
    const savedWordsInput = loadFromStorage<string>('vocab_wordsInput', '');
    const savedResults = loadFromStorage<WordResult[]>('vocab_results', []);
    if (savedWordsInput) setWordsInput(savedWordsInput);
    if (savedResults.length > 0) setResults(savedResults);
  }, []);

  useEffect(() => {
    saveToStorage('vocab_wordsInput', wordsInput);
  }, [wordsInput]);

  useEffect(() => {
    const trimmedInput = wordsInput.trim();
    if (!trimmedInput) {
      setInputStatus({ type: 'normal', message: '' });
      return;
    }

    const lines = trimmedInput.split('\n').filter(line => line.trim());
    
    setInputStatus({ type: 'normal', message: '' });
  }, [wordsInput]);

  useEffect(() => {
    saveToStorage('vocab_results', results);
  }, [results]);

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
    setRawStreamText('');
    setCompletedCount(0);
    setFlyingWords([]);
    animatedWordsRef.current.clear();

    const fixedResults: WordResult[] = [];
    const normalWords: string[] = [];

    for (const word of words) {
      let isNonEnglish = /[^\x00-\x7F]/.test(word);
      let isSent = isSentence(word);

      if (isNonEnglish) {
        fixedResults.push({
          word: word,
          phonetic: '',
          pos: '非英语',
          translation: '当前功能非英语不予翻译',
          example: '',
          exampleTranslation: '',
        });
      } else if (isSent) {
        fixedResults.push({
          word: word,
          phonetic: '',
          pos: '句子',
          translation: '当前功能不能翻译句子，翻译句子请使用Translate Only',
          example: '',
          exampleTranslation: '',
        });
      } else {
        normalWords.push(word);
      }
    }

    setPendingWords(words);
    
    // 批量处理固定结果，不使用 setTimeout
    const fixedResultsMap = new Map<string, WordResult>();
    fixedResults.forEach(result => {
      fixedResultsMap.set(result.word.toLowerCase(), result);
    });

    // 按照输入顺序处理固定结果
    const initialResults: WordResult[] = [];
    words.forEach(word => {
      const fixedResult = fixedResultsMap.get(word.toLowerCase());
      if (fixedResult) {
        initialResults.push(fixedResult);
      }
    });

    if (initialResults.length > 0) {
      setResults(initialResults);
      setPendingWords(prev => prev.filter(w => !fixedResultsMap.has(w.toLowerCase())));
      setCompletedCount(initialResults.length);
    }

    if (normalWords.length === 0) {
      setWordsInput('');
      trackTranslate(words.length, false);
      setIsLoading(false);
      return;
    }

    try {

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          words: normalWords,
          options: {
            showPos,
            showExample,
          },
          targetGroupId: selectedTargetGroupId === 'none' ? null : selectedTargetGroupId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败: ${response.statusText}`);
      }

      if (!response.body) throw new Error('ReadableStream not supported in this browser.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let accumulatedText = '';
      let lastValidParsedData: { results?: WordResult[] } | null = null;
      let flyingIdCounter = 0;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunkValue = decoder.decode(value, { stream: true });
          accumulatedText += chunkValue;
          setRawStreamText(accumulatedText);

          const jsonBlocks = accumulatedText.split('\n\n').filter((b) => b.trim());

          let parsedData: { results?: WordResult[] } | null = null;
          let currentAiBlock = jsonBlocks[jsonBlocks.length - 1] || '';

          let cleanText = currentAiBlock.trim();
          if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
          }
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
          }
          if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
          }
          cleanText = cleanText.trim();

          let jsonToParse = cleanText;
          parsedData = null;

          try {
            parsedData = JSON.parse(jsonToParse);
          } catch (e) {
            try {
              if (jsonToParse.startsWith('{') && !jsonToParse.endsWith('}')) {
                if (jsonToParse.includes('"results": [')) {
                  if (!jsonToParse.trim().endsWith(']')) {
                    const lastBrace = jsonToParse.lastIndexOf('}');
                    if (lastBrace > jsonToParse.indexOf('[')) {
                      jsonToParse = jsonToParse.substring(0, lastBrace + 1) + ']}';
                    } else {
                      jsonToParse += ']}';
                    }
                  } else {
                    jsonToParse += '}';
                  }
                }
              }
              parsedData = JSON.parse(jsonToParse);
            } catch (err2) {
              continue;
            }
          }

          if (parsedData && parsedData.results && Array.isArray(parsedData.results)) {
            lastValidParsedData = parsedData;
            const aiResults = parsedData.results.filter((item) => item && item.word);
            
            // 创建结果映射，方便按照输入顺序查找
            const resultMap = new Map<string, WordResult>();
            aiResults.forEach(result => {
              resultMap.set(result.word.toLowerCase(), result);
            });
            
            // 批量处理新结果，不使用 setTimeout
            const newResults: WordResult[] = [];
            const wordsToRemove: string[] = [];
            const newFlyingWords: FlyingWord[] = [];
            
            // 按照原始输入顺序处理结果，包括缓存结果和大模型结果
            for (const word of words) {
              const normalizedWord = word.toLowerCase();
              if (resultMap.has(normalizedWord) && !animatedWordsRef.current.has(normalizedWord)) {
                const result = resultMap.get(normalizedWord)!;
                animatedWordsRef.current.add(normalizedWord);
                
                const wordId = `fly-${Date.now()}-${flyingIdCounter++}`;
                
                const wordElement = document.querySelector(`[data-word="${normalizedWord.replace(/"/g, '\\"')}"]`);
                const rect = wordElement?.getBoundingClientRect();
                const startX = rect ? rect.left : 100 + (flyingIdCounter * 50);
                const startY = rect ? rect.top : 200;
                
                const targetX = window.innerWidth - 100;
                const targetY = window.innerHeight - 100;
                
                newFlyingWords.push({ 
                  word: result.word, 
                  id: wordId, 
                  startX, 
                  startY,
                  targetX,
                  targetY
                });
                
                newResults.push(result);
                wordsToRemove.push(word);
              }
            }
            
            // 批量更新状态
            if (newResults.length > 0) {
              setFlyingWords(prev => [...prev, ...newFlyingWords]);
              setPendingWords(prev => prev.filter(w => !wordsToRemove.includes(w)));
              
              // 批量更新结果
              setResults(prev => {
                // 先将所有结果放入map中
                const mergedMap = new Map<string, WordResult>();
                prev.forEach((p) => mergedMap.set(p.word.toLowerCase(), p));
                newResults.forEach(result => {
                  mergedMap.set(result.word.toLowerCase(), result);
                });
                
                // 按照原始输入顺序排序
                const orderedResults: WordResult[] = [];
                words.forEach(word => {
                  const wordLower = word.toLowerCase();
                  if (mergedMap.has(wordLower)) {
                    orderedResults.push(mergedMap.get(wordLower)!);
                  }
                });
                
                // 处理剩下的结果
                mergedMap.forEach((result, key) => {
                  if (!words.some(word => word.toLowerCase() === key)) {
                    orderedResults.push(result);
                  }
                });
                
                return orderedResults;
              });
              
              setCompletedCount(prev => prev + newResults.length);
              
              // 动画结束后自动移除飞行动画元素
              setTimeout(() => {
                setFlyingWords(prev => prev.filter(fw => !newFlyingWords.some(nfw => nfw.id === fw.id)));
              }, 1500);
            }
          }
        }
      }

      console.log('=== STREAM END ===');
      console.log('Accumulated Raw Text:', accumulatedText);
      console.log('Last Valid Parsed Data:', lastValidParsedData);

      let finalResults: WordResult[] = [];
      try {
        const jsonBlocks = accumulatedText.split('\n\n').filter((b) => b.trim());

        for (const block of jsonBlocks) {
          let finalText = block.trim();
          const startIdx = finalText.indexOf('{');
          const endIdx = finalText.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            finalText = finalText.substring(startIdx, endIdx + 1);
          }

          try {
            const parsed = JSON.parse(finalText);
            if (parsed && parsed.results && Array.isArray(parsed.results)) {
              finalResults = [...finalResults, ...parsed.results];
            }
          } catch (innerE) {
            console.warn('Failed to parse one of the blocks:', finalText);
          }
        }
        
        if (finalResults.length === 0 && lastValidParsedData?.results) {
          console.log('Using lastValidParsedData as fallback');
          finalResults = lastValidParsedData.results;
        }
      } catch (e) {
        console.warn('Final JSON parse failed overall.');
        if (lastValidParsedData && lastValidParsedData.results) {
          finalResults = lastValidParsedData.results;
        }
      }

      console.log('finalResults after parsing:', finalResults);

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

      const normalize = (s: string) => normalizeCase(s).trim().replace(/\s+/g, ' ');
      
      const finalMergedData: WordResult[] = [...finalResults];
      
      const actualWords = finalMergedData.map((r: WordResult) => normalize(r.word));
      const missingWords = normalWords.filter((w) => !actualWords.includes(normalize(w)));

      if (missingWords.length > 0) {
        const profanityRegex = /f\*\*k|fuck|shit|bitch|asshole|cunt|slut|dick|pussy/i;

        const filterNotices = missingWords.map((word) => {
          if (profanityRegex.test(word)) {
            return {
              word: word,
              phonetic: '',
              pos: '风控',
              translation: '⚠️ 该词触发大模型安全策略，不予翻译',
              example: '',
              exampleTranslation: '',
            };
          } else {
            return {
              word: word,
              phonetic: '',
              pos: '中断',
              translation: '受其它因素影响，解析结果改变或无法给出',
              example: '',
              exampleTranslation: '',
            };
          }
        });
        finalMergedData.push(...filterNotices);
      }

      const allResults = [...fixedResults, ...finalMergedData];
      
      // 去重处理，避免重复输出，同时保持原始输入顺序
      const seen = new Set<string>();
      const uniqueResults = allResults.filter(item => {
        const normalizedWord = normalize(item.word);
        if (seen.has(normalizedWord)) {
          return false;
        }
        seen.add(normalizedWord);
        return true;
      });
      
      // 按照原始输入顺序排序结果
      const inputOrderMap = new Map<string, number>();
      words.forEach((word, index) => {
        inputOrderMap.set(normalize(word), index);
      });
      
      // 确保按照原始输入顺序排序，即使有缓存结果
      const orderedResults: WordResult[] = [];
      const resultMap = new Map<string, WordResult>();
      
      // 先将所有结果放入map中，方便查找
      uniqueResults.forEach(result => {
        resultMap.set(normalize(result.word), result);
      });
      
      // 按照原始输入顺序遍历，从map中取出对应的结果
      words.forEach(word => {
        const normalizedWord = normalize(word);
        if (resultMap.has(normalizedWord)) {
          orderedResults.push(resultMap.get(normalizedWord)!);
          resultMap.delete(normalizedWord);
        }
      });
      
      // 处理剩下的结果（如果有的话）
      resultMap.forEach(result => {
        orderedResults.push(result);
      });
      
      setResults(orderedResults);

      setWordsInput((prevInput) => {
        const lines = prevInput.split('\n');
        const normalizedWords = orderedResults.map(res => normalize(res.word));
        const filteredLines = lines.filter(line => {
          const normalizedLine = normalize(line);
          return normalizedLine === '' || !normalizedWords.includes(normalizedLine);
        });
        return filteredLines.join('\n');
      });

      const wordsToSave = finalMergedData.filter(
        (item: WordResult) =>
          item.pos !== '错误' &&
          item.pos !== '风控' &&
          item.pos !== '中断' &&
          item.pos !== '非英语' &&
          item.pos !== '句子' &&
          !(item.translation && item.translation.includes('拼写错误或不存在')) &&
          !(item.translation && item.translation.includes('粗俗或敏感')) &&
          !(item.translation && item.translation.includes('⚠️'))
      );

      console.log('=== SYNC DEBUG ===');
      console.log('finalMergedData:', finalMergedData);
      console.log('wordsToSave:', wordsToSave);

      if (wordsToSave.length > 0) {
        console.log('Calling /api/sync with:', { results: wordsToSave });
        fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: wordsToSave }),
        })
          .then(res => res.json())
          .then(data => console.log('Sync response:', data))
          .catch((err) => console.error('Silent sync failed:', err));
      } else {
        console.log('No words to save');
      }

      trackTranslate(words.length, false);
      setPendingWords([]);
      setCompletedCount(orderedResults.length);
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      if (err.name === 'AbortError') {
        alert('请求超时：大模型响应时间过长，请检查网络或更换模型接入点。');
      } else {
        alert(err.message);
      }
    } finally {
      setIsLoading(false);
      setFlyingWords([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleProcess();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        setIsLoading(true);
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2) {
          alert('文件内容为空或格式不正确');
          return;
        }

        const headers = lines[0]
          .split(',')
          .map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());

        const uploadResults: WordResult[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values: string[] = [];
          let currentVal = '';
          let inQuotes = false;
          for (let char of lines[i]) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentVal);
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          values.push(currentVal);

          const wordObj: Partial<WordResult> = {};
          headers.forEach((header, index) => {
            if (values[index] !== undefined) {
              const val = values[index].replace(/^"|"$/g, '').trim();

              if (header.includes('exampletranslation') || header.includes('例句翻译')) {
                wordObj.exampleTranslation = val;
              } else if (header.includes('example') || header.includes('例句')) {
                wordObj.example = val;
              } else if (header.includes('translation') || header.includes('翻译') || header.includes('释义')) {
                wordObj.translation = val;
              } else if (header.includes('word') || header.includes('单词')) {
                wordObj.word = val;
              } else if (header.includes('phonetic') || header.includes('音标')) {
                wordObj.phonetic = val;
              } else if (header.includes('pos') || header.includes('词性')) {
                wordObj.pos = val;
              } else if (header.includes('correct')) {
                wordObj.correctCount = parseInt(val, 10) || 0;
              } else if (header.includes('incorrect')) {
                wordObj.incorrectCount = parseInt(val, 10) || 0;
              }
            }
          });

          if (wordObj.word) {
            uploadResults.push(wordObj as WordResult);
          }
        }

        if (uploadResults.length === 0) {
          alert('未能解析出有效的单词数据，请检查 CSV 格式是否包含 word/单词 列。');
          return;
        }

        const response = await fetch('/api/import-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: uploadResults }),
        });

        const data = await response.json();
        if (data.success) {
          alert(`成功导入 ${data.savedCount} 个单词到数据库！`);
        } else {
          alert(`导入失败: ${data.error}`);
        }
      } catch (err) {
        console.error('CSV import error:', err);
        alert('导入过程中发生错误，请检查控制台。');
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-start justify-between space-y-3 sm:space-y-0">
        <div>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <PenTool className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            批量单词/词组输入
          </CardTitle>
          <CardDescription className="mt-1.5 text-xs sm:text-sm">
            每行输入一个单词或词组，按回车换行
          </CardDescription>
        </div>
        <div className="w-full sm:w-auto">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <div className="flex flex-wrap items-center gap-2">
            {groups.length > 0 && (
              <Select value={selectedTargetGroupId} onValueChange={setSelectedTargetGroupId}>
                <SelectTrigger className="w-[130px] sm:w-[140px] h-8 text-xs bg-muted/30">
                  <SelectValue placeholder="解析后存入..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">仅存入总词库</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      存入: {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 sm:gap-2 h-8 text-xs sm:text-sm px-2.5 sm:px-3"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              导入 CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="min-h-[150px] p-4 border rounded-md bg-muted/30 flex flex-wrap gap-2 content-start items-start overflow-y-auto relative">
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
                  className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-sm font-medium shadow-sm"
                >
                  {word}
                </motion.div>
              ))}
            </AnimatePresence>
            
            <AnimatePresence>
              {flyingWords.map((fw) => {
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
          <div>
            {inputStatus.type !== 'normal' && (
              <div className={`p-3 mb-3 rounded-md flex items-center gap-2 ${inputStatus.type === 'non-english' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{inputStatus.message}</span>
              </div>
            )}
            <Textarea
              placeholder={`例如:
apple
gateway countries
take for granted`}
              className="min-h-[150px] resize-y"
              style={{ whiteSpace: 'pre-wrap' }}
              value={wordsInput}
              onChange={(e) => setWordsInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center">
        <span className="text-xs text-gray-400 dark:text-muted-foreground">支持 Ctrl+Enter 快捷解析</span>
        <Button onClick={handleProcess} disabled={isLoading}>
          {isLoading ? 'AI 正在处理...' : '一键解析'}
        </Button>
      </CardFooter>
    </Card>
  );
}
