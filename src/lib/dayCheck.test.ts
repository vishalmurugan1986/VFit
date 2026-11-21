import { describe, expect, it } from 'vitest'
import { showYesterdayNudge } from './dayCheck'

const at = (hour: number) => new Date(2026, 10, 21, hour, 0).getTime()
const morning = { today: '2026-11-21', now: at(9), firstActiveDay: '2026-11-01', closed: false, open: 3 }

describe('showYesterdayNudge', () => {
  it('nudges in the morning when yesterday was left open', () => {
    expect(showYesterdayNudge(morning)).toBe(true)
  })

  it('stays quiet on a brand-new install', () => {
    expect(showYesterdayNudge({ ...morning, firstActiveDay: null })).toBe(false)
  })

  it('stays quiet on the first day you use VFit, and nudges from the next', () => {
    expect(showYesterdayNudge({ ...morning, firstActiveDay: '2026-11-21' })).toBe(false)
    expect(showYesterdayNudge({ ...morning, firstActiveDay: '2026-11-20' })).toBe(true)
  })

  it('stays quiet from noon, once the day was closed, or with nothing left', () => {
    expect(showYesterdayNudge({ ...morning, now: at(12) })).toBe(false)
    expect(showYesterdayNudge({ ...morning, closed: true })).toBe(false)
    expect(showYesterdayNudge({ ...morning, open: 0 })).toBe(false)
  })
})
