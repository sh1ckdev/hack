import { useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { DashboardSnapshot } from './model'

export type CardLinkFocus = {
  incidentId: string
  fromCardId: string
}

type Segment = { x1: number; y1: number; x2: number; y2: number }

function cardAnchor(el: HTMLElement): { x: number; y: number } | null {
  const rect = el.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

function laneAnchor(
  scroller: HTMLElement,
  laneKey: string
): { x: number; y: number } | null {
  const lane = scroller.querySelector<HTMLElement>(
    `[data-queue-lane="${laneKey}"]`
  )
  if (!lane) return null
  const rect = lane.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + Math.min(120, rect.height * 0.22),
  }
}

function cardIdForLane(groupKey: string, incidentId: string) {
  return `incident-${groupKey}-${incidentId}`
}

export function measureLinkedCardSegments(
  focus: CardLinkFocus,
  incident: DashboardSnapshot['incidents'][number] | undefined,
  scroller: HTMLElement | null
): Segment[] {
  if (typeof document === 'undefined') return []

  const from = document.getElementById(focus.fromCardId)
  if (!from) return []

  const start = cardAnchor(from)
  if (!start) return []

  const copies = [
    ...document.querySelectorAll<HTMLElement>(
      `[data-incident-id="${CSS.escape(focus.incidentId)}"]`
    ),
  ]

  const groups =
    incident?.groups && incident.groups.length > 1
      ? incident.groups
      : undefined

  const endpoints: { x: number; y: number }[] = []
  const seen = new Set<string>()

  const pushEndpoint = (pt: { x: number; y: number } | null) => {
    if (!pt) return
    const bucket = `${Math.round(pt.x)}:${Math.round(pt.y)}`
    if (seen.has(bucket)) return
    seen.add(bucket)
    endpoints.push(pt)
  }

  if (groups) {
    for (const groupKey of groups) {
      if (from.id === cardIdForLane(groupKey, focus.incidentId)) continue
      const card = copies.find(
        (el) => el.id === cardIdForLane(groupKey, focus.incidentId)
      )
      const onCard = card ? cardAnchor(card) : null
      pushEndpoint(
        onCard ?? (scroller ? laneAnchor(scroller, groupKey) : null)
      )
    }
  } else {
    for (const el of copies) {
      if (el === from) continue
      pushEndpoint(cardAnchor(el))
    }
  }

  if (!endpoints.length) return []

  return endpoints.map((end) => ({
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
  }))
}

function ConnectorSegment({ x1, y1, x2, y2 }: Segment) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  if (length < 2) return null
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return (
    <>
      <div
        className='linked-cards-connector absolute h-[3px] rounded-full'
        style={{
          left: x1,
          top: y1,
          width: length,
          transform: `translateY(-50%) rotate(${angle}deg)`,
          transformOrigin: '0 50%',
          background: '#ff0032',
        }}
      />
      <div
        className='absolute size-2 rounded-full bg-[#ff0032]'
        style={{ left: x1, top: y1, transform: 'translate(-50%, -50%)' }}
      />
      <div
        className='absolute size-2 rounded-full bg-[#ff0032]'
        style={{ left: x2, top: y2, transform: 'translate(-50%, -50%)' }}
      />
    </>
  )
}

export function LinkedCardsOverlay({
  focus,
  incident,
  scrollerRef,
  linkedIncidentId,
}: {
  focus: CardLinkFocus | null
  incident?: DashboardSnapshot['incidents'][number]
  scrollerRef: RefObject<HTMLDivElement | null>
  linkedIncidentId: string | null
}) {
  const [segments, setSegments] = useState<Segment[]>([])

  useLayoutEffect(() => {
    if (!focus) {
      setSegments([])
      return
    }

    const update = () => {
      const scroller = scrollerRef.current
      setSegments(
        measureLinkedCardSegments(focus, incident, scroller)
      )
    }

    update()
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(update)
    })

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const scroller = scrollerRef.current
    scroller?.addEventListener('scroll', update)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      scroller?.removeEventListener('scroll', update)
    }
  }, [focus, incident, scrollerRef, linkedIncidentId])

  if (!focus || !segments.length) return null

  return createPortal(
    <div
      className='linked-cards-overlay pointer-events-none fixed inset-0 z-[200] overflow-visible'
      aria-hidden
    >
      {segments.map((seg, index) => (
        <ConnectorSegment key={`${focus.incidentId}-${index}`} {...seg} />
      ))}
    </div>,
    document.body
  )
}