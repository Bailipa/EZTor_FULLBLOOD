# Capitalization Handling Feature Development Document

## 1. Feature Overview

### Core Objectives
Implement an automatic capitalization conversion mechanism to ensure that content returned by AI containing specific keywords (such as "JavaScript") is automatically converted to all lowercase form (such as "javascript"), maintaining consistency and standardization of internal system data.

### Application Scenarios
- **Translation Function**: When users input text containing specific keywords, the system needs to ensure that the capitalization of these keywords in the returned results complies with system standards
- **Data Storage**: Ensure that word data stored in the database uses a unified lowercase form for easier subsequent querying and management
- **User Input Processing**: Handle different capitalization forms of user input to ensure the system can correctly identify and process them

## 2. Implementation Requirements

### 2.1 Automatic Capitalization Conversion Mechanism
- Implement automatic detection of specific keywords (such as "JavaScript") in AI return results
- Convert detected keywords to all lowercase form (such as "javascript")
- Ensure the converted results maintain semantic consistency

### 2.2 Prompt Mechanism Design
- Design clear prompts to guide AI to output content that complies with capitalization standards
- Add capitalization handling rules to system prompts
- Ensure prompts are clear and unambiguous, and can be correctly understood by AI

### 2.3 Return Logic Processing Flow
1. **Input Detection**: Detect the capitalization form of words or phrases input by users
2. **Keyword Identification**: Identify specific keywords in input and AI return results
3. **Conversion Rules**: Apply capitalization conversion rules to convert specific keywords to all lowercase form
4. **Output Return**: Return processed results, maintaining the original capitalization form of the input while ensuring internal processing uses lowercase form

## 3. Technical Implementation Details

### 3.1 Specific Implementation Methods for Capitalization Conversion

#### Keyword Identification and Conversion
```typescript
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
function convertSpecialKeywordsToLowerCase(text: string): string {
  let result = text;
  
  SPECIAL_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(keyword, 'g');
    result = result.replace(regex, keyword.toLowerCase());
  });
  
  return result;
}
```

#### Word Processing and Standardization
```typescript
/**
 * Standardize words, ensuring specific keywords are in lowercase form
 * @param word Input word
 * @returns Standardized word
 */
function normalizeWord(word: string): string {
  // First check if it's a special keyword
  for (const keyword of SPECIAL_KEYWORDS) {
    if (word.toLowerCase() === keyword.toLowerCase()) {
      return keyword.toLowerCase();
    }
  }
  
  // For non-special keywords, maintain original capitalization
  return word;
}
```

### 3.2 Prompt Design Principles and Content

#### Prompt Design Principles
1. **Clarity**: Clearly inform AI how to handle capitalization
2. **Consistency**: Ensure AI output capitalization forms are consistent with system standards
3. **Accuracy**: Ensure AI can correctly understand and execute capitalization handling rules

#### Specific Prompt Content
Add the following content to the existing system prompt:

```
【Capitalization Handling Rules】
1. For specific technical terms and proper nouns (such as JavaScript, TypeScript, React, etc.), please use all lowercase form in the output
2. For acronyms (such as API, AI, ML, etc.), please maintain their original capitalization form
3. For ordinary words, please maintain their original capitalization form

【Examples】
- Input: "JavaScript"
- Output: "javascript"

- Input: "API"
- Output: "API"

- Input: "Apple"
- Output: "Apple"
```

### 3.3 Edge Case and Exception Input Handling

#### Edge Case Handling
1. **Mixed Capitalization**: Handle mixed capitalization inputs such as "JaVaScRiPt"
2. **Partial Matching**: Ensure only complete keywords are matched to avoid incorrect conversion due to partial matching
3. **Context Relevance**: Consider capitalization requirements of keywords in different contexts

#### Exception Input Handling
1. **Empty Input**: Handle empty strings or null values
2. **Special Characters**: Handle inputs containing special characters
3. **Oversized Input**: Handle inputs that exceed expected length

```typescript
/**
 * Handle edge cases and exception inputs
 * @param word Input word
 * @returns Processed word
 */
function handleEdgeCases(word: string): string {
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
```

## 4. Testing Requirements

### 4.1 Test Cases

#### Normal Cases
| Input | Expected Output | Description |
|-------|----------------|-------------|
| "JavaScript" | "javascript" | Special keyword converted to lowercase |
| "TypeScript" | "typescript" | Special keyword converted to lowercase |
| "React" | "react" | Special keyword converted to lowercase |
| "API" | "API" | Acronym remains unchanged |
| "AI" | "AI" | Acronym remains unchanged |
| "Apple" | "Apple" | Ordinary word remains unchanged |
| "banana" | "banana" | Ordinary word remains unchanged |

#### Edge Cases
| Input | Expected Output | Description |
|-------|----------------|-------------|
| "JaVaScRiPt" | "javascript" | Mixed capitalization converted to lowercase |
| "JAVA" | "java" | All uppercase special keyword converted to lowercase |
| "api" | "api" | All lowercase acronym remains unchanged |
| "" | "" | Empty string handling |
| "  JavaScript  " | "javascript" | Input with spaces handling |

### 4.2 Testing Methods
1. **Unit Testing**: Write unit tests to test the functionality of each function
2. **Integration Testing**: Test the entire processing flow
3. **Edge Case Testing**: Test edge cases and exception inputs
4. **Regression Testing**: Ensure modifications do not affect existing functionality

### 4.3 Expected Results
- All test cases pass
- Special keywords can be correctly converted to lowercase form
- Acronyms and ordinary words remain unchanged
- The system can handle various edge cases and exception inputs

## 5. Notes

1. **Scope Limitation**: The current version only focuses on capitalization handling functionality, other functions are not adjusted for the time being
2. **Core Objective**: Take achieving core requirements as the primary goal, not pursuing functional perfection at this stage
3. **Compatibility**: Ensure modifications are compatible with existing code and architecture
4. **Performance**: Ensure capitalization handling does not significantly affect system performance
5. **Maintainability**: Ensure code structure is clear and easy to maintain and extend

## 6. Implementation Plan

### 6.1 Phase One: Preparation
1. Analyze existing code structure and architecture
2. Determine files and functions that need modification
3. Design specific implementation plan for capitalization handling

### 6.2 Phase Two: Core Implementation
1. Implement keyword identification and conversion functionality
2. Modify system prompts to add capitalization handling rules
3. Integrate capitalization handling functionality into existing code

### 6.3 Phase Three: Testing and Verification
1. Write test cases
2. Execute tests to verify functionality correctness
3. Fix issues found during testing

### 6.4 Phase Four: Deployment and Monitoring
1. Deploy modified code
2. Monitor system operation
3. Collect user feedback and continuously optimize

## 7. Code Integration Points

### 7.1 Input Processing Phase
In the `src/app/api/translate/route.ts` file, modify the input processing logic to add capitalization handling functionality:

```typescript
// Add after sanitizeWordList and normalizedWords processing
const sanitizedWords = sanitizeWordList(words);
const normalizedWords = sanitizedWords.map((w: string) => {
  // Apply capitalization handling
  return normalizeWord(w.toLowerCase().trim());
}).filter(Boolean);
```

### 7.2 AI Result Processing Phase
Add capitalization handling when processing AI return results:

```typescript
// Add after parsing AI results
aiParsedResults = parsed.results.map((result: any) => ({
  ...result,
  word: normalizeWord(inputWordMap.get((Array.isArray(result.word) ? result.word[0] : result.word).toLowerCase()) || (Array.isArray(result.word) ? result.word[0] : result.word))
}));
```

### 7.3 Database Storage Phase
Ensure standardized word form is used before storing to database:

```typescript
const wordsToSave = aiParsedResults.filter((item: any) => 
  item.pos !== "错误" && 
  item.pos !== "风控" &&
  item.pos !== "中断" &&
  item.pos !== "非英语" &&
  item.pos !== "句子" &&
  !(item.translation && item.translation.includes("拼写错误或不存在")) &&
  !(item.translation && item.translation.includes("粗俗或敏感")) &&
  !(item.translation && item.translation.includes("⚠️"))
).map((item: any) => ({
  word: normalizeWord(String(item.word || '').toLowerCase().trim()),
  phonetic: item.phonetic || null,
  pos: item.pos || null,
  translation: item.translation || '',
  example: item.example || null,
  exampleTranslation: item.exampleTranslation || null,
})).filter((w: any) => w.word);
```

## 8. Summary

Capitalization handling functionality is an important component to ensure system data consistency and standardization. By implementing automatic conversion mechanisms, designing clear prompts, and optimizing return logic, the system can correctly handle various capitalization forms of input and output, improving user experience and system reliability.

This development document provides detailed implementation plans and testing requirements, aiming to guide developers to efficiently and accurately implement capitalization handling functionality while ensuring compatibility with existing code and architecture.