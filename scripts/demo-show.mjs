import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { defaultDataFile } from './demo-lib.mjs'

const root = resolve(import.meta.dirname, '..')
const steps = [
  ['critical-up', 'Покажите критическую колонку, подсветку и событие. Откройте заявку и покажите личный фокус.'],
  ['coordinators', 'Покажите назначение команде, историю передач и блок «Куда передать».'],
  ['deadline', 'Покажите новый срок на обеих карточках и запись об изменении срока.'],
  ['dual-section', 'Покажите связь двух карточек с одним номером INC.'],
  ['resolved-research', 'Покажите уход из критической очереди и состояние «Исследование».'],
  ['engineers', 'Покажите уход из очереди координаторов и итоговый бриф смены.'],
]

async function main() {
  const path = process.argv[2] ?? defaultDataFile()
  if (path === '--help') {
    console.log('npm run demo:show [-- /путь/к/отдельной-демо-выгрузке.json]')
    return
  }
  if (!existsSync(path)) throw new Error('Выгрузка не найдена. Запустите npm run demo:showcase или укажите путь к копии.')
  const file = realpathSync(path)
  const protectedPaths = ['character_problems.json', 'character_problems.source.json']
    .map((name) => resolve(root, 'data', name))
    .concat(resolve(root, '.local', 'showcase', 'character_problems.source.json'))
    .filter(existsSync)
  const target = statSync(file)
  if (!target.isFile() || protectedPaths.some((path) => {
    const { dev, ino } = statSync(path)
    return dev === target.dev && ino === target.ino
  })) {
    throw new Error('Для показа нужна отдельная копия выгрузки. См. demo/README.md.')
  }

  const input = createInterface({ input: process.stdin })
  const answers = input[Symbol.asyncIterator]()
  try {
    console.log('Убедитесь, что открытый дашборд читает эту копию:')
    console.log(file)
    for (const [index, [key, cue]] of steps.entries()) {
      console.log(`\n${index + 1}/${steps.length} · ${key}`)
      console.log(cue)
      console.log('Enter — применить шаг. q — закончить.')
      const answer = await answers.next()
      if (answer.done || answer.value.trim().toLowerCase() === 'q') return
      const result = spawnSync(process.execPath, [
        resolve(root, 'scripts/demo-case.mjs'), key, '--file', file,
      ], { cwd: root, stdio: 'inherit' })
      if (result.error || result.status !== 0)
        throw result.error ?? new Error(`Не удалось применить шаг ${key}.`)
    }
    console.log('\nЦепочка завершена. Откройте «Смена началась» и покажите бриф.')
  } finally {
    input.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
