const INJECTION_PATTERNS = [
  /你(是|变成|充当|扮演|作为|现在|假装|请做)\s*(一只?|一个?)?\s*(猫[娘妹]|狗[娘妹]|兔[娘妹]|狐[娘妹]|龙[娘妹]|女仆|护士|老师|学生|医生|律师|警察|海盗|机器人|精灵|天使|恶魔|公主|女王)/i,
  /用\s*(猫[娘妹]?|狗[娘妹]?|女仆|萝莉|御姐|傲娇|温柔|可爱|性感|撒娇|卖萌|萌萌哒)?\s*的?(语气|口吻|风格|方式|态度|声音|腔调)/i,
  /请\s*(用|以|按照|遵循)\s*(.*?)(语气|口吻|风格|方式|态度|声音|腔调)\s*(翻译|回答|回复|输出|说|讲|表达)/i,
  /ignore\s+(all\s+)?(previous|above|your|the\s+following)?\s*(instructions|rules|guidelines|prompts|orders|directives)/i,
  /disregard\s+(all\s+)?(previous|your|the\s+following)?\s*(instructions|rules|guidelines|prompts)/i,
  /forget\s+(everything|all\s+(your|previous)|your\s+instructions|your\s+rules)/i,
  /(act|behave|pretend|roleplay)\s+as\s+(if\s+you\s+are|a\s+new\s+)/i,
  /you\s+are\s+(now\s+)?(no\s+longer|not)\s+(a\s+)?(translator|translation\s+assistant)/i,
  /override\s+(system|your|previous|existing)\s+(instructions|rules|prompt|behavior)/i,
  /new\s+(system|set\s+of)\s+(instructions|rules|prompt|guidelines)\s*:/i,
];

export interface InjectionCheckResult {
  isInjection: boolean;
  detected?: boolean;
  pattern?: string;
}

function regexDetect(input: string): { detected: boolean; pattern?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { detected: true, pattern: pattern.source.substring(0, 50) };
    }
  }
  
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('翻译') && 
      (lowerInput.includes('语气') || lowerInput.includes('口吻') || 
       lowerInput.includes('风格') || lowerInput.includes('方式'))) {
    return { detected: true, pattern: 'translate_with_style' };
  }
  
  if (lowerInput.includes('你是') && 
      (lowerInput.includes('猫') || lowerInput.includes('娘') ||
       lowerInput.includes('角色') || lowerInput.includes('身份'))) {
    return { detected: true, pattern: 'role_identity' };
  }

  return { detected: false };
}

export function detectPromptInjection(input: string): InjectionCheckResult {
  const result = regexDetect(input);
  
  if (result.detected) {
    console.log(`[SECURITY LOG] Injection detected and blocked: "${input.substring(0, 100)}"`);
    console.log(`[SECURITY LOG] Matched pattern: ${result.pattern}`);
  }

  return { isInjection: result.detected, detected: result.detected, pattern: result.pattern };
}

export function detectBatchPromptInjection(inputs: string[]): InjectionCheckResult {
  const combinedInput = inputs.join(' | ');
  const result = regexDetect(combinedInput);
  
  if (result.detected) {
    console.log(`[SECURITY LOG] Batch injection detected and blocked: ${inputs.length} items`);
    console.log(`[SECURITY LOG] Matched pattern: ${result.pattern}`);
  }

  return { isInjection: result.detected, detected: result.detected, pattern: result.pattern };
}
