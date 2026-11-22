import { Button } from '@/components/ui/button'
import {
  eventHeadline,
  formatDate,
  incidentStatus,
  isActive,
  priorityLabel,
  type DashboardSnapshot,
} from './model'
import type { VoiceBriefTopic } from './voice-intent'

export type VoiceBriefState = {
  runId: string
  id: string
  topic: VoiceBriefTopic
  why?: string
}

const titles = {
  next: 'Что взять первым',
  owner: 'Кто ведёт заявку',
  history: 'Последние изменения',
}

export function VoiceBrief({
  data,
  brief,
  now,
  onTopic,
}: {
  data: DashboardSnapshot
  brief: VoiceBriefState
  now: number
  onTopic: (topic: 'owner' | 'history') => void
}) {
  const incident = data.incidents.find(({ id }) => id === brief.id)
  if (data.runId !== brief.runId || !incident) return null
  const owner = incident.assignedEmployee?.trim() || 'Не назначен'
  const team = incident.assignedGroupName?.trim() || 'Не указана'
  const deadline = Date.parse(incident.deadline ?? '')
  const deadlineLabel = Number.isFinite(deadline)
    ? `${formatDate(incident.deadline)}${deadline <= now ? ' · просрочено' : ''}`
    : 'Не задан'
  const history =
    brief.topic === 'history'
      ? data.events
          .filter(({ incidentId }) => incidentId === incident.id)
          .slice(-3)
          .reverse()
      : []

  return (
    <section
      aria-label='Ответ голосового помощника'
      className='min-w-0 rounded-xl border border-border bg-card px-4 py-3 break-words'
    >
      <div aria-live='polite'>
        <h3 className='font-semibold'>{titles[brief.topic]}</h3>
        <p className='text-sm text-muted-foreground'>
          <span className='font-mono'>{incident.id}</span>
          {incident.productName && ` · ${incident.productName}`}
        </p>
      </div>
      {data.source.state === 'stale' && (
        <p className='mt-1 text-xs text-muted-foreground'>
          По последнему доступному снимку.
        </p>
      )}
      {brief.topic === 'next' && (
        <div className='mt-2 space-y-1 text-sm'>
          <p>
            {isActive(incident)
              ? brief.why
              : 'Заявка вышла из активной очереди. Спросите «Что взять первым?» ещё раз.'}
          </p>
          <p>
            Приоритет: {priorityLabel(incident)} · Статус:{' '}
            {incidentStatus(incident)} · Срок: {deadlineLabel}
          </p>
          {isActive(incident) && (
            <p className='text-muted-foreground'>
              {incident.assignedEmployee?.trim()
                ? 'Следующий шаг: уточните у исполнителя текущий статус и следующий срок.'
                : 'Следующий шаг: уточните у команды, кто возьмёт заявку.'}
            </p>
          )}
        </div>
      )}
      {brief.topic === 'owner' && (
        <p className='mt-2 text-sm'>
          Исполнитель: {owner} · Команда: {team}
        </p>
      )}
      {brief.topic === 'history' &&
        (history.length ? (
          <ul className='mt-2 space-y-1 text-sm'>
            {history.map((event) => (
              <li key={event.seq}>
                <span className='text-muted-foreground'>
                  {formatDate(event.observedAt)} ·{' '}
                </span>
                {eventHeadline(event.reasons)}
                {event.detail && ` — ${event.detail}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className='mt-2 text-sm'>В доступной истории изменений нет.</p>
        ))}
      <div className='mt-2 flex flex-wrap gap-2'>
        {brief.topic !== 'owner' && (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => onTopic('owner')}
          >
            Кто ведёт?
          </Button>
        )}
        {brief.topic !== 'history' && (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => onTopic('history')}
          >
            Что менялось?
          </Button>
        )}
      </div>
    </section>
  )
}
