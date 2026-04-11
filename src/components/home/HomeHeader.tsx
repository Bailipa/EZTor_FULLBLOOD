'use client';

import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { FlashcardWidget } from '@/components/ui/flashcard/flashcard-widget';
import { GameWidget } from '@/components/ui/game/GameWidget';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { MonitorPlay, PenTool, BookOpen, LogIn } from 'lucide-react';

interface HomeHeaderProps {
  showDanmaku: boolean;
  onToggleDanmaku: () => void;
  onFeatureClick?: (featureName: string) => void;
}

export function HomeHeader({ showDanmaku, onToggleDanmaku, onFeatureClick }: HomeHeaderProps) {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && session?.user;

  const handleFeatureClick = (featureName: string, callback?: () => void) => {
    if (!isAuthenticated && onFeatureClick) {
      onFeatureClick(featureName);
    } else if (callback) {
      callback();
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border transition-colors duration-300">
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground">EZTor</h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-muted-foreground">
          支持批量输入，自动结构化解析并永久保存。
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          提示：翻译内容由 AI 大模型生成，请仔细甄别。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {session?.user && (
          <span className="text-xs sm:text-sm text-muted-foreground w-full sm:w-auto sm:mr-2 mb-1 sm:mb-0">
            Hello, {session.user.name}
          </span>
        )}
        {isAuthenticated && <FlashcardWidget />}
        {isAuthenticated && <GameWidget />}
        <Button
          variant={showDanmaku ? 'default' : 'outline'}
          onClick={() => handleFeatureClick('弹幕复习', onToggleDanmaku)}
          className="gap-1.5 sm:gap-2 shadow-sm transition-all h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
        >
          <MonitorPlay className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{showDanmaku ? '关闭弹幕复习' : '开启弹幕复习'}</span>
        </Button>
        {isAuthenticated ? (
          <>
            <Link href="/dictation">
              <Button
                variant="outline"
                className="gap-1.5 sm:gap-2 shadow-sm border-primary/20 text-primary hover:bg-primary/5 h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              >
                <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>默写复习</span>
              </Button>
            </Link>
            <Link href="/history">
              <Button
                variant="outline"
                className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>生词本</span>
              </Button>
            </Link>
          </>
        ) : (
          <Link href="/auth/signin">
            <Button
              variant="default"
              className="gap-1.5 sm:gap-2 shadow-sm h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>登录</span>
            </Button>
          </Link>
        )}
        <ModeToggle />
        {isAuthenticated && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="shadow-sm shrink-0 h-8 w-8 sm:h-9 sm:w-9"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
                <AlertDialogDescription>
                  退出后您需要重新输入账号密码才能访问您的生词本。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await signOut({ redirect: false });
                    if (typeof window !== "undefined") {
                      window.location.href = `${window.location.origin}/`;
                    }
                  }}
                >
                  确认退出
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
