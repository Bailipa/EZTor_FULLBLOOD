export function getTodayDateUTC8(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}

export function getStartOfWeekUTC8(): Date {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const day = utc8.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  utc8.setUTCDate(utc8.getUTCDate() - diff)
  utc8.setUTCHours(0, 0, 0, 0)
  return new Date(utc8.getTime() - 8 * 60 * 60 * 1000)
}

export function isSameDayUTC8(date1: string, date2: string): boolean {
  return date1 === date2
}

export function daysBetweenUTC8(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00+08:00')
  const d2 = new Date(dateStr2 + 'T00:00:00+08:00')
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

export function getNowUTC8(): Date {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
}
