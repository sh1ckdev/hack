import { z } from 'zod'
import {
  isActive,
  isActiveCritical,
  isAssignedToCoordinators,
  type DashboardSnapshot,
} from './model'
import { SLA_SOON_MS } from './ops'

const sessionSchema = z.object({
  id: z.string(),
  runId: z.string(),
  seq: z.number(),
  deadlines: z.record(z.string(), z.string()),
})
export type FocusSession = z.infer<typeof sessionSchema>
export const focusStorageKey = 'relay-personal-focus-v1'

export function readFocus(): FocusSession | null {
  try {
    return sessionSchema.parse(
      JSON.parse(localStorage.getItem(focusStorageKey) ?? 'null')
    )
  } catch {
    return null
  }
}

export function startFocus(data: DashboardSnapshot, id: string): FocusSession {
  return {
    id,
    runId: data.runId,
    seq: data.events[data.events.length - 1]?.seq ?? 0,
    deadlines: Object.fromEntries(
      data.incidents.map((i) => [i.id, i.deadline ?? ''])
    ),
  }
}

export function focusReview(
  data: DashboardSnapshot,
  session: FocusSession,
  now: number
) {
  const incomplete =
    data.runId !== session.runId || (data.events[0]?.seq ?? 0) > session.seq + 1
  const changed = new Map<string, Set<string>>()
  for (const event of data.events) {
    if (!incomplete && event.seq <= session.seq) continue
    const reasons = changed.get(event.incidentId) ?? new Set()
    event.reasons.forEach((reason) => reasons.add(reason))
    changed.set(event.incidentId, reasons)
  }
  const rows = data.incidents
    .flatMap((i) => {
      if (i.id === session.id) return []
      const reasons = changed.get(i.id)
      const critical =
        isActiveCritical(i) &&
        (incomplete ||
          reasons?.has('enteredCritical') ||
          reasons?.has('newCritical'))
      const transfer =
        isAssignedToCoordinators(i) &&
        (incomplete || reasons?.has('assignedToCoordinators'))
      const due = Date.parse(i.deadline ?? '')
      const previous = Date.parse(session.deadlines[i.id] ?? '')
      const deadline =
        isActive(i) &&
        (i.priorityId ?? 0) >= 3 &&
        due <= now + SLA_SOON_MS &&
        (incomplete ||
          (reasons?.has('deadlineChanged') &&
            (!Number.isFinite(previous) || due < previous)))
      if (!critical && !transfer && !deadline) return []
      const facts = []
      if (critical) facts.push('Активный критический инцидент')
      if (transfer)
        facts.push(
          i.stateEnum === 'Research'
            ? 'Сбой устранён, исследование ждёт передачи'
            : 'Назначен координаторам и ждёт передачи'
        )
      if (deadline)
        facts.push('Срок решения ' + new Date(due).toLocaleString('ru-RU'))
      return [
        {
          incident: i,
          signals: [
            critical && 'critical',
            transfer && (i.stateEnum === 'Research' ? 'research' : 'transfer'),
            deadline && 'deadline',
          ].filter((v): v is string => typeof v === 'string'),
          facts,
          transfer: !!transfer,
          rank: critical ? 0 : transfer ? 1 : 2,
          due: Number.isFinite(due) ? due : Infinity,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.due - b.due ||
        a.incident.id.localeCompare(b.incident.id)
    )
  return { rows, incomplete }
}
