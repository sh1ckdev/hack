import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { GranatSearch } from '@/components/granat/granat-search'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { DefenseWizard } from './defense-wizard'
import { FocusReview } from './focus-review'
import { transferHistory, waitingOnCoordinators } from './history-insights'
import { IncidentActiveFilterChips } from './incident-active-filter-chips'
import { IncidentDetails } from './incident-details'
import {
  defaultIncidentFilterPrefs,
  filterIncidents,
  sortIncidentsForDisplay,
} from './incident-filters'
import { IncidentFiltersControl } from './incident-filters-control'
import { laneSignature } from './lane-signature'
import { LinkedCardsOverlay, type CardLinkFocus } from './linked-cards-overlay'
import {
  eventHeadline,
  eventSeverity,
  incidentGroups,
  isActive,
  primaryQueueLane,
  reasonLabels,
  type DashboardSnapshot,
} from './model'
import {
  buildShiftStartedBrief,
  OPEN_INCIDENT_EVENT,
  type OpenIncidentDetail,
} from './ops'
import {
  readFocus,
  startFocus,
  focusStorageKey,
  type FocusSession,
} from './personal-focus'
import { QueueLane } from './queue-lane'
import { buildQueueSummary } from './queue-summary'
import { QueueSummaryStrip } from './queue-summary-strip'
import {
  deliverShiftAlert,
  primeShiftAlertAudio,
  readShiftAlertPrefs,
} from './shift-alerts'
import { ShiftAlertsControl } from './shift-alerts-control'
import { readShiftAnchor, writeShiftAnchor } from './shift-anchor'
import { PRIORITY_BURST_EVENT } from './shift-calm'
import { ShiftCoordinationProvider } from './shift-coordination'
import {
  buildRecentPriorityHints,
  highlightIncidentIds,
  isPriorityShiftEvent,
  planFreshEventToasts,
  PRIORITY_HIGHLIGHT_MS,
} from './shift-event-notify'
import { isShiftFocusActive, shiftFocusFilterPatch } from './shift-focus'
import {
  buildShiftRiskSummary,
  firstIncidentForRisk,
  type ShiftRiskSummary,
} from './shift-risk'
import { ShiftRiskStrip } from './shift-risk-strip'
import { planShiftTrails } from './shift-trail'
import { ShiftTrailOverlay, type ActiveShiftTrail } from './shift-trail-overlay'
import { useIncidentDashboard } from './use-incident-dashboard'
import { useIncidentFilters } from './use-incident-filters'
import { useNow } from './use-now'
import { useShiftCalm } from './use-shift-calm'
import { useWatchlist } from './use-watchlist'
import { VoiceBrief, type VoiceBriefState } from './voice-brief'
import { VoiceCommand } from './voice-command'
import {
  interpretVoiceCommand,
  matchVoiceBrief,
  type VoiceBriefTopic,
} from './voice-intent'

export function IncidentsDashboard() {
  return (
    <ShiftCoordinationProvider>
      <IncidentBoard />
    </ShiftCoordinationProvider>
  )
}

function IncidentBoard() {
  const { data } = useIncidentDashboard()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [wallMode, setWallMode] = useState(() =>
    new URLSearchParams(window.location.search).has('wall')
  )
  const [personalFocus, setPersonalFocus] = useState(readFocus)
  function saveFocus(session: FocusSession | null) {
    setPersonalFocus(session)
    try {
      if (session)
        localStorage.setItem(focusStorageKey, JSON.stringify(session))
      else localStorage.removeItem(focusStorageKey)
    } catch {
      /* Focus remains available until the tab closes. */
    }
  }
  const previous = useRef<{ runId: string; seq: number } | undefined>(undefined)
  const [highlighted, setHighlighted] = useState<Set<string>>(() => new Set())
  const [criticalArrival, setCriticalArrival] = useState<{
    seq: number
    ids: Set<string>
  } | null>(null)

  useEffect(() => {
    if (!criticalArrival) return
    const timer = window.setTimeout(() => setCriticalArrival(null), 3_000)
    return () => window.clearTimeout(timer)
  }, [criticalArrival])

  const sortNow = useNow(30_000)
  const transfers = useMemo(() => (data ? transferHistory(data) : []), [data])
  const stuckAtCoordinators = useMemo(
    () => (data ? waitingOnCoordinators(data, sortNow) : []),
    [data, sortNow]
  )
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
  const {
    prefs: filterPrefs,
    setPrefs: setFilterPrefs,
    replacePrefs: replaceFilterPrefs,
    reset: resetFilters,
    activeCount: filterActiveCount,
  } = useIncidentFilters()
  const { prefs: calmPrefs, setPrefs: setCalmPrefs } = useShiftCalm()
  const [voiceBrief, setVoiceBrief] = useState<VoiceBriefState | null>(null)
  const [conversationFocus, setConversationFocus] = useState<{
    id: string
    runId: string
  } | null>(null)
  const voiceContext = useRef<VoiceBriefState | null>(null)
  const voiceSnapshot = useRef(data)

  useEffect(() => {
    voiceSnapshot.current = data
  }, [data])

  const showVoiceBrief = useCallback((topic: VoiceBriefTopic) => {
    const snapshot = voiceSnapshot.current
    if (!snapshot) return 'Данные дашборда ещё не загружены.'
    if (topic === 'next') {
      const now = Date.now()
      const recommendation = buildQueueSummary(snapshot.incidents, now).first
      const other = recommendation
        ? undefined
        : sortIncidentsForDisplay(
            snapshot.incidents.filter(isActive),
            { ...defaultIncidentFilterPrefs(), sortBy: 'priorityDesc' },
            new Set(),
            now
          )[0]
      const id = recommendation?.id ?? other?.id
      if (!id) {
        voiceContext.current = null
        setVoiceBrief(null)
        return 'В очереди нет активных заявок.'
      }
      voiceContext.current = {
        id,
        why:
          recommendation?.why ??
          'Первая активная заявка по приоритету и сроку.',
        topic,
        runId: snapshot.runId,
      }
    }
    const context = voiceContext.current
    if (
      !context ||
      context.runId !== snapshot.runId ||
      !snapshot.incidents.some(({ id }) => id === context.id)
    )
      return 'Сначала спросите «Что взять первым?».'
    setVoiceBrief({ ...context, topic })
    setConversationFocus({ id: context.id, runId: context.runId })
    return `Ответ по ${context.id} готов.`
  }, [])

  const applyVoiceCommand = useCallback(
    async (transcript: string, signal: AbortSignal) => {
      if (signal.aborted) return ''
      const briefTopic = matchVoiceBrief(transcript)
      if (briefTopic) return showVoiceBrief(briefTopic)
      let intent
      try {
        intent = await interpretVoiceCommand(transcript, signal)
      } catch (error) {
        if (signal.aborted) return ''
        const command = transcript
          .toLocaleLowerCase('ru-RU')
          .replace(/[.!?]+$/, '')
        if (
          /^(сбрось фильтры|очисти фильтры|убери фильтры|все заявки|покажи все(?: заявки)?)$/.test(
            command
          )
        ) {
          resetFilters()
          return 'Фильтры сброшены без ИИ.'
        }
        const onlyCritical =
          /^(?:покажи )?критические(?: инциденты| заявки)?$/.test(command)
        const onlyOverdue =
          /^(?:покажи )?просроченные(?: инциденты| заявки)?$/.test(command)
        const onlyCoordinators =
          /^(?:покажи )?(?:назначенные координаторам|заявки у координаторов)$/.test(
            command
          )
        const query =
          transcript.match(/\bINC\d+\b/i)?.[0] ??
          transcript.match(/^(?:найди|ищи|поиск)\s+(.+?)\s*[.!?]*$/i)?.[1] ??
          ''
        if (!onlyCritical && !onlyOverdue && !onlyCoordinators && !query) {
          if (error instanceof Error && error.name === 'TimeoutError')
            return 'Голосовой запрос занял слишком много времени. Повторите команду.'
          if (error instanceof Error && error.name === 'Error')
            return error.message
          return 'Не удалось обработать голосовую команду. Попробуйте ещё раз.'
        }
        replaceFilterPrefs({
          ...defaultIncidentFilterPrefs(),
          onlyCritical,
          onlyOverdue,
          onlyCoordinators,
          onlyActive: onlyCritical || onlyOverdue || onlyCoordinators,
          query,
        })
        return 'Команда применена без ИИ.'
      }
      if (signal.aborted) return ''
      if (intent.action === 'brief') return showVoiceBrief(intent.topic)
      if (intent.action === 'unsupported')
        return 'Не понял команду. Попробуйте «Что взять первым?» или «Покажи критические».'
      if (intent.action === 'reset') {
        resetFilters()
        return 'ИИ сбросил фильтры.'
      }
      const next = defaultIncidentFilterPrefs()
      for (const key of intent.filters) next[key] = true
      next.query = intent.query
      replaceFilterPrefs(next)
      return 'ИИ применил фильтры.'
    },
    [replaceFilterPrefs, resetFilters, showVoiceBrief]
  )
  const calmEnabledRef = useRef(calmPrefs.enabled)
  calmEnabledRef.current = calmPrefs.enabled
  const watchedRef = useRef(watched)
  watchedRef.current = watched

  useEffect(() => {
    const prime = () => {
      primeShiftAlertAudio()
    }
    document.addEventListener('pointerdown', prime, {
      once: true,
      capture: true,
    })
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
      setCriticalArrival(null)
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
      const toHighlight = highlightIncidentIds(fresh, watchedRef.current, calm)
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
      const trailPlans = planShiftTrails(groupsSnapshot, data.incidents, fresh)
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

      const arrivals = fresh.filter(({ reasons }) =>
        reasons.some(
          (reason) => reason === 'newCritical' || reason === 'enteredCritical'
        )
      )
      if (arrivals.length) {
        setCriticalArrival({
          seq: latest,
          ids: new Set(arrivals.map(({ incidentId }) => incidentId)),
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
    () => filterIncidents(data?.incidents ?? [], filterPrefs, filterCtx),
    [data?.incidents, filterPrefs, filterCtx]
  )
  const queueIncidents = visibleIncidents
  const queuePrefs = filterPrefs
  const sorted = useMemo(
    () => sortIncidentsForDisplay(queueIncidents, queuePrefs, watched, sortNow),
    [queueIncidents, queuePrefs, watched, sortNow]
  )
  const shiftRisk = useMemo(
    () => buildShiftRiskSummary(queueIncidents, sortNow),
    [queueIncidents, sortNow]
  )
  const shiftFocusOn = isShiftFocusActive(filterPrefs)
  const priorityHints = useMemo(
    () =>
      calmPrefs.enabled
        ? new Map<string, { detail: string; seq: number }>()
        : buildRecentPriorityHints(data?.events ?? [], sortNow),
    [data?.events, sortNow, calmPrefs.enabled]
  )
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
      const id = firstIncidentForRisk(incidentsRef.current, kind, sortNow)
      if (id) openIncident(id, false)
      else toast.message('В снимке нет INC для этого типа риска.')
    },
    [openIncident, sortNow]
  )

  const toggleShiftFocus = useCallback(() => {
    if (shiftFocusOn) resetFilters()
    else setFilterPrefs({ ...filterPrefs, ...shiftFocusFilterPatch() })
  }, [filterPrefs, resetFilters, setFilterPrefs, shiftFocusOn])

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
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        document.querySelector(
          ':is([role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-slot="tooltip-content"]):not([data-state="closed"]):not([hidden])'
        )
      )
        return

      if (pinnedLinkFocus || cardLinkFocus) {
        event.preventDefault()
        clearLinkFocus()
      } else if (filterActiveCount || filterPrefs.query) {
        event.preventDefault()
        resetFilters()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    pinnedLinkFocus,
    cardLinkFocus,
    clearLinkFocus,
    filterActiveCount,
    filterPrefs.query,
    resetFilters,
  ])

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
    <div className='flex min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden'>
      {!wallMode && (
        <Header fixed showSidebar={false}>
          <Logo />
          <h1
            ref={titleRef}
            tabIndex={-1}
            className='shrink-0 truncate text-lg font-medium text-foreground'
          >
            Массовые инциденты
          </h1>
          <div
            className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm max-lg:order-3 max-lg:basis-full'
            role='status'
          >
            {data && (
              <ShiftRiskStrip summary={shiftRisk} onJump={jumpShiftRisk} />
            )}
          </div>
          <div className='flex shrink-0 items-center gap-2 max-lg:order-2 max-lg:ms-auto'>
            <Button
              type='button'
              size='sm'
              variant={shiftFocusOn ? 'default' : 'outline'}
              className='hidden h-9 sm:inline-flex'
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
              className='hidden h-9 md:inline-flex'
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
          <Separator
            orientation='vertical'
            className='mx-0.5 hidden h-6 max-lg:order-4 lg:block'
          />
          <div className='flex shrink-0 items-center gap-1 max-lg:order-4'>
            <ShiftAlertsControl />
            <ThemeSwitch />
          </div>
        </Header>
      )}
      <Main fixed fluid className='min-h-0 flex-1 bg-card p-0 sm:px-0'>
        <div className='flex min-h-0 w-full flex-1 flex-col overflow-hidden'>
          <div
            className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
            aria-label='Канбан четырёх групп кейса'
          >
            <div className='space-y-0 dash-section-head p-0'>
              {data && (
                <div
                  role='status'
                  className='flex items-center justify-between px-4 py-1 text-xs text-muted-foreground'
                >
                  <span>
                    {data.source.state === 'stale'
                      ? 'Нет связи с выгрузкой · показан последний снимок'
                      : 'Данные обновлены ' +
                        new Date(data.source.lastReadAt).toLocaleTimeString(
                          'ru-RU'
                        )}
                  </span>
                  {wallMode && <span>Видеостена</span>}
                </div>
              )}
              {stuckAtCoordinators.length > 0 && (
                <button
                  type='button'
                  className='w-full bg-amber-500/10 px-4 py-2 text-start text-sm text-amber-700 dark:text-amber-300'
                  onClick={() => setHistoryOpen(true)}
                >
                  {stuckAtCoordinators.length}{' '}
                  {stuckAtCoordinators.length === 1 ? 'заявка' : 'заявки'} у
                  координаторов больше 10 минут без передачи
                </button>
              )}
              <div className='flex items-center gap-2 px-4 py-3'>
                <h2 className='shrink-0 granat-title'>Очереди команды</h2>
                {data && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setHistoryOpen(true)}
                  >
                    История передач · {transfers.length}
                  </Button>
                )}
                {!wallMode && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      const url = new URL(window.location.href)
                      if (wallMode) url.searchParams.delete('wall')
                      else url.searchParams.set('wall', '1')
                      window.history.replaceState({}, '', url)
                      setWallMode(!wallMode)
                    }}
                  >
                    Видеостена
                  </Button>
                )}
                {wallMode && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      const url = new URL(window.location.href)
                      url.searchParams.delete('wall')
                      window.history.replaceState({}, '', url)
                      setWallMode(false)
                    }}
                  >
                    Обычный режим
                  </Button>
                )}
                <GranatSearch
                  className='ms-2 hidden min-w-0 flex-1 md:block'
                  value={filterPrefs.query}
                  onValueChange={(query) => setFilterPrefs({ query })}
                />
                <VoiceCommand
                  onTranscript={applyVoiceCommand}
                  onStart={() => setVoiceBrief(null)}
                  onOpenReference={openIncident}
                  snapshot={data}
                  focusId={
                    data && conversationFocus?.runId === data.runId
                      ? conversationFocus.id
                      : undefined
                  }
                  answer={
                    data &&
                    voiceBrief && (
                      <VoiceBrief
                        data={data}
                        brief={voiceBrief}
                        now={sortNow}
                        onTopic={showVoiceBrief}
                      />
                    )
                  }
                  onOpenIncident={
                    voiceBrief &&
                    data?.runId === voiceBrief.runId &&
                    data.incidents.some(({ id }) => id === voiceBrief.id)
                      ? () => openIncident(voiceBrief.id)
                      : undefined
                  }
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
              <div className='flex items-center gap-2 px-4 pb-3 md:hidden'>
                <GranatSearch
                  className='min-w-0 flex-1'
                  value={filterPrefs.query}
                  onValueChange={(query) => setFilterPrefs({ query })}
                />
              </div>
              <IncidentActiveFilterChips
                prefs={filterPrefs}
                setPrefs={setFilterPrefs}
                reset={resetFilters}
              />
              {data && personalFocus && (
                <FocusReview
                  data={data}
                  session={personalFocus}
                  now={sortNow}
                  onEnd={() => saveFocus(null)}
                  onIncident={(id) => openIncident(id, true)}
                />
              )}
              <QueueSummaryStrip
                incidents={data?.incidents ?? []}
                now={sortNow}
                onOpen={(id) => openIncident(id, true)}
              />
            </div>
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
                      key={`${column.key}-${calmPrefs.enabled ? 'calm' : 'full'}`}
                      groupKey={column.key}
                      title={column.title}
                      items={items}
                      signature={signature}
                      watchSignature={watchSignature}
                      priorityHintSignature={priorityHintSignature}
                      priorityHints={priorityHints}
                      ready={!!data}
                      highlightedIds={highlightedIds}
                      attentionKey={
                        column.key === 'critical' &&
                        items.some(({ id }) => criticalArrival?.ids.has(id))
                          ? criticalArrival?.seq
                          : undefined
                      }
                      isWatched={isWatched}
                      onToggleWatch={toggleWatch}
                      onOpenCard={handleOpenCard}
                      linkedIncidentId={linkedIncidentId}
                      onLinkEnter={handleLinkEnter}
                      onLinkLeave={handleLinkLeave}
                      onLinkPin={handleLinkPin}
                      calmMode={calmPrefs.enabled}
                      compactCard={calmPrefs.enabled && calmPrefs.compactCards}
                      previewLimit={40}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </Main>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className='max-h-[80svh] overflow-y-auto'>
          <DialogTitle>История передач</DialogTitle>
          <DialogDescription>
            Переходы команд, замеченные в текущей истории изменений.
          </DialogDescription>
          {transfers.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              Передачи появятся здесь после смены команды в выгрузке.
            </p>
          )}
          {transfers.map((row) => (
            <section key={row.incidentId} className='border-b py-3 text-sm'>
              <strong>
                {row.incidentId} · {row.count}{' '}
                {row.count === 1 ? 'передача' : 'передачи'}
              </strong>
              <ol className='mt-2 space-y-1'>
                {row.events.map((event, index) => (
                  <li key={index}>
                    {new Date(event.at).toLocaleTimeString('ru-RU')} ·{' '}
                    {event.detail}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </DialogContent>
      </Dialog>
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
            <pre className='max-h-[min(50vh,20rem)] overflow-y-auto rounded-md border border-border/70 bg-muted/30 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap text-foreground'>
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
            onStartFocus={
              data && !personalFocus && selected.groups.includes('critical')
                ? () => {
                    saveFocus(startFocus(data, selected.id))
                    setSelectedId(null)
                  }
                : undefined
            }
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
