import { cn } from '@/lib/utils'
import { IncidentCard } from './incident-card'
import type { OperatorSeat } from './station'
import type { DashboardSnapshot } from './model'

export function MyDesk({
  className,
  login,
  seats,
  incidents,
  onLogin,
  highlighted,
  isWatched,
  onToggleWatch,
  onOpenCard,
  priorityHints,
  linkedIncidentId,
  onLinkEnter,
  onLinkLeave,
  onLinkPin,
}: {
  login: string
  seats: OperatorSeat[]
  incidents: DashboardSnapshot['incidents']
  onLogin: (login: string) => void
  highlighted: Set<string>
  isWatched: (id: string) => boolean
  onToggleWatch: (id: string) => void
  onOpenCard: (id: string, trigger: HTMLButtonElement) => void
  priorityHints: Map<string, { detail: string; seq: number }>
  linkedIncidentId: string | null
  onLinkEnter: (id: string, cardId: string) => void
  onLinkLeave: (id: string, related: EventTarget | null) => void
  onLinkPin: (id: string, cardId: string) => void
  className?: string
}) {
  const seat = seats.find((item) => item.login === login)
  return (
    <section
      className={cn(
        'dash-panel flex min-h-0 min-w-0 flex-col overflow-hidden',
        className
      )}
      aria-labelledby='my-desk-title'
    >
      <div className='dash-section-head space-y-2'>
        <div className='flex items-baseline justify-between gap-3'>
          <h2 id='my-desk-title' className='granat-title text-lg'>
            {seat ? seat.name : 'На мне'}
          </h2>
          <span className='text-sm tabular-nums text-muted-foreground'>
            {login ? incidents.length : '—'}
          </span>
        </div>
        <label className='block text-sm text-foreground'>
          <span className='sr-only'>Кто за этим компьютером</span>
          <select
            className='h-9 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring'
            value={seats.some((item) => item.login === login) ? login : ''}
            onChange={(event) => onLogin(event.target.value)}
          >
            <option value=''>Выберите себя</option>
            {seats.map((item) => (
              <option key={item.login} value={item.login}>
                {item.name} · {item.open}
              </option>
            ))}
          </select>
        </label>
        {seat && (
          <p className='text-sm text-muted-foreground'>
            {seat.open} в работе в текущем снимке
          </p>
        )}
      </div>
      <div className='no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-3'>
        {!login && (
          <p className='px-1 py-6 text-sm text-muted-foreground'>
            Выберите себя. На этом компьютере останутся ваши инциденты,
            слежение и сводка. Общий экран в зале от этого не меняется.
          </p>
        )}
        {login && !incidents.length && (
          <p className='px-1 py-6 text-sm text-muted-foreground'>
            В этом снимке на вас ничего не назначено. Очереди команды справа.
          </p>
        )}
        {incidents.map((incident) => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            cardId={`incident-mine-${incident.id}`}
            highlighted={highlighted.has(incident.id)}
            linked={linkedIncidentId === incident.id}
            watched={isWatched(incident.id)}
            priorityShiftHint={priorityHints.get(incident.id)?.detail}
            onToggleWatch={() => onToggleWatch(incident.id)}
            onOpen={(trigger) => onOpenCard(incident.id, trigger)}
            onLinkEnter={
              (incident.groups?.length ?? 0) > 1
                ? () =>
                    onLinkEnter(incident.id, `incident-mine-${incident.id}`)
                : undefined
            }
            onLinkLeave={
              (incident.groups?.length ?? 0) > 1
                ? (related) => onLinkLeave(incident.id, related)
                : undefined
            }
            onLinkPin={
              (incident.groups?.length ?? 0) > 1
                ? () => onLinkPin(incident.id, `incident-mine-${incident.id}`)
                : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}
