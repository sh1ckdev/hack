import { describe, expect, it } from 'vitest'
import { buildHandoverText, productBursts, slaRiskCounts } from './ops'
import type { DashboardSnapshot, Incident } from './model'

const base: Incident = {
  id: 'A',
  stateEnum: 'WorkInProgress',
  productName: 'Сервис X',
  deadline: new Date(Date.now() + 3_600_000).toISOString(),
}

describe('ops', () => {
  it('counts overdue and soon SLA for active incidents', () => {
    const now = Date.now()
    const overdue: Incident = {
      ...base,
      id: 'O',
      deadline: new Date(now - 60_000).toISOString(),
    }
    const soon: Incident = {
      ...base,
      id: 'S',
      deadline: new Date(now + 30 * 60_000).toISOString(),
    }
    const resolved: Incident = { ...overdue, id: 'R', stateEnum: 'Resolved' }
    expect(slaRiskCounts([overdue, soon, resolved], now)).toEqual({
      overdue: 1,
      dueSoon: 1,
    })
  })

  it('detects product bursts for active incidents', () => {
    const list = [
      { ...base, id: '1' },
      { ...base, id: '2', productName: 'Сервис X' },
      { ...base, id: '3', productName: 'Другой' },
    ]
    const bursts = productBursts(list)
    expect(bursts).toHaveLength(1)
    expect(bursts[0]).toMatchObject({ product: 'Сервис X', count: 2 })
  })

  it('builds handover text with critical line', () => {
    const critical = {
      ...base,
      id: 'CRIT',
      priorityId: 4,
      assignedEmployee: 'Иван',
    }
    const snapshot: DashboardSnapshot = {
      runId: 'r',
      version: 1,
      source: { state: 'ok', lastReadAt: new Date().toISOString() },
      incidents: [
        {
          ...critical,
          revision: '1',
          groups: ['critical'],
        },
      ],
      events: [
        {
          seq: 1,
          incidentId: 'CRIT',
          product: 'Сервис X',
          reasons: ['newCritical'],
          observedAt: new Date().toISOString(),
        },
      ],
    }
    const text = buildHandoverText(snapshot, Date.now())
    expect(text).toContain('Критических в работе: 1')
    expect(text).toContain('CRIT')
    expect(text).toContain('Новый критический инцидент')
  })
})