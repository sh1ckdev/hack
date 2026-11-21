#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const envPath = resolve(root, '.env.local')

function loadEnv() {
  const map = {}
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i === -1) continue
    map[trimmed.slice(0, i)] = trimmed.slice(i + 1)
  }
  return map
}

const env = loadEnv()
const mode = (env.INCIDENT_AI_MODE || 'openrouter').toLowerCase()
const openRouter = mode !== 'openai' && mode !== 'chatgpt'
const chatUrl =
  env.INCIDENT_AI_URL ||
  (openRouter
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions')
const model =
  env.INCIDENT_AI_MODEL ||
  (openRouter ? 'google/gemma-4-31b-it:free' : 'gpt-4o-mini')
const key = openRouter
  ? env.OPENROUTER_API_KEY || env.INCIDENT_AI_KEY || ''
  : env.INCIDENT_AI_KEY || env.OPENAI_API_KEY || ''
const referer = env.OPENROUTER_HTTP_REFERER || 'http://127.0.0.1:5173'
const appTitle = env.OPENROUTER_APP_TITLE || 'Relay Console'
if (!key) {
  console.error(
    openRouter
      ? 'Задайте OPENROUTER_API_KEY в .env.local'
      : 'Задайте OPENAI_API_KEY в .env.local'
  )
  process.exit(1)
}

const chat = new URL(chatUrl)
const origin = `${chat.protocol}//${chat.host}`
const isOpenAi = origin.includes('openai.com')
const isOpenRouter = origin.includes('openrouter.ai')
const tagsUrl = isOpenAi
  ? `${origin}/v1/models`
  : isOpenRouter
    ? 'https://openrouter.ai/api/v1/models'
    : `${origin}/api/tags`
const intervalMs = Number(process.env.AI_WATCH_INTERVAL_MS) || 5000
const probeChat = process.argv.includes('--probe')

const time = () =>
  new Intl.DateTimeFormat('ru-RU', { timeStyle: 'medium' }).format(new Date())

async function pingTags() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(tagsUrl, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(isOpenRouter
          ? { 'HTTP-Referer': referer, 'X-Title': appTitle }
          : {}),
      },
    })
    clearTimeout(timer)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        ok: false,
        detail: `HTTP ${response.status} ${isOpenAi ? '/v1/models' : '/api/tags'}: ${body.slice(0, 80)}`,
      }
    }
    const data = await response.json()
    const names = (data.data ?? data.models ?? []).map((m) => m.id ?? m.name)
    const hasModel = names.some(
      (name) => name === model || name?.startsWith(`${model}-`)
    )
    return {
      ok: isOpenAi || isOpenRouter ? response.ok : hasModel,
      detail: isOpenRouter
        ? response.ok
          ? `OpenRouter: ключ принят (${names.length} моделей в каталоге)`
          : `OpenRouter: отказ ${response.status}`
        : isOpenAi
          ? hasModel
            ? `ChatGPT: ключ принят, модель «${model}» доступна`
            : `ChatGPT: ключ принят, модель «${model}» не в списке`
          : hasModel
            ? `модель «${model}» есть в списке (${names.length} шт.)`
            : `хост отвечает, но нет «${model}». Есть: ${names.slice(0, 5).join(', ') || '—'}`,
    }
  } catch (error) {
    clearTimeout(timer)
    const message = error instanceof Error ? error.message : String(error)
    const hint =
      /192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\./.test(origin)
        ? ' (локальный IP: нужна та же сеть или VPN к дому)'
        : ''
    return { ok: false, detail: `нет связи с ${origin}: ${message}${hint}` }
  }
}

async function probeCompletion() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(isOpenRouter
          ? { 'HTTP-Referer': referer, 'X-Title': appTitle }
          : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 32,
        messages: [
          {
            role: 'user',
            content:
              'Ответь одним JSON без markdown: {"facts":"проверка","hypotheses":"нет"}',
          },
        ],
      }),
    })
    clearTimeout(timer)
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { ok: false, detail: `chat HTTP ${response.status}: ${body.slice(0, 120)}` }
    }
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content ?? ''
    return { ok: true, detail: `ответ модели: ${text.slice(0, 100).replace(/\s+/g, ' ')}` }
  } catch (error) {
    clearTimeout(timer)
    return {
      ok: false,
      detail: `ошибка chat: ${error instanceof Error ? error.message : error}`,
    }
  }
}

console.log(`[${time()}] Монитор ИИ · ${origin}`)
console.log(`Модель: ${model}`)
console.log(`Интервал: ${intervalMs / 1000} с · полный запрос: ${probeChat ? 'да' : 'только /api/tags'}`)
console.log('—'.repeat(56))

let tick = 0
async function loop() {
  tick += 1
  const tags = await pingTags()
  const status = tags.ok ? '✓' : '✗'
  console.log(`[${time()}] ${status} ${tags.detail}`)

  if (probeChat && (tick === 1 || tick % 6 === 0)) {
    console.log(`[${time()}] … проверка chat/completions`)
    const chatResult = await probeCompletion()
    const chatStatus = chatResult.ok ? '✓' : '✗'
    console.log(`[${time()}] ${chatStatus} ${chatResult.detail}`)
  }
}

await loop()
setInterval(loop, intervalMs)