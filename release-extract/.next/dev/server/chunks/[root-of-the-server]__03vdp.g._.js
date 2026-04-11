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
"[project]/src/app/api/analytics/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/prisma.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/next/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/api/auth/[...nextauth]/route.ts [app-route] (ecmascript)");
;
;
;
;
const EXCLUDED_USERNAMES = [
    'creator',
    'tester'
];
function getClientIp(req) {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}
function getUserAgent(req) {
    return req.headers.get('user-agent') || 'unknown';
}
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
async function POST(req) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        const body = await req.json();
        const { eventType, metadata } = body;
        if (!eventType) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: 'Event type is required'
            }, {
                status: 400
            });
        }
        const sessionId = req.headers.get('x-session-id') || generateSessionId();
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.create({
            data: {
                eventType,
                userId: session?.user?.id || null,
                sessionId,
                metadata: metadata ? JSON.stringify(metadata) : null,
                ipAddress: getClientIp(req),
                userAgent: getUserAgent(req)
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            sessionId
        });
    } catch (error) {
        console.error('Analytics track error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: 'Failed to track event'
        }, {
            status: 500
        });
    }
}
async function GET(req) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        if (!session?.user?.id) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: 'Unauthorized'
            }, {
                status: 401
            });
        }
        const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findUnique({
            where: {
                id: session.user.id
            },
            select: {
                isAdmin: true
            }
        });
        if (!user?.isAdmin) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: 'Forbidden'
            }, {
                status: 403
            });
        }
        const { searchParams } = new URL(req.url);
        const range = searchParams.get('range') || '7d';
        const excludeTestUsers = searchParams.get('excludeTestUsers') !== 'false';
        const now = new Date();
        let startDate;
        switch(range){
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '7d':
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        const excludedUsers = excludeTestUsers ? await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findMany({
            where: {
                username: {
                    in: EXCLUDED_USERNAMES
                }
            },
            select: {
                id: true
            }
        }) : [];
        const excludedUserIds = excludedUsers.map((u)=>u.id);
        const baseWhere = {
            createdAt: {
                gte: startDate
            },
            ...excludeTestUsers && excludedUserIds.length > 0 ? {
                userId: {
                    notIn: excludedUserIds
                }
            } : {}
        };
        const [totalUsers, newUsers, totalWords] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.count({
                where: excludeTestUsers ? {
                    username: {
                        notIn: EXCLUDED_USERNAMES
                    }
                } : {}
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.count({
                where: {
                    createdAt: {
                        gte: startDate
                    },
                    ...excludeTestUsers ? {
                        username: {
                            notIn: EXCLUDED_USERNAMES
                        }
                    } : {}
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].word.count()
        ]);
        const [totalTranslations, totalDictations, totalErrors] = await Promise.all([
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.count({
                where: {
                    ...baseWhere,
                    eventType: 'TRANSLATE'
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.count({
                where: {
                    ...baseWhere,
                    eventType: {
                        in: [
                            'DICTATION_START',
                            'DICTATION_COMPLETE'
                        ]
                    }
                }
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.count({
                where: {
                    ...baseWhere,
                    eventType: {
                        in: [
                            'ERROR',
                            'API_ERROR'
                        ]
                    }
                }
            })
        ]);
        const userTranslateEvents = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: {
                ...baseWhere,
                eventType: 'TRANSLATE',
                userId: {
                    not: null
                }
            },
            select: {
                metadata: true,
                createdAt: true,
                userId: true
            }
        });
        const userTranslateErrorEvents = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: {
                ...baseWhere,
                eventType: {
                    in: [
                        'ERROR',
                        'API_ERROR'
                    ]
                },
                userId: {
                    not: null
                }
            },
            select: {
                metadata: true,
                createdAt: true
            }
        });
        let totalUserQueries = 0;
        let totalUserSuccess = 0;
        let totalUserFailed = 0;
        const userDailyStats = {};
        const userErrorReasons = {};
        userTranslateEvents.forEach((event)=>{
            const metadata = event.metadata ? JSON.parse(event.metadata) : {};
            const date = event.createdAt.toISOString().split('T')[0];
            totalUserQueries += metadata.wordCount || 1;
            totalUserSuccess += metadata.wordCount || 1;
            if (!userDailyStats[date]) {
                userDailyStats[date] = {
                    total: 0,
                    success: 0,
                    failed: 0
                };
            }
            userDailyStats[date].total += metadata.wordCount || 1;
            userDailyStats[date].success += metadata.wordCount || 1;
        });
        userTranslateErrorEvents.forEach((event)=>{
            const metadata = event.metadata ? JSON.parse(event.metadata) : {};
            const date = event.createdAt.toISOString().split('T')[0];
            const error = metadata.error || 'Unknown error';
            totalUserFailed += 1;
            userErrorReasons[error] = (userErrorReasons[error] || 0) + 1;
            if (!userDailyStats[date]) {
                userDailyStats[date] = {
                    total: 0,
                    success: 0,
                    failed: 0
                };
            }
            userDailyStats[date].total += 1;
            userDailyStats[date].failed += 1;
        });
        const userSuccessRate = totalUserQueries > 0 ? Math.round(totalUserSuccess / totalUserQueries * 10000) / 100 : 0;
        const userDailyTrend = Object.entries(userDailyStats).map(([date, stats])=>({
                date,
                total: stats.total,
                success: stats.success,
                failed: stats.failed,
                successRate: stats.total > 0 ? Math.round(stats.success / stats.total * 10000) / 100 : 0
            })).sort((a, b)=>a.date.localeCompare(b.date));
        const guestTranslateEvents = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: {
                createdAt: {
                    gte: startDate
                },
                eventType: 'GUEST_TRANSLATE'
            },
            select: {
                metadata: true,
                createdAt: true
            }
        });
        const guestTranslateErrorEvents = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: {
                createdAt: {
                    gte: startDate
                },
                eventType: 'GUEST_TRANSLATE_ERROR'
            },
            select: {
                metadata: true,
                createdAt: true
            }
        });
        let totalGuestQueries = 0;
        let totalGuestFound = 0;
        let totalGuestNotFound = 0;
        const guestDailyStats = {};
        const guestErrorReasons = {};
        guestTranslateEvents.forEach((event)=>{
            const metadata = event.metadata ? JSON.parse(event.metadata) : {};
            const date = event.createdAt.toISOString().split('T')[0];
            totalGuestQueries += metadata.totalWords || 0;
            totalGuestFound += metadata.foundWords || 0;
            totalGuestNotFound += metadata.notFoundWords || 0;
            if (!guestDailyStats[date]) {
                guestDailyStats[date] = {
                    total: 0,
                    found: 0,
                    notFound: 0
                };
            }
            guestDailyStats[date].total += metadata.totalWords || 0;
            guestDailyStats[date].found += metadata.foundWords || 0;
            guestDailyStats[date].notFound += metadata.notFoundWords || 0;
        });
        guestTranslateErrorEvents.forEach((event)=>{
            const metadata = event.metadata ? JSON.parse(event.metadata) : {};
            const error = metadata.error || 'Unknown error';
            guestErrorReasons[error] = (guestErrorReasons[error] || 0) + 1;
        });
        const guestSuccessRate = totalGuestQueries > 0 ? Math.round(totalGuestFound / totalGuestQueries * 10000) / 100 : 0;
        const translationRecords = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].translationRecord.findMany({
            where: {
                createdAt: {
                    gte: startDate
                }
            },
            select: {
                word: true,
                createdAt: true,
                responseTime: true
            }
        });
        const wordFrequency = {};
        let totalResponseTime = 0;
        let responseTimeCount = 0;
        translationRecords.forEach((record)=>{
            const word = record.word.toLowerCase();
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            if (record.responseTime) {
                totalResponseTime += record.responseTime;
                responseTimeCount++;
            }
        });
        const avgResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount * 100) / 100 : 0;
        const topWords = Object.entries(wordFrequency).sort((a, b)=>b[1] - a[1]).slice(0, 20).map(([word, count])=>({
                word,
                count
            }));
        const dailyActiveUsers = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.groupBy({
            by: [
                'userId'
            ],
            where: {
                ...baseWhere,
                userId: {
                    not: null
                }
            },
            _count: true
        });
        const dau = dailyActiveUsers.length;
        const eventsByType = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.groupBy({
            by: [
                'eventType'
            ],
            where: baseWhere,
            _count: true
        });
        const eventTypeMap = {};
        eventsByType.forEach((item)=>{
            eventTypeMap[item.eventType] = item._count;
        });
        const events = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: baseWhere,
            select: {
                createdAt: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        const dateMap = new Map();
        events.forEach((event)=>{
            const date = event.createdAt.toISOString().split('T')[0];
            dateMap.set(date, (dateMap.get(date) || 0) + 1);
        });
        const dailyTrend = Array.from(dateMap.entries()).map(([date, count])=>({
                date,
                count
            })).sort((a, b)=>a.date.localeCompare(b.date));
        const guestDailyTrend = Object.entries(guestDailyStats).map(([date, stats])=>({
                date,
                total: stats.total,
                found: stats.found,
                notFound: stats.notFound,
                successRate: stats.total > 0 ? Math.round(stats.found / stats.total * 10000) / 100 : 0
            })).sort((a, b)=>a.date.localeCompare(b.date));
        const recentEventsRaw = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: baseWhere,
            orderBy: {
                createdAt: 'desc'
            },
            take: 50,
            select: {
                id: true,
                eventType: true,
                userId: true,
                sessionId: true,
                metadata: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true
            }
        });
        const userIds = [
            ...new Set(recentEventsRaw.map((e)=>e.userId).filter(Boolean))
        ];
        const users = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findMany({
            where: {
                id: {
                    in: userIds
                }
            },
            select: {
                id: true,
                username: true
            }
        });
        const userMap = new Map(users.map((u)=>[
                u.id,
                u.username
            ]));
        const recentEvents = recentEventsRaw.map((event)=>({
                id: event.id,
                eventType: event.eventType,
                userId: event.userId,
                username: event.userId ? userMap.get(event.userId) || 'Unknown' : null,
                sessionId: event.sessionId,
                metadata: event.metadata ? JSON.parse(event.metadata) : null,
                ipAddress: event.ipAddress,
                userAgent: event.userAgent,
                createdAt: event.createdAt.toISOString()
            }));
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            data: {
                overview: {
                    totalUsers,
                    newUsers,
                    dau,
                    totalWords,
                    totalTranslations,
                    totalDictations,
                    totalErrors
                },
                userStats: {
                    totalQueries: totalUserQueries,
                    totalSuccess: totalUserSuccess,
                    totalFailed: totalUserFailed,
                    successRate: userSuccessRate,
                    queryCount: userTranslateEvents.length + userTranslateErrorEvents.length,
                    errorCount: userTranslateErrorEvents.length,
                    errorReasons: Object.entries(userErrorReasons).map(([reason, count])=>({
                            reason,
                            count
                        })).sort((a, b)=>b.count - a.count),
                    dailyTrend: userDailyTrend
                },
                guestStats: {
                    totalQueries: totalGuestQueries,
                    totalFound: totalGuestFound,
                    totalNotFound: totalGuestNotFound,
                    successRate: guestSuccessRate,
                    queryCount: guestTranslateEvents.length + guestTranslateErrorEvents.length,
                    errorCount: guestTranslateErrorEvents.length,
                    avgResponseTime,
                    errorReasons: Object.entries(guestErrorReasons).map(([reason, count])=>({
                            reason,
                            count
                        })).sort((a, b)=>b.count - a.count),
                    dailyTrend: guestDailyTrend
                },
                topWords,
                eventsByType: eventTypeMap,
                dailyTrend,
                recentEvents,
                range,
                excludeTestUsers
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        });
    } catch (error) {
        console.error('Analytics fetch error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: 'Failed to fetch analytics'
        }, {
            status: 500
        });
    }
}
async function DELETE(req) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$next$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerSession"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$api$2f$auth$2f5b2e2e2e$nextauth$5d2f$route$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["authOptions"]);
        if (!session?.user?.id) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: 'Unauthorized'
            }, {
                status: 401
            });
        }
        const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findUnique({
            where: {
                id: session.user.id
            },
            select: {
                isAdmin: true
            }
        });
        if (!user?.isAdmin) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: false,
                error: 'Forbidden'
            }, {
                status: 403
            });
        }
        const { searchParams } = new URL(req.url);
        const exportRange = searchParams.get('range') || '7d';
        const format = searchParams.get('format') || 'json';
        const excludeTestUsers = searchParams.get('excludeTestUsers') !== 'false';
        const now = new Date();
        let startDate;
        switch(exportRange){
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '7d':
            default:
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        const excludedUsers = excludeTestUsers ? await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findMany({
            where: {
                username: {
                    in: EXCLUDED_USERNAMES
                }
            },
            select: {
                id: true
            }
        }) : [];
        const excludedUserIds = excludedUsers.map((u)=>u.id);
        const eventsRaw = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].analyticsEvent.findMany({
            where: {
                createdAt: {
                    gte: startDate
                },
                ...excludeTestUsers && excludedUserIds.length > 0 ? {
                    userId: {
                        notIn: excludedUserIds
                    }
                } : {}
            },
            orderBy: {
                createdAt: 'desc'
            },
            select: {
                id: true,
                eventType: true,
                userId: true,
                sessionId: true,
                metadata: true,
                ipAddress: true,
                userAgent: true,
                createdAt: true
            }
        });
        const userIds = [
            ...new Set(eventsRaw.map((e)=>e.userId).filter(Boolean))
        ];
        const users = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].user.findMany({
            where: {
                id: {
                    in: userIds
                }
            },
            select: {
                id: true,
                username: true
            }
        });
        const userMap = new Map(users.map((u)=>[
                u.id,
                u.username
            ]));
        const events = eventsRaw.map((event)=>({
                id: event.id,
                eventType: event.eventType,
                userId: event.userId,
                username: event.userId ? userMap.get(event.userId) || 'Unknown' : null,
                sessionId: event.sessionId,
                metadata: event.metadata ? JSON.parse(event.metadata) : null,
                ipAddress: event.ipAddress,
                userAgent: event.userAgent,
                createdAt: event.createdAt.toISOString()
            }));
        if (format === 'csv') {
            const escapeCSV = (str)=>{
                let cleanStr = str.replace(/"/g, '""');
                if (/^[=+\-@]/.test(cleanStr)) {
                    cleanStr = "'" + cleanStr;
                }
                return `"${cleanStr}"`;
            };
            const csvHeader = 'ID,事件类型,用户ID,用户名,Session ID,元数据,IP地址,User Agent,创建时间\n';
            const csvRows = events.map((e)=>`${escapeCSV(e.id)},${escapeCSV(e.eventType)},${escapeCSV(e.userId || '')},${escapeCSV(e.username || '')},${escapeCSV(e.sessionId || '')},${escapeCSV(JSON.stringify(e.metadata || {}))},${escapeCSV(e.ipAddress || '')},${escapeCSV(e.userAgent || '')},${escapeCSV(e.createdAt)}`).join('\n');
            return new Response('\uFEFF' + csvHeader + csvRows, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="analytics_${exportRange}_${now.toISOString().split('T')[0]}.csv"`
                }
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            data: {
                exportRange,
                exportedAt: now.toISOString(),
                totalCount: events.length,
                excludeTestUsers,
                events
            }
        });
    } catch (error) {
        console.error('Analytics export error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: 'Failed to export analytics'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__03vdp.g._.js.map