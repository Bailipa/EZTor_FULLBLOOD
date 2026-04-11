module.exports = [
"[project]/src/lib/envValidator.ts [instrumentation] (ecmascript)", ((__turbopack_context__) => {
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
];

//# sourceMappingURL=src_lib_envValidator_ts_0na0_jj._.js.map