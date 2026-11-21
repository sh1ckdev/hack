import {
  incidentStatus,
  isActive,
  isResolved,
  remainingTime,
  type Incident,
} from '../src/features/incidents/model'

type BriefInput = Pick<
  Incident,
  | 'header'
  | 'service'
  | 'stateEnum'
  | 'assignedEmployee'
  | 'deadline'
  | 'solution'
>

export type ResolutionBrief = {
  symptom: string
  known: string
  gap: string | null
  action: string
}

function componentName(header: string | null | undefined) {
  const text = header?.trim()
  if (!text) return null
  if (text.includes(':')) {
    const tail = text.split(':').pop()?.trim()
    if (tail) return tail
  }
  const match = text.match(
    /^(?:Отказ|Сбой|Аномалия в|Проблема с)\s+([^(]+?)(?:\s+\(|\s+на\s+|$)/
  )
  return match?.[1]?.trim() || text
}

function servicePlace(service: string | null | undefined) {
  const place = service?.replace(/^\[[^\]]+\]\s*/, '').trim()
  return place || null
}

function symptomLine(record: BriefInput) {
  const component = componentName(record.header)
  const place = servicePlace(record.service)
  const header = record.header?.trim() ?? ''
  if (component && place && !header.includes(place)) {
    return `Отклонение «${component}» на сервисе «${place}».`
  }
  if (component) return `Отклонение «${component}».`
  return 'Симптом в выгрузке не назван.'
}

function quotedFact(text: string) {
  return text.replace(/[.。\s]+$/, '')
}

function knownLine(record: BriefInput) {
  const solution = record.solution?.trim()
  if (solution && isResolved(record)) {
    return `В решении написано: «${quotedFact(solution)}».`
  }
  if (solution) {
    return `В решении написано: «${quotedFact(solution)}». Причина отклонения в выгрузке не подтверждена.`
  }
  return 'Причина неизвестна.'
}

function gapLine(record: BriefInput, now: number) {
  if (isResolved(record)) return null
  const parts: string[] = []
  if (record.solution?.trim()) {
    parts.push(`Статус всё ещё «${incidentStatus(record)}».`)
  }
  const time = Date.parse(record.deadline ?? '')
  if (Number.isFinite(time) && time <= now) {
    const overdue = remainingTime(record.deadline, now)
    if (overdue) parts.push(overdue)
  }
  return parts.length ? parts.join(' ') : null
}

function actionLine(record: BriefInput, handoffTeam: string | null) {
  if (isResolved(record)) return 'Дополнительных действий нет.'

  const who = record.assignedEmployee?.split('(')[0]?.trim()
  const component = componentName(record.header)
  const piece = component ? `«${component}»` : 'сбой'
  const solution = record.solution?.trim()
  const handoff = handoffTeam ? `«${handoffTeam}»` : null

  if (record.stateEnum === 'Research') {
    return handoff
      ? `Когда причина будет ясна, передайте ${piece} в ${handoff}. Закрывать рано.`
      : `Когда причина будет ясна, найдите профильную команду. Закрывать рано.`
  }

  if (solution && isActive(record)) {
    const confirm = who
      ? `${who} подтверждает, что записанное решение сняло ${piece}, и заявку закрывают.`
      : `Подтвердите, что записанное решение сняло ${piece}, и закройте заявку.`
    return handoff
      ? `${confirm} Если нет — передайте в ${handoff}.`
      : `${confirm} Если нет — найдите профильную команду по продукту.`
  }

  if (!who) {
    return handoff
      ? `Назначьте исполнителя и передайте ${piece} в ${handoff}. Зафиксируйте срок.`
      : `Назначьте исполнителя на ${piece} и зафиксируйте срок.`
  }

  return handoff
    ? `Передайте ${piece} в ${handoff} и зафиксируйте срок.`
    : `Уточните у ${who}, кто устраняет ${piece}, и зафиксируйте срок.`
}

export function buildResolutionBrief(
  record: BriefInput,
  handoffTeam: string | null,
  now = Date.now()
): ResolutionBrief {
  return {
    symptom: symptomLine(record),
    known: knownLine(record),
    gap: gapLine(record, now),
    action: actionLine(record, handoffTeam),
  }
}

function quoted(text: string) {
  return [...text.matchAll(/«([^»]*)»/g)].map((match) => match[1])
}

/** Фраза годится, только если все «...» из карточки фактов на месте и новых нет. */
export function phraseKeepsFacts(
  source: ResolutionBrief,
  phrase: ResolutionBrief
) {
  const sourceText = [source.symptom, source.known, source.gap ?? '', source.action].join(
    '\n'
  )
  const phraseText = [phrase.symptom, phrase.known, phrase.gap ?? '', phrase.action].join(
    '\n'
  )
  const sourceQuotes = quoted(sourceText)
  const phraseQuotes = quoted(phraseText)
  if (sourceQuotes.some((item) => !phraseText.includes(`«${item}»`))) return false
  if (phraseQuotes.some((item) => !sourceQuotes.includes(item))) return false
  if (!source.gap) return !phrase.gap
  return Boolean(phrase.gap)
}
