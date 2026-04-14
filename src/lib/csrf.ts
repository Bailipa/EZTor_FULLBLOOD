import { NextRequest } from 'next/server';

const CSRF_EXEMPT_PATHS = [
  '/api/auth',
  '/api/captcha',
  '/api/share/import',
];

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function isPathMatch(pathname: string, paths: string[]): boolean {
  return paths.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function getAllowedOrigins(host: string): string[] {
  return [
    `http://${host}`,
    `https://${host}`,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[];
}

export function validateCsrf(request: NextRequest): { valid: boolean; reason?: string } {
  const method = request.method.toUpperCase();
  
  if (SAFE_METHODS.includes(method)) {
    return { valid: true };
  }

  const { pathname } = request.nextUrl;
  
  if (isPathMatch(pathname, CSRF_EXEMPT_PATHS)) {
    return { valid: true };
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

  const requestOrigin = origin || (referer ? (() => {
    try {
      return new URL(referer).origin;
    } catch {
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

  return { valid: true };
}

export function checkCsrfHeader(req: Request): { valid: boolean; reason?: string } {
  const method = req.method.toUpperCase();
  
  if (SAFE_METHODS.includes(method)) {
    return { valid: true };
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

  const requestOrigin = origin || (referer ? (() => {
    try {
      return new URL(referer).origin;
    } catch {
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

  return { valid: true };
}
