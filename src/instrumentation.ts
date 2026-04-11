export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv, logEnvStatus } = await import('@/lib/envValidator');
    
    console.log('\n[Startup] Validating environment configuration...');
    
    const result = validateEnv();
    logEnvStatus();
    
    if (!result.valid) {
      console.error('[Startup] Environment validation failed!');
      console.error('[Startup] Please check your .env file and ensure all required variables are set.');
      console.error('[Startup] See .env.example for reference.');
      
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    } else {
      console.log('[Startup] Environment validation passed ✓');
    }
  }
}
