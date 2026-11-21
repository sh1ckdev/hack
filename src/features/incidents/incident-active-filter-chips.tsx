import {
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  defaultIncidentFilterPrefs,
  filtersAreDefault,
  type IncidentFilterPrefs,
} from './incident-filters'
import { incidentGroups } from './model'
import { GranatFilterChip } from '@/components/granat/granat-chip'
import { Button } from '@/components/ui/button'

export type FilterChip = {
  key: string
  label: string
  patch: Partial<IncidentFilterPrefs>
}

export function buildActiveFilterChips(
  prefs: IncidentFilterPrefs
): FilterChip[] {
  const def = defaultIncidentFilterPrefs()
  const chips: FilterChip[] = []

  const q = prefs.query.trim()
  if (q) {
    chips.push({ key: 'query', label: `Поиск: ${q}`, patch: { query: '' } })
  }

  if (prefs.priorities.length < def.priorities.length) {
    const labels = prefs.priorities
      .map(
        (p) =>
          PRIORITY_OPTIONS.find((o) => o.value === p)?.label ??
          (p === 'unknown' ? 'Без приоритета' : p)
      )
      .join(', ')
    chips.push({
      key: 'priorities',
      label: `Приоритет: ${labels}`,
      patch: { priorities: [...def.priorities] },
    })
  }

  if (prefs.states.length < def.states.length) {
    chips.push({
      key: 'states',
      label: 'Статус: выбранные',
      patch: { states: [...def.states] },
    })
  }

  if (prefs.queueGroups.length) {
    const titles = prefs.queueGroups
      .map((key) => incidentGroups.find((g) => g.key === key)?.title ?? key)
      .join(', ')
    chips.push({
      key: 'queueGroups',
      label: `Секции: ${titles}`,
      patch: { queueGroups: [] },
    })
  }

  if (prefs.products.length) {
    chips.push({
      key: 'products',
      label: `Продукты: ${prefs.products.length}`,
      patch: { products: [] },
    })
  }
  if (prefs.teams.length) {
    chips.push({
      key: 'teams',
      label: `Команды: ${prefs.teams.length}`,
      patch: { teams: [] },
    })
  }
  if (prefs.services.length) {
    chips.push({
      key: 'services',
      label: `Сервисы: ${prefs.services.length}`,
      patch: { services: [] },
    })
  }

  if (prefs.sortBy !== def.sortBy) {
    const label =
      SORT_OPTIONS.find((s) => s.value === prefs.sortBy)?.label ?? prefs.sortBy
    chips.push({
      key: 'sortBy',
      label: `Сортировка: ${label}`,
      patch: { sortBy: def.sortBy },
    })
  }

  if (prefs.onlyActive) {
    chips.push({
      key: 'onlyActive',
      label: 'В работе',
      patch: { onlyActive: false },
    })
  }
  if (prefs.hideResolved) {
    chips.push({
      key: 'hideResolved',
      label: 'Без закрытых',
      patch: { hideResolved: false },
    })
  }
  if (prefs.onlyCritical) {
    chips.push({
      key: 'onlyCritical',
      label: 'Критические',
      patch: { onlyCritical: false },
    })
  }
  if (prefs.onlyCoordinators) {
    chips.push({
      key: 'onlyCoordinators',
      label: 'Координаторы',
      patch: { onlyCoordinators: false },
    })
  }
  if (prefs.onlyWatched) {
    chips.push({
      key: 'onlyWatched',
      label: 'На смене',
      patch: { onlyWatched: false },
    })
  }
  if (prefs.onlyOverdue) {
    chips.push({
      key: 'onlyOverdue',
      label: 'Просрочка',
      patch: { onlyOverdue: false },
    })
  }
  if (prefs.onlyDueSoon) {
    chips.push({
      key: 'onlyDueSoon',
      label: 'Срок в 2 ч',
      patch: { onlyDueSoon: false },
    })
  }
  if (prefs.unassignedEmployee) {
    chips.push({
      key: 'unassignedEmployee',
      label: 'Без исполнителя',
      patch: { unassignedEmployee: false },
    })
  }
  if (prefs.unassignedTeam) {
    chips.push({
      key: 'unassignedTeam',
      label: 'Без команды',
      patch: { unassignedTeam: false },
    })
  }
  if (prefs.deadlineFilter !== def.deadlineFilter) {
    const dl =
      prefs.deadlineFilter === 'with'
        ? 'Со сроком'
        : prefs.deadlineFilter === 'without'
          ? 'Без срока'
          : prefs.deadlineFilter
    chips.push({
      key: 'deadlineFilter',
      label: `Срок: ${dl}`,
      patch: { deadlineFilter: def.deadlineFilter },
    })
  }
  if (prefs.hideEmptyColumns) {
    chips.push({
      key: 'hideEmptyColumns',
      label: 'Пустые колонки скрыты',
      patch: { hideEmptyColumns: false },
    })
  }

  return chips
}

export function IncidentActiveFilterChips({
  prefs,
  setPrefs,
  reset,
}: {
  prefs: IncidentFilterPrefs
  setPrefs: (patch: Partial<IncidentFilterPrefs>) => void
  reset: () => void
}) {
  if (filtersAreDefault(prefs)) return null
  const chips = buildActiveFilterChips(prefs)

  return (
    <div className='flex flex-wrap items-center gap-1.5 border-b border-border px-4 py-2.5'>
      {chips.map((chip) => (
        <GranatFilterChip
          key={chip.key}
          label={chip.label}
          onDismiss={() => setPrefs(chip.patch)}
        />
      ))}
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='h-8 rounded-xl px-2.5 text-sm font-normal text-link'
        onClick={reset}
      >
        Сбросить все
      </Button>
    </div>
  )
}