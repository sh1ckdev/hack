import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { Logo } from '@/assets/logo'
import { useTheme } from '@/context/theme-provider'
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
import {
  DEFENSE_DEMO_INCIDENT_ID,
  type DefenseScenarioKey,
} from './defense-script'
import { DefenseWizard, type DefenseWizardActions } from './defense-wizard'
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
  desktopNotificationPermission,
  primeShiftAlertAudio,
  readShiftAlertPrefs,
  writeShiftAlertPrefs,
  type ShiftAlertPrefs,
} from './shift-alerts'
import { ShiftAlertsControl } from './shift-alerts-control'
import { readShiftAnchor, writeShiftAnchor } from './shift-anchor'
import { PRIORITY_BURST_EVENT } from './shift-calm'
import {
  ShiftCoordinationProvider,
  useShiftCoordinationAction,
} from './shift-coordination'
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
import { VoiceCommand, type VoiceCommandResult } from './voice-command'
import {
  interpretVoiceCommand,
  matchVoiceCommand,
  resolveVoiceIncidentIds,
  voiceSearchFallback,
  type VoiceIntent,
  type VoiceBriefTopic,
} from './voice-intent'

const demoDestinations: Record<
  DefenseScenarioKey,
  { to: string; from?: string }
> = {
  'critical-up': { from: 'high', to: 'critical' },
  coordinators: { from: 'critical', to: 'coordinators' },
  deadline: { to: 'coordinators' },
  'dual-section': { to: 'critical' },
  'resolved-research': { from: 'critical', to: 'research' },
  engineers: { from: 'coordinators', to: 'research' },
}

export function IncidentsDashboard() {
  return (
    <ShiftCoordinationProvider>
      <IncidentBoard />
    </ShiftCoordinationProvider>
  )
}

function IncidentBoard() {
  const { data } = useIncidentDashboard()
  const { context: coordination, action: coordinationAction } =
    useShiftCoordinationAction()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [analysisRequest, setAnalysisRequest] = useState<number>()
  const analysisSequence = useRef(0)
  const [alertPrefs, setAlertPrefs] = useState(readShiftAlertPrefs)
  const { setTheme } = useTheme()
  const setShiftAlerts = useCallback((patch: Partial<ShiftAlertPrefs>) => {
    const next = { ...readShiftAlertPrefs(), ...patch }
    writeShiftAlertPrefs(next)
    setAlertPrefs(next)
  }, [])
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
  const [incidentSection, setIncidentSection] = useState<'summary' | 'handoff'>(
    'summary'
  )
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
  const demoOpenRef = useRef(false)
  demoOpenRef.current = defenseWizardOpen
  const demoSequence = useRef(0)
  const [demoReveal, setDemoReveal] = useState<{
    key: number
    lane: string
    trail?: ActiveShiftTrail
  } | null>(null)
  const defenseActions = useRef<DefenseWizardActions>(null)
  const [shiftAnchor, setShiftAnchor] = useState(readShiftAnchor)
  const { toggle: toggleWatch, setWatched, isWatched, watched } = useWatchlist()
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
      const trailPlans = planShiftTrails(
        groupsSnapshot,
        data.incidents,
        fresh
      ).filter(
        ({ incidentId }) =>
          !demoOpenRef.current || incidentId !== DEFENSE_DEMO_INCIDENT_ID
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
    if (focusCard && !selectedId) document.getElementById(focusCard.id)?.focus()
  }, [focusCard, selectedId])

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
  const demoIncident = defenseWizardOpen
    ? data?.incidents.find(({ id }) => id === DEFENSE_DEMO_INCIDENT_ID)
    : undefined
  const lanes = useMemo(() => {
    const rows = incidentGroups.map((group) => {
      const items = sorted.filter(
        (incident) =>
          incident.id !== demoIncident?.id &&
          incident.groups.includes(group.key)
      )
      if (demoIncident?.groups.includes(group.key)) items.unshift(demoIncident)
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
  }, [sorted, highlighted, watched, priorityHints, demoIncident])
  const openIncident = useCallback((id: string, openDialog = true) => {
    const incident = incidentsRef.current.find((item) => item.id === id)
    if (!incident) return
    const laneKey = primaryQueueLane(incident)
    scrollToGroup(laneKey, true)
    setFocusCard({ id: `incident-${laneKey}-${id}` })
    if (openDialog) {
      const trigger = document.activeElement
      lastTrigger.current =
        trigger instanceof HTMLButtonElement &&
        !trigger.closest('[role="dialog"]')
          ? trigger
          : null
      setAnalysisRequest(undefined)
      setIncidentSection('summary')
      setSelectedId(id)
    }
  }, [])

  function changeDemoOpen(open: boolean) {
    setDefenseWizardOpen(open)
    if (!open) {
      setDemoReveal(null)
      setActiveTrails((current) => current.filter((trail) => !trail.demo))
    }
  }

  function revealDemoIncident(id: string, scenario?: DefenseScenarioKey) {
    const incident = incidentsRef.current.find((item) => item.id === id)
    if (!incident) return
    const destination = scenario ? demoDestinations[scenario] : undefined
    const lane =
      destination && incident.groups.includes(destination.to)
        ? destination.to
        : primaryQueueLane(incident)
    const key = --demoSequence.current
    setDemoReveal({
      key,
      lane,
      trail:
        destination?.from && destination.from !== lane
          ? {
              key,
              incidentId: id,
              fromLane: destination.from,
              toLane: lane,
              product: incident.productName ?? undefined,
              demo: true,
            }
          : undefined,
    })
  }

  useLayoutEffect(() => {
    if (!defenseWizardOpen || !demoReveal) return
    const board = queueScrollRef.current
    const lane = board?.querySelector<HTMLElement>(
      `[data-queue-lane="${demoReveal.lane}"]`
    )
    if (!board || !lane) return
    const viewport = board.getBoundingClientRect()
    const destination = lane.getBoundingClientRect()
    if (destination.left < viewport.left || destination.right > viewport.right)
      board.scrollLeft += destination.left - viewport.left - 8
    const cards = board.querySelectorAll<HTMLElement>('[data-queue-cards]')
    for (const column of cards) {
      if (
        column.querySelector(`[data-incident-id="${DEFENSE_DEMO_INCIDENT_ID}"]`)
      )
        column.scrollTop = 0
    }
    if (!demoReveal.trail) return
    const trail = demoReveal.trail
    const frame = requestAnimationFrame(() => {
      setActiveTrails((current) => [
        ...current.filter((item) => !item.demo),
        trail,
      ])
    })
    return () => cancelAnimationFrame(frame)
  }, [defenseWizardOpen, demoReveal])

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
      setAnalysisRequest(undefined)
      setIncidentSection('summary')
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

  function setBoardMode(wall: boolean) {
    const url = new URL(window.location.href)
    if (wall) url.searchParams.set('wall', '1')
    else url.searchParams.delete('wall')
    window.history.replaceState(window.history.state, '', url)
    setWallMode(wall)
  }

  function closeDashboardPanels() {
    setSelectedId(null)
    setHistoryOpen(false)
    changeDemoOpen(false)
    setShiftBriefOpen(false)
    setFiltersOpen(false)
    setAssessmentId(null)
  }

  function executeIncidentCommand(
    intent: Extract<VoiceIntent, { action: 'incident' }>
  ): VoiceCommandResult {
    const snapshot = voiceSnapshot.current
    if (!snapshot) return 'Данные дашборда ещё не загружены.'
    const reference = intent.reference.toLowerCase()
    if (reference === 'recommended') showVoiceBrief('next')
    const context = voiceContext.current
    const contextualId =
      (reference === 'current' ? selectedId : null) ??
      (context?.runId === snapshot.runId ? context.id : undefined)
    const ids = snapshot.incidents.map(({ id }) => id)
    const matches =
      reference === 'current' || reference === 'recommended'
        ? ids.filter((id) => id === contextualId)
        : resolveVoiceIncidentIds(ids, reference)
    if (!matches.length) {
      if (reference === 'current') return 'Укажите номер инцидента.'
      if (reference === 'recommended')
        return 'В очереди нет рекомендованной заявки.'
      return `В текущей выгрузке нет инцидента по номеру ${intent.reference}.`
    }

    function run(id: string): VoiceCommandResult {
      const latest = voiceSnapshot.current
      const incident = latest?.incidents.find((item) => item.id === id)
      if (!latest || latest.runId !== snapshot?.runId || !incident)
        return 'Выгрузка изменилась. Повторите команду.'
      switch (intent.operation) {
        case 'assessRisk':
          if (
            !buildQueueSummary(latest.incidents, sortNow).rising.some(
              (item) => item.id === id
            )
          )
            return `Для ${id} сейчас нет признаков для оценки эскалации.`
          return {
            message: `Оцениваю риск для ${id}.`,
            open: () => {
              closeDashboardPanels()
              setAssessmentId(id)
            },
          }
        case 'open':
        case 'analyze':
        case 'handoff':
          if (
            intent.operation === 'handoff' &&
            !incident.groups.includes('coordinators')
          )
            return `Раздел «Передача» доступен для заявок у координаторов. ${id} сейчас в другой очереди.`
          return {
            message: `Открываю ${id}.`,
            open: () => {
              closeDashboardPanels()
              openIncident(id)
              if (intent.operation === 'handoff') setIncidentSection('handoff')
              if (intent.operation === 'analyze') {
                analysisSequence.current += 1
                setAnalysisRequest(analysisSequence.current)
              }
              setConversationFocus({ id, runId: latest.runId })
              voiceContext.current = {
                id,
                runId: latest.runId,
                topic: 'owner',
                why: '',
              }
            },
          }
        case 'watch':
        case 'unwatch': {
          const enabled = intent.operation === 'watch'
          setWatched(id, enabled)
          return enabled ? `Отслеживаю ${id}.` : `Отслеживание ${id} выключено.`
        }
        case 'see':
        case 'claim':
        case 'release': {
          const kind = intent.operation
          if (!coordination?.operator)
            return 'Укажите имя дежурного в карточке заявки, затем повторите команду.'
          const entry = coordination.entries.get(id)
          if (kind === 'release' && !entry?.claimed?.mine)
            return `${id} сейчас не закреплён за вами.`
          if (kind !== 'release' && !isActive(incident))
            return `${id} сейчас не в активной очереди.`
          if (kind === 'claim' && entry?.claimed)
            return `${id} уже в работе у ${entry.claimed.name}.`
          if (kind === 'see' && entry?.seen)
            return `По ${id} уже поставлена отметка «Увидел».`
          const labels = {
            see: ['Отметить просмотр', 'Просмотр отмечен'],
            claim: ['Взять в работу', 'Заявка взята в работу на дежурке'],
            release: ['Освободить', 'Заявка освобождена на дежурке'],
          }[kind]
          return {
            message: `${labels[0]} ${id} от имени ${coordination.operator.name}?`,
            confirmation: () => {
              const current = voiceSnapshot.current
              if (
                current?.runId !== latest.runId ||
                !current.incidents.some((item) => item.id === id)
              ) {
                toast.message('Выгрузка изменилась. Повторите команду.')
                return
              }
              void coordinationAction
                .mutateAsync({ kind, incidentId: id })
                .then(
                  () => toast.success(`${labels[1]} · ${id}`),
                  (error: Error) => toast.error(error.message)
                )
            },
          }
        }
        case 'startFocus':
          if (personalFocus)
            return 'Личный фокус уже активен. Сначала завершите его.'
          if (!incident.groups.includes('critical'))
            return 'Личный фокус доступен для критических инцидентов.'
          return {
            message: `Личный фокус на ${id}.`,
            open: () => {
              closeDashboardPanels()
              saveFocus(startFocus(latest, id))
            },
          }
      }
    }

    if (matches.length === 1) return run(matches[0])
    return {
      message: 'Подходят несколько заявок. Выберите нужную.',
      choices: matches.map((id) => ({
        label: [
          id,
          snapshot.incidents.find((item) => item.id === id)?.productName,
        ]
          .filter(Boolean)
          .join(' · '),
        run: () => run(id),
      })),
    }
  }

  function executeVoiceIntent(intent: VoiceIntent): VoiceCommandResult {
    switch (intent.action) {
      case 'brief':
        return showVoiceBrief(intent.topic)
      case 'help':
        return 'Можно открыть демо, историю передач, бриф смены, видеостену или карточку INC, запросить сводку по заявке и оценить риск. Можно применить фильтр, отсортировать очередь, следить за заявкой, поставить отметку смены, переключить тему и настроить оповещения.'
      case 'unsupported':
        return 'Команда недоступна или требует уточнения. Скажите «Что ты умеешь?».'
      case 'reset':
        resetFilters()
        return { message: 'Фильтры сброшены.', open: closeDashboardPanels }
      case 'sort':
        setFilterPrefs({ sortBy: intent.sortBy })
        return { message: 'Сортировка изменена.', open: closeDashboardPanels }
      case 'filter': {
        const next = defaultIncidentFilterPrefs()
        for (const key of intent.filters) next[key] = true
        next.query = intent.query
        if (intent.states) next.states = [...new Set(intent.states)]
        if (intent.priorities) next.priorities = [...new Set(intent.priorities)]
        if (intent.lanes) next.queueGroups = [...new Set(intent.lanes)]
        if (intent.deadline) next.deadlineFilter = intent.deadline
        if (intent.hideResolved) next.hideResolved = true
        replaceFilterPrefs(next)
        return {
          message: 'Фильтры применены.',
          open: () => {
            closeDashboardPanels()
            const lane =
              intent.lanes?.[0] ??
              (intent.states?.length === 1 && intent.states[0] === 'Research'
                ? 'research'
                : undefined)
            if (lane) scrollToGroup(lane, true)
          },
        }
      }
      case 'incident':
        return executeIncidentCommand(intent)
      case 'close':
        return { message: 'Окно закрыто.', open: closeDashboardPanels }
      case 'view':
        if (intent.view === 'demo' && !voiceSnapshot.current)
          return 'Данные дашборда ещё не загружены.'
        return {
          message: {
            demo: 'Открываю демо.',
            board: 'Обычный режим.',
            wall: 'Режим видеостены.',
            history: 'Открываю историю передач.',
            shiftBrief: 'Открываю бриф смены.',
            filters: 'Открываю фильтры.',
          }[intent.view],
          open: () => {
            closeDashboardPanels()
            switch (intent.view) {
              case 'demo':
                setDefenseWizardOpen(true)
                break
              case 'board':
                setBoardMode(false)
                break
              case 'wall':
                setBoardMode(true)
                break
              case 'history':
                setHistoryOpen(true)
                break
              case 'shiftBrief':
                setShiftBriefOpen(true)
                break
              case 'filters':
                setFiltersOpen(true)
                break
            }
          },
        }
      case 'demo':
        if (!voiceSnapshot.current) return 'Данные дашборда ещё не загружены.'
        if (intent.operation === 'start' || intent.operation === 'apply') {
          const runId = voiceSnapshot.current.runId
          return {
            message:
              intent.operation === 'start'
                ? 'Сбросить демо-выгрузку и начать сценарий?'
                : 'Применить шаг и изменить демо-выгрузку?',
            confirmation: () => {
              if (voiceSnapshot.current?.runId !== runId) {
                toast.message('Выгрузка изменилась. Повторите команду.')
                return
              }
              closeDashboardPanels()
              defenseActions.current?.run(intent.operation)
            },
          }
        }
        return {
          message: 'Перехожу к шагу демо.',
          open: () => {
            closeDashboardPanels()
            defenseActions.current?.run(intent.operation)
          },
        }
      case 'theme':
        setTheme(intent.theme)
        return 'Тема изменена.'
      case 'endFocus':
        if (!personalFocus) return 'Личный фокус уже выключен.'
        saveFocus(null)
        return 'Личный фокус завершён.'
      case 'toggle':
        switch (intent.setting) {
          case 'shiftFocus':
            if (intent.enabled !== shiftFocusOn) toggleShiftFocus()
            return intent.enabled
              ? 'Фокус смены включён.'
              : 'Фокус смены выключен.'
          case 'detailCards':
            setCalmPrefs({
              enabled: !intent.enabled,
              compactCards: !intent.enabled,
            })
            return intent.enabled
              ? 'Показываю подробные карточки.'
              : 'Показываю компактные карточки.'
          case 'sound':
            setShiftAlerts({ sound: intent.enabled })
            return intent.enabled ? 'Звук включён.' : 'Звук выключен.'
          case 'desktop':
            if (intent.enabled && desktopNotificationPermission() !== 'granted')
              return 'Разрешите уведомления в браузере, затем повторите команду.'
            setShiftAlerts({ desktop: intent.enabled })
            return intent.enabled
              ? 'Push-уведомления включены.'
              : 'Push-уведомления выключены.'
          case 'emptyColumns':
            setFilterPrefs({ hideEmptyColumns: !intent.enabled })
            return intent.enabled
              ? 'Показываю пустые колонки.'
              : 'Скрываю пустые колонки.'
        }
    }
  }

  async function applyVoiceCommand(transcript: string, signal: AbortSignal) {
    if (signal.aborted) return ''
    const known = matchVoiceCommand(transcript)
    if (known) return executeVoiceIntent(known)
    try {
      const intent = await interpretVoiceCommand(transcript, signal)
      return signal.aborted ? '' : executeVoiceIntent(intent)
    } catch (error) {
      if (signal.aborted) return ''
      const fallback = voiceSearchFallback(transcript)
      if (fallback) return executeVoiceIntent(fallback)
      throw error
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
            <ShiftAlertsControl prefs={alertPrefs} setPrefs={setShiftAlerts} />
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
                    onClick={() => setBoardMode(true)}
                  >
                    Видеостена
                  </Button>
                )}
                {wallMode && (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => setBoardMode(false)}
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
                  open={filtersOpen}
                  onOpenChange={setFiltersOpen}
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
                assessmentId={assessmentId}
                onAssessment={setAssessmentId}
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
                      demoAttentionKey={
                        demoIncident?.groups.includes(column.key)
                          ? demoReveal?.key
                          : undefined
                      }
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
        onOpenChange={changeDemoOpen}
        actionsRef={defenseActions}
        onFocusIncident={revealDemoIncident}
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
            section={incidentSection}
            analysisRequest={analysisRequest}
            onSectionChange={setIncidentSection}
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
