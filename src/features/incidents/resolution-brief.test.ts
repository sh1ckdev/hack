import { describe, expect, it } from 'vitest'
import {
  buildResolutionBrief,
  phraseKeepsFacts,
  type ResolutionBrief,
} from '../../../server/template-summary'

const now = Date.parse('2026-11-21T15:00:00Z')

describe('buildResolutionBrief', () => {
  it('states the recorded fix, the open status and the overdue deadline', () => {
    const brief = buildResolutionBrief(
      {
        header: 'Неисправность: Кэш кадров',
        service: '[Автопросматриватель TicTok] Процессор видео',
        stateEnum: 'Assigned',
        assignedEmployee: 'Буратино (buratino)',
        deadline: '2026-11-10T23:45:40Z',
        solution: 'Отрегулирован Кэш кадров, инцидент закрыт.',
      },
      'КЦ ДОИ Администрирование SAN',
      now
    )

    expect(brief).toEqual({
      symptom: 'Отклонение «Кэш кадров» на сервисе «Процессор видео».',
      known:
        'В решении написано: «Отрегулирован Кэш кадров, инцидент закрыт». Причина отклонения в выгрузке не подтверждена.',
      gap: 'Статус всё ещё «Назначен». Просрочено на 10 д. 15 ч.',
      action:
        'Буратино подтверждает, что записанное решение сняло «Кэш кадров», и заявку закрывают. Если нет — передайте в «КЦ ДОИ Администрирование SAN».',
    })
  })

  it('does not suggest closing a research ticket without a solution', () => {
    const brief = buildResolutionBrief(
      {
        header: 'Аномалия в Футляр',
        service: null,
        stateEnum: 'Research',
        assignedEmployee: 'Медведь Барсик (barsik)',
        deadline: '2026-11-22T15:00:00Z',
        solution: null,
      },
      'КЦ ДОИ VMWare',
      now
    )

    expect(brief.known).toBe('Причина неизвестна.')
    expect(brief.gap).toBeNull()
    expect(brief.action).toContain('Закрывать рано')
    expect(brief.action).not.toContain('закрывают')
  })
})

describe('phraseKeepsFacts', () => {
  const source: ResolutionBrief = {
    symptom: 'Отклонение «Кэш кадров».',
    known: 'Причина неизвестна.',
    gap: 'Статус всё ещё «Назначен».',
    action: 'Передайте в «КЦ ДОИ Администрирование SAN».',
  }

  it('rejects a phrase that adds a team', () => {
    expect(
      phraseKeepsFacts(source, {
        ...source,
        action: 'Передайте в «КЦ ДОИ Администрирование SAN» или в «ОГЭ».',
      })
    ).toBe(false)
  })

  it('rejects a phrase that drops a quoted fact', () => {
    expect(
      phraseKeepsFacts(source, {
        ...source,
        action: 'Передайте профильной команде.',
      })
    ).toBe(false)
  })
})
