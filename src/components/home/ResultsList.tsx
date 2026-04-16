'use client';

import { forwardRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Volume2, Sparkles } from 'lucide-react';
import { useTheme } from '@wrksz/themes/client';
import type { WordResult } from '@/types/api';
import { speakText } from '@/lib/ttsBrowser';
import { Virtuoso } from 'react-virtuoso';

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
        <div className="flex items-center gap-2 animate-[fadeIn_0.3s_ease-in-out]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500 flex items-center justify-center animate-[scaleIn_0.3s_ease-out_0.1s_both]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-medium">解析结果 ({results.length})</h3>
          </div>
          <span className="text-sm text-muted-foreground animate-[fadeIn_0.3s_ease-in-out_0.2s_both]">
            ↓ 向下滚动查看详情
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">
          提示：发音功能默认优先使用服务器内置的 Edge TTS；失败时会回退到浏览器自带的朗读引擎。
        </p>
        {results.length > 20 ? (
          <Virtuoso
            data={results}
            overscan={200}
            itemContent={(index, item) => (
              <ResultCard
                key={`${index}-${item.word}`}
                item={item}
                index={index}
                showPos={showPos}
                showExample={showExample}
                mounted={mounted}
                isDark={isDark}
                playAudio={playAudio}
              />
            )}
          />
        ) : (
          <div className="grid gap-4">
            {results.map((item, index) => (
              <ResultCard
                key={`${index}-${item.word}`}
                item={item}
                index={index}
                showPos={showPos}
                showExample={showExample}
                mounted={mounted}
                isDark={isDark}
                playAudio={playAudio}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

interface ResultCardProps {
  item: WordResult;
  index: number;
  showPos: boolean;
  showExample: boolean;
  mounted: boolean;
  isDark: boolean;
  playAudio: (text: string) => void;
}

function ResultCard({ item, index, showPos, showExample, mounted, isDark, playAudio }: ResultCardProps) {
  return (
    <Card
      className={`overflow-hidden animate-[slideIn_0.35s_ease-out_${index * 0.03}s_both] ${item.isNotFound ? 'border-amber-200 dark:border-amber-800' : 'border-transparent'}`}
      style={{
        backgroundColor: mounted ? (isDark ? 'rgb(38, 38, 38)' : 'rgb(255, 255, 255)') : undefined,
        color: mounted ? (isDark ? 'rgb(245, 245, 245)' : 'rgb(23, 23, 23)') : undefined,
        willChange: 'transform, opacity',
      }}
    >
      <div
        className={`h-1 animate-[scaleX_0.4s_ease-out_${index * 0.03 + 0.1}s_both] origin-left ${item.isNotFound ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400'}`}
      />
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-primary">
            {item.word}
          </span>
          {item.phonetic && (
            <span className="text-sm text-gray-500 font-mono">[{item.phonetic}]</span>
          )}
          <button
            onClick={() => playAudio(item.word)}
            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
            title="点击发音"
            aria-label={`播放 ${item.word} 的发音`}
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
                      aria-label={`朗读例句: ${ex}`}
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
  );
}
