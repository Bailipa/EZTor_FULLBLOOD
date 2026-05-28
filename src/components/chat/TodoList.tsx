'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle2, Circle } from 'lucide-react'

interface Todo {
  id: string
  title: string
  isCompleted: boolean
  sortOrder: number
}

export function TodoList() {
  const { data: session } = useSession()
  const [todos, setTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/todos')
      const data = await res.json()
      if (data.success) {
        setTodos(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()

    const eventSource = new EventSource('/api/chat/stream')

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'todos') {
          setTodos(data.data)
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
      }
    }

    return () => {
      eventSource.close()
    }
  }, [fetchTodos])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    )
  }

  if (todos.length === 0) {
    return null
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          📋 待办事项
        </h3>
        <div className="space-y-2">
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2">
              {todo.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <span className={`text-sm ${todo.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                {todo.title}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
