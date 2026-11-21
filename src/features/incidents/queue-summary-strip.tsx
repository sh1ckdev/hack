import { buildQueueSummary, escalationSignalLabel, type QueueSummary } from './queue-summary'
import type { Incident } from './model'

function IncidentRef({
  id,
  onOpen,
}: {
  id: string
  onOpen: (id: string) => void
}) {
  return (
    <button
      type='button'
      className='font-mono text-foreground underline-offset-2 hover:underline'
      onClick={() => onOpen(id)}
    >
      {id}
    </button>
  )
}

export function QueueSummaryStrip({
  incidents,
  now,
  onOpen,
}: {
  incidents: Incident[]
  now: number
  onOpen: (id: string) => void
}) {
  const summary: QueueSummary = buildQueueSummary(incidents, now)
  const shownRising = summary.rising.slice(0, 3)
  const hiddenRising = summary.rising.length - shownRising.length

  return (
    <section
      aria-label='Сводка смены'
      className='space-y-1 border-b border-border px-4 py-3 text-sm'
    >
      <h3 className='text-xs text-muted-foreground'>Сводка смены</h3>
      {summary.first ? (
        <p>
          Сначала{' '}
          <IncidentRef id={summary.first.id} onOpen={onOpen} />
          <span className='text-muted-foreground'>
            {' '}
            · {summary.first.product}. {summary.first.why}.
          </span>
        </p>
      ) : (
        <p className='text-muted-foreground'>
          Критических нет. Высоких, которые могут ими стать, тоже нет.
        </p>
      )}
      {(summary.criticalCount > 0 || summary.rising.length > 0) && (
        <>
      <p>
        Критические: {summary.criticalCount}
        {summary.criticalUnassigned > 0 &&
          `, без исполнителя ${summary.criticalUnassigned}`}
        {summary.nearestCritical && (
          <>
            . Ближайший срок{' '}
            <IncidentRef id={summary.nearestCritical.id} onOpen={onOpen} />
            <span className='text-muted-foreground'>
              {summary.nearestCritical.overdue ? ', срок прошёл' : ''}
            </span>
          </>
        )}
      </p>
      <p>
        Могут стать критическими:{' '}
        {summary.rising.length === 0 ? (
          'нет'
        ) : (
          <>
            {shownRising.map((item, index) => (
              <span key={item.id}>
                {index > 0 ? ', ' : ''}
                <IncidentRef id={item.id} onOpen={onOpen} />
                <span
                  className='text-muted-foreground'
                  title={item.signals
                    .map((signal) => escalationSignalLabel[signal])
                    .join('; ')}
                >
                  {' '}
                  · {item.signals.length} признака
                </span>
              </span>
            ))}
            {hiddenRising > 0 && (
              <span className='text-muted-foreground'>
                , ещё {hiddenRising}
              </span>
            )}
          </>
        )}
      </p>
        </>
      )}
    </section>
  )
}
