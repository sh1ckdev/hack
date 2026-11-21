import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function ShiftCalmToggle({
  enabled,
  onToggle,
  className,
}: {
  enabled: boolean
  onToggle: () => void
  className?: string
}) {
  const on = enabled
  return (
    <Button
      type='button'
      size='sm'
      variant={on ? 'secondary' : 'outline'}
      className={cn(
        'h-8 shrink-0 gap-1.5 rounded-sm px-2.5 text-xs font-normal',
        className
      )}
      aria-pressed={on}
      title={
        on
          ? 'Спокойный режим: меньше подсветок на карточках, сдвиги — в ленте над канбаном'
          : 'Полная подсветка всех изменений на карточках'
      }
      onClick={onToggle}
    >
      {on ? (
        <EyeOff aria-hidden className='size-3.5' />
      ) : (
        <Eye aria-hidden className='size-3.5' />
      )}
      <span>{on ? 'Спокойно' : 'Всё сразу'}</span>
    </Button>
  )
}