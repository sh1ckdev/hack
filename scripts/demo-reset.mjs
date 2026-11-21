#!/usr/bin/env node
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'data/character_problems.source.json')
const target = resolve(root, 'data/character_problems.json')

cpSync(source, target)
console.log('Выгрузка: source → character_problems.json')

const ports = [5173, 5174, 5175, 4173, 5180, 5181, 5182]
for (const port of ports) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/demo/reset`, {
      method: 'POST',
    })
    if (response.ok) {
      const body = await response.json().catch(() => ({}))
      console.log(
        `Сервер :${port}: лента событий сброшена (runId ${body.runId ?? '—'}).`
      )
      console.log(
        'Закладки «Следить» — только в браузере (localStorage); обнови страницу.'
      )
      process.exit(0)
    }
  } catch {
    // dev не на этом порту
  }
}

console.log(
  'Файл восстановлен. Если dev не запущен — подними npm run dev; лента обнулится при старте.'
)
process.exit(0)