import { cn } from '@/lib/utils'
import type { StationMode } from './station'

const modes: { id: StationMode; label: string }[] = [
  { id: 'wall', label: 'Общий экран' },
  { id: 'desk', label: 'Моё место' },
]

export function StationSwitch({
  mode,
  onChange,
}: {
  mode: StationMode
  onChange: (mode: StationMode) => void
}) {
  return (
    <div
      className='dash-segmented shrink-0'
      role='tablist'
      aria-label='Режим дашборда'
    >
      {modes.map((item) => (
        <button
          key={item.id}
          type='button'
          role='tab'
          aria-selected={mode === item.id}
          className={cn(
            'dash-segment',
            mode === item.id
              ? 'bg-card text-foreground shadow-[var(--granat-shadow)]'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
