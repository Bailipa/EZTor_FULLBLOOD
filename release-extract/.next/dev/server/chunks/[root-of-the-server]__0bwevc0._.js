module.exports = [
"[externals]/next/dist/build/adapter/setup-node-env.external.js [external] (next/dist/build/adapter/setup-node-env.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/build/adapter/setup-node-env.external.js", () => require("next/dist/build/adapter/setup-node-env.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/tags-manifest.external.js [external] (next/dist/server/lib/incremental-cache/tags-manifest.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/tags-manifest.external.js", () => require("next/dist/server/lib/incremental-cache/tags-manifest.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/memory-cache.external.js [external] (next/dist/server/lib/incremental-cache/memory-cache.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/memory-cache.external.js", () => require("next/dist/server/lib/incremental-cache/memory-cache.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/shared-cache-controls.external.js [external] (next/dist/server/lib/incremental-cache/shared-cache-controls.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/shared-cache-controls.external.js", () => require("next/dist/server/lib/incremental-cache/shared-cache-controls.external.js"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[externals]/zlib [external] (zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("zlib", () => require("zlib"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

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
"[project]/src/lib/csrf.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkCsrfHeader",
    ()=>checkCsrfHeader,
    "validateCsrf",
    ()=>validateCsrf
]);
const CSRF_EXEMPT_PATHS = [
    '/api/auth',
    '/api/captcha'
];
const SAFE_METHODS = [
    'GET',
    'HEAD',
    'OPTIONS'
];
function isPathMatch(pathname, paths) {
    return paths.some((path)=>pathname === path || pathname.startsWith(path + '/'));
}
function getAllowedOrigins(host) {
    return [
        `http://${host}`,
        `https://${host}`,
        ("TURBOPACK compile-time value", "http://114.55.58.90:3000")
    ].filter(Boolean);
}
function validateCsrf(request) {
    const method = request.method.toUpperCase();
    if (SAFE_METHODS.includes(method)) {
        return {
            valid: true
        };
    }
    const { pathname } = request.nextUrl;
    if (isPathMatch(pathname, CSRF_EXEMPT_PATHS)) {
        return {
            valid: true
        };
    }
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');
    if (!origin && !referer) {
        return {
            valid: false,
            reason: 'Missing origin and referer headers'
        };
    }
    const requestOrigin = origin || (referer ? (()=>{
        try {
            return new URL(referer).origin;
        } catch  {
            return '';
        }
    })() : '');
    if (!requestOrigin) {
        return {
            valid: false,
            reason: 'Invalid referer header'
        };
    }
    if (!host) {
        return {
            valid: false,
            reason: 'Missing host header'
        };
    }
    const allowedOrigins = getAllowedOrigins(host);
    if (!allowedOrigins.includes(requestOrigin)) {
        return {
            valid: false,
            reason: `Origin ${requestOrigin} not allowed`
        };
    }
    return {
        valid: true
    };
}
function checkCsrfHeader(req) {
    const method = req.method.toUpperCase();
    if (SAFE_METHODS.includes(method)) {
        return {
            valid: true
        };
    }
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const host = req.headers.get('host');
    if (!origin && !referer) {
        return {
            valid: false,
            reason: 'Missing origin and referer headers'
        };
    }
    const requestOrigin = origin || (referer ? (()=>{
        try {
            return new URL(referer).origin;
        } catch  {
            return '';
        }
    })() : '');
    if (!requestOrigin) {
        return {
            valid: false,
            reason: 'Invalid referer header'
        };
    }
    if (!host) {
        return {
            valid: false,
            reason: 'Missing host header'
        };
    }
    const allowedOrigins = getAllowedOrigins(host);
    if (!allowedOrigins.includes(requestOrigin)) {
        return {
            valid: false,
            reason: `Origin not allowed`
        };
    }
    return {
        valid: true
    };
}
}),
"[project]/src/proxy.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "proxy",
    ()=>proxy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$jwt$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next-auth/jwt/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csrf$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/csrf.ts [middleware] (ecmascript)");
;
;
;
const OPTIONAL_AUTH_PATHS = [
    "/",
    "/api/translate",
    "/api/public-translate"
];
const PUBLIC_PATHS = [
    "/auth/signin",
    "/api/auth",
    "/api/captcha"
];
const ADMIN_PATHS = [
    "/analytics",
    "/public-words",
    "/translation-records",
    "/api/analytics",
    "/api/public-words",
    "/api/translation-records",
    "/api/config"
];
function isPathMatch(pathname, paths) {
    return paths.some((path)=>{
        if (path === "/") return pathname === "/";
        return pathname === path || pathname.startsWith(path + "/");
    });
}
async function proxy(request) {
    const { pathname } = request.nextUrl;
    if (isPathMatch(pathname, PUBLIC_PATHS)) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    const csrfResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$csrf$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["validateCsrf"])(request);
    if (!csrfResult.valid) {
        console.warn(`[CSRF] Blocked request to ${pathname}: ${csrfResult.reason}`);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: "请求验证失败，请刷新页面重试"
        }, {
            status: 403
        });
    }
    const token = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2d$auth$2f$jwt$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getToken"])({
        req: request
    });
    if (!token) {
        const isOptionalAuth = isPathMatch(pathname, OPTIONAL_AUTH_PATHS);
        if (!isOptionalAuth) {
            const signInUrl = new URL("/auth/signin", request.url);
            signInUrl.searchParams.set("callbackUrl", pathname);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(signInUrl);
        }
    } else {
        const isAdminPath = isPathMatch(pathname, ADMIN_PATHS);
        if (isAdminPath && !token.isAdmin) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/", request.url));
        }
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|public).*)"
    ]
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0bwevc0._.js.map