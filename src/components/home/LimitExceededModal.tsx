'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, Key, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { saveToStorage, loadFromStorage } from '@/lib/storage'

interface CustomApiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

const STORAGE_KEY = 'vocab_custom_api'

export function loadCustomApiConfig(): CustomApiConfig | null {
  return loadFromStorage<CustomApiConfig | null>(STORAGE_KEY, null)
}

export function saveCustomApiConfig(config: CustomApiConfig | null): void {
  saveToStorage(STORAGE_KEY, config)
}

interface LimitExceededModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (config: CustomApiConfig) => void
}

export function LimitExceededModal({ open, onOpenChange, onSaved }: LimitExceededModalProps) {
  const existingConfig = loadCustomApiConfig()

  const [baseUrl, setBaseUrl] = useState(existingConfig?.baseUrl || '')
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || '')
  const [model, setModel] = useState(existingConfig?.model || '')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testedSuccessfully, setTestedSuccessfully] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleTest = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !model.trim()) {
      setTestResult({ success: false, message: '请填写完整的 API 配置信息' })
      return
    }
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      setTestResult({ success: false, message: 'API 地址必须以 http:// 或 https:// 开头' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/translate-only/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey, model }),
      })
      const data = await res.json()
      if (data.success) {
        setTestResult({ success: true, message: data.message })
        setTestedSuccessfully(true)
      } else {
        setTestResult({ success: false, message: data.error || '连接失败' })
        setTestedSuccessfully(false)
      }
    } catch {
      setTestResult({ success: false, message: '网络请求失败，请检查 API 地址' })
      setTestedSuccessfully(false)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || !model.trim()) {
      setTestResult({ success: false, message: '请填写完整的 API 配置信息' })
      return
    }
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      setTestResult({ success: false, message: 'API 地址必须以 http:// 或 https:// 开头' })
      return
    }

    setSaving(true)
    const config: CustomApiConfig = { baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() }
    saveCustomApiConfig(config)
    onSaved(config)
    setSaving(false)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            每日翻译次数已用完
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground space-y-3 pt-2">
            <p>
              出于运营成本考虑，每位用户每日可免费使用 30 次翻译功能。
            </p>
            <p>
              如需继续使用，可以配置您自己的大模型 API，支持 OpenAI、DeepSeek、智谱、通义千问等兼容 OpenAI 接口的厂商。
            </p>
            <p className="text-xs text-muted-foreground/80">
              您的 API Key 仅保存在本地浏览器中，不会上传到服务器，请放心使用。
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseUrl" className="flex items-center gap-1.5 text-sm">
              <Globe className="w-3.5 h-3.5" />
              API 接口地址 (Base URL)
            </Label>
            <Input
              id="baseUrl"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); setTestedSuccessfully(false) }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="flex items-center gap-1.5 text-sm">
              <Key className="w-3.5 h-3.5" />
              API Key
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-••••••••••••••••••••"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); setTestedSuccessfully(false) }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-1.5 text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              模型名称 (Model)
            </Label>
            <Input
              id="model"
              placeholder="gpt-4o-mini"
              value={model}
              onChange={(e) => { setModel(e.target.value); setTestResult(null); setTestedSuccessfully(false) }}
            />
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-md p-2.5 text-sm ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
              }`}
            >
              {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleTest}
              disabled={isTesting || !baseUrl || !apiKey || !model}
            >
              {isTesting ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" />测试中</>
              ) : (
                '测试连接'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            请妥善保管您的 API Key，它仅保存在本地浏览器中
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !testedSuccessfully}>
            {saving ? '保存中...' : testedSuccessfully ? '保存' : '请先测试连接'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
