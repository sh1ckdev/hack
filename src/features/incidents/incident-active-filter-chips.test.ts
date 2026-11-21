import { describe, expect, it } from 'vitest'
import { buildActiveFilterChips } from './incident-active-filter-chips'
import { defaultIncidentFilterPrefs } from './incident-filters'

describe('buildActiveFilterChips', () => {
  it('lists query and quick flags', () => {
    const prefs = {
      ...defaultIncidentFilterPrefs(),
      query: 'INC123',
      onlyCritical: true,
    }
    const keys = buildActiveFilterChips(prefs).map((c) => c.key)
    expect(keys).toContain('query')
    expect(keys).toContain('onlyCritical')
  })
})