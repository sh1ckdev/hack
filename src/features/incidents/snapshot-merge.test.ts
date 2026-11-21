import { describe, expect, it } from 'vitest'
import type { DashboardSnapshot } from './model'
import { mergeDashboardSnapshot } from './snapshot-merge'

const base = (revision: string, version = 1): DashboardSnapshot => ({
  runId: 'run',
  version,
  source: { state: 'ok', lastReadAt: '2026-11-21T00:00:01.000Z' },
  incidents: [
    {
      id: 'A',
      revision,
      groups: ['high'],
    },
  ],
  events: [],
})

describe('mergeDashboardSnapshot', () => {
  it('reuses previous object when snapshot is logically unchanged', () => {
    const prev = base('r1', 2)
    const next = base('r1', 2)
    expect(mergeDashboardSnapshot(prev, next)).toBe(prev)
  })

  it('updates lastReadAt on heartbeat without new incident objects', () => {
    const prev = base('r1', 2)
    const next = {
      ...base('r1', 2),
      source: { state: 'ok' as const, lastReadAt: '2026-11-21T00:00:02.000Z' },
    }
    const merged = mergeDashboardSnapshot(prev, next)
    expect(merged.source.lastReadAt).toBe('2026-11-21T00:00:02.000Z')
    expect(merged.incidents[0]).toBe(prev.incidents[0])
  })

  it('keeps stable incident references when only one row changed', () => {
    const prev: DashboardSnapshot = {
      ...base('r1', 1),
      incidents: [
        { id: 'A', revision: 'r1', groups: ['high'] },
        { id: 'B', revision: 'r2', groups: ['high'] },
      ],
    }
    const next: DashboardSnapshot = {
      ...prev,
      version: 2,
      incidents: [
        { id: 'A', revision: 'r1-new', groups: ['critical'] },
        { id: 'B', revision: 'r2', groups: ['high'] },
      ],
    }
    const merged = mergeDashboardSnapshot(prev, next)
    expect(merged.incidents[1]).toBe(prev.incidents[1])
    expect(merged.incidents[0]).toBe(next.incidents[0])
  })
})