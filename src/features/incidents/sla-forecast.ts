import {
  isActive,
  isActiveCritical,
  type Incident,
} from './model'
import { SLA_SOON_MS } from './ops'

/** Окно «следить заранее» для критических без исполнителя. */
export const SLA_WATCH_MS = 6 * 60 * 60 * 1000

export type SlaForecastLevel = 'breached' | 'high' | 'medium'

export type SlaForecast = {
  level: SlaForecastLevel
  label: string
  detail: string
  reasons: string[]
}

/** Прогноз срыва SLA по полям выгрузки (не ML). */
export function buildSlaForecast(
  incident: Incident,
  now: number
): SlaForecast | null {
  if (!isActive(incident)) return null
  const time = Date.parse(incident.deadline ?? '')
  if (!Number.isFinite(time)) return null

  const unassigned = !incident.assignedEmployee?.trim()
  const critical = isActiveCritical(incident)
  const msLeft = time - now

  if (msLeft <= 0) {
    return {
      level: 'breached',
      label: 'Срок сорван',
      detail: 'Дедлайн уже прошёл.',
      reasons: ['Срок прошёл'],
    }
  }

  const dueSoon = msLeft <= SLA_SOON_MS
  const reasons: string[] = []

  if (dueSoon) {
    reasons.push('До срока менее 2 ч')
    if (unassigned) reasons.push('Нет исполнителя')
    if (critical) reasons.push('Критический приоритет')
    const high = unassigned || critical
    return {
      level: high ? 'high' : 'medium',
      label: high ? 'Высокий риск срыва' : 'Возможен срыв срока',
      detail: `Основания: ${reasons.join('; ')}.`,
      reasons,
    }
  }

  if (critical && unassigned && msLeft <= SLA_WATCH_MS) {
    reasons.push('Критический приоритет', 'Нет исполнителя', 'До срока менее 6 ч')
    return {
      level: 'medium',
      label: 'Риск нарастает',
      detail: `Основания: ${reasons.join('; ')}.`,
      reasons,
    }
  }

  return null
}

export function countSlaForecasts(
  incidents: Incident[],
  now: number
): { high: number; medium: number; atRisk: number } {
  let high = 0
  let medium = 0
  for (const incident of incidents) {
    const forecast = buildSlaForecast(incident, now)
    if (forecast?.level === 'high') high += 1
    else if (forecast?.level === 'medium') medium += 1
  }
  return { high, medium, atRisk: high + medium }
}

export function firstIncidentForSlaForecast(
  incidents: Incident[],
  now: number
): string | undefined {
  for (const level of ['high', 'medium'] as const) {
    for (const incident of incidents) {
      const forecast = buildSlaForecast(incident, now)
      if (forecast?.level === level) return incident.id
    }
  }
  return undefined
}