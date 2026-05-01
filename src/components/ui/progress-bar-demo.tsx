'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProgressBar, useProgress, ProgressStatus } from '@/components/ui/progress-bar';
import { Play, RotateCcw, XCircle } from 'lucide-react';

export function ProgressBarDemo() {
  const [manualProgress, setManualProgress] = useState(0);
  const [manualStatus, setManualStatus] = useState<ProgressStatus>('normal');

  const progress1 = useProgress({ duration: 3000 });
  const progress2 = useProgress({ duration: 5000 });
  const _progress3 = useProgress({ duration: 4000 });

  const handleManualChange = (value: number) => {
    setManualProgress(value);
    if (value < 30) {
      setManualStatus('normal');
    } else if (value < 70) {
      setManualStatus('loading');
    } else if (value < 100) {
      setManualStatus('warning');
    } else {
      setManualStatus('success');
    }
  };

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">进度条组件演示</CardTitle>
        <CardDescription>展示不同状态和样式的进度条</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">基础状态</h4>
          <div className="grid gap-4">
            <ProgressBar value={25} status="normal" label="正常进度" />
            <ProgressBar value={50} status="loading" label="加载中" showIcon />
            <ProgressBar value={75} status="warning" label="警告状态" showIcon />
            <ProgressBar value={100} status="success" label="完成" showIcon />
            <ProgressBar value={60} status="error" label="错误" showIcon />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">不同尺寸</h4>
          <div className="grid gap-4">
            <ProgressBar value={60} size="sm" label="小尺寸 (sm)" />
            <ProgressBar value={60} size="md" label="中等尺寸 (md)" />
            <ProgressBar value={60} size="lg" label="大尺寸 (lg)" />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">自动进度模拟</h4>
          <div className="grid gap-4">
            <div className="space-y-2">
              <ProgressBar
                value={progress1.progress}
                status={progress1.status}
                label="快速任务 (3秒)"
                showIcon
                subLabel="模拟文件上传"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={progress1.start} disabled={progress1.status === 'loading'}>
                  <Play className="w-3 h-3 mr-1" />
                  开始
                </Button>
                <Button size="sm" variant="outline" onClick={progress1.reset}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  重置
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <ProgressBar
                value={progress2.progress}
                status={progress2.status}
                label="中等任务 (5秒)"
                showIcon
                subLabel="模拟数据处理"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={progress2.start} disabled={progress2.status === 'loading'}>
                  <Play className="w-3 h-3 mr-1" />
                  开始
                </Button>
                <Button size="sm" variant="outline" onClick={progress2.reset}>
                  <RotateCcw className="w-3 h-3 mr-1" />
                  重置
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={progress2.error}
                  disabled={progress2.status !== 'loading'}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  模拟错误
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">手动控制</h4>
          <ProgressBar
            value={manualProgress}
            status={manualStatus}
            label="手动调整进度"
            showIcon
            showPercentage
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => handleManualChange(0)}>
              0%
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleManualChange(25)}>
              25%
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleManualChange(50)}>
              50%
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleManualChange(75)}>
              75%
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleManualChange(100)}>
              100%
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">极简模式</h4>
          <ProgressBar value={45} showPercentage={false} showIcon={false} />
          <ProgressBar value={80} showPercentage size="sm" />
        </div>
      </CardContent>
    </Card>
  );
}
