import { memo, useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { PRIORITY_BURST_EVENT } from './shift-calm'
import { filterEventsByMode } from './shift-event-notify'
import {
  eventHeadline,
  formatDate,
  remainingTime,
  type DashboardSnapshot,
} from './model'
import { useNow } from './use-now'

type Event = DashboardSnapshot['events'][number]

const EventLine = memo(function EventLine({
  event,
  onLocate,
  onOpen,
  remainingIncident,
  compact,
}: {
  event: Event
  onLocate?: () => void
  onOpen?: () => void
  remainingIncident?: DashboardSnapshot['incidents'][number]
  compact?: boolean
}) {
  const needsClock = Boolean(remainingIncident?.deadline)
  const now = useNow(1000, needsClock)
  const remaining = remainingIncident
    ? remainingTime(remainingIncident.deadline, now)
    : undefined
  const headline = eventHeadline(event.reasons)
  const title = (
    <span className='font-medium text-foreground'>{event.product}</span>
  )

  return (
    <div className='min-w-0 space-y-1.5'>
      <div className='flex items-start justify-between gap-3'>
        <p className='min-w-0 flex-1 text-sm leading-snug break-words'>
          {compact && onOpen ? (
            <button
              type='button'
              className='text-start hover:underline focus-visible:outline-2 focus-visible:outline-ring'
              onClick={onOpen}
            >
              {title}
              <span className='font-normal text-muted-foreground'>
                {' '}
                — {headline}
              </span>
            </button>
          ) : (
            <>
              {title}
              <span className='text-muted-foreground'> — {headline}</span>
            </>
          )}
        </p>
        <time
          dateTime={event.observedAt}
          className='shrink-0 text-end text-xs leading-tight text-muted-foreground break-words tabular-nums'
        >
          {formatDate(event.observedAt)}
        </time>
      </div>
      {event.detail && (
        <p className='text-sm leading-snug text-muted-foreground break-words'>
          {event.detail}
        </p>
      )}
      <p className='font-mono text-xs leading-snug break-all'>
        {onLocate ? (
          <button
            type='button'
            className='text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring'
            onClick={onLocate}
            aria-label={`Найти ${event.incidentId} в очереди`}
          >
            {event.incidentId}
          </button>
        ) : onOpen ? (
          <button
            type='button'
            className='text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring'
            onClick={onOpen}
          >
            {event.incidentId}
          </button>
        ) : (
          event.incidentId
        )}
        {remaining && (
          <span className='font-sans text-destructive'> · {remaining}</span>
        )}
        {event.deadline && !remaining && (
          <span className='font-sans text-muted-foreground'>
            {' '}
            · {formatDate(event.deadline)}
          </span>
        )}
      </p>
    </div>
  )
})

type FeedFilter = 'all' | 'priority' | 'critical'

export const ShiftFeed = memo(
  function ShiftFeed({
    events,
    journalAtCap,
    journalCap,
    onOpenIncident,
    className,
  }: {
    events: DashboardSnapshot['events']
    signature: string
    journalAtCap?: boolean
    journalCap?: number
    onOpenIncident: (id: string) => void
    className?: string
  }) {
    const [feedFilter, setFeedFilter] = useState<FeedFilter>('priority')

    useEffect(() => {
      const focusPriority = () => setFeedFilter('priority')
      window.addEventListener(PRIORITY_BURST_EVENT, focusPriority)
      return () =>
        window.removeEventListener(PRIORITY_BURST_EVENT, focusPriority)
    }, [])
    const filteredEvents = useMemo(
      () => filterEventsByMode(events, feedFilter),
      [events, feedFilter]
    )
    return (
      <aside
        className={cn(
          'dash-panel flex min-h-0 min-w-0 flex-col overflow-hidden',
          className
        )}
        aria-label='Лента смены'
      >
        <div className='dash-section-head px-3'>
          <h2 className='granat-title text-base'>
            Лента
          </h2>
        </div>
        <div className='flex min-h-0 flex-1 flex-col p-3'>
          <EventsJournal
            events={filteredEvents}
            totalCount={events.length}
            filter={feedFilter}
            onFilterChange={setFeedFilter}
            journalAtCap={journalAtCap}
            journalCap={journalCap}
            onOpenIncident={onOpenIncident}
          />
        </div>
      </aside>
    )
  },
  (left, right) => left.signature === right.signature
)

const feedFilterOptions: { key: FeedFilter; label: string }[] = [
  { key: 'priority', label: 'Важное' },
  { key: 'all', label: 'Все' },
]

const EventsJournal = memo(
  function EventsJournal({
    events,
    totalCount,
    filter,
    onFilterChange,
    journalAtCap,
    journalCap,
    onOpenIncident,
  }: {
    events: DashboardSnapshot['events']
    totalCount: number
    filter: FeedFilter
    onFilterChange: (mode: FeedFilter) => void
    journalAtCap?: boolean
    journalCap?: number
    onOpenIncident: (id: string) => void
  }) {
  return (
    <div className='dash-well flex min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='space-y-2 border-b border-border/60 px-3 py-2'>
        <div className='flex items-center justify-between gap-2'>
          <span className='granat-caption text-sm'>События</span>
          {filter !== 'all' && (
            <span className='font-mono text-[10px] text-muted-foreground tabular-nums'>
              {events.length}/{totalCount}
            </span>
          )}
        </div>
        <div
          className='dash-segmented w-full'
          role='tablist'
          aria-label='Фильтр журнала'
        >
          {feedFilterOptions.map(({ key, label }) => (
            <button
              key={key}
              type='button'
              role='tab'
              aria-selected={filter === key}
              className={cn(
                'dash-segment flex-1 text-center text-[11px] font-medium',
                filter === key
                  ? 'bg-card text-foreground shadow-[var(--granat-shadow)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onFilterChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {journalAtCap && (
          <p className='text-[11px] text-amber-600 dark:text-amber-500'>
            Буфер {journalCap ?? '…'} — старые события уходят.
          </p>
        )}
      </div>
      <ol className='min-h-0 flex-1 overflow-y-auto'>
        {events.length ? (
          [...events].reverse().map((event) => (
            <li
              className='granat-cell border-b border-border px-3 py-3 last:border-0 sm:px-4'
              key={event.seq}
            >
              <EventLine
                event={event}
                compact
                onOpen={() => onOpenIncident(event.incidentId)}
              />
            </li>
          ))
        ) : (
          <li className='px-3 py-4 text-sm text-muted-foreground'>Пусто</li>
        )}
      </ol>
    </div>
  )
  },
  (left, right) =>
    left.events.length === right.events.length &&
    left.events[left.events.length - 1]?.seq ===
      right.events[right.events.length - 1]?.seq &&
    left.filter === right.filter &&
    left.journalAtCap === right.journalAtCap
)