import { useCallback, useState } from 'react'
import {
  countActiveIncidentFilters,
  defaultIncidentFilterPrefs,
  readIncidentFilterPrefs,
  writeIncidentFilterPrefs,
  type IncidentFilterPrefs,
} from './incident-filters'

export function useIncidentFilters() {
  const [prefs, setPrefsState] = useState<IncidentFilterPrefs>(() =>
    readIncidentFilterPrefs()
  )

  const setPrefs = useCallback((patch: Partial<IncidentFilterPrefs>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch }
      writeIncidentFilterPrefs(next)
      return next
    })
  }, [])

  const replacePrefs = useCallback((next: IncidentFilterPrefs) => {
    setPrefsState(next)
    writeIncidentFilterPrefs(next)
  }, [])

  const reset = useCallback(() => {
    const next = defaultIncidentFilterPrefs()
    replacePrefs(next)
  }, [replacePrefs])

  const activeCount = countActiveIncidentFilters(prefs)

  return { prefs, setPrefs, replacePrefs, reset, activeCount }
}