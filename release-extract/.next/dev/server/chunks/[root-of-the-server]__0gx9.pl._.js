module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/src/lib/envValidator.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getOptionalEnvVar",
    ()=>getOptionalEnvVar,
    "getRequiredEnvVar",
    ()=>getRequiredEnvVar,
    "logEnvStatus",
    ()=>logEnvStatus,
    "maskSensitiveValue",
    ()=>maskSensitiveValue,
    "validateEnv",
    ()=>validateEnv
]);
const REQUIRED_ENV_VARS = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'DATABASE_URL'
];
const OPTIONAL_ENV_VARS = [
    'LLM_API_KEY',
    'LLM_API_URL',
    'LLM_MODEL',
    'NEXT_PUBLIC_APP_URL'
];
const INSECURE_DEFAULTS = [
    'your-random-secret-key-at-least-32-characters-long',
    'your-api-key',
    'your-secret',
    'changeme',
    'password',
    'secret',
    'default'
];
function isInsecureValue(value) {
    const lowerValue = value.toLowerCase();
    return INSECURE_DEFAULTS.some((insecure)=>lowerValue.includes(insecure.toLowerCase()));
}
function validateSecretStrength(name, value) {
    if (name === 'NEXTAUTH_SECRET') {
        if (value.length < 32) {
            return `${name} should be at least 32 characters long (current: ${value.length})`;
        }
        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasNumbers = /\d/.test(value);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
        const varietyCount = [
            hasUpperCase,
            hasLowerCase,
            hasNumbers,
            hasSpecialChar
        ].filter(Boolean).length;
        if (varietyCount < 3) {
            return `${name} should contain at least 3 of: uppercase, lowercase, numbers, special characters`;
        }
    }
    return null;
}
function validateEnv() {
    const errors = [];
    const warnings = [];
    const missingRequired = [];
    const insecureValues = [];
    for (const varName of REQUIRED_ENV_VARS){
        const value = process.env[varName];
        if (!value) {
            missingRequired.push(varName);
            errors.push(`Missing required environment variable: ${varName}`);
        } else if (isInsecureValue(value)) {
            insecureValues.push(varName);
            errors.push(`Insecure default value detected for: ${varName}`);
        } else {
            const strengthWarning = validateSecretStrength(varName, value);
            if (strengthWarning) {
                warnings.push(strengthWarning);
            }
        }
    }
    for (const varName of OPTIONAL_ENV_VARS){
        const value = process.env[varName];
        if (value && isInsecureValue(value)) {
            insecureValues.push(varName);
            warnings.push(`Insecure default value detected for optional variable: ${varName}`);
        }
    }
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        missingRequired,
        insecureValues
    };
}
function getRequiredEnvVar(name) {
    const value = process.env[name];
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || ("TURBOPACK compile-time value", "development") === 'test' || ("TURBOPACK compile-time value", "undefined") !== 'undefined';
    if (!value) {
        if (isBuildTime) {
            console.warn(`[BUILD WARNING] Environment variable ${name} is not set during build`);
            return `BUILD_PLACEHOLDER_${name}`;
        }
        throw new Error(`Environment variable ${name} is required but not set`);
    }
    if (isInsecureValue(value)) {
        console.warn(`[SECURITY WARNING] Environment variable ${name} appears to have an insecure default value`);
    }
    return value;
}
function getOptionalEnvVar(name, defaultValue) {
    const value = process.env[name];
    if (!value) {
        return defaultValue;
    }
    if (isInsecureValue(value)) {
        console.warn(`[SECURITY WARNING] Environment variable ${name} appears to have an insecure default value`);
    }
    return value;
}
function maskSensitiveValue(value, visibleChars = 4) {
    if (value.length <= visibleChars * 2) {
        return '*'.repeat(value.length);
    }
    return `${value.slice(0, visibleChars)}${'*'.repeat(value.length - visibleChars * 2)}${value.slice(-visibleChars)}`;
}
function logEnvStatus() {
    const result = validateEnv();
    console.log('\n========================================');
    console.log('Environment Variables Status');
    console.log('========================================\n');
    console.log('Required Variables:');
    for (const varName of REQUIRED_ENV_VARS){
        const value = process.env[varName];
        const status = !value ? '❌ MISSING' : isInsecureValue(value) ? '⚠️ INSECURE' : '✅ SET';
        const displayValue = value ? maskSensitiveValue(value) : 'not set';
        console.log(`  ${varName}: ${status} (${displayValue})`);
    }
    console.log('\nOptional Variables:');
    for (const varName of OPTIONAL_ENV_VARS){
        const value = process.env[varName];
        const status = value ? isInsecureValue(value) ? '⚠️ INSECURE' : '✅ SET' : '⚪ NOT SET';
        const displayValue = value ? maskSensitiveValue(value) : 'not set';
        console.log(`  ${varName}: ${status} (${displayValue})`);
    }
    if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach((e)=>console.log(`  - ${e}`));
    }
    if (result.warnings.length > 0) {
        console.log('\n⚠️ Warnings:');
        result.warnings.forEach((w)=>console.log(`  - ${w}`));
    }
    console.log('\n========================================\n');
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
}
}),
"[project]/src/app/api/captcha/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$svg$2d$captcha__$5b$external$5d$__$28$svg$2d$captcha$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$svg$2d$captcha$29$__ = __turbopack_context__.i("[externals]/svg-captcha [external] (svg-captcha, cjs, [project]/node_modules/svg-captcha)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$envValidator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/envValidator.ts [app-route] (ecmascript)");
;
;
;
;
const SECRET_KEY = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$envValidator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getRequiredEnvVar"])('NEXTAUTH_SECRET');
function sanitizeSvg(svg) {
    return svg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, 'data-blocked=').replace(/<iframe/gi, '<disabled-iframe').replace(/<object/gi, '<disabled-object').replace(/<embed/gi, '<disabled-embed').replace(/<animate\b[^>]*\bon\w+\s*=/gi, '<animate data-blocked=').replace(/<set\b[^>]*\bon\w+\s*=/gi, '<set data-blocked=').replace(/<handler\b/gi, '<disabled-handler ').replace(/<listener\b/gi, '<disabled-listener ');
}
function svgToBase64(svg) {
    const sanitized = sanitizeSvg(svg);
    const base64 = Buffer.from(sanitized).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
}
async function GET() {
    try {
        const captcha = __TURBOPACK__imported__module__$5b$externals$5d2f$svg$2d$captcha__$5b$external$5d$__$28$svg$2d$captcha$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$svg$2d$captcha$29$__["default"].create({
            size: 4,
            noise: 2,
            color: true,
            background: '#f0f0f0',
            width: 150,
            height: 50
        });
        const text = captcha.text.toLowerCase();
        const timestamp = Date.now();
        const dataToHash = `${text}:${timestamp}`;
        const hash = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHmac('sha256', SECRET_KEY).update(dataToHash).digest('hex');
        const imageBase64 = svgToBase64(captcha.data);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            image: imageBase64,
            hash: hash,
            timestamp: timestamp
        });
    } catch (error) {
        console.error("CAPTCHA Generation Error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to generate captcha'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0gx9.pl._.js.map