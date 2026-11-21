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

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    []
  )

  const isWatched = useCallback((id: string) => ids.includes(id), [ids])

  return { ids, toggle, isWatched, watched: new Set(ids) }
}