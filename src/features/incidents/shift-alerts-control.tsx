import { useEffect, useState } from 'react'
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  desktopNotificationPermission,
  requestDesktopNotificationPermission,
  primeShiftAlertAudio,
  showDesktopNotification,
  testShiftAlertSound,
  type ShiftAlertPrefs,
} from './shift-alerts'

function SoundToggle({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  return (
    <Button
      type='button'
      size='sm'
      variant={enabled ? 'secondary' : 'outline'}
      className='h-8 gap-1.5 rounded-sm px-2.5 text-xs font-normal max-md:px-2'
      aria-pressed={enabled}
      aria-label={enabled ? 'Звук включён' : 'Звук выключен'}
      title='Звуковой сигнал при изменениях в выгрузке'
      onClick={() => {
        const next = !enabled
        if (next) {
          primeShiftAlertAudio()
          testShiftAlertSound()
        }
        onChange(next)
      }}
    >
      {enabled ? (
        <Volume2 aria-hidden className='size-3.5' />
      ) : (
        <VolumeX aria-hidden className='size-3.5' />
      )}
      <span className='max-lg:sr-only'>
        {enabled ? 'Звук вкл' : 'Звук выкл'}
      </span>
    </Button>
  )
}

function DesktopNotificationToggle({
  permission,
  enabled,
  onPermissionChange,
  onEnabledChange,
}: {
  permission: NotificationPermission | 'unsupported'
  enabled: boolean
  onPermissionChange: (p: NotificationPermission | 'unsupported') => void
  onEnabledChange: (enabled: boolean) => void
}) {
  async function requestAccess() {
    primeShiftAlertAudio()
    const result = await requestDesktopNotificationPermission()
    onPermissionChange(result)
    if (result === 'granted') {
      onEnabledChange(true)
      showDesktopNotification('Уведомления включены', {
        body: 'Будем показывать push при событиях в выгрузке.',
        tag: 'relay-notify-ready',
      })
    }
  }

  if (permission === 'unsupported') {
    return (
      <Button
        type='button'
        size='sm'
        variant='outline'
        className='h-8 rounded-sm px-2.5 text-xs font-normal'
        disabled
        title='Браузер не поддерживает уведомления'
      >
        Push недоступен
      </Button>
    )
  }

  if (permission === 'default') {
    return (
      <Button
        type='button'
        size='sm'
        variant='default'
        className='h-8 gap-1.5 rounded-sm px-2.5 text-xs font-normal max-md:px-2'
        onClick={() => void requestAccess()}
      >
        <Bell aria-hidden className='size-3.5' />
        <span className='max-xl:sr-only'>Разрешить уведомления</span>
      </Button>
    )
  }

  if (permission === 'denied') {
    return (
      <Button
        type='button'
        size='sm'
        variant='outline'
        className='h-8 gap-1.5 rounded-sm px-2.5 text-xs font-normal'
        disabled
        title='Включите уведомления для этого сайта в настройках браузера'
      >
        <BellOff aria-hidden className='size-3.5' />
        Push заблокирован
      </Button>
    )
  }

  return (
    <Button
      type='button'
      size='sm'
      variant={enabled ? 'secondary' : 'outline'}
      className='h-8 gap-1.5 rounded-sm px-2.5 text-xs font-normal'
      aria-pressed={enabled}
      aria-label={
        enabled ? 'Push-уведомления включены' : 'Push-уведомления выключены'
      }
      onClick={() => onEnabledChange(!enabled)}
    >
      <Bell aria-hidden className='size-3.5' />
      <span className='max-lg:sr-only'>
        {enabled ? 'Push вкл' : 'Push выкл'}
      </span>
    </Button>
  )
}

export function ShiftAlertsControl({
  className,
  prefs,
  setPrefs,
}: {
  className?: string
  prefs: ShiftAlertPrefs
  setPrefs: (patch: Partial<ShiftAlertPrefs>) => void
}) {
  const [permission, setPermission] = useState(desktopNotificationPermission)

  useEffect(() => {
    setPermission(desktopNotificationPermission())
  }, [])

  useEffect(() => {
    if (permission !== 'granted' && prefs.desktop) setPrefs({ desktop: false })
  }, [permission, prefs.desktop, setPrefs])

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role='group'
      aria-label='Оповещения смены'
    >
      <SoundToggle
        enabled={prefs.sound}
        onChange={(sound) => setPrefs({ sound })}
      />
      <DesktopNotificationToggle
        permission={permission}
        enabled={prefs.desktop}
        onPermissionChange={setPermission}
        onEnabledChange={(desktop) => setPrefs({ desktop })}
      />
    </div>
  )
}
