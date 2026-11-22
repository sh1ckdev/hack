import { z } from 'zod'
import { SLA_SOON_MS } from './ops'
import {
  incidentGroups,
  incidentStatus,
  isActive,
  isActiveCritical,
  isResolved,
  priorityColumnKey,
  priorityLabels,
  type DashboardSnapshot,
  type Incident,
} from './model'

export const STATE_OPTIONS = [
  { value: 'Assigned', label: 'Назначен' },
  { value: 'WorkInProgress', label: 'В работе' },
  { value: 'Research', label: 'Исследование' },
  { value: 'Resolved', label: 'Решён' },
  { value: 'Closed', label: 'Закрыт' },
  { value: '__other__', label: 'Прочие статусы' },
] as const

export const PRIORITY_OPTIONS = (
  [4, 3, 2, 1] as const
).map((id) => ({
  value: String(id) as '1' | '2' | '3' | '4',
  label: priorityLabels[id],
}))

export const SORT_OPTIONS = [
  { value: 'queue', label: 'Очередь (срок, просрочка)' },
  { value: 'priorityDesc', label: 'Приоритет: выше сначала' },
  { value: 'priorityAsc', label: 'Приоритет: ниже сначала' },
  { value: 'submitDesc', label: 'Регистрация: новые' },
  { value: 'submitAsc', label: 'Регистрация: старые' },
  { value: 'deadlineAsc', label: 'Срок: ближайшие' },
  { value: 'idAsc', label: 'Номер INC' },
] as const

export type IncidentSortMode = (typeof SORT_OPTIONS)[number]['value']
export type DeadlineFilter = 'all' | 'with' | 'without'

const prefsSchema = z.object({
  query: z.string(),
  priorities: z.array(z.union([z.literal('1'), z.literal('2'), z.literal('3'), z.literal('4'), z.literal('unknown')])),
  states: z.array(z.string()),
  queueGroups: z.array(z.string()),
  products: z.array(z.string()),
  teams: z.array(z.string()),
  services: z.array(z.string()),
  sortBy: z.enum([
    'queue',
    'priorityDesc',
    'priorityAsc',
    'submitDesc',
    'submitAsc',
    'deadlineAsc',
    'idAsc',
  ]),
  onlyActive: z.boolean(),
  hideResolved: z.boolean(),
  onlyCritical: z.boolean(),
  onlyCoordinators: z.boolean(),
  onlyWatched: z.boolean(),
  onlyOverdue: z.boolean(),
  onlyDueSoon: z.boolean(),
  unassignedEmployee: z.boolean(),
  unassignedTeam: z.boolean(),
  deadlineFilter: z.enum(['all', 'with', 'without']),
  hideEmptyColumns: z.boolean(),
})

export type IncidentFilterPrefs = z.infer<typeof prefsSchema>

const PREFS_KEY = 'relay-incident-filters-v1'

export const defaultIncidentFilterPrefs = (): IncidentFilterPrefs => ({
  query: '',
  priorities: ['4', '3', '2', '1', 'unknown'],
  states: STATE_OPTIONS.map(({ value }) => value),
  queueGroups: [],
  products: [],
  teams: [],
  services: [],
  sortBy: 'queue',
  onlyActive: false,
  hideResolved: false,
  onlyCritical: false,
  onlyCoordinators: false,
  onlyWatched: false,
  onlyOverdue: false,
  onlyDueSoon: false,
  unassignedEmployee: false,
  unassignedTeam: false,
  deadlineFilter: 'all',
  hideEmptyColumns: false,
})

export function readIncidentFilterPrefs(): IncidentFilterPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultIncidentFilterPrefs()
    return prefsSchema.parse(JSON.parse(raw))
  } catch {
    return defaultIncidentFilterPrefs()
  }
}

export function writeIncidentFilterPrefs(prefs: IncidentFilterPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

const searchFields = (incident: Incident) =>
  [
    incident.id,
    incident.sysId,
    incident.header,
    incident.productName,
    incident.service,
    incident.shortDescription,
    incident.description,
    incident.assignedEmployee,
    incident.assignedGroupName,
    incident.solution,
  ]
    .filter(Boolean)
  .join(' ')

const knownStates = new Set<string>(
  STATE_OPTIONS.map(({ value }) => value).filter((v) => v !== '__other__')
)

function stateKey(incident: Incident) {
  const raw = incident.stateEnum ?? ''
  if (!raw) return '__other__'
  if (knownStates.has(raw)) return raw
  return '__other__'
}

function priorityKey(incident: Incident) {
  const col = priorityColumnKey(incident)
  return col === 'unknown' ? 'unknown' : (col.slice(1) as '1' | '2' | '3' | '4')
}

export type FilterContext = {
  watched: Set<string>
  now: number
}

export function passesIncidentFilters(
  incident: DashboardSnapshot['incidents'][number],
  prefs: IncidentFilterPrefs,
  ctx: FilterContext
): boolean {
  if (prefs.query.trim()) {
    const needle = prefs.query.trim().toLowerCase()
    if (!searchFields(incident).toLowerCase().includes(needle)) return false
  }

  if (prefs.priorities.length < 5) {
    if (!prefs.priorities.includes(priorityKey(incident))) return false
  }

  if (prefs.states.length < STATE_OPTIONS.length) {
    if (!prefs.states.includes(stateKey(incident))) return false
  }

  if (prefs.queueGroups.length) {
    if (!prefs.queueGroups.some((key) => incident.groups.includes(key)))
      return false
  }

  if (prefs.products.length) {
    const product = incident.productName?.trim() || 'Продукт не указан'
    if (!prefs.products.includes(product)) return false
  }

  if (prefs.teams.length) {
    const team = incident.assignedGroupName?.trim() || '—'
    if (!prefs.teams.includes(team)) return false
  }

  if (prefs.services.length) {
    const service = incident.service?.trim() || '—'
    if (!prefs.services.includes(service)) return false
  }

  if (prefs.onlyActive && !isActive(incident)) return false
  if (prefs.hideResolved && isResolved(incident)) return false
  if (prefs.onlyCritical && !isActiveCritical(incident)) return false
  if (prefs.onlyCoordinators && !incident.groups.includes('coordinators'))
    return false
  if (prefs.onlyWatched && !ctx.watched.has(incident.id)) return false

  const deadline = Date.parse(incident.deadline ?? '')
  const hasDeadline = Number.isFinite(deadline)

  if (prefs.deadlineFilter === 'with' && !hasDeadline) return false
  if (prefs.deadlineFilter === 'without' && hasDeadline) return false

  if (prefs.onlyOverdue) {
    if (!isActive(incident) || !hasDeadline || deadline > ctx.now) return false
  }

  if (prefs.onlyDueSoon) {
    if (!isActive(incident) || !hasDeadline) return false
    if (deadline <= ctx.now || deadline - ctx.now > SLA_SOON_MS) return false
  }

  if (prefs.unassignedEmployee && incident.assignedEmployee?.trim())
    return false
  if (prefs.unassignedTeam && incident.assignedGroupName?.trim()) return false

  return true
}

export function filterIncidents(
  incidents: DashboardSnapshot['incidents'],
  prefs: IncidentFilterPrefs,
  ctx: FilterContext
) {
  return incidents.filter((incident) =>
    passesIncidentFilters(incident, prefs, ctx)
  )
}

function parseSubmit(incident: Incident) {
  const t = Date.parse(incident.submitDate ?? '')
  return Number.isFinite(t) ? t : 0
}

function parseDeadline(incident: Incident) {
  const t = Date.parse(incident.deadline ?? '')
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

function priorityRank(incident: Incident) {
  return incident.priorityId ?? 0
}

export function sortIncidentsForDisplay(
  incidents: DashboardSnapshot['incidents'],
  prefs: IncidentFilterPrefs,
  watched: Set<string>,
  now: number
) {
  const list = [...incidents]
  const pin = (a: DashboardSnapshot['incidents'][number], b: typeof a) =>
    (watched.has(a.id) ? 0 : 1) - (watched.has(b.id) ? 0 : 1)

  list.sort((a, b) => {
    const pinned = pin(a, b)
    if (pinned) return pinned

    switch (prefs.sortBy) {
      case 'priorityDesc':
        return (
          priorityRank(b) - priorityRank(a) ||
          compareQueue(a, b, now) ||
          a.id.localeCompare(b.id)
        )
      case 'priorityAsc':
        return (
          priorityRank(a) - priorityRank(b) ||
          compareQueue(a, b, now) ||
          a.id.localeCompare(b.id)
        )
      case 'submitDesc':
        return parseSubmit(b) - parseSubmit(a) || a.id.localeCompare(b.id)
      case 'submitAsc':
        return parseSubmit(a) - parseSubmit(b) || a.id.localeCompare(b.id)
      case 'deadlineAsc':
        return (
          parseDeadline(a) - parseDeadline(b) || a.id.localeCompare(b.id)
        )
      case 'idAsc':
        return a.id.localeCompare(b.id)
      case 'queue':
      default:
        return compareQueue(a, b, now) || a.id.localeCompare(b.id)
    }
  })
  return list
}

function compareQueue(a: Incident, b: Incident, now: number) {
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
  return rank(a) - rank(b) || deadlineMs(a) - deadlineMs(b)
}

export function incidentFilterFacets(incidents: DashboardSnapshot['incidents']) {
  const products = new Set<string>()
  const teams = new Set<string>()
  const services = new Set<string>()
  const statusLabels = new Map<string, string>()

  for (const incident of incidents) {
    products.add(incident.productName?.trim() || 'Продукт не указан')
    teams.add(incident.assignedGroupName?.trim() || '—')
    services.add(incident.service?.trim() || '—')
    const key = stateKey(incident)
    if (!statusLabels.has(key)) {
      statusLabels.set(
        key,
        key === '__other__'
          ? incidentStatus(incident)
          : STATE_OPTIONS.find((s) => s.value === key)?.label ?? key
      )
    }
  }

  const sortRu = (a: string, b: string) => a.localeCompare(b, 'ru')

  return {
    products: [...products].sort(sortRu),
    teams: [...teams].sort(sortRu),
    services: [...services].sort(sortRu),
    statusLabels,
    queueGroups: incidentGroups.map(({ key, title }) => ({ key, title })),
  }
}

export function countActiveIncidentFilters(prefs: IncidentFilterPrefs) {
  const defaults = defaultIncidentFilterPrefs()
  let count = 0
  if (prefs.query.trim()) count += 1
  if (prefs.priorities.length < defaults.priorities.length) count += 1
  if (prefs.states.length < defaults.states.length) count += 1
  if (prefs.queueGroups.length) count += 1
  if (prefs.products.length) count += 1
  if (prefs.teams.length) count += 1
  if (prefs.services.length) count += 1
  if (prefs.sortBy !== defaults.sortBy) count += 1
  if (prefs.onlyActive) count += 1
  if (prefs.hideResolved) count += 1
  if (prefs.onlyCritical) count += 1
  if (prefs.onlyCoordinators) count += 1
  if (prefs.onlyWatched) count += 1
  if (prefs.onlyOverdue) count += 1
  if (prefs.onlyDueSoon) count += 1
  if (prefs.unassignedEmployee) count += 1
  if (prefs.unassignedTeam) count += 1
  if (prefs.deadlineFilter !== defaults.deadlineFilter) count += 1
  if (prefs.hideEmptyColumns) count += 1
  return count
}

export function filtersAreDefault(prefs: IncidentFilterPrefs) {
  return countActiveIncidentFilters(prefs) === 0
}