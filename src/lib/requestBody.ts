export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

/** Count actual bytes rather than trusting the caller's Content-Length. */
export async function readJsonBody(req: Request, maxBytes = 128 * 1024): Promise<Record<string, unknown>> {
  if (!/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(req.headers.get('content-type') ?? '')) {
    throw new RequestBodyError('请求必须使用 JSON', 415)
  }
  const declaredLength = Number(req.headers.get('content-length'))
  if (declaredLength > maxBytes) throw new RequestBodyError('请求内容过大', 413)
  if (!req.body) throw new RequestBodyError('请求体无效', 400)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) { await reader.cancel(); throw new RequestBodyError('请求内容过大', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let parsed: unknown
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new RequestBodyError('请求体无效', 400) }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new RequestBodyError('请求体无效', 400)
  return parsed as Record<string, unknown>
}
