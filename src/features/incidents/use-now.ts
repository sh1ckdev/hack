import { useEffect, useState } from 'react'

/** Локальный тик часов — не перерисовывает весь дашборд. */
export function useNow(intervalMs: number, enabled = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled || intervalMs <= 0) return
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [enabled, intervalMs])
  return now
}