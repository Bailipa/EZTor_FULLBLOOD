// Keep learning outcomes and operational failures, rather than navigation/click noise.
const RECORDED_EVENTS = new Set([
  'TRANSLATE', 'TRANSLATE_ONLY', 'DICTATION_START', 'DICTATION_COMPLETE',
  'DICTATION_ERROR', 'LOGIN', 'LOGOUT', 'REGISTER', 'SHARE', 'ONBOARDING_COMPLETE',
  'ERROR', 'API_ERROR', 'GUEST_TRANSLATE', 'GUEST_TRANSLATE_ERROR',
])
export function shouldRecordAnalytics(eventType: string) {
  return RECORDED_EVENTS.has(eventType)
}
