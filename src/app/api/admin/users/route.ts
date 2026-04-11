import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const SESSION_EXPIRY_MS = 30 * 60 * 1000; // keep consistent with src/lib/analytics.ts

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!(user as any)?.isAdmin) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true as const };
}

function parseRange(range: string): Date {
  const now = new Date();
  switch (range) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '7d':
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.res;

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '30d';
  const startDate = parseRange(range);

  const users = await prisma.user.findMany({
    select: { id: true, username: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Pull events in range for all users (used for frequency + online duration estimation).
  const events = await (prisma as any).analyticsEvent.findMany({
    where: {
      userId: { not: null },
      createdAt: { gte: startDate },
    },
    select: {
      userId: true,
      sessionId: true,
      eventType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  type SessionAgg = { min: number; max: number };
  const perUser = new Map<string, {
    totalEvents: number;
    activeDays: Set<string>;
    sessions: Map<string, SessionAgg>;
    lastSeenAt: number;
  }>();

  for (const e of events as any[]) {
    const userId: string | null = e.userId;
    if (!userId) continue;
    const t = new Date(e.createdAt).getTime();
    const day = new Date(t).toISOString().slice(0, 10);

    let u = perUser.get(userId);
    if (!u) {
      u = { totalEvents: 0, activeDays: new Set(), sessions: new Map(), lastSeenAt: 0 };
      perUser.set(userId, u);
    }

    u.totalEvents += 1;
    u.activeDays.add(day);
    u.lastSeenAt = Math.max(u.lastSeenAt, t);

    const sessionId = String(e.sessionId || '');
    if (sessionId) {
      const s = u.sessions.get(sessionId);
      if (!s) {
        u.sessions.set(sessionId, { min: t, max: t });
      } else {
        s.min = Math.min(s.min, t);
        s.max = Math.max(s.max, t);
      }
    }
  }

  const rows = users.map((u) => {
    const agg = perUser.get(u.id);
    let onlineMs = 0;
    let sessionCount = 0;

    if (agg) {
      sessionCount = agg.sessions.size;
      for (const sess of agg.sessions.values()) {
        const dur = Math.max(0, sess.max - sess.min);
        onlineMs += Math.min(dur, SESSION_EXPIRY_MS);
      }
    }

    return {
      id: u.id,
      username: u.username,
      createdAt: u.createdAt.toISOString(),
      range,
      totalEventsInRange: agg?.totalEvents || 0,
      activeDaysInRange: agg?.activeDays.size || 0,
      sessionsInRange: sessionCount,
      onlineMinutesInRange: Math.round(onlineMs / 60000),
      lastSeenAt: agg?.lastSeenAt ? new Date(agg.lastSeenAt).toISOString() : null,
    };
  });

  return NextResponse.json({ success: true, data: rows });
}

