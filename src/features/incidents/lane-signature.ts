import type { DashboardSnapshot } from './model'

export function laneSignature(items: DashboardSnapshot['incidents']) {
  return items.map((item) => `${item.id}:${item.revision}`).join('|')
}

export function burstsSignature(
  bursts: { product: string; count: number; hasCritical: boolean }[]
) {
  return bursts
    .map((b) => `${b.product}:${b.count}:${b.hasCritical ? 1 : 0}`)
    .join('|')
}

export function slaSignature(incidents: DashboardSnapshot['incidents']) {
  return incidents
    .filter(
      (item) =>
        item.stateEnum === 'Assigned' || item.stateEnum === 'WorkInProgress'
    )
    .map((item) => `${item.id}:${item.revision}:${item.deadline ?? ''}`)
    .join('|')
}

export function eventsSignature(events: DashboardSnapshot['events']) {
  const last = events[events.length - 1]
  return `${events.length}:${last?.seq ?? 0}:${last?.incidentId ?? ''}`
}