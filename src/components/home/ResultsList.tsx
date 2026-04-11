'use client';

import { forwardRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Volume2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@wrksz/themes/client';
import type { WordResult } from '@/types/api';
import { speakText } from '@/lib/ttsBrowser';

interface ResultsListProps {
  results: WordResult[];
  showPos: boolean;
  showExample: boolean;
}

export const ResultsList = forwardRef<HTMLDivElement, ResultsListProps>(
  function ResultsList({ results, showPos, showExample }, ref) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
      setMounted(true);
    }, []);
    
    const isDark = resolvedTheme === 'dark';
    
    const playAudio = (text: string) => {
      speakText(text);
    };

    if (results.length === 0) return null;

    return (
      <div ref={ref} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
              className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 flex items-center justify-center"
            >
              <Sparkles className="w-4 h-4 text-white" />
            </motion.div>
            <h3 className="text-lg font-medium">解析结果 ({results.length})</h3>
          </div>
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            ↓ 向下滚动查看详情
          </motion.span>
        </motion.div>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">
          提示：发音功能默认优先使用服务器内置的 Edge TTS；失败时会回退到浏览器自带的朗读引擎。
        </p>
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {results.map((item, index) => (
              <motion.div
                key={item.word}
                layout
                initial={{ 
                  opacity: 0, 
                  y: -100,
                  x: 100,
                  scale: 0.3,
                  rotate: -10,
                }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  x: 0, 
                  scale: 1,
                  rotate: 0,
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.8, 
                  y: 20,
                  transition: { duration: 0.2 },
                }}
                transition={{ 
                  duration: 0.35,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  delay: index * 0.05,
                }}
                whileHover={{ 
                  scale: 1.01,
                  transition: { duration: 0.15 },
                }}
              >
                <Card 
                  className={`overflow-hidden ${item.isNotFound ? 'border-amber-200 dark:border-amber-800' : 'border-transparent'}`}
                  style={{ 
                    backgroundColor: mounted ? (isDark ? 'rgb(38, 38, 38)' : 'rgb(255, 255, 255)') : undefined,
                    color: mounted ? (isDark ? 'rgb(245, 245, 245)' : 'rgb(23, 23, 23)') : undefined,
                  }}
                >
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.05 + 0.1 }}
                    className={`h-1 ${item.isNotFound ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400'}`}
                  />
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <motion.span 
                        className="text-xl font-bold text-primary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.05 + 0.2 }}
                      >
                        {item.word}
                      </motion.span>
                      {item.phonetic && (
                        <span className="text-sm text-gray-500 font-mono">[{item.phonetic}]</span>
                      )}
                      <button
                        onClick={() => playAudio(item.word)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                        title="点击发音"
                      >
                        <Volume2 size={18} />
                      </button>
                      {showPos && item.pos && <Badge variant="secondary">{item.pos}</Badge>}
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {item.translation}
                      </span>
                    </div>
                    {showExample && item.example && (
                      <div 
                        className="mt-2 text-sm p-3 rounded-md space-y-3"
                        style={{ 
                          backgroundColor: mounted ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgb(249, 250, 251)') : undefined,
                          color: mounted ? (isDark ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)') : undefined,
                        }}
                      >
                        {item.example.split('\n').map((ex: string, i: number) => {
                          const translations = item.exampleTranslation
                            ? item.exampleTranslation.split('\n')
                            : [];
                          const trans = translations[i] || '';
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-start gap-2">
                                <p className="italic flex-1">"{ex}"</p>
                                <button
                                  onClick={() => playAudio(ex)}
                                  className="p-1 text-gray-400 hover:text-primary rounded transition-colors shrink-0"
                                  title="朗读例句"
                                >
                                  <Volume2 size={14} />
                                </button>
                              </div>
                              {trans && <p className="text-gray-500 dark:text-gray-400">{trans}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);
