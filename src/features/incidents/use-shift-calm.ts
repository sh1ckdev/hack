import { useCallback, useState } from 'react'
import {
  readShiftCalmPrefs,
  writeShiftCalmPrefs,
  type ShiftCalmPrefs,
} from './shift-calm'

export function useShiftCalm() {
  const [prefs, setPrefsState] = useState<ShiftCalmPrefs>(() =>
    readShiftCalmPrefs()
  )

  const setPrefs = useCallback((patch: Partial<ShiftCalmPrefs>) => {
    setPrefsState((current) => {
      const next = { ...current, ...patch }
      writeShiftCalmPrefs(next)
      return next
    })
  }, [])

  const toggleEnabled = useCallback(() => {
    setPrefsState((current) => {
      const enabled = !current.enabled
      const next = {
        ...current,
        enabled,
        compactCards: enabled,
      }
      writeShiftCalmPrefs(next)
      return next
    })
  }, [])

  return { prefs, setPrefs, toggleEnabled }
}