export function isSentence(text: string): boolean {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).length;
  const hasPunctuation = /[.!?]/.test(trimmed);
  const isQuestion = trimmed.includes('?');
  const isLong = trimmed.length > 20;
  
  return wordCount >= 3 || hasPunctuation || isQuestion || isLong;
}
