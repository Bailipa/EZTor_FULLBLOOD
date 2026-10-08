export function examAudioProgressKey(accountId: string, attemptId: string, audioId: string) {
  return `study-exam-audio:${encodeURIComponent(accountId)}:${encodeURIComponent(attemptId)}:${encodeURIComponent(audioId)}`
}

export function restorableAudioPosition(value: string | null, duration: number): number | null {
  if (value === null || value.trim() === '') return null
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Number.isFinite(duration) && duration >= 0 ? Math.min(seconds, duration) : seconds
}
