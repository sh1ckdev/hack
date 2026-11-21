import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { IncidentDetails } from './incident-details'
import { filterIncidents, sortIncidentsForDisplay } from './incident-filters'
import { IncidentFiltersControl } from './incident-filters-control'
import { IncidentActiveFilterChips } from './incident-active-filter-chips'
import { GranatSearch } from '@/components/granat/granat-search'
import {
  eventHeadline,
  eventSeverity,
  incidentGroups,
  primaryQueueLane,
  reasonLabels,
  type DashboardSnapshot,
} from './model'
import { eventsSignature, laneSignature } from './lane-signature'
import { QueueLane } from './queue-lane'
import { ShiftFeed } from './shift-feed'
import {
  buildShiftStartedBrief,
  OPEN_INCIDENT_EVENT,
  type OpenIncidentDetail,
} from './ops'
import { DefenseWizard } from './defense-wizard'
import { isShiftFocusActive, shiftFocusFilterPatch } from './shift-focus'
import {
  buildShiftRiskSummary,
  firstIncidentForRisk,
  type ShiftRiskSummary,
} from './shift-risk'
import { ShiftRiskStrip } from './shift-risk-strip'
import {
  readShiftAnchor,
  writeShiftAnchor,
} from './shift-anchor'
import { planShiftTrails } from './shift-trail'
import {
  ShiftTrailOverlay,
  type ActiveShiftTrail,
} from './shift-trail-overlay'
import {
  LinkedCardsOverlay,
  type CardLinkFocus,
} from './linked-cards-overlay'
import { useIncidentDashboard } from './use-incident-dashboard'
import { useNow } from './use-now'
import { useWatchlist } from './use-watchlist'
import {
  deliverShiftAlert,
  primeShiftAlertAudio,
  readShiftAlertPrefs,
} from './shift-alerts'
import { ShiftAlertsControl } from './shift-alerts-control'
import {
  buildRecentPriorityHints,
  highlightIncidentIds,
  isPriorityShiftEvent,
  planFreshEventToasts,
  PRIORITY_HIGHLIGHT_MS,
  SHIFT_EVENT_JOURNAL_CAP,
} from './shift-event-notify'
import { useIncidentFilters } from './use-incident-filters'
import { PRIORITY_BURST_EVENT } from './shift-calm'
import { useShiftCalm } from './use-shift-calm'
import { useStation } from './use-station'
import { StationSwitch } from './station-switch'
import { WallClock } from './wall-status'
import { MyDesk } from './my-desk'
import { incidentsForSeat, operatorSeats } from './station'
import { defaultIncidentFilterPrefs } from './incident-filters'

export function IncidentsDashboard() {
  const { data } = useIncidentDashboard()
  const previous = useRef<{ runId: string; seq: number } | undefined>(undefined)
  const [highlighted, setHighlighted] = useState<Set<string>>(() => new Set())
  const sortNow = useNow(30_000)
  const [focusCard, setFocusCard] = useState<{ id: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const lastTrigger = useRef<HTMLButtonElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const queueScrollRef = useRef<HTMLDivElement | null>(null)
  const groupsBeforeRef = useRef<Map<string, string[]>>(new Map())
  const linkHoverRef = useRef<string | null>(null)
  const linkLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [linkedIncidentId, setLinkedIncidentId] = useState<string | null>(null)
  const [cardLinkFocus, setCardLinkFocus] = useState<CardLinkFocus | null>(null)
  const [pinnedLinkFocus, setPinnedLinkFocus] = useState<CardLinkFocus | null>(
    null
  )
  const pinnedLinkRef = useRef<CardLinkFocus | null>(null)
  pinnedLinkRef.current = pinnedLinkFocus
  const activeLinkFocus = pinnedLinkFocus ?? cardLinkFocus
  const [activeTrails, setActiveTrails] = useState<ActiveShiftTrail[]>([])
  const [shiftBriefOpen, setShiftBriefOpen] = useState(false)
  const [defenseWizardOpen, setDefenseWizardOpen] = useState(false)
  const [shiftAnchor, setShiftAnchor] = useState(readShiftAnchor)
  const { toggle: toggleWatch, isWatched, watched } = useWatchlist()
  const { prefs: filterPrefs, setPrefs: setFilterPrefs, reset: resetFilters, activeCount: filterActiveCount } =
    useIncidentFilters()
  const { prefs: calmPrefs, setPrefs: setCalmPrefs } = useShiftCalm()
  const station = useStation()
  const wall = station.mode === 'wall'
  const wallPrefs = useMemo(() => defaultIncidentFilterPrefs(), [])
  const calmEnabledRef = useRef(calmPrefs.enabled)
  calmEnabledRef.current = calmPrefs.enabled
  const watchedRef = useRef(watched)
  watchedRef.current = watched

  useEffect(() => {
    const prime = () => {
      primeShiftAlertAudio()
    }
    document.addEventListener('pointerdown', prime, { once: true, capture: true })
    return () =>
      document.removeEventListener('pointerdown', prime, { capture: true })
  }, [])

  useEffect(() => {
    if (!data) return
    const before = previous.current
    const latest = data.events[data.events.length - 1]?.seq ?? 0
    const groupsSnapshot = groupsBeforeRef.current
    previous.current = { runId: data.runId, seq: latest }
    if (before?.runId !== data.runId) {
      groupsBeforeRef.current = new Map(
        data.incidents.map((i) => [i.id, [...i.groups]])
      )
      return
    }
    if ((data.events[0]?.seq ?? 0) > before.seq + 1)
      toast.warning('Часть событий пропущена. Показана доступная история.')
    const fresh = data.events.filter(({ seq }) => seq > before.seq)
    const calm = calmEnabledRef.current
    if (fresh.length) {
      const toHighlight = highlightIncidentIds(
        fresh,
        watchedRef.current,
        calm
      )
      const priorityBatch = fresh.some((e) => isPriorityShiftEvent(e.reasons))
      const highlightMs =
        toHighlight.length && priorityBatch ? PRIORITY_HIGHLIGHT_MS : 5_000
      if (toHighlight.length) {
        setHighlighted((current) => {
          const next = new Set(current)
          for (const id of toHighlight) next.add(id)
          return next
        })
        window.setTimeout(() => {
          setHighlighted((current) => {
            const next = new Set(current)
            for (const id of toHighlight) next.delete(id)
            return next
          })
        }, highlightMs)
      }
      const trailPlans = planShiftTrails(
        groupsSnapshot,
        data.incidents,
        fresh
      )
      if (trailPlans.length) {
        const base = latest * 10
        setActiveTrails((current) =>
          [
            ...current,
            ...trailPlans.map((plan, index) => ({
              ...plan,
              key: base + index,
            })),
          ].slice(-3)
        )
      }

      if (
        fresh.some((e) =>
          e.reasons.some((r) => r === 'newCritical' || r === 'enteredCritical')
        )
      ) {
        requestAnimationFrame(() => {
          const scroller = queueScrollRef.current
          const lane = scroller?.querySelector<HTMLElement>(
            '[data-queue-lane="critical"]'
          )
          if (!scroller || !lane) return
          const left =
            lane.getBoundingClientRect().left -
            scroller.getBoundingClientRect().left +
            scroller.scrollLeft
          scroller.scrollTo({
            left: Math.max(0, left - 12),
            behavior: 'smooth',
          })
        })
      }
    }

    groupsBeforeRef.current = new Map(
      data.incidents.map((i) => [i.id, [...i.groups]])
    )

    const plan = planFreshEventToasts(fresh)
    const alertPrefs = readShiftAlertPrefs()

    if (plan.mode === 'summary') {
      const notify =
        plan.severity === 'error'
          ? toast.error
          : plan.severity === 'warning'
            ? toast.warning
            : toast.info
      notify(plan.title, {
        description: plan.description,
        duration: 12_000,
      })
      deliverShiftAlert(alertPrefs, {
        severity: plan.severity,
        title: plan.title,
        body: plan.description,
        tag: `relay-burst-${latest}`,
      })
      window.dispatchEvent(new Event(PRIORITY_BURST_EVENT))
    } else {
      for (const event of fresh) {
        const severity = eventSeverity(event.reasons)
        const notify =
          severity === 'error'
            ? toast.error
            : severity === 'warning'
              ? toast.warning
              : toast.info
        const secondary = [
          event.detail,
          !event.detail &&
            event.reasons
              .slice(1)
              .map((reason) => reasonLabels[reason])
              .join(', '),
          event.incidentId,
          event.product,
        ]
          .filter(Boolean)
          .join(' · ')
        notify(eventHeadline(event.reasons), {
          description: secondary || undefined,
          duration: 8000,
        })
        deliverShiftAlert(alertPrefs, {
          severity,
          title: eventHeadline(event.reasons),
          body: secondary || undefined,
          tag: `relay-${event.seq}`,
        })
      }
    }

  }, [data])

  useEffect(() => {
    if (focusCard) document.getElementById(focusCard.id)?.focus()
  }, [focusCard])

  const incidentsRef = useRef<DashboardSnapshot['incidents']>([])
  incidentsRef.current = data?.incidents ?? []

  const selected = data?.incidents.find(({ id }) => id === selectedId)
  const filterCtx = useMemo(
    () => ({ watched, now: sortNow }),
    [watched, sortNow]
  )
  const visibleIncidents = useMemo(
    () =>
      filterIncidents(data?.incidents ?? [], filterPrefs, filterCtx),
    [data?.incidents, filterPrefs, filterCtx]
  )
  const queueIncidents = wall ? (data?.incidents ?? []) : visibleIncidents
  const queuePrefs = wall ? wallPrefs : filterPrefs
  const sorted = useMemo(
    () =>
      sortIncidentsForDisplay(queueIncidents, queuePrefs, watched, sortNow),
    [queueIncidents, queuePrefs, watched, sortNow]
  )
  const shiftRisk = useMemo(
    () => buildShiftRiskSummary(queueIncidents, sortNow),
    [queueIncidents, sortNow]
  )
  const seats = useMemo(
    () => operatorSeats(data?.incidents ?? []),
    [data?.incidents]
  )
  const mine = useMemo(
    () => incidentsForSeat(data?.incidents ?? [], station.login),
    [data?.incidents, station.login]
  )
  const shiftFocusOn = isShiftFocusActive(filterPrefs)
  const priorityHints = useMemo(
    () =>
      calmPrefs.enabled
        ? new Map<string, { detail: string; seq: number }>()
        : buildRecentPriorityHints(data?.events ?? [], sortNow),
    [data?.events, sortNow, calmPrefs.enabled]
  )
  const journalAtCap =
    (data?.events.length ?? 0) >= SHIFT_EVENT_JOURNAL_CAP
  const lanes = useMemo(() => {
    const rows = incidentGroups.map((group) => {
      const items = sorted.filter((incident) =>
        incident.groups.includes(group.key)
      )
      return {
        column: group,
        items,
        signature: laneSignature(items),
        highlightedIds: items
          .filter((item) => highlighted.has(item.id))
          .map((item) => item.id)
          .join(','),
        watchSignature: items
          .filter((item) => watched.has(item.id))
          .map((item) => item.id)
          .join(','),
        priorityHintSignature: items
          .map((item) => {
            const hint = priorityHints.get(item.id)
            return hint ? `${item.id}:${hint.seq}` : ''
          })
          .filter(Boolean)
          .join(','),
      }
    })
    return rows
  }, [sorted, highlighted, watched, priorityHints])
  const openIncident = useCallback((id: string, openDialog = true) => {
    const incident = incidentsRef.current.find((item) => item.id === id)
    if (!incident) return
    const laneKey = primaryQueueLane(incident)
    scrollToGroup(laneKey, true)
    setFocusCard({ id: `incident-${laneKey}-${id}` })
    if (openDialog) setSelectedId(id)
  }, [])

  const jumpShiftRisk = useCallback(
    (kind: keyof ShiftRiskSummary) => {
      const id = firstIncidentForRisk(
        incidentsRef.current,
        kind,
        sortNow
      )
      if (id) openIncident(id, false)
      else toast.message('В снимке нет INC для этого типа риска.')
    },
    [openIncident, sortNow]
  )

  const toggleShiftFocus = useCallback(() => {
    if (shiftFocusOn) resetFilters()
    else setFilterPrefs({ ...filterPrefs, ...shiftFocusFilterPatch() })
  }, [filterPrefs, resetFilters, setFilterPrefs, shiftFocusOn])

  const openFromFeed = useCallback(
    (id: string) => openIncident(id, true),
    [openIncident]
  )

  const handleOpenCard = useCallback(
    (id: string, trigger: HTMLButtonElement) => {
      lastTrigger.current = trigger
      setSelectedId(id)
    },
    []
  )

  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<OpenIncidentDetail>).detail?.id
      if (id) openIncident(id, true)
    }
    window.addEventListener(OPEN_INCIDENT_EVENT, handler)
    return () => window.removeEventListener(OPEN_INCIDENT_EVENT, handler)
  }, [openIncident])

  function scrollToGroup(key: string, afterLayout = false) {
    const run = () => {
      const scroller = queueScrollRef.current
      const lane = scroller?.querySelector<HTMLElement>(
        `[data-queue-lane="${key}"]`
      )
      if (!scroller || !lane) return
      const left =
        lane.getBoundingClientRect().left -
        scroller.getBoundingClientRect().left +
        scroller.scrollLeft
      scroller.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' })
    }
    if (afterLayout) requestAnimationFrame(() => requestAnimationFrame(run))
    else run()
  }

  const shiftBrief = useMemo(
    () =>
      data
        ? buildShiftStartedBrief(data, sortNow, shiftAnchor?.seq ?? null)
        : null,
    [data, sortNow, shiftAnchor]
  )

  const clearLinkFocus = useCallback(() => {
    linkHoverRef.current = null
    setLinkedIncidentId(null)
    setCardLinkFocus(null)
    setPinnedLinkFocus(null)
  }, [])

  const handleLinkEnter = useCallback((id: string, cardId: string) => {
    if (linkLeaveTimerRef.current) {
      clearTimeout(linkLeaveTimerRef.current)
      linkLeaveTimerRef.current = null
    }
    linkHoverRef.current = id
    setLinkedIncidentId(id)
    setCardLinkFocus({ incidentId: id, fromCardId: cardId })
  }, [])

  const handleLinkPin = useCallback(
    (id: string, cardId: string) => {
      if (linkLeaveTimerRef.current) {
        clearTimeout(linkLeaveTimerRef.current)
        linkLeaveTimerRef.current = null
      }
      if (pinnedLinkFocus?.incidentId === id) {
        clearLinkFocus()
        return
      }
      const focus = { incidentId: id, fromCardId: cardId }
      linkHoverRef.current = id
      setPinnedLinkFocus(focus)
      setLinkedIncidentId(id)
      setCardLinkFocus(focus)
    },
    [pinnedLinkFocus?.incidentId, clearLinkFocus]
  )

  const handleLinkLeave = useCallback(
    (id: string, related: EventTarget | null) => {
      if (pinnedLinkFocus?.incidentId === id) return
      if (related instanceof Element) {
        const other = related.closest('[data-incident-id]')
        if (other?.getAttribute('data-incident-id') === id) return
      }
      if (linkLeaveTimerRef.current) clearTimeout(linkLeaveTimerRef.current)
      linkLeaveTimerRef.current = setTimeout(() => {
        if (linkHoverRef.current === id && !pinnedLinkRef.current) {
          linkHoverRef.current = null
          setLinkedIncidentId(null)
          setCardLinkFocus(null)
        }
        linkLeaveTimerRef.current = null
      }, 150)
    },
    [pinnedLinkFocus?.incidentId]
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (pinnedLinkFocus || cardLinkFocus)) {
        clearLinkFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pinnedLinkFocus, cardLinkFocus, clearLinkFocus])

  const completeTrail = useCallback((key: number) => {
    setActiveTrails((trails) => trails.filter((t) => t.key !== key))
  }, [])

  function confirmShiftStart() {
    if (!data) return
    if (!shiftAnchor) {
      const latest = data.events[data.events.length - 1]?.seq ?? 0
      writeShiftAnchor(latest)
      setShiftAnchor(readShiftAnchor())
      toast.success('Смена зафиксирована. В брифе — только новые события.')
    }
    setShiftBriefOpen(false)
  }

  async function copyShiftBrief() {
    if (!shiftBrief) return
    try {
      await navigator.clipboard.writeText(shiftBrief.plain)
      toast.success('Бриф смены скопирован.')
    } catch {
      toast.error('Не удалось скопировать в буфер.')
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden',
        wall && 'dash-wall'
      )}
    >
      <Header fixed showSidebar={false}>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className='shrink-0 truncate text-lg font-medium text-foreground'
        >
          Массовые инциденты
        </h1>
        <StationSwitch mode={station.mode} onChange={station.setMode} />
        <div
          className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm max-lg:basis-full max-lg:order-3'
          role='status'
        >
          {data && (
            <ShiftRiskStrip summary={shiftRisk} onJump={jumpShiftRisk} />
          )}
        </div>
        {wall && <WallClock />}
        {!wall && (
          <div className='flex shrink-0 items-center gap-2 max-lg:order-2 max-lg:ms-auto'>
            <Button
              type='button'
              size='sm'
              variant={shiftFocusOn ? 'default' : 'outline'}
              className='h-9 hidden sm:inline-flex'
              disabled={!data}
              onClick={toggleShiftFocus}
              title='Только активные, сортировка по очереди'
            >
              Фокус смены
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='h-9 hidden md:inline-flex'
              disabled={!data}
              onClick={() => setDefenseWizardOpen(true)}
            >
              Для демо
            </Button>
            <Button
              type='button'
              size='sm'
              variant={shiftAnchor ? 'ghost' : 'default'}
              className='h-9'
              disabled={!data}
              onClick={() => setShiftBriefOpen(true)}
            >
              Смена началась
            </Button>
          </div>
        )}
        {!wall && (
          <>
            <Separator
              orientation='vertical'
              className='mx-0.5 hidden h-6 lg:block max-lg:order-4'
            />
            <div className='flex shrink-0 items-center gap-1 max-lg:order-4'>
              <ShiftAlertsControl />
              <ThemeSwitch />
              <ConfigDrawer />
              <ProfileDropdown />
            </div>
          </>
        )}
      </Header>
      <Main
        fixed
        fluid
        className='min-h-0 flex-1 flex-col gap-0 overflow-hidden px-0 py-0'
      >
        <div
          className={cn(
            'dash-canvas grid min-h-0 w-full max-w-none flex-1 gap-3 overflow-hidden p-3',
            wall
              ? 'grid-rows-[minmax(0,1fr)_minmax(12rem,24vh)] min-[1440px]:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)] min-[1440px]:grid-rows-1'
              : 'grid-rows-[minmax(16rem,42%)_minmax(0,1fr)_10.5rem] xl:grid-cols-[minmax(26rem,38%)_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)_11rem] min-[1680px]:grid-cols-[minmax(28rem,40rem)_minmax(0,1fr)_minmax(20rem,24rem)] min-[1680px]:grid-rows-1'
          )}
        >
          {!wall && (
            <MyDesk
              className='xl:row-start-1'
              login={station.login}
              seats={seats}
              incidents={mine}
              onLogin={station.setLogin}
              highlighted={highlighted}
              isWatched={isWatched}
              onToggleWatch={toggleWatch}
              onOpenCard={handleOpenCard}
              priorityHints={priorityHints}
              linkedIncidentId={linkedIncidentId}
              onLinkEnter={handleLinkEnter}
              onLinkLeave={handleLinkLeave}
              onLinkPin={handleLinkPin}
            />
          )}

          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden',
              wall ? 'bg-transparent' : 'dash-panel'
            )}
            aria-label='Канбан четырёх групп кейса'
          >
            {!wall && (
              <div className='dash-section-head space-y-0 p-0'>
                <div className='flex items-center gap-2 px-4 py-3'>
                  <h2 className='granat-title shrink-0'>Очереди команды</h2>
                  <GranatSearch
                    className='ms-2 hidden min-w-0 flex-1 md:block'
                    value={filterPrefs.query}
                    onValueChange={(query) => setFilterPrefs({ query })}
                  />
                  <IncidentFiltersControl
                    className='ms-auto shrink-0'
                    prefs={filterPrefs}
                    setPrefs={setFilterPrefs}
                    reset={resetFilters}
                    activeCount={filterActiveCount}
                    incidents={data?.incidents ?? []}
                    detailCards={!calmPrefs.enabled}
                    onDetailCardsChange={(detail) =>
                      setCalmPrefs({
                        enabled: !detail,
                        compactCards: !detail,
                      })
                    }
                  />
                </div>
                <GranatSearch
                  className='px-4 pb-3 md:hidden'
                  value={filterPrefs.query}
                  onValueChange={(query) => setFilterPrefs({ query })}
                />
                <IncidentActiveFilterChips
                  prefs={filterPrefs}
                  setPrefs={setFilterPrefs}
                  reset={resetFilters}
                />
              </div>
            )}
            <div ref={queueScrollRef} className='dash-kanban-board'>
              <div className='flex h-full w-full min-w-0 gap-3'>
                {lanes.map(
                  ({
                    column,
                    items,
                    signature,
                    highlightedIds,
                    watchSignature,
                    priorityHintSignature,
                  }) => (
                  <QueueLane
                    key={`${column.key}-${wall ? 'wall' : calmPrefs.enabled ? 'calm' : 'full'}`}
                    groupKey={column.key}
                    title={column.title}
                    items={items}
                    signature={signature}
                    watchSignature={watchSignature}
                    priorityHintSignature={priorityHintSignature}
                    priorityHints={priorityHints}
                    ready={!!data}
                    highlightedIds={highlightedIds}
                    isWatched={isWatched}
                    onToggleWatch={wall ? undefined : toggleWatch}
                    onOpenCard={handleOpenCard}
                    linkedIncidentId={linkedIncidentId}
                    onLinkEnter={handleLinkEnter}
                    onLinkLeave={handleLinkLeave}
                    onLinkPin={handleLinkPin}
                    calmMode={!wall && calmPrefs.enabled}
                    compactCard={!wall && calmPrefs.enabled && calmPrefs.compactCards}
                    previewLimit={wall ? 40 : 8}
                    room={wall}
                  />
                )
                )}
              </div>
            </div>
          </div>
          <ShiftFeed
            className={cn(
              'min-h-0',
              !wall && 'xl:col-span-2 min-[1680px]:col-span-1 min-[1680px]:col-start-3 min-[1680px]:row-start-1'
            )}
            events={data?.events ?? []}
            signature={eventsSignature(data?.events ?? [])}
            journalAtCap={journalAtCap}
            journalCap={SHIFT_EVENT_JOURNAL_CAP}
            onOpenIncident={openFromFeed}
          />
        </div>
      </Main>
      <ShiftTrailOverlay
        trails={activeTrails}
        scrollerRef={queueScrollRef}
        onComplete={completeTrail}
      />
      <LinkedCardsOverlay
        focus={activeLinkFocus}
        incident={data?.incidents.find(
          ({ id }) => id === activeLinkFocus?.incidentId
        )}
        scrollerRef={queueScrollRef}
        linkedIncidentId={linkedIncidentId}
      />
      <DefenseWizard
        open={defenseWizardOpen}
        onOpenChange={setDefenseWizardOpen}
        onFocusIncident={(id) => openIncident(id, false)}
      />
      <Dialog open={shiftBriefOpen} onOpenChange={setShiftBriefOpen}>
        <DialogContent className='max-w-md'>
          <DialogTitle>{shiftBrief?.title ?? 'Смена'}</DialogTitle>
          <DialogDescription className='text-xs text-muted-foreground'>
            Очередь, сроки и что изменилось после «Зафиксировать смену».
          </DialogDescription>
          {shiftBrief && (
            <pre className='max-h-[min(50vh,20rem)] overflow-y-auto whitespace-pre-wrap rounded-md border border-border/70 bg-muted/30 p-3 font-sans text-xs leading-relaxed text-foreground'>
              {shiftBrief.lines.join('\n')}
            </pre>
          )}
          <div className='flex flex-wrap justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!shiftBrief}
              onClick={() => void copyShiftBrief()}
            >
              Копировать
            </Button>
            <Button type='button' size='sm' onClick={confirmShiftStart}>
              {shiftAnchor ? 'Закрыть' : 'Зафиксировать смену'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        {selected && (
          <IncidentDetails
            key={selected.id}
            incident={selected}
            restoreFocus={() => {
              const trigger = lastTrigger.current
              if (trigger?.isConnected) trigger.focus()
              else titleRef.current?.focus()
            }}
          />
        )}
        {selectedId && !selected && <MissingIncident />}
      </Dialog>
    </div>
  )
}

function MissingIncident() {
  return (
    <DialogContent>
      <DialogTitle>Инцидент удалён из выгрузки</DialogTitle>
      <DialogDescription>
        Карточка отсутствует в текущем снимке.
      </DialogDescription>
    </DialogContent>
  )
}