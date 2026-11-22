import { expect, it } from 'vitest'
import { dashboardSchema, coordinatorGroupName } from './model'
import { startFocus, focusReview } from './personal-focus'
import { buildShiftRiskSummary, firstIncidentForRisk } from './shift-risk'

const snapshot = () =>
  dashboardSchema.parse({
    runId: 'demo',
    version: 1,
    source: { state: 'ok', lastReadAt: '' },
    events: [],
    incidents: [
      {
        id: 'A',
        revision: '1',
        groups: [],
        stateEnum: 'Research',
        assignedGroupName: coordinatorGroupName,
      },
    ],
  })
it('counts research awaiting transfer and drops it immediately after reassignment', () => {
  const data = snapshot()
  const session = startFocus(data, 'B')
  expect(focusReview(data, session, 0).rows).toHaveLength(0)
  data.events.push({
    incidentId: 'A',
    seq: 1,
    reasons: ['assignedToCoordinators'],
    observedAt: '',
  })
  expect(buildShiftRiskSummary(data.incidents, 0).coordinators).toBe(1)
  expect(firstIncidentForRisk(data.incidents, 'coordinators', 0)).toBe('A')
  expect(focusReview(data, session, 0).rows).toHaveLength(1)
  data.incidents[0].assignedGroupName = 'Engineers'
  expect(focusReview(data, session, 0).rows).toHaveLength(0)
})
it('recovers from truncated history and server reset using current state', () => {
  const data = snapshot(),
    session = startFocus(data, 'B')
  data.events.push({
    incidentId: 'X',
    seq: 5,
    reasons: ['stateChanged'],
    observedAt: '',
  })
  expect(focusReview(data, session, 0)).toMatchObject({
    incomplete: true,
    rows: [{ transfer: true }],
  })
  data.events = []
  data.runId = 'new'
  expect(focusReview(data, session, 0).incomplete).toBe(true)
})
it('merges simultaneous reasons and clears a restored deadline', () => {
  const data = snapshot(),
    now = Date.now()
  const later = new Date(now + 86400000).toISOString()
  Object.assign(data.incidents[0], {
    stateEnum: 'Assigned',
    priorityId: 3,
    deadline: later,
  })
  const session = startFocus(data, 'B')
  data.incidents[0].deadline = new Date(now + 60000).toISOString()
  data.events.push({
    incidentId: 'A',
    seq: 1,
    reasons: ['deadlineChanged', 'assignedToCoordinators'],
    observedAt: '',
  })
  expect(focusReview(data, session, now).rows.map((r) => r.signals)).toEqual([
    ['transfer', 'deadline'],
  ])
  data.incidents[0].deadline = later
  expect(focusReview(data, session, now).rows[0].signals).toEqual(['transfer'])
})
