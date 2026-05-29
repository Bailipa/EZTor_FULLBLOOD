'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Loader2, CheckCircle2, Circle, ChevronDown, ChevronRight } from 'lucide-react'

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
  const [isOpen, setIsOpen] = useState(false)

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-4">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              📋 作者的计划
              <span className="text-xs text-muted-foreground font-normal">
                ({todos.length})
              </span>
            </h3>
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
