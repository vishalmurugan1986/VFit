import { describe, expect, it } from 'vitest'
import type { Supplement, SupplementLog } from '../db/types'
import { dayStartTs } from './dates'
import { adherence, daysLabel, isScheduled } from './supplements'

const supp = (days: number[], extra: Partial<Supplement> = {}): Supplement => ({
  id: 's1',
  name: 'Creatine',
  dose: '5 g',
  time: 'anytime',
  days,
  order: 1,
  createdAt: dayStartTs('2026-11-01'),
  ...extra,
})
const log = (date: string): SupplementLog => ({ id: date, date, supplementId: 's1', takenAt: 0 })

describe('daysLabel', () => {
  it('names common schedules', () => {
    expect(daysLabel([])).toBe('Every day')
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(daysLabel([1, 2, 3, 4, 5])).toBe('Weekdays')
    expect(daysLabel([6, 0])).toBe('Weekends')
    expect(daysLabel([5, 1, 3])).toBe('Mon, Wed, Fri')
  })
})

describe('isScheduled', () => {
  it('follows the chosen days (2026-11-18 is a Wednesday)', () => {
    expect(isScheduled(supp([]), '2026-11-18')).toBe(true)
    expect(isScheduled(supp([1, 3, 5]), '2026-11-18')).toBe(true)
    expect(isScheduled(supp([2, 4]), '2026-11-18')).toBe(false)
  })

  it('is never due while paused', () => {
    expect(isScheduled(supp([], { paused: true }), '2026-11-18')).toBe(false)
  })
})

describe('adherence', () => {
  it('counts taken against due days, without marking today as missed', () => {
    const a = adherence(supp([]), [log('2026-11-12'), log('2026-11-13'), log('2026-11-15')], '2026-11-18')
    expect(a.days.map((d) => d.status)).toEqual(['taken', 'taken', 'missed', 'taken', 'missed', 'missed', 'off'])
    expect(a).toMatchObject({ taken: 3, scheduled: 6 })
  })

  it('ignores days before the supplement was added', () => {
    const a = adherence(supp([], { createdAt: dayStartTs('2026-11-17') }), [], '2026-11-18')
    expect(a.scheduled).toBe(1)
  })
})
