import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { isDeveloper } from '@/lib/chatUser'
import { subscribeToMessages, subscribeToTodos, subscribeToConfig } from '@/lib/chatSSE'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = isDeveloper({ username: session.user.name || '', isAdmin: session.user.isAdmin })

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const unsubscribeMessages = subscribeToMessages((message) => {
        const msg = message as { isDeleted?: boolean; isHidden?: boolean }
        if (!msg.isDeleted && (!msg.isHidden || admin)) {
          send({ type: 'message', data: message })
        }
      })

      const unsubscribeTodos = subscribeToTodos((todos) => {
        send({ type: 'todos', data: todos })
      })

      const unsubscribeConfig = subscribeToConfig((config) => {
        send({ type: 'config', data: config })
      })

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 30000)

      req.signal.addEventListener('abort', () => {
        unsubscribeMessages()
        unsubscribeTodos()
        unsubscribeConfig()
        clearInterval(heartbeat)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
