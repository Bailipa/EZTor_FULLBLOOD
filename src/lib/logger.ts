import pino from 'pino'

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})

export const logger = Object.assign(baseLogger, {
  security(msg: string, ...args: unknown[]) {
    baseLogger.warn({ category: 'security' }, msg, ...args)
  },
})

export function createRequestLogger(req: Request, userId?: string) {
  return logger.child({
    requestId: crypto.randomUUID(),
    userId,
    path: new URL(req.url).pathname,
  })
}
