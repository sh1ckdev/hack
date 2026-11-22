import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import {
  MAX_DATA_BYTES, readBody, replaceIncidentData, validateIncidentData,
} from './incident-data'
import { createIncidentsApi } from './incidents-api'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const api = createIncidentsApi({
  ...process.env,
  RELAY_VITE_MODE: 'production',
})
const mediaTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendJson(res: ServerResponse, status: number, payload: object) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(JSON.stringify(payload))
}

async function manageData(operation?: string, input?: string) {
  if (!input || (operation !== 'check' && operation !== 'replace'))
    throw new Error('Использование: data check|replace <файл.json|->')
  const contents =
    input === '-'
      ? await readBody(process.stdin, MAX_DATA_BYTES)
      : await readFile(input)
  const count = operation === 'replace'
    ? (await replaceIncidentData(api.source, contents)).count
    : validateIncidentData(contents)
  console.log(
    `${operation === 'replace' ? 'Выгрузка обновлена' : 'Выгрузка корректна'}. Заявок: ${count}.`
  )
}

async function transcribe(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendJson(res, 405, { error: 'Метод не поддерживается.' })
  }
  if (
    req.headers['sec-fetch-site'] &&
    req.headers['sec-fetch-site'] !== 'same-origin'
  )
    return sendJson(res, 403, { error: 'Запрос отклонён.' })
  const type = req.headers['content-type']
  if (!type?.startsWith('multipart/form-data;'))
    return sendJson(res, 415, { error: 'Ожидается multipart/form-data.' })

  const limit = 2_100_000
  let body: Buffer
  try {
    body = await readBody(req.iterator({ destroyOnReturn: false }), limit)
  } catch (error) {
    req.resume()
    return sendJson(res, error instanceof RangeError ? 413 : 400, {
      error: 'Не удалось прочитать запись.',
    })
  }
  try {
    const result = await fetch(
      process.env.INCIDENTS_WHISPER_URL || 'http://127.0.0.1:8178/inference',
      {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: new Uint8Array(body),
        redirect: 'error',
        signal: AbortSignal.timeout(28_000),
      }
    )
    if (!result.ok)
      return sendJson(res, 502, { error: 'Whisper не обработал запись.' })
    const payload: unknown = await result.json()
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('text' in payload) ||
      typeof payload.text !== 'string'
    )
      return sendJson(res, 502, { error: 'Некорректный ответ Whisper.' })
    return sendJson(res, 200, { text: payload.text })
  } catch {
    return sendJson(res, 503, { error: 'Whisper недоступен.' })
  }
}

async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return sendJson(res, 405, { error: 'Метод не поддерживается.' })
  }
  if (
    pathname
      .split('/')
      .some(
        (part) =>
          part.startsWith('.') || part.includes('\\') || part.includes('\0')
      )
  )
    return sendJson(res, 404, { error: 'Страница не найдена.' })
  const candidate = resolve(dist, '.' + pathname)
  if (candidate !== dist && !candidate.startsWith(dist + sep))
    return sendJson(res, 404, { error: 'Страница не найдена.' })
  const existing = (await stat(candidate).catch(() => undefined))?.isFile()
  if (!existing && extname(pathname))
    return sendJson(res, 404, { error: 'Файл не найден.' })
  const file = existing ? candidate : resolve(dist, 'index.html')
  res.writeHead(200, {
    'Content-Type': mediaTypes[extname(file)] || 'application/octet-stream',
    'Cache-Control':
      existing && pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  await pipeline(createReadStream(file), res)
}

async function start() {
  await stat(resolve(dist, 'index.html'))
  const server = createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const fail = (error: unknown) => {
      console.error(error)
      if (!res.headersSent) sendJson(res, 500, { error: 'Ошибка сервера.' })
      else res.destroy()
    }
    try {
      const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
      if (pathname === '/healthz') {
        const ready = api.store.current?.source.state === 'ok'
        return sendJson(res, ready ? 200 : 503, { ready })
      }
      if (pathname === '/api/voice/inference') {
        void transcribe(req, res).catch(fail)
        return
      }
      if (pathname.startsWith('/api/')) {
        return api.handle(req, res, () =>
          sendJson(res, 404, { error: 'Метод API не найден.' })
        )
      }
      let decoded: string
      try {
        decoded = decodeURIComponent(pathname)
      } catch {
        return sendJson(res, 400, { error: 'Некорректный адрес.' })
      }
      void serveStatic(req, res, decoded).catch(fail)
    } catch (error) {
      fail(error)
    }
  })
  api.store.start((stop) => server.once('close', stop))
  const host = process.env.HOST || '127.0.0.1'
  const port = Number(process.env.PORT || 8080)
  server.listen(port, host, () =>
    console.log(`МТС Дежурка: http://${host}:${port}`)
  )
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => server.close())
}

try {
  if (process.argv[2] === 'data')
    await manageData(process.argv[3], process.argv[4])
  else await start()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
