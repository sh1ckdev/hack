import {
  eventHeadline,
  eventSeverity,
  type DashboardSnapshot,
  type Reason,
} from './model'

export const SHIFT_EVENT_JOURNAL_CAP = 500
export const TOAST_BURST_THRESHOLD = 5
export const PRIORITY_HINT_MS = 45 * 60_000
export const PRIORITY_HIGHLIGHT_MS = 20_000

const PRIORITY_SHIFT_REASONS = new Set<Reason>([
  'newCritical',
  'enteredCritical',
  'leftCritical',
  'priorityChanged',
])

export function isPriorityShiftEvent(reasons: Reason[]) {
  return reasons.some((r) => PRIORITY_SHIFT_REASONS.has(r))
}

export function filterEventsByMode(
  events: DashboardSnapshot['events'],
  mode: 'all' | 'priority' | 'critical'
) {
  if (mode === 'all') return events
  if (mode === 'priority')
    return events.filter((event) => isPriorityShiftEvent(event.reasons))
  return events.filter((event) =>
    event.reasons.some(
      (r) => r === 'newCritical' || r === 'enteredCritical'
    )
  )
}

/** Последнее по времени пояснение сдвига приоритета по каждому INC. */
export function buildRecentPriorityHints(
  events: DashboardSnapshot['events'],
  now = Date.now(),
  windowMs = PRIORITY_HINT_MS
) {
  const map = new Map<string, { detail: string; seq: number }>()
  const cutoff = now - windowMs
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (!event || !isPriorityShiftEvent(event.reasons)) continue
    const at = Date.parse(event.observedAt)
    if (Number.isFinite(at) && at < cutoff) continue
    if (map.has(event.incidentId)) continue
    const detail =
      event.detail?.trim() ||
      event.reasons.map((r) => eventHeadline([r])).join(' · ')
    map.set(event.incidentId, { detail, seq: event.seq })
  }
  return map
}

export type BurstToastPlan =
  | { mode: 'individual' }
  | {
      mode: 'summary'
      severity: 'error' | 'warning' | 'info'
      title: string
      description: string
      sample: DashboardSnapshot['events']
    }

export function planFreshEventToasts(
  fresh: DashboardSnapshot['events']
): BurstToastPlan {
  if (fresh.length <= TOAST_BURST_THRESHOLD) return { mode: 'individual' }

  const priority = fresh.filter((e) => isPriorityShiftEvent(e.reasons))
  const critical = fresh.filter((e) =>
    e.reasons.some(
      (r) => r === 'newCritical' || r === 'enteredCritical'
    )
  )

  let severity: 'error' | 'warning' | 'info' = 'info'
  for (const event of fresh) {
    const s = eventSeverity(event.reasons)
    if (s === 'error') {
      severity = 'error'
      break
    }
    if (s === 'warning') severity = 'warning'
  }

  const title =
    priority.length > 0
      ? `Пакет изменений: ${fresh.length} событий`
      : `Пакет обновлений: ${fresh.length} событий`

  const parts = [
    priority.length ? `приоритет: ${priority.length}` : '',
    critical.length ? `критические: ${critical.length}` : '',
    `всего за снимок: ${fresh.length}`,
  ].filter(Boolean)

  const description = [
    parts.join(' · '),
    'Подробности — в журнале смены (вкладка «Приоритет»).',
  ].join(' ')

  return {
    mode: 'summary',
    severity,
    title,
    description,
    sample: fresh.slice(-3),
  }
}

/** Кого подсвечивать на канбане, чтобы не «засветить» всё поле. */
export function highlightIncidentIds(
  fresh: DashboardSnapshot['events'],
  watched: Set<string>,
  calm: boolean
) {
  if (!calm) return [...new Set(fresh.map((e) => e.incidentId))]
  const ids = new Set<string>()
  for (const event of fresh) {
    if (watched.has(event.incidentId)) ids.add(event.incidentId)
    if (
      event.reasons.some(
        (r) => r === 'newCritical' || r === 'enteredCritical'
      )
    ) {
      ids.add(event.incidentId)
    }
  }
  return [...ids]
}

export function worstSeverity(
  events: DashboardSnapshot['events']
): 'error' | 'warning' | 'info' {
  let worst: 'error' | 'warning' | 'info' = 'info'
  for (const event of events) {
    const s = eventSeverity(event.reasons)
    if (s === 'error') return 'error'
    if (s === 'warning') worst = 'warning'
  }
  return worst
}