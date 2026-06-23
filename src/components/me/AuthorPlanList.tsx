'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, ClipboardList, Loader2 } from 'lucide-react'

interface Todo {
  id: string
  title: string
  isCompleted: boolean
  sortOrder: number
}

export function AuthorPlanList() {
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
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <ClipboardList className="w-8 h-8 mb-2 opacity-40" />
        <span className="text-sm">暂无内容</span>
      </div>
    )
  }

  return (
    <ul className="space-y-1.5 max-h-80 overflow-y-auto">
      {todos.map((todo) => (
        <li key={todo.id} className="flex items-center gap-2">
          {todo.isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span
            className={`text-sm ${
              todo.isCompleted ? 'line-through text-muted-foreground' : ''
            }`}
          >
            {todo.title}
          </span>
        </li>
      ))}
    </ul>
  )
}
