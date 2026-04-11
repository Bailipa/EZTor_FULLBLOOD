'use client';

import { useVersionCheck } from '@/hooks/useVersionCheck';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function UpdateNotification() {
  const { updateAvailable, versionInfo, applyUpdate, deferUpdate } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50">
      <Card className="p-4 shadow-lg border-border/50 bg-background/95 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">发现新版本</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setDismissed(true)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            {versionInfo && (
              <p className="text-xs text-muted-foreground mt-1">
                v{versionInfo.version} 已发布
              </p>
            )}
            
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={applyUpdate}
                className="flex-1 h-7 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                立即更新
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  deferUpdate();
                  setDismissed(true);
                }}
                className="h-7 text-xs"
              >
                <Clock className="w-3 h-3 mr-1" />
                稍后
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
