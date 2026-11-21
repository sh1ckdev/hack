/** Цепочка защиты кейса МТС (синхронно с `scripts/demo-case.mjs`). */
export const DEFENSE_SCENARIO_KEYS = [
  'critical-up',
  'coordinators',
  'deadline',
  'dual-section',
  'resolved-research',
  'engineers',
] as const

export type DefenseScenarioKey = (typeof DEFENSE_SCENARIO_KEYS)[number]

export type DefenseStep = {
  key: DefenseScenarioKey
  title: string
  guide: string
  /** На что смотреть в Relay Console после шага. */
  lookFor: string
}

export const DEFENSE_STEPS: DefenseStep[] = [
  {
    key: 'critical-up',
    title: 'Высокий → критический',
    guide: '§10 шаг 2 · enteredCritical',
    lookFor:
      'Карточка INC000021938167 в колонке «Критические», событие в ленте, подсветка.',
  },
  {
    key: 'coordinators',
    title: 'Назначение координаторам',
    guide: '§10 шаг 3 · assignedToCoordinators',
    lookFor: 'Колонка «Назначенные координаторам», сдвиг assignedGroupName.',
  },
  {
    key: 'deadline',
    title: 'Изменение срока',
    guide: '§10 шаг 3 · deadlineChanged',
    lookFor: 'Обновление срока на всех карточках этого INC в секциях.',
  },
  {
    key: 'dual-section',
    title: 'Две секции сразу',
    guide: '§9 · critical + coordinators',
    lookFor:
      'Бейдж «Связь», две карточки, линия по клику на «Связь».',
  },
  {
    key: 'resolved-research',
    title: 'Снятие с критических → исследование',
    guide: '§9 · leftCritical без ложного «решён»',
    lookFor: 'Исследование ситуации, не статус «Решён».',
  },
  {
    key: 'engineers',
    title: 'Возврат инженерам',
    guide: '§10 шаг 6 · leftCoordinators',
    lookFor: 'Уход из колонки координаторов, новое событие в ленте.',
  },
]

export const DEFENSE_DEMO_INCIDENT_ID = 'INC000021938167'