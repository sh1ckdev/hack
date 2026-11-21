import { describe, expect, it } from 'vitest'
import {
  buildRecentPriorityHints,
  filterEventsByMode,
  highlightIncidentIds,
  planFreshEventToasts,
} from './shift-event-notify'
import type { DashboardSnapshot } from './model'

const event = (
  partial: Partial<DashboardSnapshot['events'][number]> &
    Pick<DashboardSnapshot['events'][number], 'seq' | 'incidentId' | 'reasons'>
): DashboardSnapshot['events'][number] => ({
  product: 'VPN',
  deadline: null,
  detail: undefined,
  observedAt: '2026-11-21T12:00:00Z',
  ...partial,
})

describe('shift event notify', () => {
  it('aggregates burst toasts when many events land at once', () => {
    const fresh = Array.from({ length: 8 }, (_, i) =>
      event({
        seq: i + 1,
        incidentId: `INC${i}`,
        reasons: ['priorityChanged'],
        detail: 'Приоритет: Низкий → Высокий',
      })
    )
    const plan = planFreshEventToasts(fresh)
    expect(plan.mode).toBe('summary')
    if (plan.mode === 'summary') {
      expect(plan.title).toMatch(/Пакет/)
      expect(plan.description).toMatch(/приоритет: 8/)
    }
  })

  it('filters journal by priority and critical modes', () => {
    const events = [
      event({ seq: 1, incidentId: 'A', reasons: ['priorityChanged'] }),
      event({ seq: 2, incidentId: 'B', reasons: ['assignmentChanged'] }),
      event({ seq: 3, incidentId: 'C', reasons: ['enteredCritical'] }),
    ]
    expect(filterEventsByMode(events, 'priority')).toHaveLength(2)
    expect(filterEventsByMode(events, 'critical')).toHaveLength(1)
  })

  it('highlights only critical and watched when calm', () => {
    const fresh = [
      event({ seq: 1, incidentId: 'A', reasons: ['priorityChanged'] }),
      event({ seq: 2, incidentId: 'B', reasons: ['enteredCritical'] }),
      event({ seq: 3, incidentId: 'C', reasons: ['priorityChanged'] }),
    ]
    expect(
      highlightIncidentIds(fresh, new Set(['C']), true).sort()
    ).toEqual(['B', 'C'])
    expect(highlightIncidentIds(fresh, new Set(), false).sort()).toEqual([
      'A',
      'B',
      'C',
    ])
  })

  it('keeps the latest priority hint per incident', () => {
    const events = [
      event({
        seq: 1,
        incidentId: 'INC1',
        reasons: ['priorityChanged'],
        detail: 'Приоритет: Низкий → Средний',
        observedAt: '2026-11-21T11:00:00Z',
      }),
      event({
        seq: 2,
        incidentId: 'INC1',
        reasons: ['priorityChanged'],
        detail: 'Приоритет: Средний → Высокий',
        observedAt: '2026-11-21T12:00:00Z',
      }),
    ]
    const hints = buildRecentPriorityHints(
      events,
      Date.parse('2026-11-21T12:30:00Z')
    )
    expect(hints.get('INC1')?.detail).toBe(
      'Приоритет: Средний → Высокий'
    )
  })
})