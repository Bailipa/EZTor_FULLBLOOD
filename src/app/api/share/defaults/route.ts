import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { handleApiError, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler'

/**
 * 默认词库缓存机制
 * 缓存 TTL: 1 小时
 */
interface CacheEntry {
  data: Record<string, unknown>[]
  timestamp: number
}

const defaultVocabCache = new Map<string, CacheEntry>()
const CACHE_TTL = 3600000 // 1 hour in milliseconds

/**
 * 获取默认词库列表（带缓存）
 */
async function getDefaultVocabularies() {
  const cached = defaultVocabCache.get('defaults')

  // 检查缓存是否有效
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // 从数据库查询
  const defaults = await prisma.defaultVocabulary.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
    include: {
      ReviewGroup: {
        select: {
          name: true,
          _count: {
            select: { ReviewGroupWord: true },
          },
        },
      },
    },
  })

  const transformedData = defaults.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    code: d.code,
    wordCount: d.ReviewGroup._count.ReviewGroupWord,
    sortOrder: d.sortOrder,
    groupName: d.ReviewGroup.name,
  }))

  // 更新缓存
  defaultVocabCache.set('defaults', {
    data: transformedData,
    timestamp: Date.now(),
  })

  return transformedData
}

/**
 * GET /api/share/defaults
 * 获取预配置的默认词库列表
 *
 * 认证：Required
 * 缓存：1 小时
 *
 * Response Schema:
 * {
 *   success: boolean;
 *   data: Array<{
 *     id: string;
 *     name: string;
 *     description: string | null;
 *     code: string;
 *     wordCount: number;
 *     sortOrder: number;
 *     groupName: string;
 *   }>;
 * }
 */
export async function GET() {
  try {
    // 认证检查
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return createErrorResponse('未授权访问', 401)
    }

    // 获取默认词库列表（使用缓存）
    const vocabularies = await getDefaultVocabularies()

    return createSuccessResponse({ data: vocabularies })
  } catch (err: unknown) {
    return handleApiError(err, 'share/defaults GET')
  }
}
