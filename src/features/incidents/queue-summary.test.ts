import { describe, expect, it } from 'vitest'
import { buildQueueSummary } from './queue-summary'
import type { Incident } from './model'

const now = Date.parse('2026-11-21T15:00:00Z')

function incident(patch: Partial<Incident> & Pick<Incident, 'id'>): Incident {
  return {
    stateEnum: 'Assigned',
    priorityId: 3,
    productName: 'Автопросматриватель TicTok',
    deadline: '2026-11-21T18:00:00Z',
    assignedEmployee: 'Буратино (buratino)',
    ...patch,
  }
}

describe('buildQueueSummary', () => {
  it('puts an unassigned critical first and flags a high with two signals', () => {
    const summary = buildQueueSummary(
      [
        incident({
          id: 'CRIT-OPEN',
          priorityId: 4,
          assignedEmployee: null,
          deadline: '2026-11-21T20:00:00Z',
        }),
        incident({
          id: 'CRIT-SOON',
          priorityId: 4,
          deadline: '2026-11-21T12:00:00Z',
        }),
        incident({
          id: 'HIGH-RISK',
          priorityId: 3,
          assignedEmployee: null,
          deadline: '2026-11-21T15:30:00Z',
        }),
        incident({
          id: 'HIGH-QUIET',
          priorityId: 3,
          productName: 'Другой продукт',
          deadline: '2026-11-22T15:00:00Z',
        }),
      ],
      now
    )

    expect(summary.criticalCount).toBe(2)
    expect(summary.criticalUnassigned).toBe(1)
    expect(summary.nearestCritical?.id).toBe('CRIT-SOON')
    expect(summary.nearestCritical?.overdue).toBe(true)
    expect(summary.first).toMatchObject({
      id: 'CRIT-OPEN',
      why: 'Критический без исполнителя',
    })
    expect(summary.rising.map((item) => item.id)).toEqual(['HIGH-RISK'])
    expect(summary.rising[0]?.signals).toEqual(
      expect.arrayContaining(['sameProduct', 'unassigned', 'deadline', 'productLoad'])
    )
  })

  it('does not treat a single quiet high as a future critical', () => {
    const summary = buildQueueSummary(
      [
        incident({
          id: 'HIGH-QUIET',
          productName: 'Другой продукт',
          deadline: '2026-11-22T15:00:00Z',
        }),
      ],
      now
    )

    expect(summary.rising).toEqual([])
    expect(summary.first).toBeNull()
  })

  it('uses a rising high when nothing is critical', () => {
    const summary = buildQueueSummary(
      [
        incident({ id: 'A', priorityId: 3, assignedEmployee: null }),
        incident({ id: 'B', priorityId: 3, deadline: '2026-11-21T16:00:00Z' }),
      ],
      now
    )

    expect(summary.criticalCount).toBe(0)
    expect(summary.first?.why).toBe('Высокий, может стать критическим')
    expect(summary.rising.length).toBeGreaterThan(0)
  })
})