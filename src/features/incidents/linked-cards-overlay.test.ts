import { describe, expect, it } from 'vitest'
import { measureLinkedCardSegments } from './linked-cards-overlay'

describe('measureLinkedCardSegments', () => {
  it('returns empty without DOM or source card', () => {
    expect(
      measureLinkedCardSegments(
        { incidentId: 'INC-A', fromCardId: 'missing' },
        { id: 'INC-A', groups: ['critical', 'coordinators'] } as never,
        null
      )
    ).toEqual([])
  })

  it('returns empty for a single-section incident (no peer groups)', () => {
    if (typeof document === 'undefined') return
    document.body.innerHTML = `
      <article id="incident-critical-INC-B" data-incident-id="INC-B"></article>
    `
    expect(
      measureLinkedCardSegments(
        { incidentId: 'INC-B', fromCardId: 'incident-critical-INC-B' },
        { id: 'INC-B', groups: ['critical'] } as never,
        null
      )
    ).toEqual([])
  })
})