import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

export function GranatSearch({
  value,
  onValueChange,
  placeholder = 'Поиск по INC, продукту, команде…',
  className,
  id,
  'aria-label': ariaLabel = 'Поиск по очереди',
}: {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  'aria-label'?: string
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        aria-hidden
        className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
      />
      <Input
        id={id}
        type='search'
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className='granat-search h-11 rounded-2xl border-transparent bg-secondary ps-10 text-base shadow-none focus-visible:border-border'
      />
    </div>
  )
}