type EventHandler = (data: unknown) => void

const clients = new Map<string, Set<EventHandler>>()

export function subscribeToMessages(handler: EventHandler) {
  return subscribe('messages', handler)
}

export function subscribeToTodos(handler: EventHandler) {
  return subscribe('todos', handler)
}

export function subscribeToConfig(handler: EventHandler) {
  return subscribe('config', handler)
}

function subscribe(channel: string, handler: EventHandler) {
  if (!clients.has(channel)) {
    clients.set(channel, new Set())
  }
  clients.get(channel)!.add(handler)

  return () => {
    clients.get(channel)?.delete(handler)
  }
}

export function broadcastMessage(message: unknown) {
  broadcast('messages', message)
}

export function broadcastTodos(todos: unknown) {
  broadcast('todos', todos)
}

export function broadcastConfig(config: unknown) {
  broadcast('config', config)
}

function broadcast(channel: string, data: unknown) {
  const handlers = clients.get(channel)
  if (handlers) {
    handlers.forEach(handler => handler(data))
  }
}

export function getOnlineCount(): number {
  return clients.get('messages')?.size || 0
}
