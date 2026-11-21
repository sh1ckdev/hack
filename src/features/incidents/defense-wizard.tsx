import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DEFENSE_DEMO_INCIDENT_ID,
  DEFENSE_STEPS,
  type DefenseScenarioKey,
} from './defense-script'

async function postDemo(path: string) {
  const response = await fetch(path, { method: 'POST' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      typeof body.error === 'string' ? body.error : 'Ошибка демо API'
    )
  }
  return body
}

export function DefenseWizard({
  open,
  onOpenChange,
  onFocusIncident,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFocusIncident: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const isIntro = step === 0
  const isDone = step > DEFENSE_STEPS.length
  const current =
    step > 0 && step <= DEFENSE_STEPS.length
      ? DEFENSE_STEPS[step - 1]
      : undefined

  async function resetDemo() {
    setBusy(true)
    try {
      await postDemo('/api/demo/reset')
      await queryClient.resetQueries({ queryKey: ['incident-dashboard'] })
      toast.success('Выгрузка сброшена, лента обнулена.')
      setStep(1)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Сброс недоступен (только dev).'
      )
    } finally {
      setBusy(false)
    }
  }

  async function runScenario(key: DefenseScenarioKey) {
    setBusy(true)
    try {
      await postDemo(`/api/demo/scenario/${encodeURIComponent(key)}`)
      await queryClient.invalidateQueries({ queryKey: ['incident-dashboard'] })
      toast.success('Сценарий применён — смотрите ленту и канбан.')
      setStep((s) => s + 1)
      requestAnimationFrame(() => onFocusIncident(DEFENSE_DEMO_INCIDENT_ID))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось применить сценарий.'
      )
    } finally {
      setBusy(false)
    }
  }

  function nextAfterScenario() {
    setStep((s) => s + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        showOverlay={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        className='fixed top-auto right-auto bottom-4 left-4 z-50 w-[min(100vw-2rem,22rem)] max-w-none translate-x-0 translate-y-0 gap-3 border-border bg-card p-4 shadow-[var(--granat-shadow)] data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-2 data-[state=open]:slide-in-from-left-2 sm:max-w-[22rem]'
      >
        <DialogTitle className='text-base'>Для демо</DialogTitle>
        <DialogDescription className='sr-only'>
          Пошаговые демо-сценарии
        </DialogDescription>

        {isIntro ? (
          <div className='space-y-2 text-sm'>
            <ol className='max-h-32 list-decimal space-y-0.5 overflow-y-auto ps-4 text-xs text-muted-foreground'>
              {DEFENSE_STEPS.map((s) => (
                <li key={s.key}>
                  {s.title}
                </li>
              ))}
            </ol>
          </div>
        ) : current ? (
          <div className='space-y-2 text-sm'>
            <p className='text-xs text-muted-foreground'>
              Шаг {step} из {DEFENSE_STEPS.length}
            </p>
            <h3 className='font-medium text-foreground'>{current.title}</h3>
            <p className='text-xs text-muted-foreground'>{current.guide}</p>
            <p className='rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs leading-relaxed text-foreground'>
              {current.lookFor}
            </p>
          </div>
        ) : isDone ? (
          <p className='text-sm text-chart-2'>
            Цепочка завершена. Можно закрыть мастер или начать сначала.
          </p>
        ) : null}

        <div className='flex flex-wrap justify-end gap-2'>
          {isIntro && (
            <Button
              type='button'
              size='sm'
              disabled={busy}
              onClick={() => void resetDemo()}
            >
              Сбросить и начать
            </Button>
          )}
          {current && !isIntro && (
            <>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='h-8'
                disabled={busy}
                onClick={() => onFocusIncident(DEFENSE_DEMO_INCIDENT_ID)}
              >
                К INC
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-8'
                disabled={busy}
                onClick={nextAfterScenario}
              >
                Пропустить
              </Button>
              <Button
                type='button'
                size='sm'
                className='h-8'
                disabled={busy}
                onClick={() => void runScenario(current.key)}
              >
                Применить шаг
              </Button>
            </>
          )}
          {isDone && (
            <Button type='button' size='sm' onClick={() => setStep(0)}>
              Сначала
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}