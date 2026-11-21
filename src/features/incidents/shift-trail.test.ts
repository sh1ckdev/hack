import { describe, expect, it } from 'vitest'
import { planShiftTrails } from './shift-trail'

describe('planShiftTrails', () => {
  it('plans critical escalation from high', () => {
    const before = new Map([['INC-A', ['high']]])
    const incidents = [
      {
        id: 'INC-A',
        groups: ['critical', 'high'],
        productName: 'Биллинг',
      },
    ] as never[]
    const fresh = [
      {
        incidentId: 'INC-A',
        product: 'Биллинг',
        reasons: ['enteredCritical'],
      },
    ] as never[]
    const trails = planShiftTrails(before, incidents, fresh)
    expect(trails).toHaveLength(1)
    expect(trails[0]).toMatchObject({
      incidentId: 'INC-A',
      fromLane: 'high',
      toLane: 'critical',
    })
  })

  it('plans coordinator assignment', () => {
    const before = new Map([['INC-B', ['high']]])
    const incidents = [
      {
        id: 'INC-B',
        groups: ['high', 'coordinators'],
        productName: 'Тест',
      },
    ] as never[]
    const fresh = [
      {
        incidentId: 'INC-B',
        reasons: ['assignedToCoordinators'],
      },
    ] as never[]
    const trails = planShiftTrails(before, incidents, fresh)
    expect(trails.some((t) => t.toLane === 'coordinators')).toBe(true)
  })
})