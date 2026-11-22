import {
  isActive,
  isActiveCritical,
  remainingTime,
  type Incident,
} from '../src/features/incidents/model'
import { SLA_SOON_MS } from '../src/features/incidents/ops'
import type { EscalationSignal } from '../src/features/incidents/queue-summary'

export function escalationContext(
  incident: Incident,
  incidents: Incident[],
  signals: EscalationSignal[],
  now: number
) {
  const deadline = Date.parse(incident.deadline ?? '')
  const deadlineState = !Number.isFinite(deadline)
    ? 'unknown'
    : deadline <= now
      ? 'overdue'
      : deadline - now <= SLA_SOON_MS
        ? 'due_soon'
        : 'later'
  const product = incident.productName?.trim()
  const service = incident.service?.trim()
  const peers = product
    ? incidents.filter(
        (other) =>
          other.id !== incident.id &&
          isActive(other) &&
          other.productName?.trim() === product
      )
    : []
  const critical = peers.filter(isActiveCritical)
  const sameService = Boolean(
    service && critical.some((other) => other.service?.trim() === service)
  )
  const observations = signals.map((signal) => {
    switch (signal) {
      case 'deadline':
        return remainingTime(incident.deadline, now) ?? 'Срок не указан'
      case 'unassigned':
        return 'Исполнитель не назначен'
      case 'sameProduct':
        return sameService
          ? 'Есть критический инцидент по тому же продукту и сервису'
          : 'Есть критический инцидент по тому же продукту'
      case 'productLoad':
        return `Других активных заявок по этому продукту: ${peers.length}`
    }
  })
  return {
    // Only fixed categories leave the server.
    modelInput: {
      signals,
      deadlineState,
      hasAssignee: Boolean(incident.assignedEmployee?.trim()),
      hasCriticalOnSameService: sameService,
    },
    observations,
  }
}
