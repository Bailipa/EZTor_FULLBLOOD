'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000;
const IDLE_TIMEOUT = 30 * 1000;
const DEFER_KEY = 'update_deferred_until';
const UPDATING_KEY = 'is_updating';

interface VersionInfo {
  version: string;
  buildTime: string;
  name: string;
}

interface UseVersionCheckReturn {
  updateAvailable: boolean;
  versionInfo: VersionInfo | null;
  applyUpdate: () => void;
  deferUpdate: () => void;
  isChecking: boolean;
}

export function useVersionCheck(): UseVersionCheckReturn {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const isUserIdle = useCallback(() => {
    return Date.now() - lastActivityRef.current > IDLE_TIMEOUT;
  }, []);

  const isDeferred = useCallback(() => {
    const deferredUntil = sessionStorage.getItem(DEFER_KEY);
    if (!deferredUntil) return false;
    return Date.now() < parseInt(deferredUntil, 10);
  }, []);

  const checkVersion = useCallback(async () => {
    if (isDeferred()) return;
    
    const isUpdating = sessionStorage.getItem(UPDATING_KEY);
    if (isUpdating) {
      sessionStorage.removeItem(UPDATING_KEY);
      return;
    }
    
    setIsChecking(true);
    try {
      const res = await fetch('/api/version?t=' + Date.now(), {
        cache: 'no-store',
      });
      const info: VersionInfo = await res.json();
      
      const currentBuildTime = sessionStorage.getItem('build_time');
      
      if (currentBuildTime && currentBuildTime !== info.buildTime) {
        setVersionInfo(info);
        setUpdateAvailable(true);
      }
      
      sessionStorage.setItem('build_time', info.buildTime);
    } catch (e) {
      console.error('Version check failed:', e);
    } finally {
      setIsChecking(false);
    }
  }, [isDeferred]);

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    idleTimerRef.current = setTimeout(() => {
      if (updateAvailable && isUserIdle()) {
        window.location.reload();
      }
    }, IDLE_TIMEOUT);
  }, [updateAvailable, isUserIdle]);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkVersion]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach((event) => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });
    
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer);
      });
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer]);

  const applyUpdate = useCallback(() => {
    sessionStorage.removeItem(DEFER_KEY);
    sessionStorage.setItem(UPDATING_KEY, 'true');
    window.location.reload();
  }, []);

  const deferUpdate = useCallback(() => {
    const deferTime = Date.now() + 30 * 60 * 1000;
    sessionStorage.setItem(DEFER_KEY, deferTime.toString());
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    versionInfo,
    applyUpdate,
    deferUpdate,
    isChecking,
  };
}
