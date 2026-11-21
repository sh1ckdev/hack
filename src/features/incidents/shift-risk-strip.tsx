import { cn } from '@/lib/utils'
import type { ShiftRiskSummary } from './shift-risk'

type RiskChip = {
  key: keyof ShiftRiskSummary
  label: string
  value: number
  tone?: 'danger' | 'warn' | 'info'
}

export function ShiftRiskStrip({
  summary,
  className,
  onJump,
}: {
  summary: ShiftRiskSummary
  className?: string
  onJump: (kind: keyof ShiftRiskSummary) => void
}) {
  const chips: RiskChip[] = [
    {
      key: 'overdue',
      label: 'просрочено',
      value: summary.overdue,
      tone: 'danger',
    },
    {
      key: 'dueSoon',
      label: 'срок ≤2 ч',
      value: summary.dueSoon,
      tone: 'warn',
    },
    {
      key: 'slaForecast',
      label: 'прогноз SLA',
      value: summary.slaForecast,
      tone: 'warn',
    },
    {
      key: 'critical',
      label: 'крит.',
      value: summary.critical,
      tone: 'danger',
    },
    {
      key: 'coordinators',
      label: 'коорд.',
      value: summary.coordinators,
    },
    {
      key: 'multiSection',
      label: '2+ секции',
      value: summary.multiSection,
      tone: 'info',
    },
    {
      key: 'unassigned',
      label: 'без исп.',
      value: summary.unassigned,
      tone: 'warn',
    },
    {
      key: 'productBursts',
      label: 'всплески',
      value: summary.productBursts,
    },
  ]

  const visible = chips.filter((chip) => chip.value > 0)
  if (!visible.length) {
    return (
      <p
        className={cn(
          'shrink-0 text-xs text-chart-2 tabular-nums',
          className
        )}
        title='Активные риски смены не обнаружены'
      >
        риск смены: ок
      </p>
    )
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5',
        className
      )}
      role='group'
      aria-label='Риск смены'
    >
      <span className='shrink-0 text-xs font-medium text-muted-foreground'>
        Риск смены
      </span>
      {visible.map((chip) => (
        <button
          key={chip.key}
          type='button'
          className={cn(
            'granat-chip h-7 shrink-0 cursor-pointer px-2 py-0 text-xs tabular-nums',
            chip.tone === 'danger' &&
              'border-signal/40 bg-signal/10 text-signal',
            chip.tone === 'warn' &&
              'border-chart-4/40 bg-chart-4/10 text-foreground',
            chip.tone === 'info' &&
              'border-link/35 bg-link/10 text-link'
          )}
          title={`Перейти к примеру: ${chip.label}`}
          onClick={() => onJump(chip.key)}
        >
          {chip.label} {chip.value}
        </button>
      ))}
    </div>
  )
}