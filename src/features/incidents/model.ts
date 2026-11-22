import { z } from 'zod'

const text = z.string().nullish()
export const incidentSchema = z.object({
  id: z.string().min(1),
  sysId: z.string().min(1).nullish(),
  priorityId: z.number().int().nullish(),
  stateEnum: text,
  stateReason: text,
  submitDate: text,
  deadline: text,
  completionDate: text,
  header: text,
  productName: text,
  service: text,
  shortDescription: text,
  description: text,
  solution: text,
  assignedEmployee: text,
  assignedEmployeeLogin: text,
  assignedGroupName: text,
})
export const incidentsSchema = z
  .array(incidentSchema)
  .refine(
    (incidents) =>
      new Set(incidents.map(({ id }) => id)).size === incidents.length,
    'Duplicate incident IDs'
  )
export const summarySchema = z.object({
  facts: z.string().trim().min(1),
  hypotheses: z.string().trim().min(1),
})
export type Incident = z.infer<typeof incidentSchema>

export const coordinatorGroupName =
  'КЦ ИТ Координаторы Массовых Инцидентов'
const coordinatorGroup = coordinatorGroupName

/** Коды из `data/incidents_attributes.json` (priorityId). */
export const priorityLabels: Record<number, string> = {
  1: 'Низкий',
  2: 'Средний',
  3: 'Высокий',
  4: 'Наивысший',
}

export const priorityLabel = (incident: Incident) =>
  incident.priorityId != null && priorityLabels[incident.priorityId]
    ? priorityLabels[incident.priorityId]
    : 'Приоритет не указан'

/** Колонки канбана (priorityId 4 — наивысший). */
export const priorityKanbanColumns = (
  [4, 3, 2, 1] as const
).map((priorityId) => ({
  key: `p${priorityId}` as const,
  priorityId,
  title: priorityLabels[priorityId],
}))

export const priorityKanbanUnknown = {
  key: 'unknown' as const,
  priorityId: null as null,
  title: 'Без приоритета',
}

export function priorityColumnKey(incident: Incident) {
  const id = incident.priorityId
  if (id != null && priorityLabels[id]) return `p${id}` as const
  return priorityKanbanUnknown.key
}

export function matchesPriorityColumn(
  incident: Incident,
  column: { priorityId: number | null }
) {
  if (column.priorityId === null)
    return (
      incident.priorityId == null || !priorityLabels[incident.priorityId]
    )
  return incident.priorityId === column.priorityId
}
export const isActive = (incident: Pick<Incident, 'stateEnum'>) =>
  incident.stateEnum === 'Assigned' || incident.stateEnum === 'WorkInProgress'

export const isActiveCritical = (incident: Incident) =>
  isActive(incident) && incident.priorityId === 4
export const isAssignedToCoordinators = (incident: Incident) =>
  (isActive(incident) || incident.stateEnum === 'Research') &&
  incident.assignedGroupName === coordinatorGroup

export const incidentGroups = [
  { key: 'critical', title: 'Критические', match: isActiveCritical },
  {
    key: 'coordinators',
    title: 'Назначенные координаторам',
    match: isAssignedToCoordinators,
  },
  {
    key: 'high',
    title: 'Высокий приоритет',
    match: (incident: Incident) =>
      isActive(incident) && incident.priorityId === 3,
  },
  {
    key: 'research',
    title: 'Исследование ситуации',
    match: (incident: Incident) => incident.stateEnum === 'Research',
  },
] as const

const queueLaneScrollOrder = [
  'critical',
  'coordinators',
  'high',
  'research',
] as const

/** Первая подходящая секция для прокрутки и фокуса (порядок как в кейсе МТС). */
export function primaryQueueLane(incident: { groups: string[] }) {
  return (
    queueLaneScrollOrder.find((key) => incident.groups.includes(key)) ??
    incidentGroups[0].key
  )
}

const statuses: Readonly<Record<string, string>> = {
  Assigned: 'Назначен',
  WorkInProgress: 'В работе',
  Resolved: 'Решён',
  Closed: 'Закрыт',
  Research: 'Исследование',
}
export const incidentStatus = (incident: Pick<Incident, 'stateEnum'>) =>
  statuses[incident.stateEnum ?? ''] ?? incident.stateEnum ?? 'Не указан'

export const isResolved = (incident: Pick<Incident, 'stateEnum'>) =>
  incident.stateEnum === 'Resolved' || incident.stateEnum === 'Closed'

export const reasonLabels = {
  newCritical: 'Новый критический инцидент',
  enteredCritical: 'Инцидент стал критическим',
  leftCritical: 'Снят критический приоритет',
  assignedToCoordinators: 'Назначен координаторам',
  leftCoordinators: 'Снят с координаторов',
  resolvedCritical: 'Критический инцидент снят с контроля',
  priorityChanged: 'Изменён приоритет',
  deadlineChanged: 'Изменён срок',
  assignmentChanged: 'Изменено назначение',
  stateChanged: 'Изменён статус',
  removedFromExport: 'Удалён из выгрузки',
}
const reasonSchema = z.enum([
  'newCritical',
  'enteredCritical',
  'leftCritical',
  'assignedToCoordinators',
  'leftCoordinators',
  'resolvedCritical',
  'priorityChanged',
  'deadlineChanged',
  'assignmentChanged',
  'stateChanged',
  'removedFromExport',
])
export type Reason = z.infer<typeof reasonSchema>

export type IncidentChange = {
  incident: Incident
  reasons: Reason[]
  detail?: string
}

const reasonPriority: Reason[] = [
  'newCritical',
  'enteredCritical',
  'resolvedCritical',
  'leftCritical',
  'removedFromExport',
  'assignedToCoordinators',
  'leftCoordinators',
  'deadlineChanged',
  'priorityChanged',
  'assignmentChanged',
  'stateChanged',
]

export function eventHeadline(reasons: Reason[]) {
  const primary =
    reasonPriority.find((reason) => reasons.includes(reason)) ?? reasons[0]
  return primary ? reasonLabels[primary] : 'Изменение'
}

export function eventSeverity(
  reasons: Reason[]
): 'error' | 'warning' | 'info' {
  if (reasons.some((r) => r === 'newCritical' || r === 'enteredCritical'))
    return 'error'
  if (
    reasons.some((r) =>
      ['removedFromExport', 'leftCritical', 'resolvedCritical'].includes(r)
    )
  )
    return 'warning'
  return 'info'
}

function deadlineKey(value: string | null | undefined) {
  return value?.trim() || ''
}

function buildEventDetail(
  old: Incident | undefined,
  incident: Incident,
  reasons: Reason[]
) {
  const parts: string[] = []
  if (old && old.priorityId !== incident.priorityId) {
    parts.push(
      `Приоритет: ${priorityLabel(old)} → ${priorityLabel(incident)}`
    )
  }
  if (
    old &&
    deadlineKey(old.deadline) !== deadlineKey(incident.deadline)
  ) {
    parts.push(
      `Срок: ${formatDate(old.deadline)} → ${formatDate(incident.deadline)}`
    )
  }
  if (
    old &&
    (old.assignedGroupName ?? '') !== (incident.assignedGroupName ?? '')
  ) {
    parts.push(
      `Команда: ${old.assignedGroupName || '—'} → ${incident.assignedGroupName || '—'}`
    )
  }
  if (
    old &&
    (old.assignedEmployee ?? '') !== (incident.assignedEmployee ?? '')
  ) {
    parts.push(
      `Исполнитель: ${old.assignedEmployee || '—'} → ${incident.assignedEmployee || '—'}`
    )
  }
  if (old && old.stateEnum !== incident.stateEnum) {
    parts.push(
      `Статус: ${incidentStatus(old)} → ${incidentStatus(incident)}`
    )
  }
  if (reasons.includes('removedFromExport') && !parts.length) {
    parts.push(`Последний статус: ${incidentStatus(incident)}`)
  }
  return parts.length ? parts.join(' · ') : undefined
}

export function incidentChanges(
  before: Incident[],
  after: Incident[]
): IncidentChange[] {
  const previous = new Map(before.map((incident) => [incident.id, incident]))
  const afterIds = new Set(after.map(({ id }) => id))

  const updates = after.flatMap((incident) => {
    const old = previous.get(incident.id)
    const reasons: Reason[] = []

    if (isActiveCritical(incident) && (!old || !isActiveCritical(old)))
      reasons.push(old ? 'enteredCritical' : 'newCritical')

    if (
      old &&
      isActiveCritical(old) &&
      !isActiveCritical(incident) &&
      !isResolved(incident) &&
      incident.stateEnum !== 'Research'
    )
      reasons.push('leftCritical')

    if (
      isAssignedToCoordinators(incident) &&
      (!old || !isAssignedToCoordinators(old))
    )
      reasons.push('assignedToCoordinators')

    if (
      old &&
      isAssignedToCoordinators(old) &&
      !isAssignedToCoordinators(incident)
    )
      reasons.push('leftCoordinators')

    if (
      old &&
      isActiveCritical(old) &&
      (isResolved(incident) || incident.stateEnum === 'Research')
    )
      reasons.push('resolvedCritical')

    if (
      old &&
      old.priorityId !== incident.priorityId &&
      !reasons.some((r) =>
        ['enteredCritical', 'newCritical', 'leftCritical'].includes(r)
      )
    )
      reasons.push('priorityChanged')

    if (
      old &&
      deadlineKey(old.deadline) !== deadlineKey(incident.deadline)
    )
      reasons.push('deadlineChanged')

    const groupChanged =
      old &&
      (old.assignedGroupName ?? '') !== (incident.assignedGroupName ?? '')
    const employeeChanged =
      old &&
      (old.assignedEmployee ?? '') !== (incident.assignedEmployee ?? '')
    if (groupChanged || employeeChanged) {
      const coordinatorOnly =
        (reasons.includes('assignedToCoordinators') ||
          reasons.includes('leftCoordinators')) &&
        !employeeChanged
      if (!coordinatorOnly)
        reasons.push('assignmentChanged')
    }

    if (
      old &&
      old.stateEnum !== incident.stateEnum &&
      !reasons.includes('resolvedCritical')
    )
      reasons.push('stateChanged')

    if (!reasons.length) return []
    return [
      {
        incident,
        reasons,
        detail: buildEventDetail(old, incident, reasons),
      },
    ]
  })

  const removals = before
    .filter((incident) => !afterIds.has(incident.id))
    .map((incident) => ({
      incident,
      reasons: ['removedFromExport'] as Reason[],
      detail: buildEventDetail(incident, incident, ['removedFromExport']),
    }))

  return [...updates, ...removals]
}

export function compareIncidents(a: Incident, b: Incident, now = Date.now()) {
  const deadlineMs = (item: Incident) => {
    const time = Date.parse(item.deadline ?? '')
    return isActive(item) && Number.isFinite(time) ? time : Infinity
  }
  const rank = (item: Incident) => {
    if (!isActive(item)) return 3
    const deadline = deadlineMs(item)
    if (deadline === Infinity) return 2
    return deadline <= now ? 0 : 1
  }
  return (
    rank(a) - rank(b) ||
    deadlineMs(a) - deadlineMs(b) ||
    a.id.localeCompare(b.id)
  )
}

export const dashboardSchema = z.object({
  runId: z.string(),
  version: z.number(),
  source: z.object({ state: z.enum(['ok', 'stale']), lastReadAt: z.string() }),
  incidents: z.array(
    incidentSchema.extend({ revision: z.string(), groups: z.array(z.string()) })
  ),
  events: z.array(
    z.object({
      seq: z.number(),
      incidentId: z.string(),
      product: z.string().nullish(),
      deadline: z.string().nullish(),
      reasons: z.array(reasonSchema),
      detail: z.string().nullish(),
      observedAt: z.string(),
    })
  ),
})
export type DashboardSnapshot = z.infer<typeof dashboardSchema>

export const analysisSchema = z.object({
  symptom: z.string().trim().min(1),
  known: z.string().trim().min(1),
  gap: z.string().trim().min(1).nullable(),
  action: z.string().trim().min(1),
  revision: z.string(),
  source: z.enum(['openai', 'openrouter', 'template']).optional(),
})

export function incidentLink(template: string, incident: Incident) {
  if (
    !/\{(?:sysId|id)\}/.test(template) ||
    (template.includes('{sysId}') && !incident.sysId)
  )
    return
  try {
    const url = new URL(
      template.replace(/\{(sysId|id)\}/g, (_, key) =>
        encodeURIComponent(
          key === 'sysId' ? (incident.sysId ?? '') : incident.id
        )
      )
    )
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch {
    return
  }
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatDate(value: string | null | undefined) {
  const time = value ? Date.parse(value) : NaN
  return Number.isFinite(time) ? dateFormat.format(time) : 'Не указано'
}

function duration(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000)
  if (!minutes) return 'менее минуты'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes / 60) % 24
  return days
    ? `${days} д. ${hours} ч.`
    : `${hours ? `${hours} ч. ` : ''}${minutes % 60} мин.`
}

export function remainingTime(
  deadline: string | null | undefined,
  now: number
) {
  const time = Date.parse(deadline ?? '')
  if (!Number.isFinite(time)) return undefined
  return time <= now
    ? `Просрочено на ${duration(now - time)}`
    : `Осталось ${duration(time - now)}`
}
