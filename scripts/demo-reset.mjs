#!/usr/bin/env node
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defaultDataFile } from './demo-lib.mjs'

const target = defaultDataFile()
const source = resolve(dirname(target), 'character_problems.source.json')
const port = Number(process.env.DEMO_PORT || 5182)

async function reset() {
  if (!existsSync(source)) throw new Error('Сначала создайте демо-выгрузку: npm run demo:showcase.')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Некорректный DEMO_PORT.')
  let response
  try {
    response = await fetch(`http://127.0.0.1:${port}/api/demo/reset?profile=showcase`, {
      method: 'POST',
      signal: AbortSignal.timeout(2500),
    })
  } catch (error) {
    if (error.cause?.code !== 'ECONNREFUSED') throw error
    copyFileSync(source, target)
    console.log('Демо-выгрузка восстановлена. Запустите npm run demo:dev.')
    return
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.ok !== true)
    throw new Error(result.error || 'Не удалось сбросить наглядную демо-выгрузку.')
  console.log(`Наглядная демо-выгрузка и история сброшены на порту ${port}.`)
}

reset().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
