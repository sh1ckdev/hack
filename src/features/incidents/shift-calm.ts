const KEY = 'relay-shift-calm'

export type ShiftCalmPrefs = {
  /** Меньше подсветок и плашек на карточках при пакетах. */
  enabled: boolean
  /** Компактные карточки в канбане. */
  compactCards: boolean
}

const defaults: ShiftCalmPrefs = {
  enabled: true,
  compactCards: false,
}

export function readShiftCalmPrefs(): ShiftCalmPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<ShiftCalmPrefs>
    return {
      enabled: parsed.enabled ?? true,
      compactCards: parsed.compactCards ?? true,
    }
  } catch {
    return defaults
  }
}

export function writeShiftCalmPrefs(prefs: ShiftCalmPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

export const PRIORITY_BURST_EVENT = 'relay-priority-burst'