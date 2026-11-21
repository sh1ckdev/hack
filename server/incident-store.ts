import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  incidentChanges,
  incidentGroups,
  incidentsSchema,
  type DashboardSnapshot,
} from '../src/features/incidents/model'
import { SHIFT_EVENT_JOURNAL_CAP } from '../src/features/incidents/shift-event-notify'

export function createIncidentStore(file: string) {
  let runId = randomUUID()
  let snapshot: DashboardSnapshot | undefined
  let signature = ''
  let seq = 0

  async function refresh() {
    try {
      const records = incidentsSchema.parse(
        JSON.parse(await readFile(file, 'utf8'))
      )
      const incidents = records
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((record) => ({
          ...record,
          groups: incidentGroups
            .filter(({ match }) => match(record))
            .map(({ key }) => key),
          revision: createHash('sha256')
            .update(JSON.stringify(record))
            .digest('hex'),
        }))
      const nextSignature = incidents.map(({ revision }) => revision).join(',')
      const changed = !snapshot || signature !== nextSignature
      const lastReadAt = new Date().toISOString()
      if (!changed && snapshot) {
        snapshot = {
          ...snapshot,
          source: { ...snapshot.source, state: 'ok', lastReadAt },
        }
        return
      }
      const events =
        snapshot && changed
          ? incidentChanges(snapshot.incidents, incidents).map(
              ({ incident, reasons, detail }) => ({
                seq: ++seq,
                incidentId: incident.id,
                product: incident.productName,
                deadline: incident.deadline,
                reasons,
                detail,
                observedAt: lastReadAt,
              })
            )
          : []
      snapshot = {
        runId,
        version: (snapshot?.version ?? 0) + Number(changed),
        source: { state: 'ok', lastReadAt },
        incidents,
        events: [...(snapshot?.events ?? []), ...events].slice(
          -SHIFT_EVENT_JOURNAL_CAP
        ),
      }
      signature = nextSignature
    } catch {
      if (snapshot)
        snapshot = {
          ...snapshot,
          source: { ...snapshot.source, state: 'stale' },
        }
    }
  }

  async function hardReset() {
    runId = randomUUID()
    seq = 0
    signature = ''
    snapshot = undefined
    await refresh()
  }

  return {
    get current() {
      return snapshot
    },
    refresh,
    hardReset,
    start(onClose: (stop: () => void) => void) {
      let stopped = false
      let timer: ReturnType<typeof setTimeout> | undefined
      async function poll() {
        await refresh()
        if (!stopped) timer = setTimeout(poll, 1000).unref()
      }
      onClose(() => {
        stopped = true
        clearTimeout(timer)
      })
      void poll()
    },
  }
}
