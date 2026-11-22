import { useCallback, useState } from 'react'

const STORAGE_KEY = 'relay-watch-ids'

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

export function useWatchlist() {
  const [ids, setIds] = useState<string[]>(readIds)

  const setWatched = useCallback((id: string, enabled?: boolean) => {
    setIds((current) => {
      const previouslyWatched = current.includes(id)
      const shouldWatch = enabled ?? !previouslyWatched
      if (previouslyWatched === shouldWatch) return current
      const next = previouslyWatched
        ? current.filter((item) => item !== id)
        : [...current, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const toggle = useCallback((id: string) => setWatched(id), [setWatched])

  const isWatched = useCallback((id: string) => ids.includes(id), [ids])

  return { ids, toggle, setWatched, isWatched, watched: new Set(ids) }
}
