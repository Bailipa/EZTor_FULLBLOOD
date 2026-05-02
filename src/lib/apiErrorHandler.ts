import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred';
const GENERIC_ERROR_MESSAGE_CN = '服务器内部错误';

interface ApiError {
  message: string;
  statusCode: number;
  isPublic: boolean;
}

const ERROR_MAP: Record<string, ApiError> = {
  'P2002': { message: '数据已存在', statusCode: 409, isPublic: true },
  'P2025': { message: '记录不存在', statusCode: 404, isPublic: true },
  'P2003': { message: '关联数据不存在', statusCode: 400, isPublic: true },
  'UNAUTHORIZED': { message: '未授权访问', statusCode: 401, isPublic: true },
  'FORBIDDEN': { message: '权限不足', statusCode: 403, isPublic: true },
  'NOT_FOUND': { message: '资源不存在', statusCode: 404, isPublic: true },
  'VALIDATION_ERROR': { message: '数据验证失败', statusCode: 400, isPublic: true },
  'RATE_LIMIT': { message: '请求过于频繁，请稍后再试', statusCode: 429, isPublic: true },
};

function getErrorCode(error: any): string | null {
  if (error?.code) return error.code;
  if (error?.meta?.code) return error.meta.code;
  if (error?.name === 'PrismaClientKnownRequestError') return error.code;
  return null;
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function handleApiError(error: any, context?: string): NextResponse {
  const errorCode = getErrorCode(error);
  const mappedError = errorCode ? ERROR_MAP[errorCode] : null;

  if (mappedError) {
    logger.error({ code: errorCode, message: error.message }, `[API Error] ${context || 'Unknown'}`);
    
    return NextResponse.json(
      { success: false, error: mappedError.message },
      { status: mappedError.statusCode }
    );
  }

  if (error instanceof Error) {
    if (error.message.includes('Unauthorized') || error.message.includes('未授权')) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }
    
    if (error.message.includes('Forbidden') || error.message.includes('权限')) {
      return NextResponse.json(
        { success: false, error: '权限不足' },
        { status: 403 }
      );
    }

    if (error.message.includes('not found') || error.message.includes('不存在')) {
      return NextResponse.json(
        { success: false, error: '资源不存在' },
        { status: 404 }
      );
    }
  }

  logger.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, `[API Error] ${context || 'Unknown'}`);

  const responseError = isDevelopment() 
    ? (error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE)
    : GENERIC_ERROR_MESSAGE_CN;

  return NextResponse.json(
    { success: false, error: responseError },
    { status: 500 }
  );
}

export function createErrorResponse(message: string, statusCode: number = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: message },
    { status: statusCode }
  );
}

export function createSuccessResponse(data: any, statusCode: number = 200): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status: statusCode }
  );
}
