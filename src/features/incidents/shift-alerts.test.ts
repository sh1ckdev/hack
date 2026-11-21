import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readShiftAlertPrefs, writeShiftAlertPrefs } from './shift-alerts'

describe('shift alert prefs', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => store.clear(),
    })
    localStorage.clear()
  })

  it('defaults sound on and push off until permission', () => {
    expect(readShiftAlertPrefs()).toEqual({ sound: true, desktop: false })
  })

  it('persists toggles', () => {
    writeShiftAlertPrefs({ sound: false, desktop: true })
    expect(readShiftAlertPrefs()).toEqual({ sound: false, desktop: true })
  })
})