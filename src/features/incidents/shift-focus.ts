import type { IncidentFilterPrefs } from './incident-filters'

/** Пресет «фокус смены» — меньше шума, приоритет очереди и активные. */
export function shiftFocusFilterPatch(): Partial<IncidentFilterPrefs> {
  return {
    onlyActive: true,
    hideResolved: true,
    sortBy: 'queue',
    hideEmptyColumns: false,
  }
}

export function isShiftFocusActive(prefs: IncidentFilterPrefs) {
  return prefs.onlyActive && prefs.hideResolved && prefs.sortBy === 'queue'
}