import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { 
  syncAllUserWordsWithPublic, 
  deduplicateUserWords, 
  getSyncStats,
  syncUserWordWithPublic 
} from '@/lib/wordSync';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats':
        const stats = await getSyncStats(session.user.id);
        return NextResponse.json({ success: true, data: stats });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error({ err: error }, '[WordSyncAPI] Error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, word } = body;

    switch (action) {
      case 'sync-all':
        const syncResult = await syncAllUserWordsWithPublic(session.user.id);
        return NextResponse.json({ 
          success: true, 
          data: syncResult,
          message: `同步完成：${syncResult.synced} 个单词已更新，${syncResult.skipped} 个单词无需更新`
        });

      case 'sync-word':
        if (!word) {
          return NextResponse.json({ error: 'Word is required' }, { status: 400 });
        }
        const wordResult = await syncUserWordWithPublic(session.user.id, word);
        return NextResponse.json({ 
          success: true, 
          data: wordResult,
          message: wordResult.updated 
            ? `单词 "${word}" 已从公共词库同步更新` 
            : `单词 "${word}" 无需更新`
        });

      case 'deduplicate':
        const dedupeResult = await deduplicateUserWords(session.user.id);
        return NextResponse.json({ 
          success: true, 
          data: dedupeResult,
          message: `去重完成：发现 ${dedupeResult.duplicates} 个重复，已保留最新版本`
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error({ err: error }, '[WordSyncAPI] Error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
