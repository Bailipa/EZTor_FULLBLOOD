function generateDeviceId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const segments = [8, 4, 4, 4, 12]
  const result: string[] = []
  for (const len of segments) {
    let seg = ''
    for (let i = 0; i < len; i++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    result.push(seg)
  }
  return result.join('-')
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''

  const key = 'vocab_device_id'
  let deviceId = localStorage.getItem(key)

  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem(key, deviceId)
  }

  return deviceId
}
