import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
blocked.addSubnet('2001::', 23, 'ipv6')
blocked.addSubnet('2001:db8::', 32, 'ipv6')
blocked.addSubnet('2002::', 16, 'ipv6')
blocked.addSubnet('3fff::', 20, 'ipv6')

export function isPublicModelAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
  return false
}

export function validateModelUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('模型地址无效')
  let url: URL
  try { url = new URL(value) } catch { throw new Error('模型地址无效') }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('模型地址必须使用 HTTPS，且不能包含账号、密码或片段')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || (isIP(hostname) && !isPublicModelAddress(hostname))) {
    throw new Error('模型地址不能指向本机或内网')
  }
  return url
}

/** TLS verification stays enabled; DNS is checked and pinned to prevent rebinding.
 * No redirects are followed, including HTTPS to HTTP or internal addresses. */
export async function secureModelFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init)
  const url = validateModelUrl(request.url)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  let dnsTimer: ReturnType<typeof setTimeout> | undefined
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('模型地址解析超时')), 5000) }),
  ]).finally(() => clearTimeout(dnsTimer))
  if (!addresses.length || addresses.some(({ address }) => !isPublicModelAddress(address))) throw new Error('模型地址不能指向本机或内网')
  request.signal.throwIfAborted()
  const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined
  if (body && body.length > 1024 * 1024) throw new Error('模型请求过大')
  const address = addresses[0]
  return new Promise<Response>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', abort) }
    const outgoing = https.request(url, {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      family: address.family,
      // Never let the HTTP client resolve this hostname for a second time.
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
    }, (incoming) => {
      if (incoming.statusCode && incoming.statusCode >= 300 && incoming.statusCode < 400) {
        incoming.destroy(); cleanup(); reject(new Error('模型接口不允许重定向')); return
      }
      const headers = new Headers()
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      }
      let received = 0
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          incoming.on('data', (chunk: Buffer) => {
            received += chunk.length
            if (received > 8 * 1024 * 1024) { incoming.destroy(new Error('模型响应过大')); return }
            controller.enqueue(chunk)
            if ((controller.desiredSize ?? 0) <= 0) incoming.pause()
          })
          incoming.on('end', () => { cleanup(); controller.close() })
          incoming.on('error', (error) => { cleanup(); controller.error(error) })
          incoming.on('close', cleanup)
        },
        pull() { incoming.resume() },
        cancel() { incoming.destroy(); outgoing.destroy(); cleanup() },
      })
      const status = incoming.statusCode ?? 502
      resolve(new Response([204, 205, 304].includes(status) ? null : stream, { status, headers }))
    })
    const abort = () => outgoing.destroy(Object.assign(new Error('模型请求已取消'), { name: 'AbortError' }))
    request.signal.addEventListener('abort', abort, { once: true })
    if (request.signal.aborted) abort()
    timer = setTimeout(() => outgoing.destroy(new Error('模型请求超时')), 120_000)
    outgoing.on('error', (error) => { cleanup(); reject(error) })
    if (body) outgoing.write(body)
    outgoing.end()
  })
}

export function modelSettingsError(body: Record<string, unknown>, required = true): string | null {
  for (const [key, max] of [['baseUrl', 2048], ['apiKey', 4096], ['model', 200]] as const) {
    if (body[key] === undefined && !required) continue
    const value = body[key]
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\r\n]/.test(value)) return '模型配置格式或长度无效'
  }
  if (body.baseUrl !== undefined) {
    try { validateModelUrl(body.baseUrl) } catch (error) { return error instanceof Error ? error.message : '模型地址无效' }
  }
  return null
}
