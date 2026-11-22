import { createHash } from 'node:crypto'
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  coordinationStateSchema,
  type CoordinationEntry,
  type CoordinationCommand,
} from '../src/features/incidents/coordination-model'

export function createShiftCoordination(root: string, source: string) {
  const directory = join(root, '.local', 'coordination')
  const file = join(
    directory,
    createHash('sha256').update(source).digest('hex') + '.json'
  )
  function read() {
    try {
      const entries = coordinationStateSchema.parse(
        JSON.parse(readFileSync(file, 'utf8'))
      )
      return new Map(entries.map((entry) => [entry.incidentId, entry]))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return new Map<string, CoordinationEntry>()
    }
  }

  function commit(next: Map<string, CoordinationEntry>) {
    const temporary = file + '.' + process.pid + '.tmp'
    writeFileSync(temporary, JSON.stringify([...next.values()]), {
      mode: 0o600,
    })
    renameSync(temporary, file)
  }

  function withLock<T>(action: (entries: Map<string, CoordinationEntry>) => T) {
    mkdirSync(directory, { recursive: true })
    const lock = file + '.lock'
    mkdirSync(lock)
    try {
      return action(read())
    } finally {
      rmdirSync(lock)
    }
  }

  return {
    list: () => [...read().values()],
    reset: () =>
      withLock((entries) => {
        if (entries.size) commit(new Map())
      }),
    update({ incidentId, operator, action }: CoordinationCommand) {
      return withLock((entries) => {
        const previous = entries.get(incidentId) ?? { incidentId }
        const mark = { operator, at: Date.now() }
        let entry: CoordinationEntry
        if (action === 'release') {
          if (previous.claimed?.operator.id !== operator.id)
            return {
              conflict:
                'Снять отметку может только дежурный, который взял заявку.',
            }
          entry = { ...previous, claimed: undefined }
        } else if (action === 'claim') {
          if (previous.claimed && previous.claimed.operator.id !== operator.id)
            return {
              conflict: `Заявку уже взял дежурный «${previous.claimed.operator.name}».`,
            }
          entry = {
            ...previous,
            seen: previous.seen ?? mark,
            claimed: previous.claimed ?? mark,
          }
        } else {
          entry = { ...previous, seen: previous.seen ?? mark }
        }
        entries.set(incidentId, entry)
        commit(entries)
        return { entry }
      })
    },
  }
}
