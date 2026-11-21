import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { laneTitle, type ShiftTrailPlan } from './shift-trail'

export type ActiveShiftTrail = ShiftTrailPlan & { key: number }

function laneAnchor(
  scroller: HTMLElement,
  laneKey: string
): { x: number; y: number } | null {
  const lane = scroller.querySelector<HTMLElement>(
    `[data-queue-lane="${laneKey}"]`
  )
  if (!lane) return null
  const rect = lane.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + Math.min(96, rect.height * 0.35),
  }
}

function ShiftTrailSpark({
  trail,
  scrollerRef,
  onDone,
}: {
  trail: ActiveShiftTrail
  scrollerRef: React.RefObject<HTMLDivElement | null>
  onDone: (key: number) => void
}) {
  const chipRef = useRef<HTMLDivElement>(null)
  const streakRef = useRef<SVGLineElement>(null)

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const chip = chipRef.current
    const line = streakRef.current
    if (!scroller || !chip || !line) {
      onDone(trail.key)
      return
    }

    const start = laneAnchor(scroller, trail.fromLane)
    const end = laneAnchor(scroller, trail.toLane)
    if (!start || !end) {
      onDone(trail.key)
      return
    }

    const dx = end.x - start.x
    const dy = end.y - start.y

    chip.style.left = `${start.x}px`
    chip.style.top = `${start.y}px`

    const svg = line.parentElement
    if (svg?.parentElement) {
      const box = svg.parentElement
      box.style.left = '0'
      box.style.top = '0'
      line.setAttribute('x1', String(start.x))
      line.setAttribute('y1', String(start.y))
      line.setAttribute('x2', String(start.x))
      line.setAttribute('y2', String(start.y))
    }

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (reduceMotion) {
      chip.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
      line.setAttribute('x2', String(end.x))
      line.setAttribute('y2', String(end.y))
      const t = window.setTimeout(() => onDone(trail.key), 400)
      return () => clearTimeout(t)
    }

    const chipAnim = chip.animate(
      [
        {
          transform: 'translate(-50%, -50%) scale(1)',
          opacity: 1,
          filter: 'blur(0px)',
        },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.92)`,
          opacity: 0.2,
          filter: 'blur(0.5px)',
        },
      ],
      { duration: 1_350, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    )

    const lineAnim = line.animate(
      [
        { strokeDashoffset: 1, opacity: 0.85 },
        { strokeDashoffset: 0, opacity: 0.15 },
      ],
      { duration: 1_350, easing: 'ease-out', fill: 'forwards' }
    )
    line.style.strokeDasharray = '1'
    line.style.strokeDashoffset = '1'
    line.setAttribute('x2', String(end.x))
    line.setAttribute('y2', String(end.y))

    const done = () => onDone(trail.key)
    chipAnim.onfinish = done
    lineAnim.onfinish = done

    return () => {
      chipAnim.cancel()
      lineAnim.cancel()
    }
  }, [trail, scrollerRef, onDone])

  const toCritical = trail.toLane === 'critical'

  return (
    <>
      <svg
        className='shift-trail-streak pointer-events-none fixed inset-0 z-[90] h-full w-full'
        aria-hidden
      >
        <line
          ref={streakRef}
          className={cn(
            'stroke-[2.5]',
            toCritical ? 'stroke-signal' : 'stroke-chart-2'
          )}
        />
      </svg>
      <div
        ref={chipRef}
        className={cn(
          'shift-trail-spark pointer-events-none fixed z-[91]',
          toCritical ? 'border-signal/55 ring-signal/35' : 'border-chart-2/50 ring-chart-2/30'
        )}
        role='presentation'
      >
        <p className='text-[10px] font-medium text-muted-foreground'>
          {laneTitle(trail.fromLane)} → {laneTitle(trail.toLane)}
        </p>
        <p className='truncate text-xs font-semibold text-foreground'>
          {trail.product || 'Инцидент'}
        </p>
        <p className='font-mono text-[10px] text-muted-foreground'>
          {trail.incidentId}
        </p>
      </div>
    </>
  )
}

export function ShiftTrailOverlay({
  trails,
  scrollerRef,
  onComplete,
}: {
  trails: ActiveShiftTrail[]
  scrollerRef: React.RefObject<HTMLDivElement | null>
  onComplete: (key: number) => void
}) {
  if (!trails.length) return null

  return createPortal(
    <div
      className='pointer-events-none fixed inset-0 z-[88]'
      aria-hidden={trails.length === 0}
    >
      {trails.map((trail) => (
        <ShiftTrailSpark
          key={trail.key}
          trail={trail}
          scrollerRef={scrollerRef}
          onDone={onComplete}
        />
      ))}
    </div>,
    document.body
  )
}