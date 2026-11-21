import { describe, expect, it } from 'vitest'
import {
  compareIncidents,
  incidentChanges,
  incidentGroups,
  incidentLink,
  incidentsSchema,
  incidentStatus,
  isActiveCritical,
  matchesPriorityColumn,
  primaryQueueLane,
  priorityColumnKey,
  priorityKanbanUnknown,
  priorityLabel,
  remainingTime,
  type Incident,
} from './model'

const assigned: Incident = {
  id: 'INC000021931151',
  sysId: '179413934903718013',
  priorityId: 1,
  assignedGroupName: 'КЦ ИТ Координаторы Массовых Инцидентов',
  stateEnum: 'Assigned',
}
const critical = { ...assigned, priorityId: 4 }

describe('incident snapshots', () => {
  it('keeps string identifiers and accepts null fields', () => {
    expect(
      incidentsSchema.parse([{ ...assigned, deadline: null }])[0]
    ).toMatchObject({
      id: assigned.id,
      sysId: assigned.sysId,
      deadline: null,
    })
    expect(incidentsSchema.safeParse([assigned, assigned]).success).toBe(false)
  })

  it('places an incident in each matching group independently', () => {
    expect(
      incidentGroups
        .filter(({ match }) => match(critical))
        .map(({ key }) => key)
    ).toEqual(['critical', 'coordinators'])
    const research = {
      ...critical,
      priorityId: 3,
      stateEnum: 'Research',
      deadline: null,
    }
    expect(
      incidentGroups
        .filter(({ match }) => match(research))
        .map(({ key }) => key)
    ).toEqual(['coordinators', 'research'])
    expect(isActiveCritical({ ...critical, stateEnum: 'Research' })).toBe(false)
  })

  it('uses stateEnum for resolved and closed statuses', () => {
    const resolved = { ...critical, stateEnum: 'Resolved', stateId: 7 }
    const closed = { ...critical, stateEnum: 'Closed', stateId: 10 }
    expect(incidentStatus(resolved)).toBe('Решён')
    expect(incidentStatus(closed)).toBe('Закрыт')
    expect(isActiveCritical(resolved)).toBe(false)
    expect(isActiveCritical(closed)).toBe(false)
  })

  it('combines reasons per ID and distinguishes resolution from deletion and downgrade', () => {
    const away = { ...assigned, assignedGroupName: 'Другая команда' }
    expect(
      incidentChanges([away], [critical]).map(({ reasons }) => reasons)
    ).toEqual([['enteredCritical', 'assignedToCoordinators']])
    expect(
      incidentChanges(
        [{ ...critical, deadline: '2026-11-22T08:00:00Z' }],
        [{ ...critical, deadline: '2026-11-23T12:00:00Z' }]
      ).map(({ reasons }) => reasons)
    ).toEqual([['deadlineChanged']])
    expect(
      incidentChanges([critical], [assigned]).map(({ reasons }) => reasons)
    ).toEqual([['leftCritical']])
    expect(
      incidentChanges([critical], [{ ...critical, priorityId: 3 }]).map(
        ({ reasons }) => reasons
      )
    ).toEqual([['leftCritical']])
    expect(
      incidentChanges(
        [{ ...assigned, priorityId: 3, assignedGroupName: 'ОГЭ' }],
        [{ ...assigned, priorityId: 1, assignedGroupName: 'ОГЭ' }]
      ).map(({ reasons }) => reasons)
    ).toEqual([['priorityChanged']])
    expect(
      incidentChanges([critical], []).map(({ reasons }) => reasons)
    ).toEqual([['removedFromExport']])
    expect(
      incidentChanges([], [critical]).map(({ reasons }) => reasons)
    ).toEqual([['newCritical', 'assignedToCoordinators']])
    const resolvedResearch = { ...critical, stateEnum: 'Research' }
    expect(
      incidentChanges(
        [{ ...critical, assignedGroupName: 'Другая команда' }],
        [resolvedResearch]
      ).map(({ reasons }) => reasons)
    ).toEqual([['assignedToCoordinators', 'resolvedCritical']])
    expect(
      incidentGroups.filter(({ match }) =>
        match({ ...critical, stateEnum: 'Resolved' })
      )
    ).toEqual([])
  })

  it('sorts overdue first, then by deadline, unknown deadlines last, ID breaks ties', () => {
    const now = Date.parse('2026-11-21T12:00:00Z')
    const items = [
      { ...assigned, id: 'D', deadline: null },
      { ...assigned, id: 'C', deadline: '2026-11-22T08:00:00Z' },
      { ...assigned, id: 'B', deadline: '2026-11-20T08:00:00Z' },
      { ...assigned, id: 'A', deadline: '2026-11-20T08:00:00Z' },
    ]
    expect(
      items.sort((a, b) => compareIncidents(a, b, now)).map(({ id }) => id)
    ).toEqual(['A', 'B', 'C', 'D'])
  })

  it('maps priority codes from the attributes dictionary', () => {
    expect(priorityLabel({ ...assigned, priorityId: 4 })).toBe('Наивысший')
    expect(priorityLabel({ ...assigned, priorityId: 3 })).toBe('Высокий')
    expect(priorityLabel({ ...assigned, priorityId: undefined })).toBe(
      'Приоритет не указан'
    )
  })

  it('picks scroll lane by case group order', () => {
    expect(
      primaryQueueLane({ groups: ['coordinators', 'high'] })
    ).toBe('coordinators')
    expect(
      primaryQueueLane({ groups: ['high', 'critical'] })
    ).toBe('critical')
    expect(primaryQueueLane({ groups: [] })).toBe('critical')
  })

  it('maps incidents to kanban priority columns', () => {
    expect(priorityColumnKey({ ...assigned, priorityId: 4 })).toBe('p4')
    expect(priorityColumnKey({ ...assigned, priorityId: 2 })).toBe('p2')
    expect(priorityColumnKey({ ...assigned, priorityId: undefined })).toBe(
      priorityKanbanUnknown.key
    )
    expect(
      matchesPriorityColumn(
        { ...assigned, priorityId: 3 },
        { priorityId: 3 }
      )
    ).toBe(true)
    expect(
      matchesPriorityColumn(
        { ...assigned, priorityId: 3 },
        { priorityId: 4 }
      )
    ).toBe(false)
  })

  it('treats unknown status as display-only and non-active', () => {
    const odd = { ...assigned, stateEnum: 'PendingReview' }
    expect(incidentStatus(odd)).toBe('PendingReview')
    expect(
      incidentGroups.filter(({ match }) => match(odd)).map(({ key }) => key)
    ).toEqual([])
  })

  it('calculates remaining and overdue durations from deadline and now', () => {
    const now = Date.parse('2026-11-21T12:00:00Z')
    expect(
      remainingTime('2026-11-21T13:00:00Z', now)
    ).toMatch(/^Осталось/)
    expect(
      remainingTime('2026-11-21T11:00:00Z', now)
    ).toMatch(/^Просрочено на/)
  })

  it('emits coordinator assignment again after return to engineers', () => {
    const engineers = { ...critical, assignedGroupName: 'ОГЭ Приморье' }
    const onCoordinators = {
      ...critical,
      assignedGroupName: assigned.assignedGroupName,
    }
    expect(
      incidentChanges([engineers], [onCoordinators]).map(({ reasons }) => reasons)
    ).toEqual([['assignedToCoordinators']])
    expect(
      incidentChanges([onCoordinators], [engineers]).map(({ reasons }) => reasons)
    ).toEqual([['leftCoordinators']])
    expect(
      incidentChanges([engineers], [onCoordinators]).map(({ reasons }) => reasons)
    ).toEqual([['assignedToCoordinators']])
  })

  it('builds ITSM links from either identifier and rejects unsupported schemes', () => {
    expect(
      incidentLink('https://itsm.example.test/incidents/{id}', assigned)
    ).toBe('https://itsm.example.test/incidents/INC000021931151')
    expect(
      incidentLink('https://itsm.example.test/card?id={sysId}', assigned)
    ).toBe('https://itsm.example.test/card?id=179413934903718013')
    expect(incidentLink('javascript:{id}', assigned)).toBeUndefined()
    expect(
      incidentLink('https://itsm.example.test/card?id={sysId}', {
        ...assigned,
        sysId: null,
      })
    ).toBeUndefined()
  })
})
