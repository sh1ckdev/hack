import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Incident } from './model'
import {
  buildQueueSummary,
  escalationResponseSchema,
  escalationSignalLabel,
  type QueueSummary,
  type RisingIncident,
} from './queue-summary'

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

function ModelAssessment({
  item,
  open,
  onOpenChange,
  trigger = true,
}: {
  item: RisingIncident
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: boolean
}) {
  const assessment = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/incidents/${encodeURIComponent(item.id)}/escalation-assessment`,
        {
          method: 'POST',
          headers: { 'X-Relay-Request': 'escalation-assessment' },
        }
      )
      const result = await response.json()
      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Не удалось получить оценку модели.'
        )
      }
      if (JSON.stringify(result.signals) !== JSON.stringify(item.signals)) {
        throw new Error('Признаки изменились. Запросите оценку ещё раз.')
      }
      return escalationResponseSchema.parse(result)
    },
  })

  const requested = useRef(false)
  const { isPending, mutate } = assessment
  useEffect(() => {
    if (!open) requested.current = false
    else if (!requested.current && !isPending) {
      requested.current = true
      mutate()
    }
  }, [open, isPending, mutate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogTrigger asChild>
          <button
            type='button'
            className='ms-2 text-link underline-offset-2 hover:underline'
            aria-label={`Оценить риск с ИИ для ${item.id}`}
          >
            Оценить с ИИ
          </button>
        </DialogTrigger>
      )}
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Оценка риска с ИИ</DialogTitle>
          <DialogDescription>
            {item.id} · {item.product}
          </DialogDescription>
        </DialogHeader>
        <div role='status' className='space-y-3 text-sm text-muted-foreground'>
          {assessment.isPending && <p>Оцениваем признаки эскалации…</p>}
          {assessment.data && (
            <>
              <p className='font-medium text-foreground'>
                {assessment.data.risk === 'high' ? 'Высокий' : 'Умеренный'} риск
              </p>
              <p>
                Главный признак:{' '}
                {escalationSignalLabel[assessment.data.primarySignal]}.
              </p>
              {Boolean(assessment.data.observations?.length) && (
                <div>
                  <p className='font-medium text-foreground'>
                    Что видно в заявке и очереди
                  </p>
                  <ul className='mt-1 list-disc space-y-1 ps-5'>
                    {assessment.data.observations?.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className='font-medium text-foreground'>
                  Почему это повышает риск
                </p>
                <p className='mt-1'>{assessment.data.explanation}</p>
              </div>
              <p>
                <span className='font-medium text-foreground'>
                  Что проверить:
                </span>{' '}
                {assessment.data.nextStep}
              </p>
            </>
          )}
          {assessment.error && <p>{assessment.error.message}</p>}
        </div>
        {assessment.isError && (
          <Button
            type='button'
            variant='outline'
            className='justify-self-start'
            onClick={() => assessment.mutate()}
          >
            Повторить
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function QueueSummaryStrip({
  incidents,
  now,
  onOpen,
  assessmentId,
  onAssessment,
}: {
  incidents: Incident[]
  now: number
  onOpen: (id: string) => void
  assessmentId: string | null
  onAssessment: (id: string | null) => void
}) {
  const summary: QueueSummary = buildQueueSummary(incidents, now)
  const shownRising = summary.rising.slice(0, 3)
  const hiddenRising = summary.rising.length - shownRising.length
  const additionalAssessment = shownRising.some(({ id }) => id === assessmentId)
    ? undefined
    : summary.rising.find(({ id }) => id === assessmentId)

  return (
    <section aria-label='Сводка смены' className='space-y-1 px-4 py-3 text-sm'>
      <h3 className='text-xs text-muted-foreground'>Сводка смены</h3>
      {summary.first ? (
        <p>
          Сначала <IncidentRef id={summary.first.id} onOpen={onOpen} />
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
          <div>
            <p>
              Могут стать критическими
              {summary.rising.length === 0 ? ': нет' : ''}
            </p>
            {shownRising.length > 0 && (
              <ul className='space-y-1'>
                {shownRising.map((item) => (
                  <li key={`${item.id}:${item.signals.join(',')}`}>
                    <IncidentRef id={item.id} onOpen={onOpen} />
                    <span
                      className='text-muted-foreground'
                      title={item.signals
                        .map((signal) => escalationSignalLabel[signal])
                        .join('; ')}
                    >
                      {' · '}
                      {item.signals.length} признака
                    </span>
                    <ModelAssessment
                      item={item}
                      open={assessmentId === item.id}
                      onOpenChange={(open) =>
                        onAssessment(open ? item.id : null)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {hiddenRising > 0 && (
              <p className='text-muted-foreground'>Ещё {hiddenRising}</p>
            )}
          </div>
        </>
      )}
      {additionalAssessment && (
        <ModelAssessment
          key={additionalAssessment.id}
          item={additionalAssessment}
          open
          onOpenChange={(open) => {
            if (!open) onAssessment(null)
          }}
          trigger={false}
        />
      )}
    </section>
  )
}
