import { useNow } from './use-now'

export function WallClock() {
  const now = useNow(30_000)
  const label = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)
  return (
    <time
      dateTime={new Date(now).toISOString()}
      className='shrink-0 text-2xl font-medium tabular-nums leading-none text-foreground'
    >
      {label}
    </time>
  )
}
