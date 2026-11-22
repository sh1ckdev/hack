import {
  incidentGroups,
  isActive,
  isActiveCritical,
  type DashboardSnapshot,
  type Incident,
} from './model'
import { countSlaForecasts, firstIncidentForSlaForecast } from './sla-forecast'
import { productBursts, slaRiskCounts } from './ops'

export type ShiftRiskSummary = {
  overdue: number
  dueSoon: number
  slaForecast: number
  critical: number
  coordinators: number
  multiSection: number
  unassigned: number
  productBursts: number
}

export function buildShiftRiskSummary(
  incidents: (Incident & { groups?: string[] })[],
  now: number
): ShiftRiskSummary {
  const sla = slaRiskCounts(incidents, now)
  let critical = 0
  let coordinators = 0
  let multiSection = 0
  let unassigned = 0

  const coordinatorsMatch = incidentGroups.find(
    ({ key }) => key === 'coordinators'
  )?.match

  for (const incident of incidents) {
    if (coordinatorsMatch?.(incident)) coordinators += 1
    if (!isActive(incident)) continue
    if (isActiveCritical(incident)) critical += 1
    if ((incident.groups?.length ?? 0) > 1) multiSection += 1
    if (!incident.assignedEmployee?.trim()) unassigned += 1
  }

  const forecast = countSlaForecasts(incidents, now)

  return {
    ...sla,
    slaForecast: forecast.atRisk,
    critical,
    coordinators,
    multiSection,
    unassigned,
    productBursts: productBursts(incidents).length,
  }
}

export function firstIncidentForRisk(
  incidents: (Incident & { groups?: string[] })[],
  kind: keyof ShiftRiskSummary,
  now: number
): string | undefined {
  const coordinatorsMatch = incidentGroups.find(
    ({ key }) => key === 'coordinators'
  )?.match

  for (const incident of incidents) {
    if (!isActive(incident) && kind !== 'multiSection' && kind !== 'coordinators') continue
    switch (kind) {
      case 'overdue': {
        const time = Date.parse(incident.deadline ?? '')
        if (Number.isFinite(time) && time <= now) return incident.id
        break
      }
      case 'dueSoon': {
        const time = Date.parse(incident.deadline ?? '')
        if (
          Number.isFinite(time) &&
          time > now &&
          time - now <= 2 * 60 * 60 * 1000
        )
          return incident.id
        break
      }
      case 'critical':
        if (isActiveCritical(incident)) return incident.id
        break
      case 'coordinators':
        if (coordinatorsMatch?.(incident)) return incident.id
        break
      case 'multiSection':
        if ((incident.groups?.length ?? 0) > 1) return incident.id
        break
      case 'unassigned':
        if (isActive(incident) && !incident.assignedEmployee?.trim())
          return incident.id
        break
      default:
        break
    }
  }
  if (kind === 'productBursts') {
    const burst = productBursts(incidents)[0]
    return burst?.ids[0]
  }
  if (kind === 'slaForecast') {
    return firstIncidentForSlaForecast(incidents, now)
  }
  return undefined
}

export function summarizeShiftEventsSince(
  data: DashboardSnapshot,
  anchorSeq: number | null
) {
  if (anchorSeq == null) return null
  const since = data.events.filter((e) => e.seq > anchorSeq)
  const byReason = new Map<string, number>()
  for (const event of since) {
    for (const reason of event.reasons) {
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1)
    }
  }
  return { total: since.length, byReason: [...byReason.entries()] }
}