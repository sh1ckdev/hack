import { describe, expect, it } from 'vitest'
import { suggestHandoff } from './handoff'
import type { Incident } from './model'

const coordinators = 'КЦ ИТ Координаторы Массовых Инцидентов'

function row(
  id: string,
  product: string,
  team: string,
  state = 'WorkInProgress'
): Incident {
  return {
    id,
    productName: product,
    assignedGroupName: team,
    stateEnum: state,
  }
}

describe('suggestHandoff', () => {
  it('picks the most common non-coordinator team for the product', () => {
    const current = row('INC', 'Биллинг', coordinators)
    const route = suggestHandoff(current, [
      current,
      row('A', 'Биллинг', 'ОГЭ Приморье'),
      row('B', 'Биллинг', 'ОГЭ Приморье'),
      row('C', 'Биллинг', 'ОГЭ Центр'),
      row('D', 'Другой', 'ОГЭ Центр'),
      row('E', 'Биллинг', coordinators),
      row('F', 'Биллинг', 'ОГЭ Приморье', 'Resolved'),
    ])
    expect(route).toEqual({
      team: 'ОГЭ Приморье',
      count: 2,
      productActive: 4,
      also: { team: 'ОГЭ Центр', count: 1 },
    })
  })

  it('returns null when the product has no other team', () => {
    const current = row('INC', 'Биллинг', coordinators)
    expect(
      suggestHandoff(current, [current, row('A', 'Биллинг', coordinators)])
    ).toBeNull()
  })
})