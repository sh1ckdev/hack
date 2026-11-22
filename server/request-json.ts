import type { IncomingMessage } from 'node:http'

export async function readRequestJson(
  req: IncomingMessage,
  limit: number
): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > limit) {
      req.resume()
      throw new RangeError('Request body too large')
    }
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
