import { describe, expect, it } from 'vitest'
import { lastPeriods, periodsBetween, periodStart } from './periods'

describe('periods', () => {
  it('finds the start of a week, month and year', () => {
    expect(periodStart('week', '2026-11-19', 1)).toBe('2026-11-16')
    expect(periodStart('week', '2026-11-19', 0)).toBe('2026-11-15')
    expect(periodStart('month', '2026-11-19', 1)).toBe('2026-11-01')
    expect(periodStart('year', '2026-11-19', 1)).toBe('2026-01-01')
  })
  it('lists the last few months across a year boundary', () => {
    expect(lastPeriods('month', '2027-02-10', 3, 1).map((p) => [p.start, p.end])).toEqual([
      ['2026-12-01', '2026-12-31'],
      ['2027-01-01', '2027-01-31'],
      ['2027-02-01', '2027-02-28'],
    ])
  })
  it('lists weeks oldest first, ending with the current one', () => {
    const w = lastPeriods('week', '2026-11-19', 2, 1)
    expect(w.map((p) => [p.start, p.end])).toEqual([
      ['2026-11-09', '2026-11-15'],
      ['2026-11-16', '2026-11-22'],
    ])
  })
  it('spans years', () => {
    expect(periodsBetween('year', '2025-06-01', '2027-01-02', 1).map((p) => p.start)).toEqual([
      '2025-01-01',
      '2026-01-01',
      '2027-01-01',
    ])
  })
})
