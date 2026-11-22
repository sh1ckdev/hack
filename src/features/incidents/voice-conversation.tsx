import { useEffect, useRef, useState } from 'react'
import { Mic, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  conversationAnswerSchema,
  type ConversationAnswer,
} from './conversation-model'

type Turn = { question: string; answer: ConversationAnswer }

export function VoiceConversation({
  draft,
  onDraftChange,
  onRecord,
  onExecute,
  onOpen,
  snapshot,
  focusId,
}: {
  draft: string
  onDraftChange: (draft: string) => void
  onRecord: () => void
  onExecute: () => void
  onOpen: (id: string) => void
  snapshot?: { runId: string; version: number }
  focusId?: string
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const audio = useRef<SpeechSynthesisUtterance | null>(null)
  useEffect(
    () => () => {
      request.current?.abort()
      if (audio.current) window.speechSynthesis.cancel()
    },
    []
  )

  async function ask() {
    const question = draft.trim()
    if (!question || pending) return
    const controller = new AbortController()
    request.current = controller
    setError('')
    setPending(true)
    const currentTurns = turns.filter(
      ({ answer }) => answer.runId === snapshot?.runId
    )
    const history = currentTurns.slice(-2).flatMap((turn) => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer.text.slice(0, 500) },
    ])
    try {
      const response = await fetch('/api/shift-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Request': 'shift-conversation',
        },
        body: JSON.stringify({
          question,
          history,
          focusId:
            currentTurns[currentTurns.length - 1]?.answer.focusId ?? focusId,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(29_000),
        ]),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Не удалось получить ответ.'
        )
      const answer = conversationAnswerSchema.parse(result)
      if (controller.signal.aborted) return
      setTurns([...currentTurns.slice(-7), { question, answer }])
      onDraftChange('')
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error && error.name === 'Error'
            ? error.message
            : 'Не удалось получить ответ. Попробуйте ещё раз.'
        )
    } finally {
      if (!controller.signal.aborted) setPending(false)
    }
  }

  function speak(text: string) {
    const synth = window.speechSynthesis
    const voice = synth
      ?.getVoices()
      .find(({ lang, localService }) => localService && lang.startsWith('ru'))
    if (!voice) {
      setError('Локальный русский голос недоступен на этом устройстве.')
      return
    }
    if (audio.current) synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    audio.current = utterance
    synth.speak(utterance)
  }

  return (
    <section
      aria-label='Диалог по смене'
      className='space-y-3 border-t border-border pt-3'
    >
      <h3 className='font-semibold'>Спросить по смене</h3>
      {turns.length > 0 && (
        <div role='log' className='max-h-64 space-y-3 overflow-y-auto text-sm'>
          {turns.map(({ question, answer }, index) => (
            <div
              key={index}
              className='space-y-1 rounded-lg bg-muted/60 p-3 break-words'
            >
              <p className='font-medium'>{question}</p>
              <p className='whitespace-pre-wrap'>{answer.text}</p>
              <p className='text-xs text-muted-foreground'>
                Снимок {answer.version}
                {snapshot &&
                  (answer.runId !== snapshot.runId ||
                    answer.version !== snapshot.version) &&
                  ' · данные обновились'}
              </p>
              <div className='flex flex-wrap gap-1'>
                {answer.runId === snapshot?.runId &&
                  answer.incidentIds.map((id) => (
                    <Button
                      key={id}
                      type='button'
                      size='sm'
                      variant='link'
                      onClick={() => onOpen(id)}
                    >
                      {id}
                    </Button>
                  ))}
                {'speechSynthesis' in window && (
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    onClick={() => speak(answer.text)}
                  >
                    <Volume2 /> Озвучить
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <form
        className='flex flex-wrap items-center gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          void ask()
        }}
      >
        <Input
          className='min-w-44 flex-1'
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          maxLength={500}
          aria-label='Команда или вопрос'
          placeholder='Напишите команду или вопрос'
          disabled={pending}
        />
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={pending || !draft.trim()}
          onClick={onExecute}
        >
          Выполнить команду
        </Button>
        <Button type='submit' size='sm' disabled={pending || !draft.trim()}>
          {pending ? 'Готовлю ответ…' : 'Спросить'}
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          disabled={pending}
          onClick={onRecord}
        >
          <Mic /> Записать вопрос
        </Button>
      </form>
      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
    </section>
  )
}
