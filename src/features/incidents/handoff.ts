import {
  coordinatorGroupName,
  isActive,
  type Incident,
} from './model'

export type HandoffRoute = {
  team: string
  count: number
  /** Другие активные инциденты того же продукта. */
  productActive: number
  also?: { team: string; count: number }
}

/** Куда отдать INC с координаторов: частая команда по тому же продукту. */
export function suggestHandoff(
  incident: Incident,
  all: Incident[]
): HandoffRoute | null {
  const product = incident.productName?.trim()
  if (!product) return null

  const peers = all.filter((other) => {
    if (other.id === incident.id) return false
    if (other.productName?.trim() !== product) return false
    return isActive(other)
  })
  if (!peers.length) return null

  const counts = new Map<string, number>()
  for (const peer of peers) {
    const team = peer.assignedGroupName?.trim()
    if (!team || team === coordinatorGroupName) continue
    counts.set(team, (counts.get(team) ?? 0) + 1)
  }
  if (!counts.size) return null

  const ranked = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')
  )
  const [team, count] = ranked[0]
  const second = ranked[1]
  return {
    team,
    count,
    productActive: peers.length,
    also: second ? { team: second[0], count: second[1] } : undefined,
  }
}

export function handoffLine(route: HandoffRoute) {
  const main = `Передать в «${route.team}» — ${route.count} из ${route.productActive} активных по этому продукту уже там.`
  if (!route.also) return main
  return `${main} Ещё: «${route.also.team}» — ${route.also.count}.`
}
