// Define list of keywords that require special handling
const SPECIAL_KEYWORDS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Vue',
  'Angular',
  'Node.js',
  'HTML',
  'CSS',
  'JSON',
  'Java'
];

// Define acronyms that should maintain their original capitalization
const ACRONYMS = [
  'API',
  'AI',
  'ML',
  'UI',
  'UX'
];

/**
 * Convert specific keywords in text to all lowercase form
 * @param text Input text
 * @returns Converted text
 */
export function convertSpecialKeywordsToLowerCase(text: string): string {
  let result = text;
  
  // Convert special keywords to lowercase
  SPECIAL_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(keyword, 'g');
    result = result.replace(regex, keyword.toLowerCase());
  });
  
  return result;
}

/**
 * Standardize words, ensuring specific keywords are in lowercase form
 * @param word Input word
 * @returns Standardized word
 */
export function normalizeWord(word: string): string {
  // Trim whitespace first
  const trimmedWord = word.trim();
  
  // Check if it's a special keyword
  for (const keyword of SPECIAL_KEYWORDS) {
    if (trimmedWord.toLowerCase() === keyword.toLowerCase()) {
      return keyword.toLowerCase();
    }
  }
  
  // For non-special keywords, maintain original capitalization
  return trimmedWord;
}

/**
 * Handle edge cases and exception inputs
 * @param word Input word
 * @returns Processed word
 */
export function handleEdgeCases(word: string): string {
  // Handle empty input
  if (!word || word.trim() === '') {
    return '';
  }
  
  // Handle mixed capitalization
  const normalizedWord = word.trim();
  
  // Check if it's a special keyword
  for (const keyword of SPECIAL_KEYWORDS) {
    if (normalizedWord.toLowerCase() === keyword.toLowerCase()) {
      return keyword.toLowerCase();
    }
  }
  
  // For non-special keywords, maintain original capitalization
  return normalizedWord;
}
