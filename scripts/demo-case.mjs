#!/usr/bin/env node
/**
 * Имитации по кейсу МТС (MTS-Codex-Guide §9–10), не случайный churn.
 *
 *   npm run demo:case              — список сценариев
 *   npm run demo:case -- critical-up
 *   npm run demo:defense           — цепочка защиты ~1–3 мин
 *
 * Перед прогоном: npm run demo:reset
 */
import { resolve } from 'node:path'
import {
  COORDINATORS,
  DEMO_IDS,
  ENGINEERS_PRIMORYE,
  defaultDataFile,
  findById,
  isoIn,
  loadIncidents,
  patchById,
  removeById,
  saveIncidents,
  sleep,
} from './demo-lib.mjs'

const SCENARIOS = {
  'critical-up': {
    title: 'Высокий → критический (enteredCritical)',
    guide: '§10 шаг 2 · INC000021938167 priorityId 3→4',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        priorityId: 4,
        stateEnum: 'WorkInProgress',
      })
    },
  },
  'critical-down': {
    title: 'Снятие критического без «решён» (leftCritical)',
    guide: '§9 · priorityId 4→3',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, { priorityId: 3 })
    },
  },
  coordinators: {
    title: 'Назначение координаторам',
    guide: '§10 шаг 3 · assignedToCoordinators',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        assignedGroupName: COORDINATORS,
      })
    },
  },
  engineers: {
    title: 'Возврат инженерам (leftCoordinators)',
    guide: '§10 шаг 6',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        assignedGroupName: ENGINEERS_PRIMORYE,
      })
    },
  },
  deadline: {
    title: 'Только срок (deadlineChanged)',
    guide: '§10 шаг 3 · синхрон на всех карточках',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        deadline: isoIn(6),
      })
    },
  },
  employee: {
    title: 'Смена исполнителя (assignmentChanged)',
    guide: '§9',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        assignedEmployee: 'Координатор смены (relay_demo)',
      })
    },
  },
  'dual-section': {
    title: 'Критический у координаторов (две секции)',
    guide: '§9 · один ID в critical + coordinators',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        priorityId: 4,
        stateEnum: 'WorkInProgress',
        assignedGroupName: COORDINATORS,
      })
    },
  },
  'coordinator-roundtrip': {
    title: 'Инженеры → координаторы → инженеры → координаторы',
    guide: '§9 · два сигнала assignedToCoordinators',
    steps: [
      {
        label: '→ координаторы',
        run(data) {
          patchById(data, DEMO_IDS.highPriority, {
            assignedGroupName: COORDINATORS,
          })
        },
      },
      {
        label: '→ инженеры',
        run(data) {
          patchById(data, DEMO_IDS.highPriority, {
            assignedGroupName: ENGINEERS_PRIMORYE,
          })
        },
      },
      {
        label: '→ координаторы снова',
        run(data) {
          patchById(data, DEMO_IDS.highPriority, {
            assignedGroupName: COORDINATORS,
          })
        },
      },
    ],
  },
  'research-coordinators': {
    title: 'Исследование + координаторы',
    guide: '§10 шаг 5 · INC000021930418',
    run(data) {
      patchById(data, DEMO_IDS.research, {
        stateEnum: 'Research',
        assignedGroupName: COORDINATORS,
        completionDate:
          findById(data, DEMO_IDS.research).completionDate ?? isoIn(-48),
      })
    },
  },
  'resolved-research': {
    title: 'Критический → исследование (resolvedCritical)',
    guide: '§9 · снятие с критических, очередь исследования',
    run(data) {
      patchById(data, DEMO_IDS.highPriority, {
        priorityId: 4,
        stateEnum: 'Research',
        assignedGroupName: COORDINATORS,
        completionDate: isoIn(-1),
      })
    },
  },
  remove: {
    title: 'Удаление из выгрузки (removedFromExport)',
    guide: '§9 · без ложного «решён»',
    run(data) {
      removeById(data, DEMO_IDS.removable)
    },
  },
}

const DEFENSE_SEQUENCE = [
  'critical-up',
  'coordinators',
  'deadline',
  'dual-section',
  'resolved-research',
  'engineers',
]

function usage() {
  console.log(`Сценарии кейса МТС (одно изменение = один снимок ≈1 с).

Команды:
  node scripts/demo-case.mjs --list
  node scripts/demo-case.mjs <ключ> [--file путь]
  node scripts/demo-case.mjs defense [--wait 1500]   — цепочка защиты §10
  node scripts/demo-case.mjs all [--wait 1200]        — все одиночные сценарии по порядку

Сброс: npm run demo:reset
`)
}

function parseArgs(argv) {
  const opts = {
    list: false,
    file: defaultDataFile(),
    wait: 0,
    scenario: null,
    help: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') opts.help = true
    else if (a === '--list') opts.list = true
    else if (a === '--file') opts.file = resolve(argv[++i])
    else if (a === '--wait') opts.wait = Number(argv[++i])
    else if (!a.startsWith('-')) opts.scenario = a
    else {
      console.error(`Неизвестный аргумент: ${a}`)
      opts.help = true
    }
  }
  return opts
}

function printList() {
  console.log('Ключ              | Описание')
  console.log('------------------|------------------------------------------')
  for (const [key, s] of Object.entries(SCENARIOS)) {
    console.log(`${key.padEnd(17)} | ${s.title}`)
  }
  console.log(`\ndefense             | ${DEFENSE_SEQUENCE.join(' → ')}`)
  console.log('all                 | все одиночные сценарии подряд')
}

async function applyOnce(file, scenario, meta) {
  const data = loadIncidents(file)
  if (scenario.steps) {
    const stepWait = optsWait > 0 ? optsWait : 900
    for (const step of scenario.steps) {
      step.run(data)
      saveIncidents(file, data)
      console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${meta}${step.label}`)
      await sleep(stepWait)
    }
    return
  }
  scenario.run(data)
  saveIncidents(file, data)
  console.log(
    `[${new Date().toLocaleTimeString('ru-RU')}] ${meta}${scenario.title}`
  )
}

let optsWait = 0

async function runScenario(key, file, wait) {
  optsWait = wait
  const scenario = SCENARIOS[key]
  if (!scenario) throw new Error(`Неизвестный сценарий: ${key}`)
  await applyOnce(file, scenario, '')
}

async function runDefense(file, wait) {
  const pause = wait > 0 ? wait : 1500
  for (const key of DEFENSE_SEQUENCE) {
    await runScenario(key, file, 0)
    if (pause > 0) await sleep(pause)
  }
}

async function runAll(file, wait) {
  const keys = Object.keys(SCENARIOS)
  for (const key of keys) {
    await runScenario(key, file, wait)
    if (wait > 0) await sleep(wait)
  }
}

async function main() {
  const opts = parseArgs(process.argv)
  if (opts.help) {
    usage()
    process.exit(opts.help && process.argv.length > 2 ? 1 : 0)
  }
  if (opts.list || !opts.scenario) {
    printList()
    return
  }
  const { file, wait, scenario } = opts
  if (scenario === 'defense') {
    await runDefense(file, wait || 1500)
    return
  }
  if (scenario === 'all') {
    await runAll(file, wait || 1200)
    return
  }
  await runScenario(scenario, file, wait)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
