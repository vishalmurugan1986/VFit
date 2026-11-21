import { describe, expect, it } from 'vitest'
import { dayStartTs } from './dates'
import { movingAverage, niceScale, valueOnOrBefore } from './series'

describe('movingAverage', () => {
  it('averages the trailing 7 calendar days', () => {
    const p = (date: string, v: number) => ({ t: dayStartTs(date), v })
    const out = movingAverage([p('2026-11-08', 79), p('2026-11-01', 80), p('2026-11-03', 82), p('2026-11-07', 81)])
    expect(out.map((x) => x.v)).toEqual([80, 82, 81, 79]) // sorted by date
    expect(out[0].avg).toBe(80)
    expect(out[1].avg).toBe(81)
    expect(out[2].avg).toBe(81) // Nov 1–7
    expect(out[3].avg).toBeCloseTo(80.667, 3) // Nov 2–8: Nov 1 has dropped out
  })
})

describe('niceScale', () => {
  it('picks round tick steps that cover the data', () => {
    expect(niceScale([171, 184]).ticks).toEqual([165, 170, 175, 180, 185, 190])
    expect(niceScale([180.2, 182.6]).ticks).toEqual([180, 181, 182, 183])
  })

  it('widens a flat series to the minimum span', () => {
    expect(niceScale([18.2, 18.6]).ticks).toEqual([17.5, 18, 18.5, 19])
    expect(niceScale([80]).domain).toEqual([79, 81])
  })

  it('handles no data', () => {
    expect(niceScale([])).toEqual({ domain: [0, 1], ticks: [0, 1] })
  })
})

describe('valueOnOrBefore', () => {
  it('finds the latest value on or before a date, skipping blanks', () => {
    const rows = [
      { date: '2026-10-01', w: 82 },
      { date: '2026-10-10', w: null },
      { date: '2026-10-20', w: 80 },
    ]
    expect(valueOnOrBefore(rows, '2026-10-15', (r) => r.w)).toBe(82)
    expect(valueOnOrBefore(rows, '2026-10-20', (r) => r.w)).toBe(80)
    expect(valueOnOrBefore(rows, '2026-09-30', (r) => r.w)).toBeNull()
  })
})
