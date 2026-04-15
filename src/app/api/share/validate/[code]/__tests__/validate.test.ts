/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GET } from '../route';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    sharedVocabulary: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sharedVocabularyImport: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    reviewGroup: {
      findUnique: vi.fn(),
    },
  };
  return { default: mockPrisma };
});

describe('Share Validate API', () => {
  const mockUserId = 'test-user-123';
  const validShareCode = 'ABC-234-XYZ';

  const mockSession = {
    user: {
      id: mockUserId,
      username: 'testuser',
    },
  };

  const mockShare = {
    id: 'share-1',
    code: validShareCode,
    name: 'Test Share',
    description: 'Test description',
    wordCount: 10,
    shareType: 'REVIEW_GROUP',
    isActive: true,
    usedCount: 0,
    maxUses: null,
    expiresAt: null,
    User: {
      username: 'creator_user',
    },
    ReviewGroup: {
      name: 'Test Group',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe('Valid Code Scenarios', () => {
    it('should return valid=true for a valid share code', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(true);
      expect(data.data.code).toBe(validShareCode);
      expect(data.data.creator).toBe('creator_user');
    });

    it('should normalize lowercase code to uppercase', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/share/validate/abc-234-xyz');
      const response = await GET(req, { params: Promise.resolve({ code: 'abc-234-xyz' }) });

      expect(prisma.sharedVocabulary.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'ABC-234-XYZ' },
        })
      );
    });
  });

  describe('Invalid Code Scenarios', () => {
    it('should return INVALID_CODE for non-existent code', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(null);

      const req = new Request('http://localhost/api/share/validate/ZZZ-ZZZ-ZZZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ZZZ-ZZZ-ZZZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toBe('INVALID_CODE');
    });

    it('should return INACTIVE_SHARE for revoked share', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        isActive: false,
      } as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toBe('INACTIVE_SHARE');
    });

    it('should return EXPIRED_CODE for expired share', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        expiresAt: new Date('2020-01-01'),
      } as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toBe('EXPIRED_CODE');
    });

    it('should return MAX_USES_REACHED when usage limit exceeded', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        maxUses: 5,
        usedCount: 5,
      } as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toBe('MAX_USES_REACHED');
    });

    it('should return ALREADY_IMPORTED for duplicate import', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue({
        id: 'import-1',
        sharedId: mockShare.id,
        importerId: mockUserId,
        targetGroupId: 'existing-group-1',
      } as any);
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'existing-group-1',
        name: 'Existing Group',
        userId: mockUserId,
      } as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toBe('ALREADY_IMPORTED');
    });

    it('should allow re-import when target group was deleted', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue({
        id: 'import-1',
        sharedId: mockShare.id,
        importerId: mockUserId,
        targetGroupId: 'deleted-group-1',
      } as any);
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabularyImport.delete).mockResolvedValue({ id: 'import-1' } as any);
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      const response = await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });
      const data = await response.json();

      expect(data.valid).toBe(true);
    });
  });

  describe('Prisma Relation Name Validation', () => {
    it('should use correct capital relation names in include', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({} as any);

      const req = new Request('http://localhost/api/share/validate/ABC-234-XYZ');
      await GET(req, { params: Promise.resolve({ code: 'ABC-234-XYZ' }) });

      const callArg = vi.mocked(prisma.sharedVocabulary.findUnique).mock.calls[0][0] as any;
      expect(callArg.include).toHaveProperty('User');
      expect(callArg.include).toHaveProperty('ReviewGroup');
      expect(callArg.include).not.toHaveProperty('user');
      expect(callArg.include).not.toHaveProperty('reviewGroup');
    });
  });
});
