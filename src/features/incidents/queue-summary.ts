import { isActive, type Incident } from './model'
import { SLA_SOON_MS } from './ops'

export type EscalationSignal =
  | 'sameProduct'
  | 'unassigned'
  | 'deadline'
  | 'productLoad'

export const escalationSignalLabel: Record<EscalationSignal, string> = {
  sameProduct: 'тот же продукт, что у критического',
  unassigned: 'нет исполнителя',
  deadline: 'срок меньше 2 ч или прошёл',
  productLoad: 'два и больше активных по продукту',
}

export type QueueSummaryRef = {
  id: string
  product: string
}

export type RisingIncident = QueueSummaryRef & {
  signals: EscalationSignal[]
}

export type QueueSummary = {
  criticalCount: number
  criticalUnassigned: number
  nearestCritical: (QueueSummaryRef & { overdue: boolean }) | null
  rising: RisingIncident[]
  first: (QueueSummaryRef & { why: string }) | null
}

function deadlineMs(incident: Incident) {
  const time = Date.parse(incident.deadline ?? '')
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

function byDeadline(a: Incident, b: Incident) {
  return deadlineMs(a) - deadlineMs(b) || a.id.localeCompare(b.id, 'ru')
}

function productOf(incident: Incident) {
  return incident.productName?.trim() || 'Продукт не указан'
}

function refOf(incident: Incident): QueueSummaryRef {
  return { id: incident.id, product: productOf(incident) }
}

export function escalationSignals(
  incident: Incident,
  now: number,
  criticalProducts: Set<string>,
  activeByProduct: Map<string, number>
): EscalationSignal[] {
  if (!isActive(incident) || incident.priorityId !== 3) return []
  const product = incident.productName?.trim() ?? ''
  const signals: EscalationSignal[] = []
  if (product && criticalProducts.has(product)) signals.push('sameProduct')
  if (!incident.assignedEmployee?.trim()) signals.push('unassigned')
  const time = Date.parse(incident.deadline ?? '')
  if (Number.isFinite(time) && time - now <= SLA_SOON_MS) signals.push('deadline')
  if (product && (activeByProduct.get(product) ?? 0) >= 2) signals.push('productLoad')
  return signals
}

export function buildQueueSummary(
  incidents: Incident[],
  now: number
): QueueSummary {
  const active = incidents.filter(isActive)
  const criticals = active.filter((incident) => incident.priorityId === 4)
  const criticalProducts = new Set(
    criticals
      .map((incident) => incident.productName?.trim())
      .filter((product): product is string => Boolean(product))
  )
  const activeByProduct = new Map<string, number>()
  for (const incident of active) {
    const product = incident.productName?.trim()
    if (!product) continue
    activeByProduct.set(product, (activeByProduct.get(product) ?? 0) + 1)
  }

  const withDeadline = criticals
    .filter((incident) => Number.isFinite(deadlineMs(incident)) && deadlineMs(incident) !== Number.POSITIVE_INFINITY)
    .sort(byDeadline)
  const nearest = withDeadline[0]
  const nearestCritical = nearest
    ? { ...refOf(nearest), overdue: deadlineMs(nearest) <= now }
    : null

  const rising = active
    .map((incident) => ({
      incident,
      signals: escalationSignals(incident, now, criticalProducts, activeByProduct),
    }))
    .filter(({ signals }) => signals.length >= 2)
    .sort(
      (a, b) =>
        b.signals.length - a.signals.length ||
        byDeadline(a.incident, b.incident)
    )
    .map(({ incident, signals }) => ({ ...refOf(incident), signals }))

  const unassigned = criticals
    .filter((incident) => !incident.assignedEmployee?.trim())
    .sort(byDeadline)
  const firstCritical = unassigned[0] ?? [...criticals].sort(byDeadline)[0]
  const firstRising = rising[0]
  const first = firstCritical
    ? {
        ...refOf(firstCritical),
        why: unassigned[0]
          ? 'Критический без исполнителя'
          : 'Критический с ближайшим сроком',
      }
    : firstRising
      ? {
          id: firstRising.id,
          product: firstRising.product,
          why: 'Высокий, может стать критическим',
        }
      : null

  return {
    criticalCount: criticals.length,
    criticalUnassigned: unassigned.length,
    nearestCritical,
    rising,
    first,
  }
}
