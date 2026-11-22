import { describe, expect, it } from 'vitest'
import {
  matchVoiceCommand,
  resolveVoiceIncidentIds,
  voiceIntentSchema,
} from './voice-intent'

describe('dashboard voice commands', () => {
  it('recognizes the demo and research commands without a provider', () => {
    expect(matchVoiceCommand('Включи демо-режим.')).toEqual({
      action: 'view',
      view: 'demo',
    })
    expect(matchVoiceCommand('Включите деморежим')).toEqual({
      action: 'view',
      view: 'demo',
    })
    expect(matchVoiceCommand('Отфильтруй исследование ситуации')).toEqual({
      action: 'filter',
      filters: [],
      query: '',
      states: ['Research'],
    })
  })

  it('normalizes a spoken suffix and keeps every matching incident', () => {
    const command = matchVoiceCommand(
      'Открой инцидент, заканчивающийся на один пять один.'
    )
    expect(command).toEqual({
      action: 'incident',
      operation: 'open',
      reference: '151',
    })
    expect(
      resolveVoiceIncidentIds(['INC00151', 'INC02151', 'INC01510'], '151')
    ).toEqual(['INC00151', 'INC02151'])
    expect(
      resolveVoiceIncidentIds(['INC00151', 'INC02151'], 'inc02151')
    ).toEqual(['INC02151'])
    expect(
      matchVoiceCommand(
        'Открой карточку, у которой последние цифры сто пятьдесят один'
      )
    ).toEqual(command)
    expect(resolveVoiceIncidentIds(['INC00151'], 'INC151')).toEqual([])
  })

  it('validates provider actions against known filters and incident operations', () => {
    expect(
      voiceIntentSchema.safeParse({
        action: 'incident',
        operation: 'delete',
        reference: '151',
      }).success
    ).toBe(false)
    expect(
      voiceIntentSchema.safeParse({
        action: 'filter',
        filters: [],
        query: '',
        states: ['Research'],
      }).success
    ).toBe(true)
    expect(
      voiceIntentSchema.safeParse({
        action: 'filter',
        filters: [],
        query: '',
        states: ['Active'],
      }).success
    ).toBe(false)
  })
})
