import { useEffect, useMemo, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { incidentDestination } from './incident-destination'
import { handoffLine, suggestHandoff } from './handoff'
import { buildIncidentProtocol } from './ops'
import { useIncidentDashboard } from './use-incident-dashboard'
import { incidentStatus, analysisSchema, type Incident } from './model'

export function IncidentDetails({
  incident,
  restoreFocus,
}: {
  incident: Incident & { revision: string; groups?: string[] }
  restoreFocus: () => void
}) {
  const { href, label } = incidentDestination(incident)
  const { data: dashboard } = useIncidentDashboard()
  const onCoordinators = incident.groups?.includes('coordinators') ?? false
  const handoff = useMemo(
    () =>
      onCoordinators
        ? suggestHandoff(incident, dashboard?.incidents ?? [])
        : null,
    [onCoordinators, incident, dashboard?.incidents]
  )
  const revisionOnRequest = useRef<string | undefined>(undefined)
  const { mutate, data, isPending, error } = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch(
          `/api/incidents/${encodeURIComponent(incident.id)}/analysis`,
          {
            method: 'POST',
            headers: { 'X-Relay-Request': 'summary' },
          }
        )
        const result = await response.json()
        if (!response.ok)
          return {
            message:
              typeof result.error === 'string'
                ? result.error
                : 'Не удалось получить сводку.',
          }
        const summary = analysisSchema.parse(result)
        revisionOnRequest.current = incident.revision
        return { summary }
      } catch {
        return {
          message: 'Не удалось получить сводку. Повторите запрос позже.',
        }
      }
    },
  })

  const summaryStale =
    data?.summary &&
    (data.summary.revision !== incident.revision ||
      (revisionOnRequest.current &&
        revisionOnRequest.current !== incident.revision))

  useEffect(() => {
    revisionOnRequest.current = undefined
  }, [incident.id])

  return (
    <DialogContent
      className='max-h-[85svh] gap-4 overflow-y-auto border-border sm:max-w-lg rounded-[var(--radius-modal)]'
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        restoreFocus()
      }}
    >
      <DialogHeader className='gap-1 pe-5 text-start'>
        <p className='font-mono text-xs text-muted-foreground'>{incident.id}</p>
        <DialogTitle className='text-base leading-snug font-semibold break-words'>
          {incident.header || 'Без заголовка'}
        </DialogTitle>
        <DialogDescription className='text-sm'>
          {incidentStatus(incident)}
          {incident.productName && ` · ${incident.productName}`}
        </DialogDescription>
      </DialogHeader>
      <div className='space-y-2 border-y border-border py-3 text-sm break-words'>
        <p>
          {incident.description ||
            incident.shortDescription ||
            'Описание отсутствует.'}
        </p>
        {incident.solution && (
          <p className='text-muted-foreground'>
            Решение в записи: {incident.solution}
          </p>
        )}
      </div>
      {summaryStale && (
        <p className='rounded-sm border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-sm text-destructive'>
          Выгрузка обновилась — сводка может быть устаревшей. Запросите заново.
        </p>
      )}
      {onCoordinators && (
        <div className='rounded-2xl border border-chart-2/30 bg-chart-2/8 p-4 text-sm wrap-anywhere'>
          <h3 className='granat-title text-base'>Куда передать</h3>
          <p className='mt-1'>
            {handoff
              ? handoffLine(handoff)
              : 'По этому продукту в выгрузке нет другой команды — смотрите описание.'}
          </p>
          {handoff && (
            <Button
              size='sm'
              variant='outline'
              type='button'
              className='mt-3'
              onClick={() => {
                void navigator.clipboard
                  .writeText(handoff.team)
                  .then(() =>
                    toast.success(`Команда «${handoff.team}» в буфере.`)
                  )
                  .catch(() => toast.error('Не удалось скопировать команду.'))
              }}
            >
              Скопировать команду
            </Button>
          )}
        </div>
      )}
      <div className='rounded-2xl border border-border bg-secondary/60 p-4'>
        <h3 className='granat-title text-base'>ИИ-сводка</h3>
        <p className='granat-caption mt-1'>
          Краткие факты, гипотезы и подсказка координатору по полям выгрузки.
        </p>
        <div className='mt-3 flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='default'
            onClick={() => mutate()}
            disabled={isPending}
          >
            {isPending
              ? 'Готовим…'
              : summaryStale
                ? 'Обновить сводку'
                : 'Запросить сводку'}
          </Button>
          <Button
            size='sm'
            variant='outline'
            type='button'
            onClick={() => {
              void navigator.clipboard
                .writeText(buildIncidentProtocol(incident, Date.now()))
                .then(() => toast.success('Протокол для передачи скопирован.'))
                .catch(() => toast.error('Не удалось скопировать.'))
            }}
          >
            Протокол
          </Button>
          <Button size='sm' variant='outline' asChild>
            <a href={href} target='_blank' rel='noopener noreferrer'>
              <ExternalLink aria-hidden='true' className='size-3.5' />
              {label}
            </a>
          </Button>
        </div>
      </div>
      {(data?.message || error) && (
        <p role='alert' className='text-sm text-destructive'>
          {data?.message || 'Не удалось получить сводку.'}
        </p>
      )}
      {data?.summary && (
        <section
          aria-label='Сводка'
          className='space-y-4 rounded-2xl border border-border bg-card p-4 text-sm wrap-anywhere'
          aria-live='polite'
        >
          {data.summary.source === 'template' && (
            <p className='text-xs text-muted-foreground'>
              По полям выгрузки (модель не подключена).
            </p>
          )}
          {data.summary.source === 'openrouter' && (
            <p className='text-xs text-muted-foreground'>
              Текст сформирован моделью (OpenRouter).
            </p>
          )}
          <div>
            <h3 className='granat-caption text-sm font-medium text-foreground'>
              Выжимка (факты)
            </h3>
            <p className='mt-1 whitespace-pre-wrap'>{data.summary.facts}</p>
          </div>
          <div>
            <h3 className='granat-caption text-sm font-medium text-foreground'>
              Гипотезы и риски
            </h3>
            <p className='mt-1 whitespace-pre-wrap'>
              {data.summary.hypotheses}
            </p>
          </div>
          <div>
            <h3 className='granat-caption text-sm font-medium text-foreground'>
              Подсказка координатору
            </h3>
            <p className='mt-1'>{data.summary.nextStep}</p>
          </div>
          {!!data.summary.evidence.length && (
            <p className='text-xs text-muted-foreground'>
              Поля: {data.summary.evidence.join(', ')}
            </p>
          )}
        </section>
      )}
    </DialogContent>
  )
}