import { useEffect, useMemo, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Clipboard, ExternalLink, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { findHandoffAnalogues, handoffLine, suggestHandoff } from './handoff'
import { incidentDestination } from './incident-destination'
import {
  analysisSchema,
  formatDate,
  incidentStatus,
  isActive,
  isActiveCritical,
  priorityLabel,
  remainingTime,
  type Incident,
} from './model'
import { buildIncidentProtocol } from './ops'
import { ShiftCoordinationActions } from './shift-coordination'
import { useIncidentDashboard } from './use-incident-dashboard'
import { useNow } from './use-now'

function HandoffDetails({
  incident,
  candidates,
}: {
  incident: Incident
  candidates: Incident[]
}) {
  const handoff = suggestHandoff(incident, candidates)
  const analogues = findHandoffAnalogues(incident, candidates)

  return (
    <div className='space-y-5 text-sm wrap-anywhere'>
      <section className='space-y-2'>
        <h3 className='granat-title text-base'>Куда передать</h3>
        <p>
          {handoff
            ? handoffLine(handoff)
            : 'В выгрузке нет другой команды с активными заявками по этому продукту.'}
        </p>
        {handoff && (
          <details className='rounded-lg border border-border px-3 py-2'>
            <summary className='cursor-pointer font-medium'>
              Основания и примеры заявок
            </summary>
            {[handoff.team, handoff.also?.team]
              .filter((team): team is string => Boolean(team))
              .map((team) => {
                const peers = candidates.filter(
                  (other) =>
                    other.id !== incident.id &&
                    isActive(other) &&
                    other.productName?.trim() ===
                      incident.productName?.trim() &&
                    other.assignedGroupName?.trim() === team
                )
                const service = incident.service?.trim()
                const sameService = peers.filter(
                  (peer) => service && peer.service?.trim() === service
                )
                const examples = [
                  ...sameService,
                  ...peers.filter((peer) => !sameService.includes(peer)),
                ].slice(0, 2)
                return (
                  <div
                    key={team}
                    className='mt-3 space-y-1 border-t border-border pt-3'
                  >
                    <p className='font-semibold'>{team}</p>
                    <p className='text-muted-foreground'>
                      Совпадения: продукт {peers.length}, сервис{' '}
                      {sameService.length}.
                    </p>
                    <div className='flex flex-wrap items-center gap-2'>
                      {examples.map((other) => (
                        <a
                          key={other.id}
                          href={incidentDestination(other).href}
                          target='_blank'
                          rel='noreferrer'
                          className='font-mono text-link underline'
                        >
                          {other.id}
                        </a>
                      ))}
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(team)
                            .then(() => toast.success('Команда скопирована.'))
                            .catch(() =>
                              toast.error('Не удалось скопировать команду.')
                            )
                        }}
                      >
                        Скопировать команду
                      </Button>
                    </div>
                  </div>
                )
              })}
          </details>
        )}
      </section>
      <section className='space-y-2 border-t border-border pt-4'>
        <h3 className='granat-title text-base'>
          Похожие случаи с известным решением
        </h3>
        {analogues.length ? (
          <ul className='divide-y divide-border'>
            {analogues.map(({ candidate, solution, evidence }) => (
              <li key={candidate.id} className='space-y-1 py-2.5'>
                <a
                  className='font-mono text-link underline'
                  href={incidentDestination(candidate).href}
                  target='_blank'
                  rel='noreferrer'
                >
                  {candidate.id}
                </a>
                <p className='text-muted-foreground'>
                  {evidence} ·{' '}
                  {candidate.assignedGroupName?.trim() || 'Команда не указана'}
                </p>
                <p>{solution}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground'>
            В текущей выгрузке нет похожих заявок с известным решением.
          </p>
        )}
      </section>
    </div>
  )
}

export function IncidentDetails({
  incident,
  restoreFocus,
  onStartFocus,
  section,
  onSectionChange,
  analysisRequest,
}: {
  incident: Incident & { revision: string; groups?: string[] }
  onStartFocus?: () => void
  restoreFocus: () => void
  section: 'summary' | 'handoff'
  analysisRequest?: number
  onSectionChange: (section: 'summary' | 'handoff') => void
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { href, label } = incidentDestination(incident)
  const { data: dashboard } = useIncidentDashboard()
  const active = isActive(incident)
  const now = useNow(1000, active && Boolean(incident.deadline))
  const deadlineHint = active ? remainingTime(incident.deadline, now) : null
  const overdue = Boolean(
    deadlineHint && Date.parse(incident.deadline ?? '') <= now
  )
  const onCoordinators = incident.groups?.includes('coordinators') ?? false
  const candidates = useMemo(
    () => dashboard?.incidents ?? [],
    [dashboard?.incidents]
  )
  const { mutate, data, isPending, error } = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/incidents/${encodeURIComponent(incident.id)}/analysis`,
        {
          method: 'POST',
          headers: { 'X-Relay-Request': 'summary' },
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Не удалось получить сводку.'
        )
      return analysisSchema.parse(result)
    },
  })
  const startedAnalysis = useRef<number>(undefined)
  useEffect(() => {
    if (
      analysisRequest === undefined ||
      startedAnalysis.current === analysisRequest
    )
      return
    startedAnalysis.current = analysisRequest
    mutate()
  }, [analysisRequest, mutate])
  const summaryStale = data && data.revision !== incident.revision
  const facts = [
    ['Исполнитель', incident.assignedEmployee?.trim() || 'Не назначен'],
    ['Команда', incident.assignedGroupName?.trim() || 'Не указана'],
    ['Регистрация', formatDate(incident.submitDate)],
    ['Срок', formatDate(incident.deadline)],
  ]

  return (
    <DialogContent
      className='max-h-[90svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[var(--radius-modal)] p-0 sm:max-w-[min(62rem,calc(100vw-2rem))]'
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        titleRef.current?.focus()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        restoreFocus()
      }}
    >
      <DialogHeader className='gap-1.5 border-b border-border px-5 py-4 pe-11 text-start sm:px-6 sm:pe-12'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-mono text-xs text-muted-foreground'>
            {incident.id}
          </span>
          <Badge
            variant={isActiveCritical(incident) ? 'destructive' : 'outline'}
          >
            {priorityLabel(incident)}
          </Badge>
          <Badge variant='secondary'>{incidentStatus(incident)}</Badge>
        </div>
        <DialogTitle
          ref={titleRef}
          tabIndex={-1}
          className='text-xl font-semibold wrap-anywhere outline-none'
        >
          {incident.header || 'Сводка по заявке'}
        </DialogTitle>
        <DialogDescription className='wrap-anywhere'>
          {[incident.productName, incident.service]
            .filter(Boolean)
            .join(' · ') || 'Продукт и сервис не указаны'}
        </DialogDescription>
      </DialogHeader>

      <div className='min-h-0 overflow-y-auto overscroll-contain'>
        <div className='grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
          <aside
            aria-label='Данные заявки'
            className='order-2 min-w-0 space-y-4 border-t border-border bg-muted/35 p-5 text-sm wrap-anywhere sm:p-6 md:order-0 md:border-e md:border-t-0'
          >
            <dl className='grid grid-cols-2 gap-x-3 gap-y-3'>
              {facts.map(([name, value]) => (
                <div key={name}>
                  <dt className='text-xs text-muted-foreground'>{name}</dt>
                  <dd className='mt-0.5 font-medium'>{value}</dd>
                </div>
              ))}
            </dl>
            {deadlineHint && (
              <p
                className={
                  overdue
                    ? 'font-medium text-destructive'
                    : 'text-muted-foreground'
                }
              >
                {deadlineHint}
              </p>
            )}
            <section className='space-y-1.5 border-t border-border pt-3'>
              <h3 className='font-semibold'>Описание заявки</h3>
              <p className='whitespace-pre-line'>
                {incident.description ||
                  incident.shortDescription ||
                  'Описание отсутствует.'}
              </p>
              {incident.solution && (
                <p className='whitespace-pre-line text-muted-foreground'>
                  <strong>Решение в записи:</strong> {incident.solution}
                </p>
              )}
            </section>
            <ShiftCoordinationActions id={incident.id} active={active} />
          </aside>

          <Tabs
            value={onCoordinators ? section : 'summary'}
            onValueChange={(value) =>
              onSectionChange(value === 'handoff' ? 'handoff' : 'summary')
            }
            className='min-w-0 gap-4 p-5 sm:p-6'
            key={onCoordinators ? 'coordinators' : 'summary'}
          >
            {onCoordinators && (
              <TabsList aria-label='Разделы заявки'>
                <TabsTrigger value='summary'>Сводка</TabsTrigger>
                <TabsTrigger value='handoff'>Передача</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value='summary'>
              <section
                aria-label='Сводка'
                className='space-y-4 text-sm wrap-anywhere'
                aria-live='polite'
              >
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <h3 className='granat-title text-base'>
                    Сводка по инциденту
                  </h3>
                  <Button
                    size='sm'
                    type='button'
                    onClick={() => mutate()}
                    disabled={isPending}
                  >
                    {isPending && (
                      <LoaderCircle className='motion-safe:animate-spin' />
                    )}
                    {isPending
                      ? 'Готовим сводку…'
                      : data
                        ? 'Обновить сводку'
                        : 'Запросить сводку'}
                  </Button>
                </div>
                {summaryStale && (
                  <p
                    role='status'
                    className='rounded-lg border border-destructive/35 bg-destructive/5 px-3 py-2 text-destructive'
                  >
                    Данные заявки изменились. Обновите сводку.
                  </p>
                )}
                {error && (
                  <p role='alert' className='text-destructive'>
                    {error instanceof Error && error.name === 'Error'
                      ? error.message
                      : 'Не удалось получить сводку.'}
                  </p>
                )}
                {data ? (
                  <>
                    {data.review && (
                      <section className='rounded-xl border border-border bg-muted/40 px-4 py-3'>
                        <h4 className='font-semibold'>Что сделать сейчас</h4>
                        <p className='mt-1'>{data.review.nextStep}</p>
                      </section>
                    )}
                    <p className='text-xs text-muted-foreground'>
                      {data.source === 'template'
                        ? 'Разбор по данным выгрузки. Формулировки по правилам.'
                        : 'Формулировки сводки подготовлены моделью. Факты и история взяты из выгрузки.'}
                    </p>
                    <dl className='divide-y divide-border rounded-xl border border-border'>
                      {[
                        ['Симптом', data.symptom],
                        ['Известно', data.known],
                        ['Что уточнить', data.gap],
                        ...(!data.review
                          ? [['Следующий шаг', data.action]]
                          : []),
                      ]
                        .filter(([, content]) => Boolean(content))
                        .map(([heading, content]) => (
                          <div key={heading} className='space-y-1 px-4 py-3'>
                            <dt className='font-semibold'>{heading}</dt>
                            <dd className='whitespace-pre-line text-muted-foreground'>
                              {content}
                            </dd>
                          </div>
                        ))}
                    </dl>
                    {Boolean(data.review?.evidence.length) && (
                      <details className='rounded-xl border border-border px-4 py-3'>
                        <summary className='cursor-pointer font-semibold'>
                          На чём основан вывод
                        </summary>
                        <dl className='mt-2 divide-y divide-border'>
                          {data.review?.evidence.map(({ label, text }) => (
                            <div key={label} className='space-y-0.5 py-2'>
                              <dt className='font-medium'>{label}</dt>
                              <dd className='text-muted-foreground'>{text}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                    {data.review && (
                      <section className='space-y-2'>
                        <h4 className='font-semibold'>Последние изменения</h4>
                        {data.review.events.length ? (
                          <ul className='space-y-2 border-s border-border ps-3'>
                            {data.review.events.map(
                              ({ seq, at, title, detail }) => (
                                <li key={seq}>
                                  <span className='text-xs text-muted-foreground'>
                                    {formatDate(at)} ·{' '}
                                  </span>
                                  <span className='font-medium'>{title}</span>
                                  {detail && (
                                    <p className='text-muted-foreground'>
                                      {detail}
                                    </p>
                                  )}
                                </li>
                              )
                            )}
                          </ul>
                        ) : (
                          <p className='text-muted-foreground'>
                            В доступном журнале изменений по этой заявке пока
                            нет.
                          </p>
                        )}
                      </section>
                    )}
                  </>
                ) : (
                  !error && (
                    <p className='rounded-xl bg-muted/50 px-4 py-3 text-muted-foreground'>
                      Сводка соберёт симптом, известные факты и следующий шаг по
                      данным заявки.
                    </p>
                  )
                )}
              </section>
            </TabsContent>
            {onCoordinators && (
              <TabsContent value='handoff'>
                <HandoffDetails incident={incident} candidates={candidates} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 sm:px-6'>
        {onStartFocus && (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='me-auto'
            onClick={onStartFocus}
          >
            Взять в личный фокус
          </Button>
        )}
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
          <Clipboard /> Протокол
        </Button>
        <Button size='sm' variant='outline' asChild>
          <a href={href} target='_blank' rel='noopener noreferrer'>
            <ExternalLink /> {label}
          </a>
        </Button>
      </div>
    </DialogContent>
  )
}
