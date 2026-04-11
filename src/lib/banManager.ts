import prisma from '@/lib/prisma';

const VIOLATION_THRESHOLDS = {
  WARNING: 1,
  TEMP_BAN_1H: 3,
  TEMP_BAN_24H: 5,
  PERMANENT_BAN: 10,
};

const BAN_DURATIONS = {
  [VIOLATION_THRESHOLDS.TEMP_BAN_1H]: 60 * 60 * 1000,
  [VIOLATION_THRESHOLDS.TEMP_BAN_24H]: 24 * 60 * 60 * 1000,
};

export interface BanCheckResult {
  isBanned: boolean;
  reason?: string;
  expiresAt?: Date;
}

export interface ViolationRecordResult {
  violationCount: number;
  banApplied: boolean;
  banInfo?: {
    type: 'warning' | 'temp_ban' | 'permanent_ban';
    duration?: number;
    message: string;
  };
}

export async function checkUserBan(userId: string): Promise<BanCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return { isBanned: false };
  }

  const userData = user as any;

  if (userData.isBanned) {
    if (userData.banExpiresAt && new Date() > new Date(userData.banExpiresAt)) {
      await prisma.user.update({
        where: { id: userId },
        data: { isBanned: false, banReason: null, banExpiresAt: null } as any
      });
      return { isBanned: false };
    }
    
    return {
      isBanned: true,
      reason: userData.banReason || 'Account banned',
      expiresAt: userData.banExpiresAt ? new Date(userData.banExpiresAt) : undefined
    };
  }

  return { isBanned: false };
}

export async function checkIpBan(ipAddress: string): Promise<BanCheckResult> {
  try {
    const ipBan = await (prisma as any).ipBan.findUnique({
      where: { ipAddress }
    });

    if (!ipBan) {
      return { isBanned: false };
    }

    if (ipBan.isPermanent) {
      return {
        isBanned: true,
        reason: ipBan.reason
      };
    }

    if (ipBan.expiresAt && new Date() > new Date(ipBan.expiresAt)) {
      await (prisma as any).ipBan.delete({
        where: { ipAddress }
      });
      return { isBanned: false };
    }

    return {
      isBanned: true,
      reason: ipBan.reason,
      expiresAt: ipBan.expiresAt ? new Date(ipBan.expiresAt) : undefined
    };
  } catch {
    return { isBanned: false };
  }
}

export async function recordViolation(
  userId: string,
  violationType: string,
  inputValue: string,
  ipAddress?: string,
  userAgent?: string
): Promise<ViolationRecordResult> {
  const truncatedInput = inputValue.substring(0, 500);

  try {
    await (prisma as any).securityViolation.create({
      data: {
        userId,
        violationType,
        inputValue: truncatedInput,
        ipAddress,
        userAgent
      }
    });
  } catch {
    return { violationCount: 0, banApplied: false };
  }

  let recentViolations = 0;
  try {
    recentViolations = await (prisma as any).securityViolation.count({
      where: {
        userId,
        detectedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
  } catch {
    recentViolations = 1;
  }

  let banApplied = false;
  let banInfo: ViolationRecordResult['banInfo'];

  try {
    if (recentViolations >= VIOLATION_THRESHOLDS.PERMANENT_BAN) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: '永久封禁：多次尝试提示词注入攻击',
          banExpiresAt: null
        } as any
      });
      
      if (ipAddress) {
        try {
          await (prisma as any).ipBan.upsert({
            where: { ipAddress },
            create: {
              ipAddress,
              reason: '关联永久封禁账户',
              isPermanent: true
            },
            update: {
              violationCount: { increment: 1 },
              isPermanent: true
            }
          });
        } catch {}
      }
      
      banApplied = true;
      banInfo = { type: 'permanent_ban', message: '账户已被永久封禁' };
    } else if (recentViolations >= VIOLATION_THRESHOLDS.TEMP_BAN_24H) {
      const expiresAt = new Date(Date.now() + BAN_DURATIONS[VIOLATION_THRESHOLDS.TEMP_BAN_24H]);
      await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: '临时封禁24小时：多次尝试提示词注入攻击',
          banExpiresAt: expiresAt
        } as any
      });
      
      if (ipAddress) {
        try {
          await (prisma as any).ipBan.upsert({
            where: { ipAddress },
            create: {
              ipAddress,
              reason: '关联临时封禁账户',
              expiresAt
            },
            update: {
              violationCount: { increment: 1 },
              expiresAt
            }
          });
        } catch {}
      }
      
      banApplied = true;
      banInfo = { type: 'temp_ban', duration: 24, message: '账户已被临时封禁24小时' };
    } else if (recentViolations >= VIOLATION_THRESHOLDS.TEMP_BAN_1H) {
      const expiresAt = new Date(Date.now() + BAN_DURATIONS[VIOLATION_THRESHOLDS.TEMP_BAN_1H]);
      await prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: true,
          banReason: '临时封禁1小时：尝试提示词注入攻击',
          banExpiresAt: expiresAt
        } as any
      });
      
      banApplied = true;
      banInfo = { type: 'temp_ban', duration: 1, message: '账户已被临时封禁1小时' };
    } else if (recentViolations >= VIOLATION_THRESHOLDS.WARNING) {
      banInfo = { type: 'warning', message: '警告：检测到可疑行为' };
    }
  } catch (error) {
    console.error('Error applying ban:', error);
  }

  return {
    violationCount: recentViolations,
    banApplied,
    banInfo
  };
}

export const INJECTION_DETECTED_MESSAGE = '检测到提示词注入，不执行。如果继续尝试将面临封禁。';
