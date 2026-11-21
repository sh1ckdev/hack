import {
  formatDate,
  incidentGroups,
  incidentStatus,
  isActive,
  isActiveCritical,
  priorityLabel,
  reasonLabels,
  remainingTime,
  type DashboardSnapshot,
  type Incident,
} from './model'
import { countSlaForecasts } from './sla-forecast'
import { handoffLine, suggestHandoff } from './handoff'
import {
  buildShiftRiskSummary,
  summarizeShiftEventsSince,
} from './shift-risk'

export const SLA_SOON_MS = 2 * 60 * 60 * 1000

export function slaRiskCounts(incidents: Incident[], now: number) {
  let overdue = 0
  let dueSoon = 0
  for (const incident of incidents) {
    if (!isActive(incident)) continue
    const time = Date.parse(incident.deadline ?? '')
    if (!Number.isFinite(time)) continue
    if (time <= now) overdue += 1
    else if (time - now <= SLA_SOON_MS) dueSoon += 1
  }
  return { overdue, dueSoon }
}

export type ProductBurst = {
  product: string
  count: number
  ids: string[]
  hasCritical: boolean
}

export function productBursts(
  incidents: Incident[],
  minActive = 2
): ProductBurst[] {
  const byProduct = new Map<string, Incident[]>()
  for (const incident of incidents) {
    if (!isActive(incident)) continue
    const product = incident.productName?.trim() || 'Продукт не указан'
    const bucket = byProduct.get(product) ?? []
    bucket.push(incident)
    byProduct.set(product, bucket)
  }
  return [...byProduct.entries()]
    .filter(([, list]) => list.length >= minActive)
    .map(([product, list]) => ({
      product,
      count: list.length,
      ids: list.map(({ id }) => id),
      hasCritical: list.some(isActiveCritical),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(b.hasCritical) - Number(a.hasCritical) ||
        a.product.localeCompare(b.product, 'ru')
    )
}

export function buildHandoverText(data: DashboardSnapshot, now: number) {
  const critical = data.incidents.filter(isActiveCritical)
  const coordinators = data.incidents.filter((incident) =>
    incidentGroups
      .find(({ key }) => key === 'coordinators')
      ?.match(incident)
  )
  const risks = slaRiskCounts(data.incidents, now)
  const bursts = productBursts(data.incidents)
  const stamp = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(now)
  const lines = [
    `Передача смены — Relay Console`,
    stamp,
    '',
    `Выгрузка: ${data.incidents.length} записей · событий в ленте: ${data.events.length}`,
    `Критических в работе: ${critical.length}`,
    `У координаторов: ${coordinators.length}`,
    `SLA: просрочено ${risks.overdue}, срок в 2 ч — ${risks.dueSoon}`,
  ]
  if (bursts.length) {
    lines.push('', 'Массовость (активные по продукту):')
    for (const burst of bursts.slice(0, 6)) {
      const tail = burst.ids.slice(0, 4).join(', ')
      lines.push(
        `  • ${burst.product}: ${burst.count}${burst.hasCritical ? ' (есть крит.)' : ''} — ${tail}${burst.ids.length > 4 ? '…' : ''}`
      )
    }
  }
  if (critical.length) {
    lines.push('', 'Критические:')
    for (const incident of critical.slice(0, 10)) {
      lines.push(
        `  • ${incident.id} · ${incident.productName ?? '—'} · ${remainingTime(incident.deadline, now) ?? 'срок не задан'} · ${incident.assignedEmployee ?? 'исполнитель —'}`
      )
    }
  }
  const latest = data.events[data.events.length - 1]
  if (latest) {
    lines.push(
      '',
      `Последнее событие: ${latest.incidentId} (${formatDate(latest.observedAt)}) — ${
        latest.detail ??
        latest.reasons.map((r) => reasonLabels[r]).join(', ')
      }`
    )
  }
  return lines.join('\n')
}

export type ShiftStartedBrief = {
  title: string
  lines: string[]
  plain: string
  anchorSeq: number | null
}

/** Бриф «Смена началась» — снимок очереди и события после якоря. */
export function buildShiftStartedBrief(
  data: DashboardSnapshot,
  now: number,
  anchorSeq: number | null
): ShiftStartedBrief {
  const critical = data.incidents.filter(isActiveCritical)
  const coordinators = data.incidents.filter((incident) =>
    incidentGroups
      .find(({ key }) => key === 'coordinators')
      ?.match(incident)
  )
  const risks = buildShiftRiskSummary(data.incidents, now)
  const slaForecast = countSlaForecasts(data.incidents, now)
  const stamp = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(now)

  const since =
    anchorSeq != null ? data.events.filter((e) => e.seq > anchorSeq) : []

  const lines: string[] = [
    `Снимок: ${stamp}`,
    '',
    'Очередь:',
    `  • Критические — ${critical.length}`,
    `  • У координаторов — ${coordinators.length}`,
    '',
    'Внимание по активным:',
    `  • Просрочен срок — ${risks.overdue}`,
    `  • Срок в ближайшие 2 часа — ${risks.dueSoon}`,
    `  • Нет исполнителя — ${risks.unassigned}`,
    `  • В двух и более очередях сразу — ${risks.multiSection}`,
    '',
    'Прогноз срыва SLA (по полям выгрузки):',
    `  • Высокий риск — ${slaForecast.high}`,
    `  • Под наблюдением — ${slaForecast.medium}`,
  ]

  if (coordinators.length) {
    lines.push('', 'Куда передать:')
    for (const incident of coordinators.slice(0, 6)) {
      const route = suggestHandoff(incident, data.incidents)
      const product = incident.productName ?? 'продукт не указан'
      lines.push(
        route
          ? `  • ${incident.id} · ${product} — ${handoffLine(route)}`
          : `  • ${incident.id} · ${product} — нет другой команды в выгрузке`
      )
    }
  }

  const delta = summarizeShiftEventsSince(data, anchorSeq)
  if (anchorSeq != null && delta && delta.total > 0) {
    lines.push(
      '',
      `Изменения с фиксации смены (${delta.total}):`,
      `  ${delta.byReason
        .slice(0, 6)
        .map(
          ([r, n]) =>
            `${reasonLabels[r as keyof typeof reasonLabels] ?? r} — ${n}`
        )
        .join('; ')}`
    )
  }

  if (anchorSeq == null) {
    lines.push(
      '',
      'Смена ещё не зафиксирована.',
      'Нажмите «Зафиксировать смену» — дальше здесь будут только новые записи из ленты.'
    )
  } else if (since.length) {
    lines.push('', `Новое с начала вашей смены (${since.length}):`)
    for (const event of since.slice(-10)) {
      const headline =
        event.detail ??
        event.reasons.map((r) => reasonLabels[r]).join(', ')
      lines.push(`  • ${event.incidentId}: ${headline}`)
    }
  } else {
    lines.push('', 'С начала смены в ленте пока ничего нового.')
  }

  if (critical.length) {
    lines.push('', 'Критические (что под рукой):')
    for (const incident of critical.slice(0, 6)) {
      lines.push(
        `  • ${incident.id} · ${incident.productName ?? '—'} · ${remainingTime(incident.deadline, now) ?? 'срок не задан'}`
      )
    }
  }

  const title = anchorSeq == null ? 'Начало смены' : 'Сводка смены'

  return {
    title,
    lines,
    plain: [`Relay Console — ${title}`, ...lines].join('\n'),
    anchorSeq,
  }
}

export const OPEN_INCIDENT_EVENT = 'relay:open-incident' as const

export type OpenIncidentDetail = { id: string }

/** Текст для чата/звонка по одному INC (передача смены). */
export function buildIncidentProtocol(
  incident: Incident & { groups?: string[] },
  now: number
) {
  const groups =
    incident.groups?.length ?
      incident.groups
          .map(
            (key) =>
              incidentGroups.find((g) => g.key === key)?.title ?? key
          )
          .join(', ')
    : '—'
  const lines = [
    `INC ${incident.id}`,
    `${incident.productName ?? 'Продукт не указан'} · ${incidentStatus(incident)}`,
    `Секции кейса: ${groups}`,
    `Приоритет: ${priorityLabel(incident)}`,
    `Срок: ${incident.deadline ? formatDate(incident.deadline) : 'не задан'} (${remainingTime(incident.deadline, now) ?? '—'})`,
    `Исполнитель: ${incident.assignedEmployee ?? 'не назначен'}`,
    `Команда: ${incident.assignedGroupName ?? '—'}`,
    incident.header ? `Тема: ${incident.header}` : '',
    `Relay Console · ${new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(now)}`,
  ]
  return lines.filter(Boolean).join('\n')
}