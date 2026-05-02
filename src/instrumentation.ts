export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv, logEnvStatus } = await import('@/lib/envValidator')

    console.log('\n[Startup] Validating environment configuration...')

    const result = validateEnv()
    logEnvStatus()

    if (!result.valid) {
      console.error('[Startup] Environment validation failed!')
      console.error(
        '[Startup] Please check your .env file and ensure all required variables are set.',
      )
      console.error('[Startup] See .env.example for reference.')

      if (process.env.NODE_ENV === 'production') {
        process.exit(1)
      }
    } else {
      console.log('[Startup] Environment validation passed ✓')
    }

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`[Shutdown] Received ${signal}, closing database connections...`)
      try {
        const { default: prisma } = await import('@/lib/prisma')
        await prisma.$disconnect()
        console.log('[Shutdown] Database connections closed')
      } catch (e) {
        console.error('[Shutdown] Error disconnecting from database:', e)
      }
      process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  }
}
