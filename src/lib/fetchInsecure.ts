import https from 'https'

export async function fetchInsecure(url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const headers = init.headers as Record<string, string>
    const bodyStr = typeof init.body === 'string' ? init.body : undefined

    const options: https.RequestOptions = {
      method: init.method || 'GET',
      hostname: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port) : undefined,
      path: urlObj.pathname + urlObj.search,
      headers: {
        ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
      },
      rejectUnauthorized: false,
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString()
        resolve(
          new Response(body, {
            status: res.statusCode,
            statusText: res.statusMessage,
          }),
        )
      })
    })

    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}
