import { useEffect, useState } from 'react'
import {
  readStation,
  writeStation,
  type StationMode,
  type StationPrefs,
} from './station'

export function useStation() {
  const [prefs, setPrefs] = useState<StationPrefs>(readStation)

  useEffect(() => {
    writeStation(prefs)
    document.documentElement.dataset.station = prefs.mode
  }, [prefs])

  return {
    mode: prefs.mode,
    login: prefs.login,
    setMode: (mode: StationMode) =>
      setPrefs((current) => ({ ...current, mode })),
    setLogin: (login: string) =>
      setPrefs((current) => ({ ...current, login })),
  }
}
