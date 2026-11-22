import {
  coordinatorGroupName,
  isActive,
  isResolved,
  type Incident,
} from './model'

export function findHandoffAnalogues(incident: Incident, all: Incident[]) {
  const product = incident.productName?.trim()
  const service = incident.service?.trim()
  const words = (text: string) =>
    new Set(text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])
  const symptom = words(
    [incident.header, incident.shortDescription].filter(Boolean).join(' ')
  )
  return all
    .flatMap((candidate) => {
      const sameProduct = Boolean(
        product && product === candidate.productName?.trim()
      )
      const sameService = Boolean(
        service && service === candidate.service?.trim()
      )
      const solution = candidate.solution?.trim()
      if (
        candidate.id === incident.id ||
        (!sameProduct && !sameService) ||
        !solution ||
        (!isResolved(candidate) && !candidate.completionDate)
      )
        return []
      const candidateWords = words(
        [candidate.header, candidate.shortDescription].filter(Boolean).join(' ')
      )
      const shared = [...symptom].filter((word) =>
        candidateWords.has(word)
      ).length
      return [
        {
          candidate,
          solution,
          score:
            Number(sameService) * 4 +
            Number(sameProduct) * 2 +
            Math.min(shared, 3),
          evidence: [
            sameService && 'тот же сервис',
            sameProduct && 'тот же продукт',
            shared > 0 && 'совпадения в описании',
          ]
            .filter(Boolean)
            .join(', '),
        },
      ]
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.id.localeCompare(b.candidate.id)
    )
    .slice(0, 3)
}

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
  if (route.also?.count === route.count)
    return `Одинаково частые назначения: «${route.team}» и «${route.also.team}» (по ${route.count}). Сверьте сервис перед передачей.`
  const main = `Кандидат — «${route.team}» — ${route.count} из ${route.productActive} активных по этому продукту уже там.`
  if (!route.also) return main
  return `${main} Ещё: «${route.also.team}» — ${route.also.count}.`
}
