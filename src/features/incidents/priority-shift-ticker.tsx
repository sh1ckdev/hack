import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { eventHeadline, type DashboardSnapshot } from './model'
import { isPriorityShiftEvent } from './shift-event-notify'

const TICKER_LIMIT = 8

export const PriorityShiftTicker = memo(function PriorityShiftTicker({
  events,
  signature,
  onOpen,
  className,
}: {
  events: DashboardSnapshot['events']
  signature: string
  onOpen: (id: string) => void
  className?: string
}) {
  const items = useMemo(() => {
    const rows: DashboardSnapshot['events'] = []
    for (let i = events.length - 1; i >= 0 && rows.length < TICKER_LIMIT; i--) {
      const event = events[i]
      if (event && isPriorityShiftEvent(event.reasons)) rows.push(event)
    }
    return rows
  }, [events])

  if (!items.length) return null

  return (
    <div
      className={cn(
        'shrink-0 border-b border-border/60 bg-gradient-to-r from-muted/40 via-card/50 to-muted/30 px-4 py-2.5',
        className
      )}
      data-ticker-sig={signature}
      aria-label='Последние сдвиги приоритета'
    >
      <p className='mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase'>
        Сдвиги приоритета
      </p>
      <ul className='no-scrollbar flex gap-2 overflow-x-auto pb-0.5'>
        {items.map((event) => (
          <li key={event.seq} className='shrink-0'>
            <button
              type='button'
              className='max-w-[14rem] rounded-lg border border-border/60 bg-card/95 px-2.5 py-1.5 text-left text-[11px] shadow-xs transition-colors hover:border-chart-2/30 hover:bg-accent/30'
              onClick={() => onOpen(event.incidentId)}
            >
              <span className='font-mono text-link'>{event.incidentId}</span>
              <span className='mt-0.5 block truncate text-muted-foreground'>
                {event.detail ||
                  eventHeadline(event.reasons)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
})