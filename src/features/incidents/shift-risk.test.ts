import { describe, expect, it } from 'vitest'
import { buildShiftRiskSummary } from './shift-risk'

describe('buildShiftRiskSummary', () => {
  const now = Date.parse('2026-01-01T12:00:00Z')

  it('aggregates shift risks from active incidents', () => {
    const incidents = [
      {
        id: 'A',
        stateEnum: 'WorkInProgress',
        priorityId: 4,
        deadline: '2025-12-31T12:00:00Z',
        groups: ['critical', 'coordinators'],
        assignedGroupName: 'КЦ ИТ Координаторы Массовых Инцидентов',
      },
      {
        id: 'B',
        stateEnum: 'WorkInProgress',
        priorityId: 3,
        deadline: '2026-01-01T13:00:00Z',
        groups: ['high'],
        assignedEmployee: 'Иван',
      },
      {
        id: 'C',
        stateEnum: 'Resolved',
        priorityId: 4,
        groups: ['critical'],
      },
    ] as never[]

    expect(buildShiftRiskSummary(incidents, now)).toMatchObject({
      overdue: 1,
      dueSoon: 1,
      slaForecast: 1,
      critical: 1,
      coordinators: 1,
      multiSection: 1,
      unassigned: 1,
    })
  })
})