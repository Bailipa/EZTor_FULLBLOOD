/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST } from '../import/route';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

// Mock dependencies
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}));

vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    publicWord: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    sharedVocabulary: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    sharedVocabularyImport: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    reviewGroup: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    word: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'new-word-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    reviewGroupWord: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (fn) => {
      const result = await fn(mockPrisma);
      return result;
    }),
  };
  return { default: mockPrisma };
});

describe('Share Import API', () => {
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
    isActive: true,
    usedCount: 0,
    maxUses: null,
    expiresAt: null,
    ReviewGroup: {
      ReviewGroupWord: [
        {
          Word: {
            word: 'test',
            phonetic: '/test/',
            pos: 'n.',
            translation: '测试',
            example: 'This is a test',
            exampleTranslation: '这是一个测试',
          },
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('未授权访问');
    });

    it('should reject requests without user id', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: null },
      } as any);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid share code format', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'invalid-code',
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_FORMAT');
    });

    it('should normalize lowercase share code to uppercase', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabulary.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      });
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' });
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabularyImport.create).mockResolvedValue({});
      vi.mocked(prisma.word.findMany).mockResolvedValue([]);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'abc-234-xyz',
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.sharedVocabulary.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { code: 'ABC-234-XYZ' }
        })
      );
    });

    it('should reject empty custom name', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: '',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should reject missing custom name', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Share Code Validation', () => {
    it('should reject non-existent share code', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(null);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_CODE');
    });

    it('should reject inactive share', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        isActive: false,
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INACTIVE_SHARE');
    });

    it('should reject expired share code', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        expiresAt: new Date('2020-01-01'),
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.success).toBe(false);
      expect(data.error).toBe('EXPIRED_CODE');
    });

    it('should reject when max uses reached', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        maxUses: 5,
        usedCount: 5,
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe('MAX_USES_REACHED');
    });

    it('should reject when atomic maxUses check fails (race condition)', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        ...mockShare,
        maxUses: 5,
        usedCount: 4,
      });
      vi.mocked(prisma.sharedVocabulary.updateMany).mockResolvedValue({ count: 0 });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toBe('MAX_USES_REACHED');
    });
  });

  describe('Duplicate Import Prevention', () => {
    it('should reject duplicate import', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue({
        id: 'import-1',
        sharedId: mockShare.id,
        importerId: mockUserId,
        targetGroupId: 'existing-group-1',
      });
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'existing-group-1',
        name: 'Existing Group',
        userId: mockUserId,
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('ALREADY_IMPORTED');
    });

    it('should allow re-import when target group was deleted', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue({
        id: 'import-1',
        sharedId: mockShare.id,
        importerId: mockUserId,
        targetGroupId: 'deleted-group-1',
      });
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabularyImport.delete).mockResolvedValue({ id: 'import-1' });
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      });
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' });
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabularyImport.create).mockResolvedValue({});
      vi.mocked(prisma.word.findMany).mockResolvedValue([]);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.sharedVocabularyImport.delete).toHaveBeenCalled();
    });
  });

  describe('Target Group Management', () => {
    it('should create new group when createNewGroup is true', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      });
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' });
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabularyImport.create).mockResolvedValue({});
      vi.mocked(prisma.word.findMany).mockResolvedValue([]);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          createNewGroup: true,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.reviewGroup.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          name: 'Test Group',
          userId: mockUserId,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should use existing group when targetGroupId is provided', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'existing-group-1',
        name: 'Existing Group',
        userId: mockUserId,
      });
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' });
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({});
      vi.mocked(prisma.sharedVocabularyImport.create).mockResolvedValue({});
      vi.mocked(prisma.word.findMany).mockResolvedValue([]);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          targetGroupId: 'existing-group-1',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.reviewGroup.findUnique).toHaveBeenCalledWith({
        where: { id: 'existing-group-1' },
      });
    });

    it('should reject when target group does not exist', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue(null);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          targetGroupId: 'non-existent-group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('should reject when target group belongs to another user', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.reviewGroup.findUnique).mockResolvedValue({
        id: 'other-group-1',
        name: 'Other Group',
        userId: 'other-user-456',
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          targetGroupId: 'other-group-1',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it('should reject when neither targetGroupId nor createNewGroup is provided', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          createNewGroup: false,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Import Process', () => {
    beforeEach(() => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare as any);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      } as any);
      vi.mocked(prisma.publicWord.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.publicWord.create).mockResolvedValue({ id: 'public-word-1' } as any);
      vi.mocked(prisma.word.create).mockResolvedValue({ id: 'new-word-1' } as any);
      vi.mocked(prisma.reviewGroupWord.create).mockResolvedValue({} as any);
      vi.mocked(prisma.reviewGroupWord.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.sharedVocabulary.update).mockResolvedValue({} as any);
      vi.mocked(prisma.sharedVocabularyImport.create).mockResolvedValue({} as any);
      vi.mocked(prisma.word.findMany).mockResolvedValue([]);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return await fn(prisma);
      });
    });

    it('should successfully import words', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('wordsImported');
      expect(data.data).toHaveProperty('wordsSkipped');
      expect(data.data).toHaveProperty('groupId');
      expect(data.data).toHaveProperty('groupName');
    });

    it('should skip existing words but still link them to the target group when skipExisting is true', async () => {
      vi.mocked(prisma.word.findUnique).mockResolvedValue({
        id: 'existing-word-1',
        word: 'test',
      } as any);
      vi.mocked(prisma.reviewGroupWord.findUnique).mockResolvedValue(null);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          skipExisting: true,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.wordsSkipped).toBe(1);
      expect(prisma.reviewGroupWord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reviewGroupId: 'new-group-1',
          wordId: 'existing-word-1',
        }),
      });
    });

    it('should not create ReviewGroupWord when word already exists in target group', async () => {
      vi.mocked(prisma.word.findUnique).mockResolvedValue({
        id: 'existing-word-1',
        word: 'test',
      } as any);
      vi.mocked(prisma.reviewGroupWord.findUnique).mockResolvedValue({
        id: 'existing-link-1',
        reviewGroupId: 'new-group-1',
        wordId: 'existing-word-1',
      } as any);
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
          skipExisting: true,
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.wordsSkipped).toBe(1);
      expect(prisma.reviewGroupWord.create).not.toHaveBeenCalled();
    });

    it('should update share usage count after successful import', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      await POST(req);

      expect(prisma.sharedVocabulary.update).toHaveBeenCalledWith({
        where: { id: mockShare.id },
        data: {
          importedCount: { increment: 1 },
          usedCount: { increment: 1 },
        },
      });
    });

    it('should create import record after successful import', async () => {
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      await POST(req);

      expect(prisma.sharedVocabularyImport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sharedId: mockShare.id,
          importerId: mockUserId,
          targetGroupId: 'new-group-1',
        }),
      });
    });
  });

  describe('Error Handling & Transaction Rollback', () => {
    beforeEach(() => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(mockShare);
      vi.mocked(prisma.sharedVocabularyImport.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.reviewGroup.create).mockResolvedValue({
        id: 'new-group-1',
        name: 'Test Group',
        userId: mockUserId,
      });
    });

    it('should handle Prisma relation query errors gracefully', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockRejectedValue(
        new Error('Prisma client could not find relation reviewGroup')
      );

      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should rollback on transaction failure', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Database error during transaction')
      );
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      
      // Should handle error gracefully
      expect(response.status).toBe(500);
    });

    it('should handle unique constraint errors', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed',
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('数据已存在');
    });

    it('should handle record not found errors', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue({
        code: 'P2025',
        message: 'Record not found',
      });
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('记录不存在');
    });

    it('should handle transaction errors gracefully', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Transaction failed')
      );
      
      const req = new Request('http://localhost/api/share/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validShareCode,
          customName: 'Test Group',
        }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('IMPORT_FAILED');
    });
  });
});
