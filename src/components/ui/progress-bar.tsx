'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export type ProgressStatus = 'idle' | 'loading' | 'normal' | 'warning' | 'success' | 'error';

export interface ProgressBarProps {
  value: number;
  status?: ProgressStatus;
  showPercentage?: boolean;
  showIcon?: boolean;
  label?: string;
  subLabel?: string;
  animated?: boolean;
  striped?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<ProgressStatus, {
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  text: string;
}> = {
  idle: {
    color: 'bg-gray-400 dark:bg-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    icon: null,
    text: '等待中'
  },
  loading: {
    color: 'bg-blue-500 dark:bg-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    text: '处理中'
  },
  normal: {
    color: 'bg-primary',
    bgColor: 'bg-muted',
    icon: null,
    text: ''
  },
  warning: {
    color: 'bg-amber-500 dark:bg-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
    text: '注意'
  },
  success: {
    color: 'bg-green-500 dark:bg-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    text: '完成'
  },
  error: {
    color: 'bg-red-500 dark:bg-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    icon: <AlertCircle className="w-4 h-4 text-red-500" />,
    text: '失败'
  }
};

const sizeConfig = {
  sm: { height: 'h-1.5', text: 'text-xs', padding: 'p-2' },
  md: { height: 'h-2.5', text: 'text-sm', padding: 'p-3' },
  lg: { height: 'h-4', text: 'text-base', padding: 'p-4' }
};

export function ProgressBar({
  value,
  status = 'normal',
  showPercentage = true,
  showIcon = true,
  label,
  subLabel,
  animated = true,
  striped = false,
  size = 'md',
  className
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const _config = statusConfig[status];
  const sizeStyle = sizeConfig[size];

  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setDisplayValue(clampedValue);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setDisplayValue(clampedValue);
    }
  }, [clampedValue, animated]);

  const isComplete = displayValue >= 100;
  const currentStatus = isComplete && status !== 'error' ? 'success' : status;
  const currentConfig = statusConfig[currentStatus];

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage || showIcon) && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            {showIcon && currentConfig.icon && (
              <span className="flex-shrink-0">{currentConfig.icon}</span>
            )}
            {label && (
              <span className={cn('font-medium text-foreground', sizeStyle.text)}>
                {label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {subLabel && (
              <span className={cn('text-muted-foreground', sizeStyle.text)}>
                {subLabel}
              </span>
            )}
            {showPercentage && (
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  sizeStyle.text,
                  currentStatus === 'success' && 'text-green-600 dark:text-green-400',
                  currentStatus === 'error' && 'text-red-600 dark:text-red-400',
                  currentStatus === 'warning' && 'text-amber-600 dark:text-amber-400'
                )}
              >
                {Math.round(displayValue)}%
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full',
          sizeStyle.height,
          currentConfig.bgColor
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            currentConfig.color,
            striped && 'bg-stripes'
          )}
          style={{ width: `${displayValue}%` }}
        >
          {status === 'loading' && animated && (
            <div className="absolute inset-0 w-full">
              <div className="h-full w-full animate-progress-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          )}
        </div>

        {isComplete && status !== 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircle2
              className={cn(
                'text-white drop-shadow-sm transition-all duration-300',
                size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3.5 h-3.5' : 'w-5 h-5'
              )}
            />
          </div>
        )}
      </div>

      {currentConfig.text && status !== 'normal' && status !== 'idle' && (
        <div
          className={cn(
            'mt-1.5 flex items-center gap-1',
            sizeStyle.text,
            currentStatus === 'success' && 'text-green-600 dark:text-green-400',
            currentStatus === 'error' && 'text-red-600 dark:text-red-400',
            currentStatus === 'warning' && 'text-amber-600 dark:text-amber-400',
            currentStatus === 'loading' && 'text-blue-600 dark:text-blue-400'
          )}
        >
          {currentConfig.text}
        </div>
      )}
    </div>
  );
}

export interface ProgressBarControllerProps {
  onComplete?: () => void;
  onError?: () => void;
  duration?: number;
  autoStart?: boolean;
}

export function useProgress({
  onComplete,
  onError,
  duration = 5000,
  autoStart = false
}: ProgressBarControllerProps = {}) {
  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState<ProgressStatus>('idle');
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const start = React.useCallback(() => {
    setProgress(0);
    setStatus('loading');
    
    const startTime = Date.now();
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setStatus('success');
        onComplete?.();
      }
    }, 50);
  }, [duration, onComplete]);

  const stop = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const complete = React.useCallback(() => {
    stop();
    setProgress(100);
    setStatus('success');
    onComplete?.();
  }, [stop, onComplete]);

  const error = React.useCallback(() => {
    stop();
    setStatus('error');
    onError?.();
  }, [stop, onError]);

  const warning = React.useCallback(() => {
    setStatus('warning');
  }, []);

  const reset = React.useCallback(() => {
    stop();
    setProgress(0);
    setStatus('idle');
  }, [stop]);

  const setManualProgress = React.useCallback((value: number, newStatus?: ProgressStatus) => {
    setProgress(Math.min(100, Math.max(0, value)));
    if (newStatus) setStatus(newStatus);
  }, []);

  React.useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => stop();
  }, [autoStart, start, stop]);

  return {
    progress,
    status,
    start,
    stop,
    complete,
    error,
    warning,
    reset,
    setProgress: setManualProgress
  };
}
