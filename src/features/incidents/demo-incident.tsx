import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { formatDate, incidentStatus } from '@/features/incidents/model'
import { useIncidentDashboard } from '@/features/incidents/use-incident-dashboard'

export function DemoIncident({ incidentId }: { incidentId: string }) {
  const { data, isPending, isError } = useIncidentDashboard()
  const incident = data?.incidents.find(({ id }) => id === incidentId)

  return (
    <>
      <Header>
        <span className='text-sm font-semibold'>Демо ITSM</span>
      </Header>
      <Main className='w-full min-w-0 space-y-4 sm:px-8'>
        <Button variant='outline' asChild>
          <Link to='/'>
            <ArrowLeft aria-hidden='true' /> К дашборду
          </Link>
        </Button>
        <article className='max-w-3xl space-y-5 rounded-2xl border bg-card p-5 sm:p-8'>
          <div className='space-y-2'>
            <Badge variant='secondary'>Демо · только просмотр</Badge>
            <h1 className='text-2xl font-extrabold break-all'>{incidentId}</h1>
            <p className='text-sm text-muted-foreground'>
              Локальная карточка из выгрузки. Изменения в рабочей системе МТС
              здесь недоступны.
            </p>
          </div>
          {(isError || data?.source.state === 'stale') && (
            <p role='status' className='text-sm text-destructive'>
              {data
                ? 'Показан последний успешный снимок.'
                : 'Выгрузка временно недоступна.'}
            </p>
          )}
          {incident ? (
            <>
              <h2 className='text-lg font-bold wrap-anywhere'>
                {incident.header || 'Инцидент'}
              </h2>
              <p className='text-sm wrap-anywhere'>
                {incident.description ||
                  incident.shortDescription ||
                  'Описание отсутствует.'}
              </p>
              <dl className='grid gap-4 border-t pt-4 sm:grid-cols-2'>
                {[
                  ['Статус', incidentStatus(incident)],
                  ['Продукт', incident.productName],
                  ['Сервис', incident.service],
                  ['Исполнитель', incident.assignedEmployee],
                  ['Команда', incident.assignedGroupName],
                  ['Регистрация', formatDate(incident.submitDate)],
                  ['Дедлайн', formatDate(incident.deadline)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className='text-xs text-muted-foreground'>{label}</dt>
                    <dd className='text-sm wrap-anywhere'>
                      {value || 'Не указано'}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p role='status' className='text-sm text-muted-foreground'>
              {isPending
                ? 'Загружаем карточку…'
                : data
                  ? 'Инцидент отсутствует в выгрузке.'
                  : 'Карточку пока не удалось загрузить.'}
            </p>
          )}
        </article>
      </Main>
    </>
  )
}
