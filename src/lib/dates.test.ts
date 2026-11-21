import { describe, expect, it } from 'vitest'
import {
  addDays,
  combineDateTime,
  dateStrFromTs,
  dayLabel,
  diffDays,
  formatClock,
  formatDuration,
  isDateStr,
  parseClock,
  startOfWeek,
  timeStrFromTs,
} from './dates'

describe('calendar dates', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('counts whole days between dates, including across DST changes', () => {
    expect(diffDays('2026-11-18', '2026-11-11')).toBe(7)
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2)
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2)
  })

  it('finds the start of the week (2026-11-18 is a Wednesday)', () => {
    expect(startOfWeek('2026-11-18', 1)).toBe('2026-11-16')
    expect(startOfWeek('2026-11-18', 0)).toBe('2026-11-15')
    expect(startOfWeek('2026-11-16', 1)).toBe('2026-11-16')
    expect(startOfWeek('2026-11-15', 1)).toBe('2026-11-09')
  })

  it('validates date strings', () => {
    expect(isDateStr('2028-02-29')).toBe(true)
    expect(isDateStr('2026-02-29')).toBe(false)
    expect(isDateStr('2026-1-5')).toBe(false)
    expect(isDateStr(null)).toBe(false)
  })

  it('labels today and yesterday', () => {
    expect(dayLabel('2026-11-18', '2026-11-18')).toBe('Today')
    expect(dayLabel('2026-11-17', '2026-11-18')).toBe('Yesterday')
  })

  it('combines a date and a time of day', () => {
    const ts = combineDateTime('2026-11-18', '07:45')
    expect(dateStrFromTs(ts)).toBe('2026-11-18')
    expect(timeStrFromTs(ts)).toBe('07:45')
  })
})

describe('durations', () => {
  it('formats clock times', () => {
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(312)).toBe('5:12')
    expect(formatClock(0)).toBe('0:00')
  })

  it('parses "m:ss", "h:mm:ss" and plain seconds', () => {
    expect(parseClock('1:30')).toBe(90)
    expect(parseClock('90')).toBe(90)
    expect(parseClock('1:02:05')).toBe(3725)
    expect(parseClock('')).toBeNull()
    expect(parseClock('abc')).toBeNull()
  })

  it('formats human durations', () => {
    expect(formatDuration(3725)).toBe('1h 2m')
    expect(formatDuration(2700)).toBe('45m')
    expect(formatDuration(40)).toBe('40s')
  })
})
