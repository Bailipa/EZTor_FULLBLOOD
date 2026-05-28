import { getRequiredEnvVar } from './envValidator'

let LLM_API_URL: string
let LLM_API_KEY: string
let LLM_MODEL: string

try {
  LLM_API_URL = getRequiredEnvVar('LLM_API_URL')
  LLM_API_KEY = getRequiredEnvVar('LLM_API_KEY')
  LLM_MODEL = getRequiredEnvVar('LLM_MODEL')
} catch {
  console.warn('LLM environment variables not set, risk detection will be disabled')
}

export async function checkMessageRisk(content: string): Promise<{ isRisky: boolean; reason?: string }> {
  if (!LLM_API_URL || !LLM_API_KEY || !LLM_MODEL) {
    return { isRisky: false }
  }

  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个内容安全审查员。请判断以下聊天内容是否具有风险。

风险类型包括：
1. 诈骗信息
2. 伤害人类的举动
3. 无法正常理解的语言文字（暗号、谐音）
4. 其他具有迷惑性的内容

请用 JSON 格式回答：
- 如果安全：{"isRisky": false}
- 如果有风险：{"isRisky": true, "reason": "风险原因"}

注意：只回答 JSON，不要添加其他内容。`
          },
          { role: 'user', content }
        ],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      console.error('Risk detection API error:', response.status)
      return { isRisky: false }
    }

    const result = await response.json()
    const message = result.choices?.[0]?.message?.content || ''

    try {
      return JSON.parse(message)
    } catch {
      return { isRisky: message.includes('risky') }
    }
  } catch (error) {
    console.error('Risk detection failed:', error)
    return { isRisky: false }
  }
}
