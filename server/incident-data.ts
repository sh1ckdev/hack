import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { incidentsSchema } from '../src/features/incidents/model'

export const MAX_DATA_BYTES = 64 * 1024 * 1024

export class InvalidIncidentData extends Error {}
export class IncidentDataConflict extends Error {}

export async function readBody(
  stream: AsyncIterable<Buffer | string>,
  maxBytes: number
) {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > maxBytes)
      throw new RangeError('Превышен размер входных данных.')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, total)
}

function digest(content: string | Buffer) {
  return createHash('sha256').update(content).digest()
}

export function validateIncidentData(contents: Buffer) {
  let input: unknown
  try {
    input = JSON.parse(contents.toString('utf8').replace(/^\uFEFF/, ''))
  } catch {
    throw new InvalidIncidentData('Некорректный синтаксис JSON.')
  }
  const result = incidentsSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new InvalidIncidentData(
      `Некорректная выгрузка (${issue.path.join('.') || 'корень'}): ${issue.message}`
    )
  }
  return result.data.length
}

export async function readIncidentData(source: string) {
  try {
    const contents = await readFile(source)
    return { contents, version: `"${digest(contents).toString('hex')}"` }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return { contents: Buffer.from('[]'), version: '"missing"' }
  }
}

export async function replaceIncidentData(
  source: string,
  contents: Buffer,
  expectedVersion?: string
) {
  const count = validateIncidentData(contents)
  const lock = `${source}.write-lock`
  try {
    await mkdir(lock)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new IncidentDataConflict('Другая операция обновляет выгрузку. Повторите попытку.')
    throw error
  }
  const temporary = `${source}.${randomUUID()}.tmp`
  try {
    if (expectedVersion && expectedVersion !== (await readIncidentData(source)).version)
      throw new IncidentDataConflict('Файл уже изменился. Скопируйте черновик и загрузите свежую версию.')
    // Remove a UTF-8 BOM so the same file can be read by the dashboard.
    const text = contents.toString('utf8').replace(/^\uFEFF/, '')
    await writeFile(temporary, text, { flag: 'wx', mode: 0o600 })
    await rename(temporary, source)
    return { count, version: `"${digest(text).toString('hex')}"` }
  } finally {
    await rm(temporary, { force: true }).finally(() => rmdir(lock))
  }
}

export function incidentEditorAccess(
  req: IncomingMessage,
  key: string | undefined,
  development: boolean
) {
  const site = req.headers['sec-fetch-site']
  if ((site && site !== 'same-origin') || req.headers['x-relay-request'] !== 'incident-editor')
    return 403
  if (key && key.length >= 32) {
    const actual = req.headers['x-incident-editor-key']
    return typeof actual === 'string' && timingSafeEqual(digest(key), digest(actual))
      ? 200
      : 401
  }
  const address = req.socket.remoteAddress
  const host = req.headers.host || ''
  const loopback = address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
  return !key && development && loopback &&
    /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host) &&
    !req.headers.forwarded && !req.headers['x-forwarded-for']
    ? 200
    : 503
}
