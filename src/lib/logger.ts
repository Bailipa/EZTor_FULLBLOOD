const isProduction = process.env.NODE_ENV === 'production';

// Mask sensitive information
function maskSensitiveInfo(str: string): string {
  // Mask user IDs with more comprehensive regex
  str = str.replace(/user[\s:]*=*[\s:]*([a-zA-Z0-9_-]+)/gi, 'user: [MASKED]');
  str = str.replace(/userId[\s:]*=*[\s:]*([a-zA-Z0-9_-]+)/gi, 'userId: [MASKED]');
  
  // Mask IP addresses
  str = str.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[MASKED IP]');
  
  // Mask input content (keep first 10 chars, mask the rest)
  str = str.replace(/input:\s*"([^"]+)"/gi, (match, content) => {
    if (content.length > 10) {
      return `input: "${content.substring(0, 10)}..."`;
    }
    return match;
  });
  
  return str;
}

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (!isProduction) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (!isProduction) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    const maskedMessage = maskSensitiveInfo(message);
    console.warn(`[WARN] ${maskedMessage}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    const maskedMessage = maskSensitiveInfo(message);
    console.error(`[ERROR] ${maskedMessage}`, ...args);
  },
  
  security: (message: string, ...args: any[]) => {
    const maskedMessage = maskSensitiveInfo(message);
    if (isProduction) {
      console.warn(`[SECURITY] ${maskedMessage}`, ...args);
    } else {
      console.log(`[SECURITY] ${maskedMessage}`, ...args);
    }
  }
};
