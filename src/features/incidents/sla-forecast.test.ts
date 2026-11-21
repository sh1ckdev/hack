import { describe, expect, it } from 'vitest'
import { buildSlaForecast, countSlaForecasts } from './sla-forecast'
import type { Incident } from './model'

const base: Incident = {
  id: 'INC1',
  stateEnum: 'WorkInProgress',
  priorityId: 3,
  deadline: null,
}

describe('buildSlaForecast', () => {
  const now = Date.parse('2026-01-01T12:00:00Z')

  it('returns null without deadline', () => {
    expect(buildSlaForecast(base, now)).toBeNull()
  })

  it('flags breached when deadline passed', () => {
    const forecast = buildSlaForecast(
      { ...base, deadline: '2025-12-31T12:00:00Z' },
      now
    )
    expect(forecast?.level).toBe('breached')
  })

  it('high risk when due soon and unassigned critical', () => {
    const forecast = buildSlaForecast(
      {
        ...base,
        priorityId: 4,
        deadline: '2026-01-01T13:00:00Z',
        assignedEmployee: '',
      },
      now
    )
    expect(forecast?.level).toBe('high')
    expect(forecast?.reasons).toContain('Критический приоритет')
  })

  it('medium when due soon with assignee', () => {
    const forecast = buildSlaForecast(
      {
        ...base,
        deadline: '2026-01-01T13:00:00Z',
        assignedEmployee: 'Иван',
      },
      now
    )
    expect(forecast?.level).toBe('medium')
  })
})

describe('countSlaForecasts', () => {
  it('counts at-risk without breached', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    const incidents = [
      {
        ...base,
        id: 'A',
        deadline: '2026-01-01T13:00:00Z',
        assignedEmployee: 'x',
      },
      {
        ...base,
        id: 'B',
        priorityId: 4,
        deadline: '2026-01-01T13:30:00Z',
      },
    ]
    const { high, medium, atRisk } = countSlaForecasts(incidents, now)
    expect(medium).toBe(1)
    expect(high).toBe(1)
    expect(atRisk).toBe(2)
  })
})