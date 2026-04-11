'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export type EventType =
  | 'PAGE_VIEW'
  | 'TRANSLATE'
  | 'TRANSLATE_ONLY'
  | 'DICTATION_START'
  | 'DICTATION_COMPLETE'
  | 'DICTATION_ERROR'
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'SHARE'
  | 'ERROR'
  | 'API_ERROR';

const SESSION_KEY = 'analytics_session_id';
const SESSION_EXPIRY = 30 * 60 * 1000; // 30 minutes

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    const { id, timestamp } = JSON.parse(stored);
    if (Date.now() - timestamp < SESSION_EXPIRY) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id, timestamp: Date.now() }));
      return id;
    }
  }
  
  const newId = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: newId, timestamp: Date.now() }));
  return newId;
}

export function useAnalytics() {
  const sessionIdRef = useRef<string>('');
  
  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  const track = useCallback(async (
    eventType: EventType,
    metadata?: Record<string, unknown>
  ) => {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionIdRef.current
        },
        body: JSON.stringify({ eventType, metadata })
      });
    } catch (error) {
      console.error('Analytics track error:', error);
    }
  }, []);

  const trackPageView = useCallback((pageName?: string) => {
    track('PAGE_VIEW', { 
      path: window.location.pathname,
      pageName: pageName || document.title 
    });
  }, [track]);

  const trackTranslate = useCallback((wordCount: number, cached: boolean) => {
    track('TRANSLATE', { wordCount, cached });
  }, [track]);

  const trackTranslateOnly = useCallback((charCount: number) => {
    track('TRANSLATE_ONLY', { charCount });
  }, [track]);

  const trackDictationStart = useCallback((wordCount: number, mode: string) => {
    track('DICTATION_START', { wordCount, mode });
  }, [track]);

  const trackDictationComplete = useCallback((score: number, total: number) => {
    track('DICTATION_COMPLETE', { score, total, percentage: Math.round((score / total) * 100) });
  }, [track]);

  const trackError = useCallback((errorType: string, message: string) => {
    track('ERROR', { errorType, message: message.substring(0, 200) });
  }, [track]);

  const trackShare = useCallback((platform: string, contentType: string) => {
    track('SHARE', { platform, contentType });
  }, [track]);

  return {
    track,
    trackPageView,
    trackTranslate,
    trackTranslateOnly,
    trackDictationStart,
    trackDictationComplete,
    trackError,
    trackShare
  };
}

export function usePageView(pageName?: string) {
  const pathname = usePathname();
  const { trackPageView } = useAnalytics();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackPageView(pageName);
    }
  }, [pathname, pageName, trackPageView]);
}
