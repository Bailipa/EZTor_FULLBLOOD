'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignInError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error('Sign in page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">登录页面出错</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || '加载登录页面时发生错误。'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">重试</Button>
            <Button onClick={() => window.location.href = '/'} className="flex-1">返回首页</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
