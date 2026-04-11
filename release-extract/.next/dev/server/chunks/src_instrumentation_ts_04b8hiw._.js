module.exports = [
"[project]/src/instrumentation.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "register",
    ()=>register
]);
async function register() {
    if ("TURBOPACK compile-time truthy", 1) {
        const { validateEnv, logEnvStatus } = await __turbopack_context__.A("[project]/src/lib/envValidator.ts [instrumentation] (ecmascript, async loader)");
        console.log('\n[Startup] Validating environment configuration...');
        const result = validateEnv();
        logEnvStatus();
        if (!result.valid) {
            console.error('[Startup] Environment validation failed!');
            console.error('[Startup] Please check your .env file and ensure all required variables are set.');
            console.error('[Startup] See .env.example for reference.');
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
        } else {
            console.log('[Startup] Environment validation passed ✓');
        }
    }
}
}),
];

//# sourceMappingURL=src_instrumentation_ts_04b8hiw._.js.map