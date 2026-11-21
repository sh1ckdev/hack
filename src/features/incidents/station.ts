import { isActive, type Incident } from './model'

export type StationMode = 'wall' | 'desk'

export type StationPrefs = {
  mode: StationMode
  login: string
}

const KEY = 'relay.station'

export function readStation(): StationPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { mode: 'wall', login: '' }
    const parsed = JSON.parse(raw) as Partial<StationPrefs>
    return {
      mode: parsed.mode === 'desk' ? 'desk' : 'wall',
      login: typeof parsed.login === 'string' ? parsed.login : '',
    }
  } catch {
    return { mode: 'wall', login: '' }
  }
}

export function writeStation(prefs: StationPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

export type OperatorSeat = {
  login: string
  name: string
  open: number
}

export function operatorSeats(incidents: Incident[]): OperatorSeat[] {
  const map = new Map<string, OperatorSeat>()
  for (const incident of incidents) {
    const login = incident.assignedEmployeeLogin?.trim()
    if (!login) continue
    const row = map.get(login) ?? {
      login,
      name: incident.assignedEmployee?.trim() || login,
      open: 0,
    }
    row.name = incident.assignedEmployee?.trim() || row.name
    if (isActive(incident) || incident.stateEnum === 'Research') row.open += 1
    map.set(login, row)
  }
  return [...map.values()].sort(
    (a, b) => b.open - a.open || a.name.localeCompare(b.name, 'ru')
  )
}

export function incidentsForSeat<T extends Incident>(
  incidents: T[],
  login: string
): T[] {
  const key = login.trim()
  if (!key) return []
  return incidents
    .filter((incident) => (incident.assignedEmployeeLogin ?? '').trim() === key)
    .sort((a, b) => {
      const rank = (incident: Incident) =>
        isActive(incident) || incident.stateEnum === 'Research' ? 0 : 1
      const byRank = rank(a) - rank(b)
      if (byRank) return byRank
      const left = Date.parse(a.deadline ?? '')
      const right = Date.parse(b.deadline ?? '')
      return (
        (Number.isFinite(left) ? left : Number.POSITIVE_INFINITY) -
        (Number.isFinite(right) ? right : Number.POSITIVE_INFINITY)
      )
    })
}
