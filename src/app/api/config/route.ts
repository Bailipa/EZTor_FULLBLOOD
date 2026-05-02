import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { logger } from '@/lib/logger';

function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return '****';
  }
  return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
}

async function checkAdmin(session: { user?: { id?: string | null } | null } | null): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true }
    });
    return user?.isAdmin === true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to verify admin status');
    return false;
  }
}

export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkAdmin(session);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let config = await prisma.apiConfig.findUnique({
      where: { id: "global" }
    });

    if (!config) {
      return NextResponse.json({
        success: true,
        data: {
          apiKey: '',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-4o-mini',
          systemPrompt: ''
        }
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        ...config,
        apiKey: maskApiKey(config.apiKey)
      }
    });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to fetch api config:");
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await checkAdmin(session);
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { apiKey, baseUrl, model, systemPrompt } = body;

    const updatedConfig = await prisma.apiConfig.upsert({
      where: { id: "global" },
      update: {
        apiKey,
        baseUrl,
        model,
        systemPrompt
      },
      create: {
        id: "global",
        apiKey,
        baseUrl: baseUrl || 'https://api.openai.com/v1',
        model: model || 'gpt-4o-mini',
        systemPrompt: systemPrompt || '',
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        ...updatedConfig,
        apiKey: maskApiKey(updatedConfig.apiKey)
      }
    });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to update api config:");
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
