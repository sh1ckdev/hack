import { memo } from 'react'
import { Bookmark, ExternalLink, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { incidentDestination } from './incident-destination'
import { ShiftCoordinationMark } from './shift-coordination'
import {
  formatDate,
  remainingTime,
  incidentStatus,
  isActive,
  isActiveCritical,
  isResolved,
  priorityLabel,
  type Incident,
} from './model'
import { buildSlaForecast } from './sla-forecast'
import { useNow } from './use-now'

function priorityBadgeClass(priorityId: number | null | undefined) {
  if (priorityId === 4) return 'border-signal/40 text-signal'
  return 'border-border text-muted-foreground'
}

function IncidentCardInner({
  incident,
  cardId,
  highlighted,
  linked,
  watched,
  priorityShiftHint,
  compact,
  room = false,
  onToggleWatch,
  onOpen,
  onLinkEnter,
  onLinkLeave,
  onLinkPin,
}: {
  incident: Incident & { revision: string; groups?: string[] }
  cardId: string
  highlighted?: boolean
  linked?: boolean
  watched?: boolean
  priorityShiftHint?: string
  compact?: boolean
  room?: boolean
  onToggleWatch?: () => void
  onOpen: (trigger: HTMLButtonElement) => void
  onLinkEnter?: () => void
  onLinkLeave?: (related: EventTarget | null) => void
  onLinkPin?: () => void
}) {
  const resolved = isResolved(incident)
  const active = isActive(incident)
  const needsClock = active && Boolean(incident.deadline)
  const now = useNow(1000, needsClock)
  const priority = priorityLabel(incident)
  const critical = isActiveCritical(incident)
  const deadline = incident.deadline ? Date.parse(incident.deadline) : NaN
  const hasDeadline = Number.isFinite(deadline)
  const overdue = active && hasDeadline && deadline <= now
  const { href, label } = incidentDestination(incident)
  const remaining = active ? remainingTime(incident.deadline, now) : undefined
  const slaForecast =
    active && hasDeadline ? buildSlaForecast(incident, now) : null
  const completion =
    resolved || incident.stateEnum === 'Research'
      ? formatDate(incident.completionDate)
      : 'Не указано'

  return (
    <article
      id={cardId}
      data-incident-id={incident.id}
      tabIndex={-1}
      onMouseEnter={onLinkEnter}
      onMouseLeave={(event) => onLinkLeave?.(event.relatedTarget)}
      className={cn(
        'min-w-0 scroll-mt-4 rounded-2xl border border-border bg-card transition-colors duration-150 hover:bg-[var(--color-background-hover)] focus:outline-2 focus:outline-ring',
        compact ? 'px-3.5 py-2.5' : room ? 'px-4 py-4' : 'px-4 py-3.5',
        critical &&
          'border-signal/20 bg-signal/[0.02]',
        watched && 'ring-1 ring-foreground/20',
        linked && 'z-[1] ring-1 ring-inset ring-foreground/25',
        highlighted && !critical && 'ring-1 ring-foreground/20'
      )}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 space-y-0.5'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <h3
              className={cn(
                'font-medium leading-[1.25] break-words text-foreground',
                room ? 'text-lg' : 'text-base'
              )}
            >
              {incident.productName || 'Продукт не указан'}
            </h3>
            {(incident.groups?.length ?? 0) > 1 && (
              <button
                type='button'
                className='inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring'
                title='Один INC в нескольких секциях — наведите или нажмите, чтобы показать линию'
                onClick={(event) => {
                  event.stopPropagation()
                  onLinkPin?.()
                }}
              >
                <Link2 aria-hidden className='size-3' />
                Связь
              </button>
            )}
          </div>
          <a
            className='inline-flex items-center gap-1 font-mono text-xs text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring'
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={`Открыть ${incident.id} — ${label}`}
          >
            {incident.id}
            <ExternalLink aria-hidden='true' className='size-3' />
          </a>
        </div>
        <Badge
          variant='outline'
          className={cn(
            'max-w-[45%] shrink-0 rounded-md border px-1.5 py-0 text-[10px] font-semibold whitespace-normal',
            priorityBadgeClass(incident.priorityId)
          )}
        >
          {priority}
        </Badge>
      </div>
      {!compact && incident.header && (
        <p className='mt-1.5 text-sm wrap-anywhere text-muted-foreground'>
          {incident.header}
        </p>
      )}
      {priorityShiftHint && (
        <p
          className='mt-1.5 rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted-foreground wrap-anywhere'
          title='Недавний сдвиг приоритета'
        >
          {priorityShiftHint}
        </p>
      )}
      {slaForecast && (
        <p
          className={cn(
            'mt-1.5 rounded-sm border px-2 py-0.5 text-[11px] wrap-anywhere',
            (slaForecast.level === 'high' ||
              slaForecast.level === 'breached') &&
              'border-signal/40 text-signal',
            slaForecast.level === 'medium' &&
              'border-border text-muted-foreground'
          )}
          title={slaForecast.detail}
        >
          <span className='font-medium'>{slaForecast.label}</span>{' '}
          {slaForecast.reasons.join(' · ')}
        </p>
      )}
      <dl
        className={cn(
          'grid gap-x-3 gap-y-1.5',
          compact
            ? 'mt-1.5 grid-cols-2 text-xs'
            : 'mt-2.5 grid-cols-2 text-sm'
        )}
      >
        <div className='col-span-2'>
          <dt className='sr-only'>Статус</dt>
          <dd>
            <Badge
              variant='outline'
              className='rounded-sm border-border font-normal text-foreground'
            >
              {incidentStatus(incident)}
            </Badge>
          </dd>
        </div>
        {compact && (
          <div className='col-span-2 text-[11px] text-muted-foreground wrap-anywhere'>
            <span className='tabular-nums'>
              {formatDate(incident.submitDate)}
            </span>
            <span aria-hidden> · </span>
            <span>{incident.assignedEmployee || 'без исполнителя'}</span>
          </div>
        )}
        {!compact && (
          <>
            <div>
              <dt className='text-xs text-muted-foreground'>Исполнитель</dt>
              <dd className='wrap-anywhere'>
                {incident.assignedEmployee || '—'}
              </dd>
            </div>
            <div>
              <dt className='text-xs text-muted-foreground'>Команда</dt>
              <dd className='wrap-anywhere'>
                {incident.assignedGroupName || '—'}
              </dd>
            </div>
          </>
        )}
      </dl>
      <dl
        className={cn(
          'flex flex-wrap gap-x-3 gap-y-1 tabular-nums',
          compact
            ? 'mt-1.5 text-[11px]'
            : 'mt-2.5 gap-x-4 border-t border-border/80 pt-2 text-xs'
        )}
      >
        {!compact && (
          <div>
            <dt className='text-muted-foreground'>Регистрация</dt>
            <dd>{formatDate(incident.submitDate)}</dd>
          </div>
        )}
        <div>
          <dt className='text-muted-foreground'>Срок</dt>
          <dd>{hasDeadline ? formatDate(incident.deadline) : 'Не задан'}</dd>
        </div>
        {!compact && completion !== 'Не указано' && (
          <div>
            <dt className='text-muted-foreground'>Решение</dt>
            <dd>{completion}</dd>
          </div>
        )}
        {remaining && (
          <div
            className={cn(
              'font-medium',
              overdue ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            <dt className='sr-only'>До срока</dt>
            <dd>{remaining}</dd>
          </div>
        )}
      </dl>
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2',
          compact ? 'mt-1.5' : 'mt-2.5 border-t border-border/80 pt-2'
        )}
      >
        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            aria-haspopup='dialog'
            aria-label={`Сводка по ${incident.id}`}
            className='rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-accent'
            onClick={(event) => onOpen(event.currentTarget)}
          >
            Сводка
          </button>
          {onToggleWatch && (
            <button
              type='button'
              aria-label={
                watched ? 'Убрать из слежения' : 'Держать на смене'
              }
              aria-pressed={watched}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                watched && 'text-foreground'
              )}
              onClick={onToggleWatch}
            >
              <Bookmark
                aria-hidden='true'
                className={cn('size-3.5', watched && 'fill-current')}
              />
              {watched ? 'На смене' : 'Следить'}
            </button>
          )}
        </div>
        {label === 'Демо ITSM' && (
          <span className='text-[11px] text-muted-foreground'>демо ITSM</span>
        )}
      </div>
      <ShiftCoordinationMark id={incident.id} />
    </article>
  )
}

export const IncidentCard = memo(
  IncidentCardInner,
  (left, right) =>
    left.incident.revision === right.incident.revision &&
    left.highlighted === right.highlighted &&
    left.watched === right.watched &&
    left.priorityShiftHint === right.priorityShiftHint &&
    left.compact === right.compact &&
    left.room === right.room &&
    left.linked === right.linked &&
    left.cardId === right.cardId
)
