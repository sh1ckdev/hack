import { describe, expect, it } from 'vitest'
import type { Incident } from './model'
import { incidentsForSeat, operatorSeats } from './station'

function incident(patch: Partial<Incident> & Pick<Incident, 'id'>): Incident {
  return {
    stateEnum: 'Assigned',
    assignedEmployee: patch.assignedEmployeeLogin ?? 'Исполнитель',
    deadline: '2026-11-22T12:00:00Z',
    ...patch,
  }
}

describe('operator seats', () => {
  it('groups the export by assignee login and counts open work', () => {
    const seats = operatorSeats([
      incident({
        id: 'a',
        assignedEmployeeLogin: 'alice',
        assignedEmployee: 'Алиса (alice)',
      }),
      incident({
        id: 'b',
        assignedEmployeeLogin: 'alice',
        assignedEmployee: 'Алиса (alice)',
        stateEnum: 'Closed',
      }),
      incident({
        id: 'c',
        assignedEmployeeLogin: 'winnie',
        assignedEmployee: 'Винни (winnie)',
        stateEnum: 'Research',
      }),
    ])
    expect(seats.map((seat) => [seat.login, seat.open])).toEqual([
      ['alice', 1],
      ['winnie', 1],
    ])
  })

  it('returns only that person, open work first', () => {
    const mine = incidentsForSeat(
      [
        incident({
          id: 'late',
          assignedEmployeeLogin: 'alice',
          stateEnum: 'Closed',
          deadline: '2026-11-01T00:00:00Z',
        }),
        incident({
          id: 'soon',
          assignedEmployeeLogin: 'alice',
          deadline: '2026-11-21T12:00:00Z',
        }),
        incident({
          id: 'other',
          assignedEmployeeLogin: 'winnie',
        }),
      ],
      'alice'
    )
    expect(mine.map((item) => item.id)).toEqual(['soon', 'late'])
  })
})
