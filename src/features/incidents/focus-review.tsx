import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { incidentDestination } from './incident-destination'
import { isActiveCritical, type DashboardSnapshot } from './model'
import { focusReview, type FocusSession } from './personal-focus'

export function FocusReview({
  data,
  session,
  now,
  onEnd,
  onIncident,
}: {
  data: DashboardSnapshot
  session: FocusSession
  now: number
  onEnd: () => void
  onIncident: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { rows, incomplete } = focusReview(data, session, now)
  const focused = data.incidents.find((i) => i.id === session.id)
  const active = focused && isActiveCritical(focused)
  return (
    <div className='flex flex-wrap items-center gap-3 bg-secondary px-4 py-2 text-sm'>
      <strong>
        {active ? 'Личный фокус' : 'Критический снят с контроля'} · {session.id}
      </strong>
      <Button size='sm' variant='outline' onClick={() => setOpen(true)}>
        К разбору · {rows.length}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-h-[85svh] overflow-y-auto'>
          <DialogTitle>Пока вы занимались критическим</DialogTitle>
          <DialogDescription>
            {incomplete
              ? 'История периода неполная. Показаны актуальные задачи по последнему снимку.'
              : 'Изменения в других заявках, которые ещё требуют действия.'}
          </DialogDescription>
          {data.source.state === 'stale' && (
            <p role='status'>
              Источник недоступен. Данные на момент последнего обновления.
            </p>
          )}
          {!rows.length && <p>Других заявок для разбора нет.</p>}
          {rows[0] && (
            <FocusAdvice
              key={JSON.stringify([rows[0].incident.id, rows[0].signals])}
              id={rows[0].incident.id}
              signals={rows[0].signals}
            />
          )}
          {rows.map(({ incident, facts, transfer }) => (
            <section
              key={incident.id}
              className='space-y-2 border-b pb-3 text-sm'
            >
              <strong>
                {incident.productName} · {incident.id}
              </strong>
              <p>{facts.join(' · ')}</p>
              {transfer ? (
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    setOpen(false)
                    onIncident(incident.id)
                  }}
                >
                  Подобрать команду
                </Button>
              ) : (
                <Button asChild size='sm' variant='outline'>
                  <a
                    href={incidentDestination(incident).href}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Открыть в ITSM
                  </a>
                </Button>
              )}
            </section>
          ))}
          <Button onClick={onEnd}>Завершить личный фокус</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FocusAdvice({ id, signals }: { id: string; signals: string[] }) {
  const advice = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        '/api/focus-advice?' +
          new URLSearchParams({ signals: signals.join(',') }),
        {
          method: 'POST',
          headers: { 'X-Relay-Request': 'focus-advice' },
        }
      )
      if (!response.ok) throw new Error()
      const result: { advice: string } = await response.json()
      return result.advice
    },
  })
  return (
    <div className='text-sm'>
      <Button
        variant='outline'
        size='sm'
        disabled={advice.isPending}
        onClick={() => advice.mutate()}
      >
        {advice.isPending ? 'Запрос…' : 'Спросить ИИ о первом действии'}
      </Button>
      {advice.data && (
        <p className='mt-2'>
          {id} · {advice.data}
        </p>
      )}
      {advice.isError && (
        <p role='status'>
          ИИ сейчас недоступен. Действия по заявкам приведены ниже.
        </p>
      )}
    </div>
  )
}
