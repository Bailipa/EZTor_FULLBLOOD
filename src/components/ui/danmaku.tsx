'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@wrksz/themes/client';

interface DanmakuItem {
  id: string;
  word: string;
  translation: string;
  top: number;
  duration: number;
  delay: number;
  endTime: number;
}

export function Danmaku({ isVisible }: { isVisible: boolean }) {
  const { theme, systemTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tracksFreeTimeRef = useRef<number[]>(Array(12).fill(0));
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isDark = resolvedTheme === 'dark' || theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  // 定期清理已经播放完毕的弹幕，防止 DOM 元素无限增长
  useEffect(() => {
    if (!isVisible) return;
    
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      // 这里必须断言 item.endTime，因为我们在接口里没定义，或者在接口里补上
      setItems(prevItems => prevItems.filter(item => item.endTime > now));
    }, 10000); // 每 10 秒清理一次
    
    return () => clearInterval(cleanupInterval);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      setItems([]); // 隐藏时清空弹幕
      return;
    }

    // 获取随机数据并生成弹幕配置
    const fetchAndGenerateDanmaku = async () => {
      try {
        // 减少每次获取的数量，让屏幕看起来更稀疏，只需2-3个
        const res = await fetch(`/api/danmaku?limit=3&t=${Date.now()}`); 
        const result = await res.json();
        
        if (result.success && result.data && result.data.length > 0) {
          const words = result.data;
          const now = Date.now();
          const TRACK_COUNT = 10; // 划分 10 个轨道，增加垂直间距
          
          const newItems: DanmakuItem[] = [];
          
          for (let i = 0; i < words.length; i++) {
            const w = words[i];
            
            // 寻找当前可用的轨道（即当前时间 > 该轨道记录的下一次可用时间）
            let availableTracks: number[] = [];
            for (let t = 0; t < TRACK_COUNT; t++) {
              if (now > tracksFreeTimeRef.current[t]) {
                availableTracks.push(t);
              }
            }
            
            let trackIndex = 0;
            let delay = 0;
            
            if (availableTracks.length > 0) {
              // 如果有空闲轨道，随机选一个
              trackIndex = availableTracks[Math.floor(Math.random() * availableTracks.length)];
              // 增加基础延迟，让即使是第一批单词也不会立刻填满屏幕
              // 每个单词之间的出现时间拉开巨大的差距（0 到 15秒）
              delay = 2 + Math.random() * 15; 
            } else {
              // 如果所有轨道都很拥挤，找出最快能空出来的那个轨道
              let earliestTrack = 0;
              let earliestTime = tracksFreeTimeRef.current[0];
              for (let t = 1; t < TRACK_COUNT; t++) {
                if (tracksFreeTimeRef.current[t] < earliestTime) {
                  earliestTime = tracksFreeTimeRef.current[t];
                  earliestTrack = t;
                }
              }
              trackIndex = earliestTrack;
              // 必须延迟到该轨道空出来为止，再加上较长的安全缓冲
              delay = ((earliestTime - now) / 1000) + Math.random() * 5;
            }

            const top = 10 + (trackIndex * (80 / TRACK_COUNT)); // 调整范围 10% 到 90%，避开最顶和最底
            // 增加滚动时间，让移动速度变慢、变平滑
            const duration = 25 + Math.random() * 15; // 25-40秒
            
            // 更新该轨道的“足够空闲”时间
            // 假设弹幕在 duration 时间内走完 200vw (从 100vw 到 -100vw)
            // 增加占用时间比例到 40%，确保两车之间有足够长的空白距离
            const timeToClearEntry = duration * 0.4; 
            
            // 记录：下一次可以在这个轨道发射弹幕的最早时间
            tracksFreeTimeRef.current[trackIndex] = now + (delay * 1000) + (timeToClearEntry * 1000);
            
            newItems.push({
              id: `${w.word}-${now}-${i}`,
              word: w.word,
              translation: w.translation,
              top: top,
              duration: duration,
              delay: delay,
              endTime: now + (delay + duration) * 1000
            });
          }
          
          // 追加新弹幕
          setItems(prevItems => {
            const combined = [...prevItems, ...newItems];
            if (combined.length > 100) {
              return combined.slice(combined.length - 100);
            }
            return combined;
          });
        }
      } catch (err) {
        console.error("Failed to generate danmaku:", err);
      }
    };

    // 初始加载
    fetchAndGenerateDanmaku();

    // 将刷新间隔恢复到 12 秒，保持一个适中的刷新率
    // 每次只有 3 个词，这样屏幕上会有大段的空白时间，极度稀疏
    const interval = setInterval(() => {
      fetchAndGenerateDanmaku();
    }, 12000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // 如果不可见，直接返回 null
  if (!isVisible) return null;
  if (!mounted) return null;
  if (items.length === 0) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      aria-hidden="true"
    >
      {items.map((item) => (
        <motion.div
          key={item.id}
          className="absolute whitespace-nowrap px-4 py-2 backdrop-blur-md rounded-full shadow-md flex items-center gap-3"
          style={{ 
            top: `${item.top}%`,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
          initial={{ x: "100vw", opacity: 0 }}
          animate={{ x: "-100vw", opacity: [0, 1, 1, 0] }}
          transition={{
            x: {
              duration: item.duration,
              ease: "linear",
              delay: item.delay,
              repeat: 0,
            },
            opacity: {
              duration: item.duration,
              times: [0, 0.1, 0.9, 1],
              ease: "linear",
              delay: item.delay,
              repeat: 0,
            }
          }}
        >
          <span 
            className="font-bold text-lg"
            style={{ color: isDark ? '#f3f4f6' : '#111827' }}
          >
            {item.word}
          </span>
          <span 
            className="text-sm"
            style={{ color: isDark ? '#d1d5db' : '#374151' }}
          >
            {item.translation}
          </span>
        </motion.div>
      ))}
    </div>
  );
}