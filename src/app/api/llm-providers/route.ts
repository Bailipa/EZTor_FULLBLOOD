import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { listLlmProviders, maskApiKey } from '@/lib/llmPool';

function badRequest(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, res: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!(user as any)?.isAdmin) return { ok: false as const, res: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };

  return { ok: true as const, session };
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.res;

  const providers = await listLlmProviders();
  return NextResponse.json({
    success: true,
    data: providers.map((p) => ({
      ...p,
      apiKey: maskApiKey(p.apiKey),
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.res;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const apiKey = String(body.apiKey || '').trim();
  const baseUrl = String(body.baseUrl || 'https://api.openai.com/v1').trim();
  const model = String(body.model || 'gpt-4o-mini').trim();
  const priority = Number.isFinite(body.priority) ? Number(body.priority) : 0;
  const isActive = body.isActive !== false;
  const quotaRemaining = body.quotaRemaining === null || body.quotaRemaining === undefined || body.quotaRemaining === ''
    ? null
    : Number(body.quotaRemaining);

  if (!name) return badRequest('name is required');
  if (!apiKey) return badRequest('apiKey is required');

  const now = new Date();
  const id = crypto.randomUUID();

  try {
    await prisma.llmApiProvider.create({
      data: {
        id,
        name,
        apiKey,
        baseUrl,
        model,
        priority,
        isActive,
        quotaRemaining,
        quotaUsed: 0,
        createdAt: now,
        updatedAt: now
      }
    });
  } catch (e: any) {
    const msg = String(e?.message || 'create failed');
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.res;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '').trim();
  if (!id) return badRequest('id is required');

  const fields: Record<string, any> = {};
  for (const key of ['name', 'apiKey', 'baseUrl', 'model']) {
    if (body[key] !== undefined) fields[key] = String(body[key]).trim();
  }
  if (body.priority !== undefined) fields.priority = Number(body.priority) || 0;
  if (body.isActive !== undefined) fields.isActive = Boolean(body.isActive);
  if (body.quotaRemaining !== undefined) {
    fields.quotaRemaining =
      body.quotaRemaining === null || body.quotaRemaining === ''
        ? null
        : Number(body.quotaRemaining);
  }

  if (Object.keys(fields).length === 0) return badRequest('no fields to update');

  fields.updatedAt = new Date();

  try {
    await prisma.llmApiProvider.update({
      where: { id },
      data: fields,
    });
  } catch (e: any) {
    const msg = String(e?.message || 'update failed');
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.res;

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();
  if (!id) return badRequest('id is required');

  try {
    await prisma.llmApiProvider.delete({
      where: { id },
    });
  } catch (e: any) {
    const msg = String(e?.message || 'delete failed');
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
