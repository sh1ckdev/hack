import { describe, expect, it } from 'vitest'
import {
  defaultIncidentFilterPrefs,
  filterIncidents,
  passesIncidentFilters,
  sortIncidentsForDisplay,
} from './incident-filters'
import type { DashboardSnapshot } from './model'

const base: DashboardSnapshot['incidents'][number] = {
  id: 'INC001',
  revision: 'a',
  groups: ['high'],
  priorityId: 3,
  stateEnum: 'Assigned',
  productName: 'VPN',
  assignedGroupName: 'ОГЭ',
  assignedEmployee: 'Иванов',
  deadline: '2026-11-22T12:00:00Z',
  submitDate: '2026-11-20T10:00:00Z',
}

describe('incident filters', () => {
  const now = Date.parse('2026-11-21T12:00:00Z')
  const ctx = { watched: new Set(['INC002']), now }

  it('matches by query and priority', () => {
    const prefs = {
      ...defaultIncidentFilterPrefs(),
      query: 'vpn',
      priorities: ['3'],
    }
    expect(passesIncidentFilters(base, prefs, ctx)).toBe(true)
    expect(
      passesIncidentFilters(
        { ...base, productName: 'Other' },
        prefs,
        ctx
      )
    ).toBe(false)
    expect(passesIncidentFilters({ ...base, priorityId: 2 }, prefs, ctx)).toBe(
      false
    )
  })

  it('filters active and watched', () => {
    const watchedOnly = { ...defaultIncidentFilterPrefs(), onlyWatched: true }
    expect(
      passesIncidentFilters(
        { ...base, id: 'INC002', groups: [] },
        watchedOnly,
        ctx
      )
    ).toBe(true)
    expect(passesIncidentFilters(base, watchedOnly, ctx)).toBe(false)

    const activeOnly = { ...defaultIncidentFilterPrefs(), onlyActive: true }
    expect(passesIncidentFilters(base, activeOnly, ctx)).toBe(true)
    expect(
      passesIncidentFilters(
        { ...base, stateEnum: 'Resolved' },
        activeOnly,
        ctx
      )
    ).toBe(false)
  })

  it('filters overdue incidents', () => {
    const prefs = { ...defaultIncidentFilterPrefs(), onlyOverdue: true }
    expect(
      passesIncidentFilters(
        { ...base, deadline: '2026-11-20T08:00:00Z' },
        prefs,
        ctx
      )
    ).toBe(true)
    expect(passesIncidentFilters(base, prefs, ctx)).toBe(false)
  })

  it('sorts by priority descending', () => {
    const prefs = {
      ...defaultIncidentFilterPrefs(),
      sortBy: 'priorityDesc' as const,
    }
    const list = sortIncidentsForDisplay(
      [
        { ...base, id: 'A', priorityId: 1 },
        { ...base, id: 'B', priorityId: 4 },
        { ...base, id: 'C', priorityId: 3 },
      ],
      prefs,
      new Set(),
      now
    )
    expect(list.map((i) => i.id)).toEqual(['B', 'C', 'A'])
  })

  it('filterIncidents returns subset', () => {
    const prefs = { ...defaultIncidentFilterPrefs(), hideResolved: true }
    const rows = filterIncidents(
      [
        base,
        { ...base, id: 'INC002', stateEnum: 'Resolved', groups: [] },
      ],
      prefs,
      ctx
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('INC001')
  })
})