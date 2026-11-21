import { describe, expect, it } from 'vitest'
import type { CardioSession } from '../db/types'
import { cardioTotals, paceLabel, usesDistance } from './cardio'

describe('paceLabel', () => {
  it('shows walking and running pace per km', () => {
    expect(paceLabel('pace', 5, 1500)).toBe('5:00 /km')
    expect(paceLabel('pace', 2.5, 1530)).toBe('10:12 /km')
  })

  it('shows cycling speed', () => {
    expect(paceLabel('speed', 30, 3600)).toBe('30 km/h')
  })

  it('shows swim pace per 100 m', () => {
    expect(paceLabel('swim', 1, 1200)).toBe('2:00 /100 m')
  })

  it('has nothing to show without a distance, or for time-only activities', () => {
    expect(paceLabel('pace', null, 1500)).toBeNull()
    expect(paceLabel('time', 5, 1500)).toBeNull()
  })

  it('asks for a distance except for time-only activities', () => {
    expect(usesDistance('pace')).toBe(true)
    expect(usesDistance('swim')).toBe(true)
    expect(usesDistance('time')).toBe(false)
  })
})

describe('cardioTotals', () => {
  it('adds up distance, time and sessions', () => {
    const s = (distanceKm: number | null, durationSec: number): CardioSession => ({
      id: String(Math.random()),
      date: '2026-11-18',
      activity: 'run',
      durationSec,
      distanceKm,
      calories: null,
      avgHr: null,
      createdAt: 0,
    })
    expect(cardioTotals([s(5, 1500), s(null, 1800), s(10.5, 3600)])).toEqual({
      distanceKm: 15.5,
      durationSec: 6900,
      sessions: 3,
    })
  })
})
