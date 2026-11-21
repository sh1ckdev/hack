import { incidentGroups, type DashboardSnapshot, type Incident } from './model'

export type ShiftTrailPlan = {
  incidentId: string
  fromLane: string
  toLane: string
  product?: string
}

const LANE_ORDER = ['critical', 'coordinators', 'high', 'research'] as const

export function laneTitle(key: string) {
  return incidentGroups.find(({ key: k }) => k === key)?.title ?? key
}

function pickFromLane(beforeGroups: string[], avoid: string) {
  for (const key of LANE_ORDER) {
    if (beforeGroups.includes(key) && key !== avoid) return key
  }
  for (const key of LANE_ORDER) {
    if (key !== avoid) return key
  }
  return 'high'
}

/** Трасса эскалации по свежим событиям и группам до обновления снимка. */
export function planShiftTrails(
  before: Map<string, string[]>,
  incidents: (Incident & { groups: string[] })[],
  fresh: DashboardSnapshot['events']
): ShiftTrailPlan[] {
  const byId = new Map(incidents.map((i) => [i.id, i]))
  const trails: ShiftTrailPlan[] = []
  const seen = new Set<string>()

  for (const event of fresh) {
    const id = event.incidentId
    const sig = `${id}:${event.reasons.join('|')}`
    if (seen.has(sig)) continue
    const prev = before.get(id) ?? []
    const incident = byId.get(id)
    const product = event.product ?? incident?.productName ?? undefined

    if (
      event.reasons.some(
        (r) => r === 'enteredCritical' || r === 'newCritical'
      )
    ) {
      trails.push({
        incidentId: id,
        fromLane: pickFromLane(prev, 'critical'),
        toLane: 'critical',
        product,
      })
      seen.add(sig)
      continue
    }

    if (event.reasons.includes('assignedToCoordinators')) {
      trails.push({
        incidentId: id,
        fromLane: pickFromLane(prev, 'coordinators'),
        toLane: 'coordinators',
        product,
      })
      seen.add(sig)
    }
  }

  return trails
}