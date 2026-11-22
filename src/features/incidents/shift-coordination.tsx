import { createContext, useContext, useState, type ReactNode } from 'react'
import type { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  coordinationViewSchema,
  operatorSchema,
  type CoordinationCommand,
  type Operator,
} from './coordination-model'
import { formatDate } from './model'

const key = 'relay-shift-operator'
const queryKey = ['shift-coordination']
type Mark = z.infer<typeof coordinationViewSchema>[number]
const ShiftContext = createContext<{
  entries: Map<string, Mark>
  operator: Operator | undefined
  saveName: (name: string) => void
} | null>(null)

function readOperator() {
  try {
    return operatorSchema.parse(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return undefined
  }
}

export function ShiftCoordinationProvider({
  children,
}: {
  children: ReactNode
}) {
  const [operator, setOperator] = useState(readOperator)
  const id = operator?.id ?? ''
  const { data = [] } = useQuery({
    queryKey: [...queryKey, id],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/shift-coordination', {
        headers: { 'X-Relay-Operator': id },
        signal,
      })
      if (!response.ok) throw new Error('Отметки смены недоступны')
      return coordinationViewSchema.parse(await response.json())
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  })
  const entries = new Map(data.map((entry) => [entry.incidentId, entry]))
  function saveName(name: string) {
    const next = operatorSchema.safeParse({
      name,
      id:
        operator?.id ??
        Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join(''),
    })
    if (!next.success) return
    try {
      localStorage.setItem(key, JSON.stringify(next.data))
    } catch {
      /* Имя остаётся до закрытия вкладки. */
    }
    setOperator(next.data)
  }
  return (
    <ShiftContext.Provider value={{ entries, operator, saveName }}>
      {children}
    </ShiftContext.Provider>
  )
}

export function ShiftCoordinationMark({ id }: { id: string }) {
  const entry = useContext(ShiftContext)?.entries.get(id)
  if (!entry?.claimed && !entry?.seen) return null
  return (
    <p className='mt-1 text-xs wrap-anywhere text-muted-foreground'>
      {entry.claimed ? (
        <>
          Взял в работу:{' '}
          <strong className='text-foreground'>{entry.claimed.name}</strong>
        </>
      ) : (
        <>Увидел: {entry.seen?.name}</>
      )}
    </p>
  )
}

export function useShiftCoordinationAction() {
  const context = useContext(ShiftContext)
  const operator = context?.operator
  const client = useQueryClient()
  const action = useMutation({
    mutationFn: async ({
      incidentId,
      kind,
    }: {
      incidentId: string
      kind: CoordinationCommand['action']
    }) => {
      if (!operator) throw new Error('Укажите имя дежурного.')
      const response = await fetch('/api/shift-coordination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Request': 'shift-coordination',
        },
        body: JSON.stringify({ incidentId, operator, action: kind }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'Не удалось обновить отметку.'
        )
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  })
  return { context, action }
}

export function ShiftCoordinationActions({
  id,
  active,
}: {
  id: string
  active: boolean
}) {
  const { context, action } = useShiftCoordinationAction()
  const entry = context?.entries.get(id)
  const operator = context?.operator
  const [name, setName] = useState('')
  if (!context || (!active && !entry?.seen && !entry?.claimed)) return null
  return (
    <section
      aria-label='Отметки смены'
      className='space-y-2 rounded-xl border border-border px-4 py-3 text-sm'
    >
      <h3 className='font-semibold'>Отметки смены</h3>
      {entry?.seen && (
        <p>
          Увидел: {entry.seen.name} ·{' '}
          {formatDate(new Date(entry.seen.at).toISOString())}
        </p>
      )}
      {entry?.claimed && (
        <p>
          Взял в работу: {entry.claimed.name} ·{' '}
          {formatDate(new Date(entry.claimed.at).toISOString())}
        </p>
      )}
      {!operator && active && (
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            context.saveName(name)
          }}
        >
          <Input
            className='min-w-40 flex-1'
            aria-label='Имя дежурного'
            placeholder='Ваше имя в смене'
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
          />
          <Button
            type='submit'
            size='sm'
            variant='outline'
            disabled={!name.trim()}
          >
            Сохранить имя
          </Button>
        </form>
      )}
      {operator && (
        <div className='flex flex-wrap gap-2'>
          {active && !entry?.seen && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={action.isPending}
              onClick={() => action.mutate({ kind: 'see', incidentId: id })}
            >
              Увидел
            </Button>
          )}
          {active && !entry?.claimed && (
            <Button
              type='button'
              size='sm'
              disabled={action.isPending}
              onClick={() => action.mutate({ kind: 'claim', incidentId: id })}
            >
              Беру в работу
            </Button>
          )}
          {entry?.claimed?.mine && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={action.isPending}
              onClick={() => action.mutate({ kind: 'release', incidentId: id })}
            >
              Освободить заявку
            </Button>
          )}
        </div>
      )}
      {action.error && (
        <p role='alert' className='text-destructive'>
          {action.error.message}
        </p>
      )}
    </section>
  )
}
