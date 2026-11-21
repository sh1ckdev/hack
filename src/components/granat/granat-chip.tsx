import { cn } from '@/lib/utils'

export function GranatChip({
  selected,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type='button'
      className={cn(
        'granat-chip',
        selected && 'granat-chip-selected',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function GranatFilterChip({
  label,
  onDismiss,
  className,
}: {
  label: string
  onDismiss: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        'granat-chip-filter inline-flex max-w-full items-center gap-1',
        className
      )}
    >
      <span className='truncate'>{label}</span>
      <button
        type='button'
        className='rounded-lg p-0.5 text-muted-foreground hover:bg-[var(--color-background-hover)] hover:text-foreground'
        aria-label={`Убрать фильтр: ${label}`}
        onClick={onDismiss}
      >
        ×
      </button>
    </span>
  )
}