import {
  findHandoffAnalogues,
  suggestHandoff,
} from '../src/features/incidents/handoff'
import {
  eventHeadline,
  isActive,
  isResolved,
  remainingTime,
  type DashboardSnapshot,
} from '../src/features/incidents/model'
import { SLA_SOON_MS } from '../src/features/incidents/ops'

export function buildIncidentReview(
  incident: DashboardSnapshot['incidents'][number],
  snapshot: DashboardSnapshot,
  now: number
) {
  const evidence: { label: string; text: string }[] = []
  const owner = incident.assignedEmployee?.trim()
  const team = incident.assignedGroupName?.trim()
  const active = isActive(incident)
  const coordinators = incident.groups.includes('coordinators')
  const deadline = Date.parse(incident.deadline ?? '')
  const remaining = deadline - now
  const hasSolution = Boolean(incident.solution?.trim())
  const events = snapshot.events
    .filter(({ incidentId }) => incidentId === incident.id)
    .slice(-3)
    .reverse()
  const related = snapshot.incidents.filter((other) => {
    const service = incident.service?.trim()
    return Boolean(
      service &&
      other.id !== incident.id &&
      isActive(other) &&
      other.service?.trim() === service
    )
  })
  const description = (
    incident.shortDescription?.trim() ||
    incident.description?.trim() ||
    ''
  ).replace(/\s+/g, ' ')
  if (description && description !== incident.header?.trim()) {
    evidence.push({
      label: 'Что описано в заявке',
      text:
        description.length > 320
          ? description.slice(0, 317).trimEnd() + '…'
          : description,
    })
  }
  if (active) {
    evidence.push({
      label: 'Контроль срока',
      text:
        remainingTime(incident.deadline, now) ??
        'В выгрузке нет срока решения.',
    })
    evidence.push({
      label: 'Ответственный',
      text: owner
        ? [owner, team].filter(Boolean).join(' · ')
        : team
          ? `Команда ${team} назначена. Исполнитель не указан.`
          : 'Команда и исполнитель не указаны.',
    })
    if (hasSolution) {
      evidence.push({
        label: 'Статус и решение',
        text: 'Действия записаны в поле решения, но по статусу заявка ещё активна. Проверьте, восстановился ли сервис.',
      })
    }
  }
  if (related.length) {
    evidence.push({
      label: 'Другие активные по тому же сервису',
      text: `${related.length} · ${related
        .slice(0, 3)
        .map(({ id }) => id)
        .join(', ')}. Общая причина пока не подтверждена.`,
    })
  }

  const route = coordinators
    ? suggestHandoff(incident, snapshot.incidents)
    : null
  const target =
    route && route.count > (route.also?.count ?? 0) ? route.team : null
  const analogue = coordinators
    ? findHandoffAnalogues(incident, snapshot.incidents)[0]
    : undefined
  if (analogue) {
    evidence.push({
      label: 'Похожий случай',
      text: `${analogue.candidate.id} · ${analogue.evidence}. Проверьте, подходит ли записанное решение к текущему симптому.`,
    })
  }

  const contact = owner
    ? `исполнителем ${owner}`
    : team
      ? `командой ${team}`
      : 'дежурным координатором'
  let nextStep: string
  if (isResolved(incident)) {
    nextStep = hasSolution
      ? 'Заявка отмечена завершённой. При повторении симптома используйте записанное решение как отправную точку.'
      : 'Заявка отмечена завершённой. Если нужно подготовить разбор, запросите запись о том, какие действия помогли.'
  } else if (incident.stateEnum === 'Research') {
    nextStep = `Сверьте с ${contact}, что уже проверили, и попросите зафиксировать подтверждённую причину или оставшийся вопрос.`
  } else if (!active) {
    nextStep =
      'Уточните в ITSM текущее состояние заявки перед передачей или закрытием.'
  } else if (hasSolution) {
    nextStep = `Свяжитесь с ${contact} и запросите результат проверки сервиса после записанных действий. До подтверждения восстановления контролируйте заявку.`
  } else if (coordinators) {
    nextStep = target
      ? `Сверьте с «${target}» владение конкретным сервисом и попросите подтвердить, кто примет заявку и когда даст первый ответ.`
      : 'Сверьте владельца сервиса в ITSM и запросите подтверждение приёма у выбранной команды.'
  } else if (!owner) {
    nextStep = `Свяжитесь с ${contact}, чтобы назначить исполнителя и договориться о времени первого обновления.`
  } else if (remaining <= SLA_SOON_MS) {
    nextStep = `Сверьте с ${contact}, что уже проверено, есть ли блокер и когда ждать восстановления. Зафиксируйте время следующего обновления.`
  } else {
    nextStep = `Сверьте с ${contact} последнюю проверку по симптому и договоритесь о времени следующего статуса.`
  }
  return {
    evidence,
    events: events.map((event) => ({
      seq: event.seq,
      at: event.observedAt,
      title: eventHeadline(event.reasons),
      detail: event.detail?.trim() || undefined,
    })),
    nextStep,
  }
}
