import { z } from 'zod'
import { SORT_OPTIONS, STATE_OPTIONS } from './incident-filters'
import { incidentGroups } from './model'

export const voiceFilterKeys = [
  'onlyCritical',
  'onlyCoordinators',
  'onlyOverdue',
  'onlyDueSoon',
  'onlyWatched',
  'onlyActive',
  'unassignedEmployee',
  'unassignedTeam',
] as const

const voiceBriefTopic = z.enum(['next', 'owner', 'history'])
export type VoiceBriefTopic = z.infer<typeof voiceBriefTopic>

const voiceViews = [
  'demo',
  'board',
  'wall',
  'history',
  'shiftBrief',
  'filters',
] as const
const incidentOperations = [
  'open',
  'handoff',
  'analyze',
  'assessRisk',
  'watch',
  'unwatch',
  'startFocus',
  'see',
  'claim',
  'release',
] as const
const demoOperations = ['start', 'apply', 'skip', 'restart'] as const

export const voiceIntentSchema = z.discriminatedUnion('action', [
  z
    .strictObject({
      action: z.literal('filter'),
      filters: z.array(z.enum(voiceFilterKeys)).max(voiceFilterKeys.length),
      query: z.string().trim().max(150),
      states: z
        .array(z.enum(STATE_OPTIONS.map(({ value }) => value)))
        .min(1)
        .max(6)
        .optional(),
      priorities: z
        .array(z.enum(['1', '2', '3', '4', 'unknown']))
        .min(1)
        .max(5)
        .optional(),
      lanes: z
        .array(z.enum(incidentGroups.map(({ key }) => key)))
        .min(1)
        .max(4)
        .optional(),
      deadline: z.enum(['with', 'without']).optional(),
      hideResolved: z.boolean().optional(),
    })
    .refine(
      ({ filters, query, states, priorities, lanes, deadline, hideResolved }) =>
        Boolean(
          filters.length ||
          query ||
          states ||
          priorities ||
          lanes ||
          deadline ||
          hideResolved
        )
    ),
  z.strictObject({
    action: z.literal('sort'),
    sortBy: z.enum(SORT_OPTIONS.map(({ value }) => value)),
  }),
  z.strictObject({ action: z.literal('reset') }),
  z.strictObject({ action: z.literal('brief'), topic: voiceBriefTopic }),
  z.strictObject({ action: z.literal('view'), view: z.enum(voiceViews) }),
  z.strictObject({ action: z.literal('close') }),
  z.strictObject({
    action: z.literal('incident'),
    operation: z.enum(incidentOperations),
    reference: z
      .string()
      .regex(/^(?:INC\d{1,24}|\d{2,24}|current|recommended)$/i),
  }),
  z.strictObject({
    action: z.literal('demo'),
    operation: z.enum(demoOperations),
  }),
  z.strictObject({
    action: z.literal('toggle'),
    setting: z.enum([
      'shiftFocus',
      'detailCards',
      'sound',
      'desktop',
      'emptyColumns',
    ]),
    enabled: z.boolean(),
  }),
  z.strictObject({
    action: z.literal('theme'),
    theme: z.enum(['light', 'dark', 'system']),
  }),
  z.strictObject({ action: z.literal('endFocus') }),
  z.strictObject({ action: z.literal('help') }),
  z.strictObject({ action: z.literal('unsupported') }),
])

export type VoiceIntent = z.infer<typeof voiceIntentSchema>

export function resolveVoiceIncidentIds(
  ids: readonly string[],
  reference: string
) {
  const normalized = reference.toUpperCase()
  const exact = ids.filter((id) => id.toUpperCase() === normalized)
  if (exact.length || normalized.startsWith('INC')) return exact
  return ids.filter((id) => /^INC\d+$/i.test(id) && id.endsWith(normalized))
}

const spokenDigits: Record<string, string> = {
  ноль: '0',
  нуль: '0',
  один: '1',
  одна: '1',
  два: '2',
  две: '2',
  три: '3',
  четыре: '4',
  пять: '5',
  шесть: '6',
  семь: '7',
  восемь: '8',
  девять: '9',
}

const spokenNumbers: Record<string, number> = {
  ...Object.fromEntries(
    Object.entries(spokenDigits).map(([word, digit]) => [word, Number(digit)])
  ),
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
}

function voiceSuffix(raw: string) {
  const chunks = raw.split(/[ ,–-]+/)
  const digits = chunks.map((chunk) =>
    /^\d+$/.test(chunk)
      ? chunk
      : Object.prototype.hasOwnProperty.call(spokenDigits, chunk)
        ? spokenDigits[chunk]
        : ''
  )
  if (digits.every(Boolean) && /^\d{2,24}$/.test(digits.join('')))
    return digits.join('')

  const numbers = chunks.map((chunk) =>
    Object.prototype.hasOwnProperty.call(spokenNumbers, chunk)
      ? spokenNumbers[chunk]
      : /^\d{1,3}$/.test(chunk)
        ? Number(chunk)
        : NaN
  )
  const scales = numbers.map((n) => (n >= 100 ? 100 : n >= 10 ? 10 : 1))
  if (
    numbers.every((n, i) => n > 0 && (i === 0 || scales[i] < scales[i - 1]))
  ) {
    const value = numbers.reduce((sum, n) => sum + n, 0)
    if (value >= 10 && value < 1000) return String(value)
  }
}

export function matchVoiceCommand(transcript: string): VoiceIntent | undefined {
  const text = transcript
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/^пожалуйста[, ]+/, '')
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
  const brief = matchVoiceBrief(text)
  if (brief) return { action: 'brief', topic: brief }

  if (
    /^(?:открой(?:те)?|покажи(?:те)?|включи(?:те)?)(?: (?:окно|режим))? (?:для демо|демо(?:[- ]?режим)?|мастер демо)$/.test(
      text
    )
  )
    return { action: 'view', view: 'demo' }
  if (/^(?:покажи |включи |открой )?видеостену$/.test(text))
    return { action: 'view', view: 'wall' }
  if (
    /^(?:выключи видеостену|обычный режим|вернись (?:на дашборд|к очередям))$/.test(
      text
    )
  )
    return { action: 'view', view: 'board' }
  if (
    /^(?:открой|покажи) (?:историю передач|передачи координаторов)$/.test(text)
  )
    return { action: 'view', view: 'history' }
  if (/^(?:(?:открой|покажи) (?:бриф|сводку) смены|смена началась)$/.test(text))
    return { action: 'view', view: 'shiftBrief' }
  if (/^(?:открой|покажи) (?:панель )?фильтры$/.test(text))
    return { action: 'view', view: 'filters' }
  if (
    /^(?:закрой (?:окно|карточку|демо|фильтры|сводку|историю)|закрыть окно)$/.test(
      text
    )
  )
    return { action: 'close' }
  if (/^(?:что ты умеешь|покажи команды|помощь)$/.test(text))
    return { action: 'help' }

  if (
    /^(?:сбрось фильтры|очисти фильтры|убери фильтры|все заявки|покажи все(?: заявки)?)$/.test(
      text
    )
  )
    return { action: 'reset' }
  if (
    /^(?:(?:отфильтруй|покажи)(?: только)? )?исследование(?: ситуации)?$/.test(
      text
    )
  )
    return { action: 'filter', filters: [], query: '', states: ['Research'] }

  if (
    /^(?:сбрось демо и начни|сбросить и начать|начни демо сначала)$/.test(text)
  )
    return { action: 'demo', operation: 'start' }
  if (/^примени (?:текущий )?(?:шаг|демо[- ]шаг)$/.test(text))
    return { action: 'demo', operation: 'apply' }
  if (/^пропусти (?:текущий )?(?:шаг|демо[- ]шаг)$/.test(text))
    return { action: 'demo', operation: 'skip' }

  const switchCommand =
    /^(включи|выключи) (фокус смены|звук|push(?:[- ]уведомления)?)$/.exec(text)
  if (switchCommand) {
    const [, verb, name] = switchCommand
    const setting =
      name === 'фокус смены'
        ? 'shiftFocus'
        : name === 'звук'
          ? 'sound'
          : 'desktop'
    return { action: 'toggle', setting, enabled: verb === 'включи' }
  }

  if (
    /^(?:отсортируй|сортируй|упорядочь|упорядочи)(?: (?:очередь|заявки|инциденты))? по (?:ближайшему )?(?:сроку|дедлайну)$/.test(
      text
    ) ||
    /^(?:сначала|выше) (?:заявки )?с ближайшим (?:сроком|дедлайном)$/.test(text)
  )
    return { action: 'sort', sortBy: 'deadlineAsc' }

  const incidentCommand = [
    {
      operation: 'see',
      pattern:
        /^(?:отметь просмотр |отметь увидел |отметь как просмотренную )(.+)$/,
    },
    {
      operation: 'claim',
      pattern: /^(?:возьми в работу|беру в работу|возьми)(?: заявку)? (.+)$/,
    },
    { operation: 'release', pattern: /^(?:освободи|сними с меня) (.+)$/ },
    {
      operation: 'assessRisk',
      pattern: /^(?:оцени(?: с ии)? риск|оцени эскалацию) (.+)$/,
    },
    {
      operation: 'analyze',
      pattern: /^(?:запроси|сгенерируй|подготовь) сводку (.+)$/,
    },
    { operation: 'handoff', pattern: /^(?:открой|покажи) передачу (.+)$/ },
    { operation: 'watch', pattern: /^(?:следи за|отслеживай) (.+)$/ },
    {
      operation: 'unwatch',
      pattern: /^(?:перестань следить за|не отслеживай) (.+)$/,
    },
    {
      operation: 'open',
      pattern: /^(?:открой|покажи (?:карточку|сводку)) (.+)$/,
    },
  ] as const
  for (const { operation, pattern } of incidentCommand) {
    const target = pattern.exec(text)?.[1]
    if (!target) continue
    const suffix =
      /(?:заканчива[а-я]* на|последние цифры|на конце)[ :]+(.+)$/u.exec(
        target
      )?.[1]
    const reference = suffix
      ? voiceSuffix(suffix)
      : (/^(?:(?:по |для )?(?:инцидент[ауом]?|заявк[ауие]|карточку) (?:номер |№ ?)?)(inc[ -]?\d{1,24}|\d{2,24})$/.exec(
          target
        )?.[1] ??
        /^(?:по |для )?(inc[ -]?\d{1,24}|\d{2,24})$/.exec(target)?.[1])
    if (reference)
      return {
        action: 'incident',
        operation,
        reference: reference.replace(/[ -]/g, ''),
      }
    if (
      /(?:рекомендованн[а-я]+ (?:заявк[а-я]+|инцидент[а-я]*)|заявку которую ты рекомендовал)$/.test(
        target
      )
    )
      return { action: 'incident', operation, reference: 'recommended' }
    if (
      /^(?:по |для )?(?:эту заявку|этот инцидент|этой заявке|этого инцидента)$/.test(
        target
      )
    )
      return { action: 'incident', operation, reference: 'current' }
  }

  const idQuery = /^(?:найди|ищи|поиск) (INC\d{1,24})$/iu.exec(text)?.[1]
  if (idQuery) return { action: 'filter', filters: [], query: idQuery }
  const quickFilters = [
    [/^(?:покажи )?критические(?: инциденты| заявки)?$/, 'onlyCritical'],
    [/^(?:покажи )?просроченные(?: инциденты| заявки)?$/, 'onlyOverdue'],
    [
      /^(?:покажи )?(?:назначенные координаторам|заявки у координаторов)$/,
      'onlyCoordinators',
    ],
    [/^(?:покажи )?(?:отслеживаемые|избранные)(?: заявки)?$/, 'onlyWatched'],
  ] as const
  const quickFilter = quickFilters.find(([pattern]) => pattern.test(text))?.[1]
  if (quickFilter)
    return { action: 'filter', filters: [quickFilter], query: '' }
}

export function voiceSearchFallback(
  transcript: string
): VoiceIntent | undefined {
  const query = /^(?:найди|ищи|поиск) (.+)$/iu.exec(
    transcript.trim().replace(/[.!?]+$/, '')
  )?.[1]
  if (query && query.length <= 150)
    return { action: 'filter', filters: [], query }
}

export function matchVoiceBrief(
  transcript: string
): VoiceBriefTopic | undefined {
  const text = transcript
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/ первыми почему$/, ' первым и почему')
  if (
    /^(?:скажи,? )?(?:что|какую заявку) (?:мне )?(?:сейчас )?(?:взять в работу|(?:взять|проверить|разобрать) (?:первым|первой|сначала|в первую очередь))(?: и почему)?$/u.test(
      text
    )
  )
    return 'next'
  if (
    /^(?:а )?кто (?:е[её] вед[её]т|исполнитель|назначен на эту заявку|отвечает за не[её])$/u.test(
      text
    )
  )
    return 'owner'
  if (
    /^(?:а )?что (?:по ней|в этой заявке) (?:менялось|изменилось)$/u.test(text)
  )
    return 'history'
}

export async function interpretVoiceCommand(
  transcript: string,
  signal: AbortSignal
) {
  const response = await fetch('/api/voice-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Relay-Request': 'voice-intent',
    },
    body: JSON.stringify({ transcript }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(22_000)]),
  })
  if (!response.ok) {
    switch (response.status) {
      case 400:
      case 413:
        throw new Error('Произнесите более короткую команду.')
      case 503:
        throw new Error('Qwen недоступен. Запустите npm run voice:ai.')
      case 504:
        throw new Error('Qwen отвечает слишком долго. Повторите команду.')
      default:
        throw new Error(
          'Не удалось обработать голосовую команду. Попробуйте ещё раз.'
        )
    }
  }
  return voiceIntentSchema.parse(await response.json())
}
