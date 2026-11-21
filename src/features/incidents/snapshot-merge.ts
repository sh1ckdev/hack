import type { DashboardSnapshot } from './model'

/** Не дёргаем React, если сервер отдал тот же логический снимок. */
export function mergeDashboardSnapshot(
  previous: DashboardSnapshot | undefined,
  next: DashboardSnapshot
): DashboardSnapshot {
  if (!previous) return next
  if (previous.runId !== next.runId) return next
  if (
    previous.version === next.version &&
    previous.source.state === next.source.state &&
    previous.events.length === next.events.length &&
    previous.incidents.length === next.incidents.length
  ) {
    const sameRevisions = previous.incidents.every(
      (item, index) => item.revision === next.incidents[index]?.revision
    )
    if (sameRevisions) {
      if (
        previous.source.lastReadAt !== next.source.lastReadAt ||
        previous.source.state !== next.source.state
      ) {
        return { ...previous, source: next.source }
      }
      return previous
    }
  }

  const byId = new Map(previous.incidents.map((item) => [item.id, item]))
  const incidents = next.incidents.map((item) => {
    const kept = byId.get(item.id)
    return kept && kept.revision === item.revision ? kept : item
  })

  let events = next.events
  if (
    next.events.length >= previous.events.length &&
    previous.events.every(
      (event, index) => event.seq === next.events[index]?.seq
    )
  ) {
    events = [
      ...previous.events,
      ...next.events.slice(previous.events.length),
    ]
  }

  return { ...next, incidents, events }
}