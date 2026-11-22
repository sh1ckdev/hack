import { z } from 'zod'

export const voiceFilterKeys = [
  'onlyCritical',
  'onlyCoordinators',
  'onlyOverdue',
  'onlyDueSoon',
  'onlyWatched',
  'onlyActive',
  'unassignedEmployee',
  'unassignedTeam',
] as const

const voiceBriefTopic = z.enum(['next', 'owner', 'history'])
export type VoiceBriefTopic = z.infer<typeof voiceBriefTopic>

export const voiceIntentSchema = z.discriminatedUnion('action', [
  z
    .strictObject({
      action: z.literal('filter'),
      filters: z.array(z.enum(voiceFilterKeys)).max(voiceFilterKeys.length),
      query: z.string().trim().max(150),
    })
    .refine(({ filters, query }) => Boolean(filters.length || query)),
  z.strictObject({ action: z.literal('reset') }),
  z.strictObject({ action: z.literal('brief'), topic: voiceBriefTopic }),
  z.strictObject({ action: z.literal('unsupported') }),
])

export function matchVoiceBrief(
  transcript: string
): VoiceBriefTopic | undefined {
  const text = transcript
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/ первыми почему$/, ' первым и почему')
  if (
    /^(?:скажи,? )?(?:что|какую заявку) (?:мне )?(?:сейчас )?(?:взять в работу|(?:взять|проверить|разобрать) (?:первым|первой|сначала|в первую очередь))(?: и почему)?$/u.test(
      text
    )
  )
    return 'next'
  if (
    /^(?:а )?кто (?:е[её] вед[её]т|исполнитель|назначен на эту заявку|отвечает за не[её])$/u.test(
      text
    )
  )
    return 'owner'
  if (
    /^(?:а )?что (?:по ней|в этой заявке) (?:менялось|изменилось)$/u.test(text)
  )
    return 'history'
}

export async function interpretVoiceCommand(
  transcript: string,
  signal: AbortSignal
) {
  const response = await fetch('/api/voice-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Relay-Request': 'voice-intent',
    },
    body: JSON.stringify({ transcript }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(22_000)]),
  })
  if (!response.ok) {
    switch (response.status) {
      case 400:
      case 413:
        throw new Error('Произнесите более короткую команду.')
      case 503:
        throw new Error('Qwen недоступен. Запустите npm run voice:ai.')
      case 504:
        throw new Error('Qwen отвечает слишком долго. Повторите команду.')
      default:
        throw new Error(
          'Не удалось обработать голосовую команду. Попробуйте ещё раз.'
        )
    }
  }
  return voiceIntentSchema.parse(await response.json())
}
