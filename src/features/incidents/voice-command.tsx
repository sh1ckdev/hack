import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LoaderCircle, Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { VoiceConversation } from './voice-conversation'

export type VoiceCommandResult =
  | string
  | { message: string; open: () => void }
  | { message: string; confirmation: () => void }
  | {
      message: string
      choices: { label: string; run: () => VoiceCommandResult }[]
    }

type VoiceState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'transcribing'
  | 'interpreting'

const voiceTitles: Record<VoiceState, string> = {
  idle: 'Голосовая команда',
  starting: 'Включаем микрофон…',
  recording: 'Говорите',
  transcribing: 'Распознаю речь…',
  interpreting: 'Готовлю ответ…',
}

function toWav(chunks: Float32Array[], sampleRate: number) {
  const input = new Float32Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  )
  let offset = 0
  for (const chunk of chunks) {
    input.set(chunk, offset)
    offset += chunk.length
  }

  const ratio = sampleRate / 16_000
  const length = Math.floor(input.length / ratio)
  const pcm = new Int16Array(length)
  for (let index = 0; index < length; index++) {
    const start = Math.floor(index * ratio)
    const end = Math.min(Math.floor((index + 1) * ratio), input.length)
    let sum = 0
    for (let sample = start; sample < end; sample++) sum += input[sample]
    const value = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
    pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff
  }

  const wav = new ArrayBuffer(44 + pcm.byteLength)
  const view = new DataView(wav)
  const write = (text: string, at: number) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(at + i, text.charCodeAt(i))
  }
  write('RIFF', 0)
  view.setUint32(4, 36 + pcm.byteLength, true)
  write('WAVE', 8)
  write('fmt ', 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16_000, true)
  view.setUint32(28, 32_000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write('data', 36)
  view.setUint32(40, pcm.byteLength, true)
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true)
  return new Blob([wav], { type: 'audio/wav' })
}

export function VoiceCommand({
  onTranscript,
  onStart,
  answer,
  onOpenIncident,
  onOpenReference,
  snapshot,
  focusId,
}: {
  onTranscript: (
    transcript: string,
    signal: AbortSignal
  ) => Promise<VoiceCommandResult>
  onStart: () => void
  answer: ReactNode
  onOpenIncident?: () => void
  onOpenReference: (id: string) => void
  snapshot?: { runId: string; version: number }
  focusId?: string
}) {
  const [state, setState] = useState<VoiceState>('idle')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [decision, setDecision] = useState<Exclude<
    VoiceCommandResult,
    string
  > | null>(null)
  const afterClose = useRef<(() => void) | null>(null)
  const transcriptHandler = useRef(onTranscript)
  useEffect(() => {
    transcriptHandler.current = onTranscript
  }, [onTranscript])
  const [transcript, setTranscript] = useState('')
  const [draft, setDraft] = useState('')
  const questionMode = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const timerRef = useRef<number | null>(null)
  const stateRef = useRef<VoiceState>('idle')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const restoreFocusRef = useRef(true)

  function updateState(next: VoiceState) {
    stateRef.current = next
    setState(next)
  }

  function stopCapture() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    if (processorRef.current) processorRef.current.onaudioprocess = null
    processorRef.current?.disconnect()
    contextRef.current?.close().catch(() => undefined)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    processorRef.current = null
    contextRef.current = null
    streamRef.current = null
  }

  function cancelRecording() {
    requestRef.current?.abort()
    stopCapture()
    chunksRef.current = []
    updateState('idle')
  }

  function closeDialog(restoreFocus = true) {
    restoreFocusRef.current = restoreFocus
    cancelRecording()
    setOpen(false)
  }

  function presentResult(result: VoiceCommandResult) {
    setDecision(null)
    setMessage(typeof result === 'string' ? result : result.message)
    if (typeof result === 'string') return
    if ('open' in result) {
      afterClose.current = result.open
      closeDialog(false)
    } else {
      setDecision(result)
    }
  }

  async function executeCommand(command: string, signal: AbortSignal) {
    updateState('interpreting')
    const result = await transcriptHandler.current(command, signal)
    if (!signal.aborted) presentResult(result)
  }

  async function executeDraft() {
    const command = draft.trim()
    if (!command || stateRef.current !== 'idle') return
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    onStart()
    setDecision(null)
    setTranscript(command)
    setMessage('')
    try {
      await executeCommand(command, controller.signal)
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Не удалось выполнить команду.'
        )
    } finally {
      if (!controller.signal.aborted) updateState('idle')
    }
  }

  async function transcribe(signal: AbortSignal) {
    if (signal.aborted || stateRef.current !== 'recording') return
    const context = contextRef.current
    const chunks = chunksRef.current
    stopCapture()
    chunksRef.current = []
    updateState('transcribing')
    if (!context || !chunks.length) {
      setMessage('Не удалось записать голос. Попробуйте ещё раз.')
      updateState('idle')
      return
    }

    try {
      const wav = toWav(chunks, context.sampleRate)
      if (wav.size > 2_000_000)
        throw new Error('Запись слишком длинная. Ограничение — 15 секунд.')
      const form = new FormData()
      form.append('file', wav, 'voice-command.wav')
      form.append('response_format', 'json')
      form.append('language', 'ru')
      form.append(
        'prompt',
        'МТС Дежурка. Инцидент, номер заявки, демо-режим, исследование ситуации, видеостена.'
      )
      const response = await fetch('/api/voice/inference', {
        method: 'POST',
        body: form,
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      })
      if ([502, 503, 504].includes(response.status))
        throw new Error(
          'Распознавание недоступно. Запустите npm run voice:server и повторите запись.'
        )
      if (!response.ok) {
        throw new Error(
          `Ошибка распознавания (${response.status}). Повторите запись.`
        )
      }
      const result: unknown = await response.json()
      const transcript =
        result &&
        typeof result === 'object' &&
        'text' in result &&
        typeof result.text === 'string'
          ? result.text.trim()
          : ''
      if (
        !transcript.replace(/\[[^\]]*\]|\([^)]*\)/g, '').match(/[\p{L}\p{N}]/u)
      )
        throw new Error(
          'Не удалось распознать речь. Попробуйте сказать команду ещё раз.'
        )
      if (signal.aborted) return
      setTranscript(transcript)
      setDraft(transcript.slice(0, 500))
      if (questionMode.current) {
        setMessage('Проверьте расшифровку и нажмите «Спросить».')
        return
      }
      await executeCommand(transcript, signal)
    } catch (error) {
      if (signal.aborted) return
      const reason =
        error instanceof Error ? error.message : 'Неизвестная ошибка.'
      setMessage(
        reason.includes('Failed to fetch')
          ? 'Распознавание недоступно. Запустите npm run voice:server.'
          : reason
      )
    } finally {
      if (!signal.aborted) updateState('idle')
    }
  }

  async function startCapture(signal: AbortSignal) {
    if (!window.isSecureContext) {
      setMessage(
        'Браузер блокирует микрофон на этом адресе. Откройте приложение на localhost или по HTTPS.'
      )
      updateState('idle')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage(
        'Этот браузер не предоставляет доступ к микрофону. Откройте приложение в актуальном Chrome, Edge или Safari.'
      )
      updateState('idle')
      return
    }

    let stream: MediaStream | undefined
    let context: AudioContext | undefined
    try {
      // Resume AudioContext inside the click gesture before the permission prompt.
      context = new AudioContext()
      contextRef.current = context
      await context.resume()
      if (signal.aborted) return
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (signal.aborted) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const silent = context.createGain()
      silent.gain.value = 0
      chunksRef.current = []
      processor.onaudioprocess = (event) => {
        chunksRef.current.push(
          new Float32Array(event.inputBuffer.getChannelData(0))
        )
      }
      source.connect(processor)
      processor.connect(silent)
      silent.connect(context.destination)
      processorRef.current = processor
      updateState('recording')
      timerRef.current = window.setTimeout(
        () => void transcribe(signal),
        15_000
      )
    } catch (error) {
      if (signal.aborted) return
      stopCapture()
      updateState('idle')
      const name = error instanceof DOMException ? error.name : ''
      const messageByName: Record<string, string> = {
        NotAllowedError:
          'Браузер или macOS запретили микрофон. Разрешите его в настройках сайта и в Системных настройках → Конфиденциальность и безопасность → Микрофон.',
        NotFoundError:
          'Микрофон не найден. Подключите или выберите микрофон и попробуйте снова.',
        NotReadableError:
          'Микрофон занят другим приложением или недоступен macOS. Закройте другое приложение, использующее микрофон.',
        AbortError:
          'Браузер прервал запуск микрофона. Попробуйте нажать кнопку ещё раз.',
        SecurityError:
          'Браузер заблокировал микрофон для этого адреса. Откройте приложение на localhost или по HTTPS.',
      }
      setMessage(
        messageByName[name] ??
          (error instanceof Error
            ? `Не удалось запустить микрофон: ${error.message}`
            : 'Не удалось запустить микрофон. Проверьте настройки браузера и повторите попытку.')
      )
    }
  }

  useEffect(
    () => () => {
      requestRef.current?.abort()
      stopCapture()
    },
    []
  )

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.code !== 'KeyV' ||
        !event.altKey ||
        !event.shiftKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return

      event.preventDefault()
      if (!event.repeat) buttonRef.current?.click()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const toggle = (asQuestion = false) => {
    if (stateRef.current === 'recording' && requestRef.current) {
      void transcribe(requestRef.current.signal)
    } else if (stateRef.current === 'idle') {
      requestRef.current?.abort()
      requestRef.current = new AbortController()
      questionMode.current = asQuestion
      onStart()
      setTranscript('')
      setMessage('')
      setDecision(null)
      setDraft('')
      setOpen(true)
      updateState('starting')
      void startCapture(requestRef.current.signal)
    }
  }

  const busy = state !== 'idle' && state !== 'recording'
  const latestMessage = [message, transcript && `«${transcript}»`]
    .filter(Boolean)
    .join(' ')

  return (
    <div className='flex min-w-0 items-center gap-2'>
      {!open && message && (
        <span
          title={latestMessage}
          className='line-clamp-2 max-w-[min(18rem,26vw)] min-w-0 text-end text-xs break-words text-muted-foreground'
        >
          {latestMessage}
        </span>
      )}
      <Button
        ref={buttonRef}
        type='button'
        size='sm'
        variant='outline'
        onClick={() => toggle()}
        disabled={busy}
        aria-label='Голосовая команда'
        aria-keyshortcuts='Alt+Shift+V'
        aria-haspopup='dialog'
        title='Голосовая команда (Alt+Shift+V)'
        className='h-10 shrink-0'
      >
        <Mic />
        <span className='hidden xl:inline'>Голос</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
      >
        <DialogContent
          className='max-h-[85svh] overflow-y-auto sm:max-w-xl'
          overlayClassName='bg-black/55'
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const callback = afterClose.current
            afterClose.current = null
            if (callback) callback()
            else if (restoreFocusRef.current) buttonRef.current?.focus()
          }}
        >
          <div className='grid justify-items-center gap-2 px-5 text-center'>
            <span
              aria-hidden='true'
              className={
                state === 'recording'
                  ? 'grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive'
                  : 'grid size-12 place-items-center rounded-full bg-muted text-muted-foreground'
              }
            >
              {busy ? (
                <LoaderCircle className='size-5 motion-safe:animate-spin' />
              ) : (
                <Mic className='size-5' />
              )}
            </span>
            <DialogTitle aria-live='polite'>{voiceTitles[state]}</DialogTitle>
            <DialogDescription
              className={state === 'recording' ? undefined : 'sr-only'}
            >
              {state === 'recording'
                ? 'Нажмите «Завершить запись» или Alt+Shift+V, когда договорите.'
                : 'Запись голосовой команды и ответ помощника.'}
            </DialogDescription>
          </div>
          {(transcript || message) && (
            <div
              role='status'
              className='min-w-0 space-y-2 rounded-lg bg-muted/60 px-4 py-3 break-words'
            >
              {transcript && <p className='text-base'>«{transcript}»</p>}
              {message && (
                <p className='text-sm text-muted-foreground'>{message}</p>
              )}
            </div>
          )}
          {state === 'idle' && answer}
          {state === 'idle' && decision && (
            <div className='flex max-h-44 flex-wrap gap-2 overflow-y-auto'>
              {'choices' in decision &&
                decision.choices.map(({ label, run }) => (
                  <Button
                    key={label}
                    type='button'
                    variant='outline'
                    onClick={() => presentResult(run())}
                  >
                    {label}
                  </Button>
                ))}
              {'confirmation' in decision && (
                <>
                  <Button
                    type='button'
                    onClick={() => {
                      afterClose.current = decision.confirmation
                      setDecision(null)
                      closeDialog()
                    }}
                  >
                    Подтвердить
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      setDecision(null)
                      setMessage('Команда отменена.')
                    }}
                  >
                    Отмена
                  </Button>
                </>
              )}
            </div>
          )}
          <div hidden={state !== 'idle'}>
            <VoiceConversation
              draft={draft}
              onDraftChange={setDraft}
              onRecord={() => toggle(true)}
              onExecute={() => void executeDraft()}
              onOpen={(id) => {
                closeDialog(false)
                onOpenReference(id)
              }}
              snapshot={snapshot}
              focusId={focusId}
            />
          </div>
          {(state === 'starting' || state === 'recording') && (
            <Button
              type='button'
              size='sm'
              variant='ghost'
              className='justify-self-center'
              onClick={cancelRecording}
            >
              Ввести текст
            </Button>
          )}
          {(state === 'recording' || state === 'idle') && (
            <div className='flex flex-wrap justify-center gap-2'>
              {state === 'idle' && onOpenIncident && (
                <Button
                  type='button'
                  onClick={() => {
                    closeDialog(false)
                    onOpenIncident()
                  }}
                >
                  Открыть заявку
                </Button>
              )}
              <Button
                type='button'
                variant={state === 'recording' ? 'destructive' : 'outline'}
                onClick={() => toggle()}
              >
                {state === 'recording' ? (
                  <>
                    <Square /> Завершить запись
                  </>
                ) : (
                  <>
                    <Mic /> Записать ещё
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
