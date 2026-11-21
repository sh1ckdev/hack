import { type Incident, summarySchema } from '../src/features/incidents/model'

type SummaryInput = Pick<
  Incident,
  | 'productName'
  | 'service'
  | 'description'
  | 'shortDescription'
  | 'header'
  | 'stateEnum'
  | 'assignedGroupName'
  | 'assignedEmployee'
  | 'deadline'
>

export function buildTemplateSummary(record: SummaryInput) {
  const text =
    record.description?.trim() ||
    record.shortDescription?.trim() ||
    record.header?.trim() ||
    ''
  const facts = [
    text
      ? `По описанию: ${text.slice(0, 320)}${text.length > 320 ? '…' : ''}`
      : 'В выгрузке нет текста описания — опираемся только на метаданные.',
    record.service ? `Затронутый сервис: ${record.service}.` : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  const hypothesesParts: string[] = []
  if (text.length > 50) {
    hypothesesParts.push(
      'По описанию возможно регламентное отклонение; причину нужно подтвердить у исполнителя.'
    )
  } else {
    hypothesesParts.push('Недостаточно данных для предположений.')
  }
  if (record.assignedGroupName?.includes('Координаторы')) {
    hypothesesParts.push(
      'Запись уже у координаторов — при необходимости уточните профильную команду по продукту.'
    )
  }

  return summarySchema.parse({
    facts,
    hypotheses: hypothesesParts.join(' '),
  })
}