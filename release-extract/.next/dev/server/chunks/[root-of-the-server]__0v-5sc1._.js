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
"[project]/src/lib/prisma.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const prismaClientSingleton = ()=>{
    return new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]();
};
const prisma = globalThis.prisma ?? prismaClientSingleton();
const __TURBOPACK__default__export__ = prisma;
if ("TURBOPACK compile-time truthy", 1) globalThis.prisma = prisma;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/assert [external] (assert, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("assert", () => require("assert"));

module.exports = mod;
}),
"[externals]/querystring [external] (querystring, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("querystring", () => require("querystring"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/events [external] (events, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/rateLimit.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cleanupExpiredEntries",
    ()=>cleanupExpiredEntries,
    "getClientKey",
    ()=>getClientKey,
    "initializeRedisStore",
    ()=>initializeRedisStore,
    "isRedisStoreEnabled",
    ()=>isRedisStoreEnabled,
    "rateLimit",
    ()=>rateLimit,
    "useMemoryStore",
    ()=>useMemoryStore
]);
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;
class MemoryRateLimitStore {
    store = new Map();
    async get(key) {
        return this.store.get(key) || null;
    }
    async set(key, entry) {
        this.store.set(key, entry);
    }
    async delete(key) {
        this.store.delete(key);
    }
    async cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()){
            if (now > entry.resetTime) {
                this.store.delete(key);
            }
        }
    }
}
class RedisRateLimitStore {
    redis;
    keyPrefix;
    constructor(redisClient, keyPrefix = 'ratelimit:'){
        this.redis = redisClient;
        this.keyPrefix = keyPrefix;
    }
    async get(key) {
        const data = await this.redis.get(`${this.keyPrefix}${key}`);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch  {
            return null;
        }
    }
    async set(key, entry) {
        const ttl = Math.max(0, entry.resetTime - Date.now());
        await this.redis.set(`${this.keyPrefix}${key}`, JSON.stringify(entry), 'PX', ttl);
    }
    async delete(key) {
        await this.redis.del(`${this.keyPrefix}${key}`);
    }
    async cleanup() {
    // Redis automatically handles TTL-based expiration
    }
}
let store = new MemoryRateLimitStore();
let isRedisEnabled = false;
function initializeRedisStore(redisClient, keyPrefix) {
    store = new RedisRateLimitStore(redisClient, keyPrefix);
    isRedisEnabled = true;
    console.log('Rate limiting: Redis store initialized');
}
function useMemoryStore() {
    store = new MemoryRateLimitStore();
    isRedisEnabled = false;
    console.log('Rate limiting: Memory store initialized');
}
function isRedisStoreEnabled() {
    return isRedisEnabled;
}
async function rateLimit(key) {
    const now = Date.now();
    const entry = await store.get(key);
    if (!entry || now > entry.resetTime) {
        const newEntry = {
            count: 1,
            resetTime: now + WINDOW_MS
        };
        await store.set(key, newEntry);
        return {
            success: true,
            remaining: MAX_REQUESTS - 1,
            resetTime: now + WINDOW_MS
        };
    }
    if (entry.count >= MAX_REQUESTS) {
        return {
            success: false,
            remaining: 0,
            resetTime: entry.resetTime
        };
    }
    entry.count++;
    await store.set(key, entry);
    return {
        success: true,
        remaining: MAX_REQUESTS - entry.count,
        resetTime: entry.resetTime
    };
}
function getClientKey(req, sessionId) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
    if (sessionId) {
        return `${ip}:${sessionId}`;
    }
    return ip;
}
async function cleanupExpiredEntries() {
    await store.cleanup();
}
setInterval(()=>{
    cleanupExpiredEntries().catch(console.error);
}, 60 * 1000);
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
"[project]/src/app/api/auth/[...nextauth]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>handler,
    "POST",
    ()=>handler,
    "authOptions",
    ()=>authOptions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$credentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/providers/credentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/bcryptjs/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rateLimit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/rateLimit.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$envValidator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/envValidator.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
const SECRET_KEY = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$envValidator$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getRequiredEnvVar"])('NEXTAUTH_SECRET');
const AUTH_ERROR_MESSAGE = "用户名或密码错误 / Invalid username or password";
async function simulatePasswordHash() {
    await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].hash("dummy_password_for_timing", 10);
}
const authOptions = {
    providers: [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$providers$2f$credentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])({
            name: "Credentials",
            credentials: {
                username: {
                    label: "Username",
                    type: "text"
                },
                password: {
                    label: "Password",
                    type: "password"
                },
                captchaInput: {
                    label: "Captcha",
                    type: "text"
                },
                captchaHash: {
                    label: "CaptchaHash",
                    type: "text"
                },
                captchaTimestamp: {
                    label: "CaptchaTimestamp",
                    type: "text"
                }
            },
            async authorize (credentials, req) {
                const ip = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || 'unknown';
                const rateLimitKey = `auth:${ip}`;
                const rateLimitResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$rateLimit$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rateLimit"])(rateLimitKey);
                if (!rateLimitResult.success) {
                    throw new Error("Too many login attempts. Please try again later.");
                }
                if (!credentials?.username || !credentials?.password) {
                    throw new Error("Missing username or password");
                }
                if (!credentials.captchaInput || !credentials.captchaHash || !credentials.captchaTimestamp) {
                    throw new Error("验证码缺失 / Missing captcha");
                }
                const timeDiff = Date.now() - parseInt(credentials.captchaTimestamp);
                if (timeDiff > 5 * 60 * 1000) {
                    throw new Error("验证码已过期 / Captcha expired");
                }
                const expectedHash = __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["default"].createHmac('sha256', SECRET_KEY).update(`${credentials.captchaInput.toLowerCase()}:${credentials.captchaTimestamp}`).digest('hex');
                if (expectedHash !== credentials.captchaHash) {
                    throw new Error("验证码错误 / Invalid captcha");
                }
                const normalizedUsername = credentials.username.toLowerCase().trim();
                const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findUnique({
                    where: {
                        username: normalizedUsername
                    }
                });
                if (!user) {
                    await simulatePasswordHash();
                    const hashedPassword = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].hash(credentials.password, 10);
                    const newUser = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.create({
                        data: {
                            username: normalizedUsername,
                            password: hashedPassword
                        }
                    });
                    return {
                        id: newUser.id,
                        name: newUser.username,
                        isAdmin: newUser.isAdmin
                    };
                }
                if (user.isBanned) {
                    const banInfo = user.banReason ? `账户已被封禁: ${user.banReason}` : "账户已被封禁 / Account has been banned";
                    throw new Error(banInfo);
                }
                const isPasswordValid = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$bcryptjs$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].compare(credentials.password, user.password);
                if (!isPasswordValid) {
                    throw new Error(AUTH_ERROR_MESSAGE);
                }
                return {
                    id: user.id,
                    name: user.username,
                    isAdmin: user.isAdmin
                };
            }
        })
    ],
    session: {
        strategy: "jwt"
    },
    callbacks: {
        async session ({ session, token }) {
            if (session?.user) {
                session.user.id = token.sub;
                session.user.isAdmin = token.isAdmin;
            }
            return session;
        },
        async jwt ({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.isAdmin = user.isAdmin;
            }
            return token;
        }
    },
    pages: {
        signIn: "/auth/signin"
    }
};
const handler = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"])(authOptions);
;
}),
"[project]/src/lib/apiErrorHandler.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createErrorResponse",
    ()=>createErrorResponse,
    "createSuccessResponse",
    ()=>createSuccessResponse,
    "handleApiError",
    ()=>handleApiError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred';
const GENERIC_ERROR_MESSAGE_CN = '服务器内部错误';
const ERROR_MAP = {
    'P2002': {
        message: '数据已存在',
        statusCode: 409,
        isPublic: true
    },
    'P2025': {
        message: '记录不存在',
        statusCode: 404,
        isPublic: true
    },
    'P2003': {
        message: '关联数据不存在',
        statusCode: 400,
        isPublic: true
    },
    'UNAUTHORIZED': {
        message: '未授权访问',
        statusCode: 401,
        isPublic: true
    },
    'FORBIDDEN': {
        message: '权限不足',
        statusCode: 403,
        isPublic: true
    },
    'NOT_FOUND': {
        message: '资源不存在',
        statusCode: 404,
        isPublic: true
    },
    'VALIDATION_ERROR': {
        message: '数据验证失败',
        statusCode: 400,
        isPublic: true
    },
    'RATE_LIMIT': {
        message: '请求过于频繁，请稍后再试',
        statusCode: 429,
        isPublic: true
    }
};
function getErrorCode(error) {
    if (error?.code) return error.code;
    if (error?.meta?.code) return error.meta.code;
    if (error?.name === 'PrismaClientKnownRequestError') return error.code;
    return null;
}
function isDevelopment() {
    return ("TURBOPACK compile-time value", "development") === 'development';
}
function handleApiError(error, context) {
    const errorCode = getErrorCode(error);
    const mappedError = errorCode ? ERROR_MAP[errorCode] : null;
    if (mappedError) {
        console.error(`[API Error] ${context || 'Unknown'}:`, {
            code: errorCode,
            message: error.message
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: mappedError.message
        }, {
            status: mappedError.statusCode
        });
    }
    if (error instanceof Error) {
        if (error.message.includes('Unauthorized') || error.message.includes('未授权')) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: '未授权访问'
            }, {
                status: 401
            });
        }
        if (error.message.includes('Forbidden') || error.message.includes('权限')) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: '权限不足'
            }, {
                status: 403
            });
        }
        if (error.message.includes('not found') || error.message.includes('不存在')) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: '资源不存在'
            }, {
                status: 404
            });
        }
    }
    console.error(`[API Error] ${context || 'Unknown'}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
    });
    const responseError = isDevelopment() ? error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE : "TURBOPACK unreachable";
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: false,
        error: responseError
    }, {
        status: 500
    });
}
function createErrorResponse(message, statusCode = 400) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: false,
        error: message
    }, {
        status: statusCode
    });
}
function createSuccessResponse(data, statusCode = 200) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        success: true,
        ...data
    }, {
        status: statusCode
    });
}
}),
"[project]/src/app/api/review-groups/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/next/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/api/auth/[...nextauth]/route.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/apiErrorHandler.ts [app-route] (ecmascript)");
;
;
;
;
async function GET(req) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        if (!session?.user?.id) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createErrorResponse"])('未授权访问', 401);
        }
        const groups = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].reviewGroup.findMany({
            where: {
                userId: session.user.id
            },
            include: {
                _count: {
                    select: {
                        words: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSuccessResponse"])({
            data: groups
        });
    } catch (error) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleApiError"])(error, 'review-groups GET');
    }
}
async function POST(req) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        if (!session?.user?.id) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createErrorResponse"])('未授权访问', 401);
        }
        const { name } = await req.json();
        if (!name || name.trim() === '') {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createErrorResponse"])('分组名称不能为空', 400);
        }
        const count = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].reviewGroup.count({
            where: {
                userId: session.user.id
            }
        });
        if (count >= 3) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createErrorResponse"])('最多只能创建 3 个复习分组', 400);
        }
        const group = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].reviewGroup.create({
            data: {
                name: name.trim(),
                userId: session.user.id
            }
        });
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createSuccessResponse"])({
            data: group
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createErrorResponse"])('该分组名称已存在', 400);
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$apiErrorHandler$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["handleApiError"])(error, 'review-groups POST');
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0v-5sc1._.js.map