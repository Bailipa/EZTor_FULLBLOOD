export interface QualityFactors {
  hasPhonetic: boolean;
  hasPos: boolean;
  hasExample: boolean;
  hasExampleTranslation: boolean;
  translationLength: number;
  exampleLength: number;
  hasMultiplePos: boolean;
  isError: boolean;
  isSensitive: boolean;
}

export interface QualityScore {
  score: number;
  factors: QualityFactors;
  grade: 'A' | 'B' | 'C' | 'D';
}

export function calculateQualityScore(
  word: string,
  phonetic: string | null,
  pos: string | null,
  translation: string,
  example: string | null,
  exampleTranslation: string | null
): QualityScore {
  const factors: QualityFactors = {
    hasPhonetic: !!phonetic && phonetic.trim().length > 0,
    hasPos: !!pos && pos.trim().length > 0,
    hasExample: !!example && example.trim().length > 0,
    hasExampleTranslation: !!exampleTranslation && exampleTranslation.trim().length > 0,
    translationLength: translation?.trim().length || 0,
    exampleLength: example?.trim().length || 0,
    hasMultiplePos: pos ? pos.includes('/') || pos.includes(';') : false,
    isError: pos === '错误' || translation.includes('拼写错误'),
    isSensitive: translation.includes('粗俗') || translation.includes('敏感')
  };

  let score = 0;

  if (factors.isError || factors.isSensitive) {
    return { score: 0, factors, grade: 'D' };
  }

  if (factors.hasPhonetic) score += 15;
  if (factors.hasPos) score += 15;
  if (factors.hasExample) score += 20;
  if (factors.hasExampleTranslation) score += 10;
  
  if (factors.translationLength > 10) score += 10;
  if (factors.translationLength > 30) score += 5;
  
  if (factors.hasMultiplePos) score += 10;
  
  if (factors.exampleLength > 20) score += 10;
  if (factors.exampleLength > 50) score += 5;

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';

  return { score: Math.min(score, 100), factors, grade };
}

export function updatePublicWordQuality(
  currentScore: number,
  newScore: number,
  currentVersion: number
): { qualityScore: number; version: number } {
  if (newScore > currentScore) {
    return {
      qualityScore: newScore,
      version: currentVersion + 1
    };
  }
  return {
    qualityScore: currentScore,
    version: currentVersion
  };
}

export function shouldUpdatePublicWord(
  currentWord: { qualityScore: number; version: number } | null,
  newScore: number
): boolean {
  if (!currentWord) return true;
  if (newScore > currentWord.qualityScore) return true;
  if (newScore === currentWord.qualityScore && Math.random() > 0.5) return true;
  return false;
}
