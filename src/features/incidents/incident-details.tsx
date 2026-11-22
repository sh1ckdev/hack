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
import { findHandoffAnalogues, handoffLine, suggestHandoff } from './handoff'
import { buildIncidentProtocol } from './ops'
import { useIncidentDashboard } from './use-incident-dashboard'
import { ShiftCoordinationActions } from './shift-coordination'
import { isActive, incidentStatus, analysisSchema, type Incident } from './model'

export function IncidentDetails({
  incident,
  restoreFocus,
  onStartFocus,
}: {
  incident: Incident & { revision: string; groups?: string[] }
  onStartFocus?: () => void
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
  const analogues = useMemo(
    () => onCoordinators ? findHandoffAnalogues(incident, dashboard?.incidents ?? []) : [],
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
      {onStartFocus && <Button onClick={onStartFocus}>Взять в личный фокус</Button>}
      <ShiftCoordinationActions id={incident.id} active={isActive(incident)} />
      {summaryStale && (
        <p className='rounded-sm border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-sm text-destructive'>
          Выгрузка обновилась — сводка может быть устаревшей. Запросите заново.
        </p>
      )}
      {onCoordinators && (
        <div className='rounded-2xl border border-border bg-secondary p-4 text-sm wrap-anywhere'>
          <h3 className='granat-title text-base'>Куда передать</h3>
          <p className='mt-1'>
            {handoff
              ? handoffLine(handoff)
              : 'По этому продукту в выгрузке нет другой команды — смотрите описание.'}
          </p>
          {handoff && <details className='mt-3'><summary className='cursor-pointer'>Основания и примеры заявок</summary>
            {[handoff.team, ...(handoff.also ? [handoff.also.team] : [])].map(team => {
              const peers = (dashboard?.incidents ?? []).filter(i => i.id !== incident.id && isActive(i) && i.productName?.trim() === incident.productName?.trim() && i.assignedGroupName?.trim() === team)
              const sameService = peers.filter(i => !!incident.service?.trim() && i.service?.trim() === incident.service.trim())
              return <div key={team} className='mt-3'>
                <strong>{team}</strong>
                <p>Совпадает продукт у {peers.length}, из них совпадает сервис у {sameService.length}.</p>
                {[...sameService, ...peers.filter(i => !sameService.includes(i))].slice(0, 2).map(i => <a key={i.id} href={incidentDestination(i).href} target='_blank' rel='noreferrer' className='me-3 text-primary underline'>{i.id}</a>)}
                <Button size='sm' variant='ghost' onClick={() => void navigator.clipboard.writeText(team).then(() => toast.success('Команда скопирована.')).catch(() => toast.error('Не удалось скопировать команду.'))}>Скопировать команду</Button>
              </div>
            })}
          </details>}
        </div>
      )}
      {onCoordinators && (
        <section className='rounded-2xl border border-border bg-secondary/60 p-4 text-sm'>
          <h3 className='granat-title text-base'>Похожие случаи с известным решением</h3>
          {!analogues.length && <p className='mt-2 text-muted-foreground'>В текущей выгрузке нет похожих заявок с известным решением.</p>}
          <ul className='mt-2 space-y-3'>
            {analogues.map(({ candidate, solution, evidence }) => (
              <li key={candidate.id}>
                <a className='font-mono text-link underline' href={incidentDestination(candidate).href} target='_blank' rel='noreferrer'>{candidate.id}</a>
                <p className='text-muted-foreground'>{evidence} · {candidate.assignedGroupName?.trim() || 'Команда не указана'}</p>
                <p className='line-clamp-3 break-words'>{solution}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className='rounded-2xl border border-border bg-secondary/60 p-4'>
        <h3 className='granat-title text-base'>Сводка</h3>
        <div className='mt-3 flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant='default'
            onClick={() => mutate()}
            disabled={isPending}
          >
            {isPending
              ? 'Запрос…'
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
              По полям заявки, без модели.
            </p>
          )}
          {data.summary.source && data.summary.source !== 'template' && (
            <p className='text-xs text-muted-foreground'>
              Сформулировано моделью по полям заявки.
            </p>
          )}
          <div>
            <h3 className='granat-caption text-sm font-medium text-foreground'>
              Симптом
            </h3>
            <p className='mt-1'>{data.summary.symptom}</p>
          </div>
          <div>
            <h3 className='granat-caption text-sm font-medium text-foreground'>
              Известно
            </h3>
            <p className='mt-1'>{data.summary.known}</p>
          </div>
          {data.summary.gap && (
            <div>
              <h3 className='granat-caption text-sm font-medium text-foreground'>
                Не сходится
              </h3>
              <p className='mt-1'>{data.summary.gap}</p>
            </div>
          )}
          <div>
            <h3 className='granat-caption text-sm font-medium text-foreground'>
              Сделать
            </h3>
            <p className='mt-1'>{data.summary.action}</p>
          </div>
        </section>
      )}
    </DialogContent>
  )
}
