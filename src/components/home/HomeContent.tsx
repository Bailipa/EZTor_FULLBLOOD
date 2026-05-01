'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Danmaku } from '@/components/ui/danmaku';
import { WordInputCard, TranslateOnlyCard, ResultsList, HomeHeader } from '@/components/home';
import { GuestWordInputCard } from '@/components/home/GuestWordInputCard';
import { WelcomeBanner, useLoginPrompt } from '@/components/ui/login-prompt-modal';
import ErrorBoundary from '@/components/error-boundary';
import type { WordResult, ReviewGroup } from '@/types/api';
import { saveToStorage, loadFromStorage } from '@/lib/storage';
import { usePageView } from '@/lib/analytics';

export default function HomeContent() {
  usePageView('Home');

  const [wordsInput, setWordsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPos, setShowPos] = useState(true);
  const [showExample, setShowExample] = useState(true);
  const [results, setResults] = useState<WordResult[]>([]);
  const [showDanmaku, setShowDanmaku] = useState(false);
  const [groups, setGroups] = useState<ReviewGroup[]>([]);
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState<string>('none');
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevResultsLengthRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: session, status } = useSession();
  const { showLoginPrompt, pendingFeature, promptLogin, closePrompt, LoginPromptDialog } = useLoginPrompt();

  const isAuthenticated = status === 'authenticated' && session?.user;
  const isGuestMode = !isAuthenticated;

  useEffect(() => {
    const savedDanmaku = loadFromStorage<boolean>('vocab_showDanmaku', false);
    setShowDanmaku(savedDanmaku);
    const savedBannerDismissed = loadFromStorage<boolean>('vocab_welcomeBannerDismissed', false);
    setShowWelcomeBanner(!savedBannerDismissed);
  }, []);

  useEffect(() => {
    saveToStorage('vocab_showDanmaku', showDanmaku);
  }, [showDanmaku]);

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/review-groups')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setGroups(data.data);
          }
        })
        .catch((err) => console.error('Failed to fetch groups', err));
    }
  }, [session]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (results.length > 0 && prevResultsLengthRef.current === 0) {
      scrollTimeoutRef.current = setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
    prevResultsLengthRef.current = results.length;
  }, [results.length]);

  const handleFeatureClick = (featureName: string) => {
    if (isGuestMode) {
      promptLogin(featureName);
    }
  };

  const handleDismissBanner = () => {
    setShowWelcomeBanner(false);
    saveToStorage('vocab_welcomeBannerDismissed', true);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12 font-[family-name:var(--font-geist-sans)] relative transition-colors duration-300">
      {showDanmaku && isAuthenticated && <Danmaku isVisible={showDanmaku} />}

      <main className="max-w-7xl mx-auto space-y-6 relative z-10">
        <HomeHeader
          showDanmaku={showDanmaku}
          onToggleDanmaku={() => setShowDanmaku(!showDanmaku)}
          onFeatureClick={promptLogin}
        />

        {isGuestMode && showWelcomeBanner && (
          <WelcomeBanner onDismiss={handleDismissBanner} />
        )}

        <div className="grid grid-cols-1 gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {isGuestMode ? (
              <GuestWordInputCard
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                showPos={showPos}
                showExample={showExample}
                results={results}
                setResults={setResults}
                wordsInput={wordsInput}
                setWordsInput={setWordsInput}
                onFeatureClick={handleFeatureClick}
              />
            ) : (
              <WordInputCard
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                showPos={showPos}
                showExample={showExample}
                groups={groups}
                selectedTargetGroupId={selectedTargetGroupId}
                setSelectedTargetGroupId={setSelectedTargetGroupId}
                results={results}
                setResults={setResults}
                wordsInput={wordsInput}
                setWordsInput={setWordsInput}
              />
            )}

            {isGuestMode ? (
              <div
                className="cursor-pointer opacity-50 hover:opacity-70 transition-opacity"
                onClick={() => handleFeatureClick('AI 智能翻译')}
              >
                <ErrorBoundary>
                  <TranslateOnlyCard />
                </ErrorBoundary>
                <p className="text-center text-sm text-muted-foreground mt-2">
                  🔒 登录后解锁 AI 智能翻译
                </p>
              </div>
            ) : (
              <ErrorBoundary>
                <TranslateOnlyCard />
              </ErrorBoundary>
            )}

            <ResultsList ref={resultsRef} results={results} showPos={showPos} showExample={showExample} />
          </div>
        </div>
      </main>

      <footer className="mt-12 py-6 text-center text-sm text-muted-foreground">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          ICP备案号：粤ICP备2026008729号
        </a>
      </footer>

      <LoginPromptDialog />
    </div>
  );
}
