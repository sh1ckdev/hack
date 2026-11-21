import { useMemo, useState } from 'react'
import { ChevronDown, Filter, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  PRIORITY_OPTIONS,
  SORT_OPTIONS,
  STATE_OPTIONS,
  type DeadlineFilter,
  type IncidentFilterPrefs,
  incidentFilterFacets,
  type IncidentSortMode,
} from './incident-filters'
import type { DashboardSnapshot } from './model'
import { GranatChip } from '@/components/granat/granat-chip'
import { GranatSearch } from '@/components/granat/granat-search'

function FilterSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      <h3 className='granat-caption text-sm font-medium text-foreground'>
        {title}
      </h3>
      {children}
    </section>
  )
}

function BoolRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className='flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-2.5'>
      <div className='min-w-0 space-y-0.5'>
        <Label htmlFor={id} className='text-sm font-medium leading-snug'>
          {label}
        </Label>
        {description && (
          <p className='text-xs text-muted-foreground'>{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className='mt-0.5'
      />
    </div>
  )
}

function FacetList({
  values,
  selected,
  emptyMeansAll,
  onChange,
  facetSearch,
  onFacetSearch,
  maxHeight = '8.5rem',
}: {
  values: string[]
  selected: string[]
  emptyMeansAll: boolean
  onChange: (next: string[]) => void
  facetSearch: string
  onFacetSearch: (value: string) => void
  maxHeight?: string
}) {
  const selectedSet = useMemo(() => {
    if (emptyMeansAll) return new Set(values)
    return new Set(selected)
  }, [emptyMeansAll, selected, values])

  const filtered = useMemo(() => {
    const q = facetSearch.trim().toLowerCase()
    if (!q) return values
    return values.filter((v) => v.toLowerCase().includes(q))
  }, [facetSearch, values])

  function toggle(value: string, checked: boolean) {
    const base = emptyMeansAll ? [...values] : [...selected]
    const set = new Set(base)
    if (checked) set.add(value)
    else set.delete(value)
    const next = [...set]
    if (next.length === values.length) onChange([])
    else onChange(next)
  }

  if (!values.length) {
    return (
      <p className='text-xs text-muted-foreground'>Нет значений в выгрузке</p>
    )
  }

  return (
    <div className='space-y-2'>
      <Input
        value={facetSearch}
        onChange={(e) => onFacetSearch(e.target.value)}
        placeholder='Поиск в списке…'
        className='h-8 text-xs'
      />
      <ScrollArea style={{ height: maxHeight }} className='rounded-md border'>
        <ul className='space-y-0.5 p-2'>
          {filtered.map((value) => (
            <li key={value}>
              <label className='flex cursor-pointer items-start gap-2 rounded-sm px-1.5 py-1 hover:bg-muted/60'>
                <Checkbox
                  checked={selectedSet.has(value)}
                  onCheckedChange={(c) => toggle(value, c === true)}
                  className='mt-0.5'
                />
                <span className='text-xs leading-snug wrap-anywhere'>{value}</span>
              </label>
            </li>
          ))}
        </ul>
      </ScrollArea>
      {!emptyMeansAll && (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-7 text-xs'
          onClick={() => onChange([])}
        >
          Сбросить — показывать все
        </Button>
      )}
    </div>
  )
}

export function IncidentFiltersControl({
  prefs,
  setPrefs,
  reset,
  activeCount,
  incidents,
  detailCards,
  onDetailCardsChange,
  className,
}: {
  prefs: IncidentFilterPrefs
  setPrefs: (patch: Partial<IncidentFilterPrefs>) => void
  reset: () => void
  activeCount: number
  incidents: DashboardSnapshot['incidents']
  detailCards?: boolean
  onDetailCardsChange?: (enabled: boolean) => void
  className?: string
}) {
  const facets = useMemo(() => incidentFilterFacets(incidents), [incidents])
  const [productSearch, setProductSearch] = useState('')
  const [teamSearch, setTeamSearch] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [advanced, setAdvanced] = useState(false)

  const allPriorities = ['4', '3', '2', '1', 'unknown'] as const

  function togglePriority(value: (typeof allPriorities)[number], checked: boolean) {
    const set = new Set(prefs.priorities)
    if (checked) set.add(value)
    else set.delete(value)
    const next = allPriorities.filter((p) => set.has(p))
    setPrefs({ priorities: [...next] })
  }

  function toggleState(value: string, checked: boolean) {
    const all = STATE_OPTIONS.map((s) => s.value)
    const set = new Set(
      prefs.states.length === all.length ? all : prefs.states
    )
    if (checked) set.add(value)
    else set.delete(value)
    const next = all.filter((s) => set.has(s))
    setPrefs({ states: next })
  }

  function toggleQueueGroup(key: string, checked: boolean) {
    const set = new Set(prefs.queueGroups)
    if (checked) set.add(key)
    else set.delete(key)
    setPrefs({ queueGroups: [...set] })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type='button'
          size='sm'
          variant={activeCount ? 'secondary' : 'outline'}
          className={cn(
            'relative h-9 gap-1.5 rounded-xl px-3 text-sm font-normal',
            className
          )}
          aria-label={`Фильтры очереди${activeCount ? `, активно: ${activeCount}` : ''}`}
        >
          <Filter aria-hidden className='size-3.5' />
          <span className='max-md:sr-only'>Фильтры</span>
          {activeCount > 0 && (
            <Badge
              variant='default'
              className='h-4 min-w-4 rounded-sm px-1 text-[10px]'
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className='flex w-full flex-col sm:max-w-md'>
        <SheetHeader className='pb-0 text-start'>
          <SheetTitle>Фильтры</SheetTitle>
          <SheetDescription className='sr-only'>
            Поиск и отбор карточек в канбане
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className='min-h-0 flex-1 px-4'>
          <div className='space-y-5 pb-4 pe-3'>
            <FilterSection title='Поиск'>
              <GranatSearch
                value={prefs.query}
                onValueChange={(query) => setPrefs({ query })}
                placeholder='INC, продукт, команда…'
              />
            </FilterSection>

            <FilterSection title='Сортировка'>
              <Select
                value={prefs.sortBy}
                onValueChange={(v) =>
                  setPrefs({ sortBy: v as IncidentSortMode })
                }
              >
                <SelectTrigger className='w-full text-sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterSection>

            <FilterSection title='Быстро'>
              <div className='flex flex-wrap gap-1.5'>
                <GranatChip
                  selected={prefs.onlyCritical}
                  onClick={() =>
                    setPrefs({ onlyCritical: !prefs.onlyCritical })
                  }
                >
                  Критические
                </GranatChip>
                <GranatChip
                  selected={prefs.onlyCoordinators}
                  onClick={() =>
                    setPrefs({ onlyCoordinators: !prefs.onlyCoordinators })
                  }
                >
                  Координаторы
                </GranatChip>
                <GranatChip
                  selected={prefs.onlyOverdue}
                  onClick={() =>
                    setPrefs({ onlyOverdue: !prefs.onlyOverdue })
                  }
                >
                  Просрочка
                </GranatChip>
                <GranatChip
                  selected={prefs.onlyWatched}
                  onClick={() =>
                    setPrefs({ onlyWatched: !prefs.onlyWatched })
                  }
                >
                  На смене
                </GranatChip>
              </div>
              <div className='mt-3 space-y-2'>
                <BoolRow
                  id='f-only-active'
                  label='Только в работе'
                  checked={prefs.onlyActive}
                  onCheckedChange={(onlyActive) => setPrefs({ onlyActive })}
                />
                <BoolRow
                  id='f-hide-resolved'
                  label='Скрыть закрытые'
                  checked={prefs.hideResolved}
                  onCheckedChange={(hideResolved) => setPrefs({ hideResolved })}
                />
              </div>
            </FilterSection>

            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-8 w-full justify-between gap-2 px-2 text-xs font-normal'
              aria-expanded={advanced}
              onClick={() => setAdvanced((open) => !open)}
            >
              {advanced ? 'Скрыть расширенные' : 'Расширенные фильтры'}
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0 transition-transform',
                  advanced && 'rotate-180'
                )}
              />
            </Button>

            {advanced && (
              <>
            <FilterSection title='Приоритет'>
              <ul className='space-y-1.5'>
                {PRIORITY_OPTIONS.map(({ value, label }) => (
                  <li key={value}>
                    <label className='flex items-center gap-2 text-sm'>
                      <Checkbox
                        checked={prefs.priorities.includes(value)}
                        onCheckedChange={(c) =>
                          togglePriority(value, c === true)
                        }
                      />
                      {label}
                      <span className='font-mono text-xs text-muted-foreground'>
                        {value}
                      </span>
                    </label>
                  </li>
                ))}
                <li>
                  <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                      checked={prefs.priorities.includes('unknown')}
                      onCheckedChange={(c) =>
                        togglePriority('unknown', c === true)
                      }
                    />
                    Без приоритета
                  </label>
                </li>
              </ul>
            </FilterSection>

            <FilterSection title='Статус'>
              <ul className='space-y-1.5'>
                {STATE_OPTIONS.map(({ value, label }) => (
                  <li key={value}>
                    <label className='flex items-center gap-2 text-sm'>
                      <Checkbox
                        checked={
                          prefs.states.length === STATE_OPTIONS.length ||
                          prefs.states.includes(value)
                        }
                        onCheckedChange={(c) => toggleState(value, c === true)}
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </FilterSection>

            <FilterSection title='Роли в очереди'>
              <p className='text-xs text-muted-foreground'>
                Пустой выбор — любые. Отметьте одну или несколько ролей.
              </p>
              <ul className='space-y-1.5'>
                {facets.queueGroups.map(({ key, title }) => (
                  <li key={key}>
                    <label className='flex items-center gap-2 text-sm'>
                      <Checkbox
                        checked={prefs.queueGroups.includes(key)}
                        onCheckedChange={(c) =>
                          toggleQueueGroup(key, c === true)
                        }
                      />
                      {title}
                    </label>
                  </li>
                ))}
              </ul>
            </FilterSection>

            <FilterSection title='Продукт'>
              <FacetList
                values={facets.products}
                selected={prefs.products}
                emptyMeansAll={!prefs.products.length}
                onChange={(products) => setPrefs({ products })}
                facetSearch={productSearch}
                onFacetSearch={setProductSearch}
              />
            </FilterSection>

            <FilterSection title='Команда'>
              <FacetList
                values={facets.teams}
                selected={prefs.teams}
                emptyMeansAll={!prefs.teams.length}
                onChange={(teams) => setPrefs({ teams })}
                facetSearch={teamSearch}
                onFacetSearch={setTeamSearch}
              />
            </FilterSection>

            <FilterSection title='Сервис'>
              <FacetList
                values={facets.services}
                selected={prefs.services}
                emptyMeansAll={!prefs.services.length}
                onChange={(services) => setPrefs({ services })}
                facetSearch={serviceSearch}
                onFacetSearch={setServiceSearch}
              />
            </FilterSection>

            <FilterSection title='Срок'>
              <Select
                value={prefs.deadlineFilter}
                onValueChange={(v) =>
                  setPrefs({ deadlineFilter: v as DeadlineFilter })
                }
              >
                <SelectTrigger className='w-full text-sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Любой</SelectItem>
                  <SelectItem value='with'>Только со сроком</SelectItem>
                  <SelectItem value='without'>Без срока</SelectItem>
                </SelectContent>
              </Select>
            </FilterSection>

            <FilterSection title='Ещё условия'>
              <div className='space-y-2'>
                <BoolRow
                  id='f-only-critical'
                  label='Только критические (P4)'
                  checked={prefs.onlyCritical}
                  onCheckedChange={(onlyCritical) => setPrefs({ onlyCritical })}
                />
                <BoolRow
                  id='f-only-coord'
                  label='Только у координаторов'
                  checked={prefs.onlyCoordinators}
                  onCheckedChange={(onlyCoordinators) =>
                    setPrefs({ onlyCoordinators })
                  }
                />
                <BoolRow
                  id='f-only-watched'
                  label='Только «на смене»'
                  checked={prefs.onlyWatched}
                  onCheckedChange={(onlyWatched) => setPrefs({ onlyWatched })}
                />
                <BoolRow
                  id='f-only-overdue'
                  label='Только просроченные'
                  checked={prefs.onlyOverdue}
                  onCheckedChange={(onlyOverdue) => setPrefs({ onlyOverdue })}
                />
                <BoolRow
                  id='f-only-due-soon'
                  label='Срок в ближайшие 2 ч'
                  checked={prefs.onlyDueSoon}
                  onCheckedChange={(onlyDueSoon) => setPrefs({ onlyDueSoon })}
                />
                <BoolRow
                  id='f-unassigned-emp'
                  label='Без исполнителя'
                  checked={prefs.unassignedEmployee}
                  onCheckedChange={(unassignedEmployee) =>
                    setPrefs({ unassignedEmployee })
                  }
                />
                <BoolRow
                  id='f-unassigned-team'
                  label='Без команды'
                  checked={prefs.unassignedTeam}
                  onCheckedChange={(unassignedTeam) =>
                    setPrefs({ unassignedTeam })
                  }
                />
                {onDetailCardsChange && (
                  <BoolRow
                    id='f-detail-cards'
                    label='Подробные карточки'
                    description='Больше полей и подсветок при смене приоритета'
                    checked={!!detailCards}
                    onCheckedChange={onDetailCardsChange}
                  />
                )}
              </div>
            </FilterSection>
              </>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className='flex-row gap-2 sm:justify-between'>
          <Button
            type='button'
            variant='outline'
            className='gap-1.5'
            onClick={reset}
          >
            <RotateCcw className='size-3.5' />
            Сбросить фильтры
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}