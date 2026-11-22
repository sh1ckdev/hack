import { memo, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEFENSE_DEMO_INCIDENT_ID } from './defense-script'
import { IncidentCard } from './incident-card'
import type { DashboardSnapshot } from './model'

const LANE_PREVIEW = 6

const columnAccent: Record<string, string> = {
  critical: 'border-t-signal',
}

export const QueueLane = memo(
  function QueueLane({
    groupKey,
    title,
    items,
    signature: _signature,
    watchSignature: _watchSignature,
    priorityHintSignature: _priorityHintSignature,
    priorityHints,
    ready,
    highlightedIds,
    attentionKey,
    demoAttentionKey,
    isWatched,
    onToggleWatch,
    onOpenCard,
    linkedIncidentId,
    onLinkEnter,
    onLinkLeave,
    onLinkPin,
    calmMode,
    compactCard,
    previewLimit = LANE_PREVIEW,
    room = false,
  }: {
    groupKey: string
    title: string
    items: DashboardSnapshot['incidents']
    signature: string
    /** Меняется при «Следить» / «На смене», чтобы memo не глушил UI. */
    watchSignature: string
    priorityHintSignature: string
    priorityHints: Map<string, { detail: string; seq: number }>
    ready: boolean
    highlightedIds: string
    attentionKey?: number
    demoAttentionKey?: number
    isWatched: (id: string) => boolean
    onToggleWatch?: (id: string) => void
    onOpenCard: (id: string, trigger: HTMLButtonElement) => void
    linkedIncidentId: string | null
    onLinkEnter: (id: string, cardId: string) => void
    onLinkLeave: (id: string, related: EventTarget | null) => void
    onLinkPin: (id: string, cardId: string) => void
    calmMode: boolean
    compactCard: boolean
    previewLimit?: number
    room?: boolean
  }) {
    const highlightSet = new Set(
      highlightedIds ? highlightedIds.split(',').filter(Boolean) : []
    )
    const [expanded, setExpanded] = useState(false)
    const overflow = items.length > previewLimit
    const visible = useMemo(() => {
      if (expanded || !overflow) return items
      const base = items.slice(0, previewLimit)
      if (!linkedIncidentId) return base
      const linked = items.find((item) => item.id === linkedIncidentId)
      if (linked && !base.some((item) => item.id === linked.id)) {
        return [...base, linked]
      }
      return base
    }, [items, expanded, overflow, linkedIncidentId, previewLimit])

    return (
      <section
        data-queue-lane={groupKey}
        id={`queue-${groupKey}`}
        aria-labelledby={`group-${groupKey}`}
        className={cn(
          'relative flex h-full min-h-0 min-w-[17rem] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card'
        )}
      >
        {attentionKey !== undefined && (
          <span
            key={attentionKey}
            aria-hidden
            className='critical-lane-attention'
          />
        )}
        <div
          className={cn(
            'flex shrink-0 items-baseline justify-between gap-2 border-b border-border/60 px-3 py-2',
            'border-t-[3px]',
            columnAccent[groupKey] ?? 'border-t-border',
            groupKey === 'critical' && items.length > 0 && 'bg-signal/5'
          )}
        >
          <h3
            id={`group-${groupKey}`}
            className={cn(
              'flex min-w-0 items-center gap-1.5 granat-title wrap-anywhere',
              room ? 'text-xl' : 'text-sm'
            )}
          >
            {groupKey === 'critical' && (
              <span
                className='size-1.5 shrink-0 rounded-full bg-signal'
                aria-hidden
              />
            )}
            {title}
          </h3>
          <Badge
            variant='outline'
            className={cn(
              'justify-center rounded-full border-border/60 bg-card/90 px-2 tabular-nums',
              room ? 'h-7 min-w-7 text-sm' : 'h-5 min-w-5 text-[10px]'
            )}
          >
            {ready ? items.length : '—'}
          </Badge>
        </div>
        <div
          data-queue-cards
          className='no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-y-contain p-2.5'
        >
          {visible.map((incident) => (
            <IncidentCard
              key={`${groupKey}-${incident.id}`}
              incident={incident}
              demoAttentionKey={
                incident.id === DEFENSE_DEMO_INCIDENT_ID
                  ? demoAttentionKey
                  : undefined
              }
              cardId={`incident-${groupKey}-${incident.id}`}
              highlighted={highlightSet.has(incident.id)}
              linked={linkedIncidentId === incident.id}
              watched={isWatched(incident.id)}
              priorityShiftHint={
                !calmMode ||
                isWatched(incident.id) ||
                highlightSet.has(incident.id)
                  ? priorityHints.get(incident.id)?.detail
                  : undefined
              }
              compact={compactCard}
              room={room}
              onToggleWatch={
                onToggleWatch ? () => onToggleWatch(incident.id) : undefined
              }
              onOpen={(trigger) => onOpenCard(incident.id, trigger)}
              onLinkEnter={
                (incident.groups?.length ?? 0) > 1
                  ? () =>
                      onLinkEnter(
                        incident.id,
                        `incident-${groupKey}-${incident.id}`
                      )
                  : undefined
              }
              onLinkLeave={
                (incident.groups?.length ?? 0) > 1
                  ? (related) => onLinkLeave(incident.id, related)
                  : undefined
              }
              onLinkPin={
                (incident.groups?.length ?? 0) > 1
                  ? () =>
                      onLinkPin(
                        incident.id,
                        `incident-${groupKey}-${incident.id}`
                      )
                  : undefined
              }
            />
          ))}
          {!items.length && (
            <p className='rounded-sm border border-dashed border-border bg-card/80 px-3 py-8 text-center text-sm text-muted-foreground'>
              {ready ? 'Пусто' : 'Ожидаем данные'}
            </p>
          )}
        </div>
        {overflow && (
          <div className='shrink-0 border-t border-border/60 px-2.5 py-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-8 w-full text-xs font-normal'
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Свернуть' : `Показать все (${items.length})`}
            </Button>
          </div>
        )}
      </section>
    )
  },
  (left, right) =>
    left.signature === right.signature &&
    left.watchSignature === right.watchSignature &&
    left.priorityHintSignature === right.priorityHintSignature &&
    left.ready === right.ready &&
    left.highlightedIds === right.highlightedIds &&
    left.attentionKey === right.attentionKey &&
    left.demoAttentionKey === right.demoAttentionKey &&
    left.title === right.title &&
    left.groupKey === right.groupKey &&
    left.calmMode === right.calmMode &&
    left.compactCard === right.compactCard &&
    left.previewLimit === right.previewLimit &&
    left.room === right.room &&
    left.linkedIncidentId === right.linkedIncidentId
)
