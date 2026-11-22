import { coordinatorGroupName, type DashboardSnapshot } from './model'

export function transferHistory(data: DashboardSnapshot) {
  const byIncident = new Map<string, { at: string; detail: string }[]>()
  for (const event of data.events) {
    const teamChange = event.detail?.match(/Команда: (.*?) → (.*?)(?: ·|$)/)
    if (!teamChange) continue
    const [, from, to] = teamChange
    if (to === coordinatorGroupName || from === coordinatorGroupName) {
      const rows = byIncident.get(event.incidentId) ?? []
      rows.push({ at: event.observedAt, detail: from + ' → ' + to })
      byIncident.set(event.incidentId, rows)
    }
  }
  return [...byIncident.entries()]
    .map(([incidentId, events]) => ({
      incidentId,
      events,
      count: events.length,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.events[b.events.length - 1].at.localeCompare(
          a.events[a.events.length - 1].at
        )
    )
}

export function waitingOnCoordinators(
  data: DashboardSnapshot,
  now: number,
  minutes = 10
) {
  return data.incidents.flatMap((incident) => {
    if (!incident.groups.includes('coordinators')) return []
    const latest = [...data.events]
      .reverse()
      .find(
        (event) =>
          event.incidentId === incident.id &&
          (event.reasons.includes('assignedToCoordinators') ||
            event.reasons.includes('assignmentChanged')) &&
          event.detail?.includes('→ ' + coordinatorGroupName)
      )
    const age = latest ? now - Date.parse(latest.observedAt) : NaN
    return Number.isFinite(age) && age >= minutes * 60_000
      ? [{ incident, minutes: Math.floor(age / 60_000) }]
      : []
  })
}
