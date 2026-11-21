import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createIncidentStore } from './incident-store'

describe('incident store', () => {
  it('does not emit events on first read and reacts to priority changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'relay-incidents-'))
    const file = join(dir, 'incidents.json')
    const record = {
      id: 'INC000021938167',
      sysId: '1',
      stateEnum: 'WorkInProgress',
      priorityId: 3,
      assignedGroupName: 'ОГЭ Приморье',
      productName: 'Биллинг',
      deadline: '2026-11-22T12:00:00Z',
    }
    await writeFile(file, JSON.stringify([record]))
    const store = createIncidentStore(file)
    await store.refresh()
    expect(store.current?.events).toEqual([])
    expect(store.current?.incidents[0]?.groups).toEqual(['high'])

    await writeFile(file, JSON.stringify([{ ...record, priorityId: 4 }]))
    await store.refresh()
    const events = store.current?.events ?? []
    expect(events).toHaveLength(1)
    expect(events[0]?.reasons).toEqual(['enteredCritical'])
    expect(store.current?.incidents[0]?.groups).toEqual(['critical'])
    expect(store.current?.version).toBe(2)

    await writeFile(file, JSON.stringify([{ ...record, priorityId: 4 }]))
    await store.refresh()
    expect(store.current?.events).toHaveLength(1)

    const readAt = store.current?.source.lastReadAt
    await store.refresh()
    expect(store.current?.source.lastReadAt).not.toBe(readAt)
    expect(store.current?.version).toBe(2)
    expect(store.current?.events).toHaveLength(1)
  })

  it('clears events after hardReset', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'relay-incidents-'))
    const file = join(dir, 'incidents.json')
    const record = {
      id: 'A',
      sysId: '1',
      stateEnum: 'WorkInProgress',
      priorityId: 3,
    }
    await writeFile(file, JSON.stringify([record]))
    const store = createIncidentStore(file)
    await store.refresh()
    await writeFile(file, JSON.stringify([{ ...record, priorityId: 4 }]))
    await store.refresh()
    expect(store.current?.events.length).toBeGreaterThan(0)
    const runBefore = store.current?.runId
    await store.hardReset()
    expect(store.current?.events).toEqual([])
    expect(store.current?.runId).not.toBe(runBefore)
  })

  it('keeps the last valid snapshot when JSON becomes invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'relay-incidents-'))
    const file = join(dir, 'incidents.json')
    await writeFile(
      file,
      JSON.stringify([{ id: 'A', sysId: '1', stateEnum: 'Assigned' }])
    )
    const store = createIncidentStore(file)
    await store.refresh()
    const before = store.current?.version
    await writeFile(file, '{ incomplete')
    await store.refresh()
    expect(store.current?.source.state).toBe('stale')
    expect(store.current?.version).toBe(before)
    expect(store.current?.incidents).toHaveLength(1)
  })

  it('drops removed ids without resolution events and ignores row order', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'relay-incidents-'))
    const file = join(dir, 'incidents.json')
    const a = {
      id: 'A',
      sysId: '1',
      stateEnum: 'WorkInProgress',
      priorityId: 4,
      assignedGroupName: 'ОГЭ Приморье',
    }
    const b = {
      id: 'B',
      sysId: '2',
      stateEnum: 'Assigned',
      priorityId: 1,
      assignedGroupName: 'ОГЭ Приморье',
    }
    await writeFile(file, JSON.stringify([a, b]))
    const store = createIncidentStore(file)
    await store.refresh()
    await writeFile(file, JSON.stringify([b]))
    await store.refresh()
    expect(store.current?.incidents.map(({ id }) => id)).toEqual(['B'])
    expect(
      store.current?.events?.some((event) =>
        event.reasons.includes('resolvedCritical')
      )
    ).toBe(false)
    expect(
      store.current?.events?.some((event) =>
        event.reasons.includes('removedFromExport')
      )
    ).toBe(true)

    await writeFile(
      file,
      JSON.stringify([{ ...a, priorityId: 1 }])
    )
    await store.refresh()
    expect(
      store.current?.events?.find((event) =>
        event.reasons.includes('leftCritical')
      )?.detail
    ).toMatch(/Приоритет/)

    const versionAfterRemoval = store.current?.version
    await writeFile(file, JSON.stringify([b]))
    await store.refresh()
    expect(store.current?.version).toBe(versionAfterRemoval)

    await writeFile(file, JSON.stringify([b, a]))
    await store.refresh()
    const versionAfterReorder = store.current?.version
    await writeFile(file, JSON.stringify([a, b]))
    await store.refresh()
    expect(store.current?.version).toBe(versionAfterReorder)
  })

  it('signals coordinators twice after engineer reassignment round trip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'relay-incidents-'))
    const file = join(dir, 'incidents.json')
    const coordinators = 'КЦ ИТ Координаторы Массовых Инцидентов'
    const base = {
      id: 'INC-1',
      sysId: '1',
      stateEnum: 'WorkInProgress',
      priorityId: 3,
      assignedGroupName: 'ОГЭ Приморье',
      productName: 'Тест',
    }
    await writeFile(file, JSON.stringify([base]))
    const store = createIncidentStore(file)
    await store.refresh()
    await writeFile(
      file,
      JSON.stringify([{ ...base, assignedGroupName: coordinators }])
    )
    await store.refresh()
    await writeFile(file, JSON.stringify([base]))
    await store.refresh()
    await writeFile(
      file,
      JSON.stringify([{ ...base, assignedGroupName: coordinators }])
    )
    await store.refresh()
    const assignments = store.current?.events.filter((event) =>
      event.reasons.includes('assignedToCoordinators')
    )
    expect(assignments).toHaveLength(2)
  })
})