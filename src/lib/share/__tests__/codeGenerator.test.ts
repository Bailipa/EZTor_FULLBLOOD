/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateShareCode, isValidShareCode, generateUniqueCode } from '../codeGenerator';
import prisma from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    sharedVocabulary: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Code Generator', () => {
  describe('generateShareCode', () => {
    it('should generate code in correct format (XXX-XXX-XXX)', () => {
      const code = generateShareCode();
      
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    });

    it('should generate codes of correct length (11 characters)', () => {
      const code = generateShareCode();
      expect(code).toHaveLength(11); // 3 + 1 + 3 + 1 + 3 = 11
    });

    it('should not contain ambiguous characters (0, O, 1, I, l)', () => {
      const code = generateShareCode();
      
      expect(code).not.toContain('0');
      expect(code).not.toContain('O');
      expect(code).not.toContain('1');
      expect(code).not.toContain('I');
      expect(code).not.toContain('l');
    });

    it('should generate different codes on each call', () => {
      const code1 = generateShareCode();
      const code2 = generateShareCode();
      const code3 = generateShareCode();
      
      expect(code1).not.toBe(code2);
      expect(code2).not.toBe(code3);
      expect(code1).not.toBe(code3);
    });

    it('should only contain uppercase letters and numbers', () => {
      const code = generateShareCode();
      expect(code).toMatch(/^[A-Z2-9-]+$/);
    });

    it('should have exactly 2 hyphens as separators', () => {
      const code = generateShareCode();
      const hyphenCount = (code.match(/-/g) || []).length;
      expect(hyphenCount).toBe(2);
    });

    it('should have 3 segments of 3 characters each', () => {
      const code = generateShareCode();
      const segments = code.split('-');
      
      expect(segments).toHaveLength(3);
      segments.forEach(segment => {
        expect(segment).toHaveLength(3);
      });
    });
  });

  describe('isValidShareCode', () => {
    it('should return true for valid code format', () => {
      expect(isValidShareCode('ABC-DEF-GHJ')).toBe(true);
      expect(isValidShareCode('JKL-MNP-QRS')).toBe(true);
      expect(isValidShareCode('TUV-WXY-Z23')).toBe(true);
      expect(isValidShareCode('456-789-ABC')).toBe(true);
    });

    it('should return false for code with ambiguous characters', () => {
      expect(isValidShareCode('AB0-123-XYZ')).toBe(false); // contains 0
      expect(isValidShareCode('ABC-123-OXY')).toBe(false); // contains O
      expect(isValidShareCode('ABC-1I3-XYZ')).toBe(false); // contains I
      expect(isValidShareCode('ABC-123-lXY')).toBe(false); // contains l
    });

    it('should return false for incorrect format', () => {
      expect(isValidShareCode('ABC123XYZ')).toBe(false); // no hyphens
      expect(isValidShareCode('AB-123-XYZ')).toBe(false); // first segment too short
      expect(isValidShareCode('ABCD-123-XYZ')).toBe(false); // first segment too long
      expect(isValidShareCode('ABC-12-XYZ')).toBe(false); // second segment too short
      expect(isValidShareCode('ABC-1234-XYZ')).toBe(false); // second segment too long
    });

    it('should return false for lowercase letters', () => {
      expect(isValidShareCode('abc-123-xyz')).toBe(false);
      expect(isValidShareCode('AbC-123-XyZ')).toBe(false);
    });

    it('should return false for empty or null input', () => {
      expect(isValidShareCode('')).toBe(false);
      expect(isValidShareCode(null as any)).toBe(false);
      expect(isValidShareCode(undefined as any)).toBe(false);
    });

    it('should return false for special characters', () => {
      expect(isValidShareCode('AB@-123-XYZ')).toBe(false);
      expect(isValidShareCode('ABC-1#3-XYZ')).toBe(false);
      expect(isValidShareCode('ABC-123-X$Z')).toBe(false);
    });
  });

  describe('generateUniqueCode', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should return unique code when no collision', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue(null);
      
      const code = await generateUniqueCode();
      
      expect(code).toBeDefined();
      expect(isValidShareCode(code)).toBe(true);
      expect(prisma.sharedVocabulary.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should retry when code collision occurs', async () => {
      // First two calls return existing codes, third returns null
      vi.mocked(prisma.sharedVocabulary.findUnique)
        .mockResolvedValueOnce({ id: '1', code: 'ABC-123-XYZ' } as any)
        .mockResolvedValueOnce({ id: '2', code: 'DEF-456-WVU' } as any)
        .mockResolvedValue(null);
      
      const code = await generateUniqueCode();
      
      expect(code).toBeDefined();
      expect(isValidShareCode(code)).toBe(true);
      expect(prisma.sharedVocabulary.findUnique).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries', async () => {
      // Always return existing code
      vi.mocked(prisma.sharedVocabulary.findUnique).mockResolvedValue({
        id: '1',
        code: 'ABC-123-XYZ',
      } as any);
      
      await expect(generateUniqueCode()).rejects.toThrow(
        'Failed to generate unique code after multiple attempts'
      );
      
      expect(prisma.sharedVocabulary.findUnique).toHaveBeenCalledTimes(3);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.sharedVocabulary.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );
      
      await expect(generateUniqueCode()).rejects.toThrow('Database connection failed');
    });
  });
});
