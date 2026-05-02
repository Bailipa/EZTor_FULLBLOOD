export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  reason?: string;
}

export const MAX_INPUT_LENGTH = 2000;
export const MAX_TRANSLATE_LENGTH = 8000;

export function sanitizeInput(input: string, maxLength: number = MAX_INPUT_LENGTH): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<\|(system|user|assistant)\|>/gi, '')
    .replace(/<\|endoftext\|>/gi, '')
    .replace(/<<SYS>>[\s\S]*?<<\/SYS>>/gi, '')
    .replace(/<\[INST\]/gi, '')
    .replace(/\[\/INST\]/gi, '')
    .replace(/<s>[\s\S]*?<\/s>/gi, '')
    .replace(/{{SYSTEM}}[\s\S]*?{{\/SYSTEM}}/gi, '')
    .substring(0, maxLength);
}

export function escapePromptInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ');
}

export function validateInput(input: string, maxLength: number = MAX_INPUT_LENGTH): ValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'Input is required' };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Input cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, reason: `Input exceeds maximum length (${maxLength} characters)` };
  }

  const sanitized = sanitizeInput(trimmed, maxLength);
  return { valid: true, sanitized };
}

export function validateTranslateInput(input: string): ValidationResult {
  return validateInput(input, MAX_TRANSLATE_LENGTH);
}

export function sanitizeWordList(words: string[]): string[] {
  if (!Array.isArray(words)) {
    return [];
  }

  return words
    .map(w => sanitizeInput(w))
    .filter(w => w.length > 0 && w.length <= 500)
    .slice(0, 100);
}

export function escapeWordListForPrompt(words: string[]): string {
  return words
    .map(w => escapePromptInput(w))
    .map(w => `"${w}"`)
    .join(', ');
}

export interface AiOutputItem {
  word: string;
  phonetic?: string;
  pos?: string;
  translation: string;
  example?: string;
  exampleTranslation?: string;
}

export interface AiOutput {
  results: AiOutputItem[];
}

export function validateAiOutput(output: unknown): { valid: boolean; data?: AiOutput } {
  if (!output || typeof output !== 'object') {
    return { valid: false };
  }

  const obj = output as Record<string, unknown>;
  if (!obj.results || !Array.isArray(obj.results)) {
    return { valid: false };
  }

  for (const item of obj.results as Array<Record<string, unknown>>) {
    if (typeof item.word !== 'string' || item.word.length === 0) {
      return { valid: false };
    }
    if (typeof item.translation !== 'string') {
      return { valid: false };
    }
    
    const injectionPatterns = [
      /<\|(system|user|assistant)\|>/i,
      /<<SYS>>/i,
      /<\[INST\]/i,
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(item.translation as string) || 
          (item.example && pattern.test(item.example as string))) {
        return { valid: false };
      }
    }
  }

  return { valid: true, data: output as AiOutput };
}
