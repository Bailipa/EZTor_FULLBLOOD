'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
} from '@/components/ui/alert-dialog'
import {
  MessageSquare,
  AlertTriangle,
  Unlock,
  Trash2,
  Plus,
  Edit2,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface ChatConfig {
  featureEnabled: boolean
  isEnabled: boolean
  isCircuitBroken: boolean
  circuitBreakType: string | null
  circuitBreakReason: string | null
  circuitBreakAt: string | null
}

interface ChatBan {
  id: string
  userId: string
  reason: string | null
  bannedAt: string
  User: {
    id: string
    username: string
  }
}

interface CustomProfanity {
  id: string
  word: string
  createdAt: string
}

interface AdminTodo {
  id: string
  title: string
  isCompleted: boolean
  sortOrder: number
}

export function ChatManagement() {
  const [config, setConfig] = useState<ChatConfig | null>(null)
  const [bans, setBans] = useState<ChatBan[]>([])
  const [profanityWords, setProfanityWords] = useState<CustomProfanity[]>([])
  const [todos, setTodos] = useState<AdminTodo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [newWords, setNewWords] = useState('')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [editingTodo, setEditingTodo] = useState<AdminTodo | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null)
  const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/config')
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    }
  }, [])

  const fetchBans = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/ban')
      const data = await res.json()
      if (data.success) {
        setBans(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch bans:', error)
    }
  }, [])

  const fetchProfanityWords = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/profanity')
      const data = await res.json()
      if (data.success) {
        setProfanityWords(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch profanity words:', error)
    }
  }, [])

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/todos')
      const data = await res.json()
      if (data.success) {
        setTodos(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error)
    }
  }, [])

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true)
      await Promise.all([
        fetchConfig(),
        fetchBans(),
        fetchProfanityWords(),
        fetchTodos(),
      ])
      setIsLoading(false)
    }
    fetchAll()
  }, [fetchConfig, fetchBans, fetchProfanityWords, fetchTodos])

  const handleToggleFeature = async (checked: boolean) => {
    try {
      const res = await fetch('/api/chat/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureEnabled: checked })
      })
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        toast.success(checked ? '聊天功能已开启' : '聊天功能已关闭')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      const res = await fetch('/api/chat/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: checked })
      })
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        toast.success(checked ? '聊天入口已开启' : '聊天入口已关闭')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleUnbreak = async () => {
    try {
      const res = await fetch('/api/chat/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCircuitBroken: false,
          circuitBreakType: null,
          circuitBreakReason: null
        })
      })
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
        toast.success('熔断已解除')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleClearMessages = async () => {
    try {
      const res = await fetch('/api/chat/messages/clear', {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`已清除 ${data.deletedCount} 条消息`)
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleUnban = async (userId: string) => {
    try {
      const res = await fetch(`/api/chat/ban/${userId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setBans(prev => prev.filter(b => b.userId !== userId))
        toast.success('已解禁')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleBatchAddWords = async () => {
    if (!newWords.trim()) return

    const words = newWords.split('\n').map(w => w.trim()).filter(w => w.length > 0)
    if (words.length === 0) return

    let successCount = 0
    for (const word of words) {
      try {
        const res = await fetch('/api/admin/profanity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word })
        })
        const data = await res.json()
        if (data.success) {
          successCount++
          setProfanityWords(prev => [...prev, data.data])
        }
      } catch (error) {
        console.error('Failed to add word:', error)
      }
    }

    setNewWords('')
    toast.success(`成功添加 ${successCount} 个敏感词`)
  }

  const handleDeleteWord = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/profanity/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setProfanityWords(prev => prev.filter(w => w.id !== id))
        toast.success('已删除')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return

    try {
      const res = await fetch('/api/admin/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodoTitle.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setTodos(prev => [...prev, data.data])
        setNewTodoTitle('')
        toast.success('已添加')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleToggleTodo = async (todo: AdminTodo) => {
    try {
      const res = await fetch(`/api/admin/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !todo.isCompleted })
      })
      const data = await res.json()
      if (data.success) {
        setTodos(prev => prev.map(t => t.id === todo.id ? data.data : t))
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleStartEdit = (todo: AdminTodo) => {
    setEditingTodo(todo)
    setEditValue(todo.title)
  }

  const handleSaveEdit = async () => {
    if (!editingTodo || !editValue.trim()) return

    try {
      const res = await fetch(`/api/admin/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editValue.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setTodos(prev => prev.map(t => t.id === editingTodo.id ? data.data : t))
        setEditingTodo(null)
        toast.success('已更新')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleDeleteTodo = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/todos/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        setTodos(prev => prev.filter(t => t.id !== id))
        toast.success('已删除')
      }
    } catch (error) {
      toast.error('操作失败')
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return

    const newTodos = [...todos]
    const temp = newTodos[index]
    newTodos[index] = newTodos[index - 1]
    newTodos[index - 1] = temp
    setTodos(newTodos)

    try {
      await fetch('/api/admin/todos/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newTodos.map(t => t.id) })
      })
    } catch (error) {
      toast.error('排序失败')
      fetchTodos()
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index === todos.length - 1) return

    const newTodos = [...todos]
    const temp = newTodos[index]
    newTodos[index] = newTodos[index + 1]
    newTodos[index + 1] = temp
    setTodos(newTodos)

    try {
      await fetch('/api/admin/todos/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newTodos.map(t => t.id) })
      })
    } catch (error) {
      toast.error('排序失败')
      fetchTodos()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 聊天管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            聊天管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">聊天功能</p>
              <p className="text-sm text-muted-foreground">关闭后整个聊天功能不可用</p>
            </div>
            <Switch
              checked={config?.featureEnabled ?? true}
              onCheckedChange={handleToggleFeature}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">聊天入口</p>
              <p className="text-sm text-muted-foreground">关闭后普通用户无法访问</p>
            </div>
            <Switch
              checked={config?.isEnabled ?? true}
              onCheckedChange={handleToggleEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">熔断状态</p>
              {config?.isCircuitBroken && (
                <p className="text-sm text-muted-foreground">
                  原因: {config.circuitBreakReason}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {config?.isCircuitBroken ? (
                <>
                  <Badge variant="destructive">
                    {config.circuitBreakType === 'api_failure' ? 'API 故障' : '风险检测'}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={handleUnbreak}>
                    <Unlock className="w-4 h-4 mr-1" />
                    解除熔断
                  </Button>
                </>
              ) : (
                <Badge className="bg-green-500 text-white">正常</Badge>
              )}
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-1" />
                清除历史消息
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清除</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除所有 24 小时前的消息，且不可恢复。确定要继续吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearMessages}>确认清除</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* 禁言列表 */}
          <div>
            <h3 className="font-medium mb-2">禁言列表</h3>
            {bans.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无禁言用户</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left py-2 px-3 font-medium">用户名</th>
                      <th className="text-left py-2 px-3 font-medium">禁言原因</th>
                      <th className="text-left py-2 px-3 font-medium">禁言时间</th>
                      <th className="text-right py-2 px-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bans.map(ban => (
                      <tr key={ban.id} className="border-t">
                        <td className="py-2 px-3">{ban.User.username}</td>
                        <td className="py-2 px-3 text-muted-foreground">{ban.reason || '-'}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {new Date(ban.bannedAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnban(ban.userId)}
                          >
                            解禁
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 自定义敏感词 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            自定义敏感词
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              placeholder="每行一个敏感词..."
              value={newWords}
              onChange={e => setNewWords(e.target.value)}
              className="mb-2"
            />
            <Button onClick={handleBatchAddWords} disabled={!newWords.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              批量添加
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {profanityWords.map(word => (
              <AlertDialog key={word.id}>
                <AlertDialogTrigger asChild>
                  <Badge variant="secondary" className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground">
                    {word.word}
                    <span className="ml-1">×</span>
                  </Badge>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认删除</AlertDialogTitle>
                    <AlertDialogDescription>
                      确定要删除敏感词 &quot;{word.word}&quot; 吗？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteWord(word.id)}>
                      确认删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
          </div>

          {profanityWords.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无自定义敏感词</p>
          )}
        </CardContent>
      </Card>

      {/* Todolist 管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 待办事项管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="输入新任务..."
              value={newTodoTitle}
              onChange={e => setNewTodoTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
            />
            <Button onClick={handleAddTodo} disabled={!newTodoTitle.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              添加
            </Button>
          </div>

          <div className="space-y-2">
            {todos.map((todo, index) => (
              <div key={todo.id} className="flex items-center gap-2 p-2 border rounded">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === 0}
                  onClick={() => handleMoveUp(index)}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === todos.length - 1}
                  onClick={() => handleMoveDown(index)}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>

                <Checkbox
                  checked={todo.isCompleted}
                  onCheckedChange={() => handleToggleTodo(todo)}
                />

                <span className={`flex-1 ${todo.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                  {todo.title}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleStartEdit(todo)}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认删除</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除任务 &quot;{todo.title}&quot; 吗？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteTodo(todo.id)}>
                        确认删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>

          {todos.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无待办事项</p>
          )}
        </CardContent>
      </Card>

      {/* 编辑弹窗 */}
      <Dialog open={!!editingTodo} onOpenChange={() => setEditingTodo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
            <DialogDescription>修改任务标题</DialogDescription>
          </DialogHeader>
          <Input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTodo(null)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
