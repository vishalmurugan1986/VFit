import { describe, expect, it } from 'vitest'
import type { Phase } from '../db/types'
import {
  DEFAULT_TARGETS,
  goalLabel,
  GOALS,
  phaseFromLegacy,
  phaseOn,
  phaseProgressLabel,
  phaseSpans,
  phaseStats,
  phaseStatus,
  sortPhases,
} from './phases'

const phase = (id: string, startDate: string, extra: Partial<Phase> = {}): Phase => ({
  id,
  goal: 'maingain',
  startDate,
  targetWeightKg: null,
  targets: DEFAULT_TARGETS,
  createdAt: 0,
  ...extra,
})

describe('goals', () => {
  it('offers bulk, maingain and cut', () => {
    expect(GOALS.map((g) => g.label)).toEqual(['Bulk', 'Maingain', 'Cut'])
    expect(goalLabel('cut')).toBe('Cut')
  })
})

describe('phaseFromLegacy', () => {
  it('carries over the goal and targets kept in settings', () => {
    const p = phaseFromLegacy(
      { goal: 'lose', goalWeightKg: 72, calorieTarget: 2200, proteinTarget: 160 },
      '2026-01-05',
      'x',
    )
    expect(p.goal).toBe('cut')
    expect(p.targetWeightKg).toBe(72)
    expect(p.targets).toEqual({ calories: 2200, protein: 160, carbs: 200, fat: 65 })
  })
  it('falls back to defaults', () => {
    const p = phaseFromLegacy({}, '2026-01-05', 'x')
    expect(p.goal).toBe('maingain')
    expect(p.targets).toEqual(DEFAULT_TARGETS)
  })
})

describe('phase timeline', () => {
  const list = sortPhases([phase('cut', '2027-02-01', { goal: 'cut' }), phase('mg', '2026-09-01')])

  it('picks the phase in force on a date, and switches by itself on the start date', () => {
    expect(phaseOn(list, '2026-12-31')?.id).toBe('mg')
    expect(phaseOn(list, '2027-02-01')?.id).toBe('cut')
    // Before the first phase: use the first one.
    expect(phaseOn(list, '2025-01-01')?.id).toBe('mg')
    expect(phaseOn([], '2026-01-01')).toBeNull()
  })

  it('ends each phase the day before the next starts', () => {
    const spans = phaseSpans(list)
    expect(spans.map((s) => [s.start, s.end])).toEqual([
      ['2026-09-01', '2027-01-31'],
      ['2027-02-01', null],
    ])
    expect(spans.map((s) => phaseStatus(s, '2026-11-19'))).toEqual(['current', 'upcoming'])
    expect(spans.map((s) => phaseStatus(s, '2027-03-01'))).toEqual(['past', 'current'])
  })

  it('labels progress', () => {
    const p = phase('a', '2026-09-01')
    expect(phaseProgressLabel(p, '2026-09-01')).toBe('Week 1')
    expect(phaseProgressLabel(p, '2026-10-13')).toBe('Week 7')
    expect(phaseProgressLabel(phase('b', '2026-11-20'), '2026-11-19')).toBe('Starts tomorrow')
    expect(phaseProgressLabel(phase('b', '2027-02-01'), '2026-11-19')).toBe('Starts in 11 weeks')
  })
})

describe('phaseStats', () => {
  const span = { phase: phase('mg', '2026-09-01'), start: '2026-09-01', end: '2026-09-28' }
  const stats = phaseStats(
    span,
    {
      weights: [
        { date: '2026-08-30', kg: 80 },
        { date: '2026-09-14', kg: 80.6 },
        { date: '2026-09-27', kg: 81.2 },
        { date: '2026-10-05', kg: 79 },
      ],
      kcalByDay: new Map([
        ['2026-09-02', 2000],
        ['2026-09-03', 2500],
        ['2026-10-01', 9999],
      ]),
      workoutDates: ['2026-09-02', '2026-09-04', '2026-09-20', '2026-10-02'],
      cardio: [{ date: '2026-09-10', km: 5, sec: 1800 }],
    },
    '2026-11-19',
  )
  it('measures weight change from the weigh-in just before the start', () => {
    expect(stats.days).toBe(28)
    expect(stats.startWeight).toBe(80)
    expect(stats.endWeight).toBe(81.2)
    expect(stats.change).toBeCloseTo(1.2)
    expect(stats.perWeek).toBeCloseTo((1.2 / 28) * 7)
  })
  it('counts only days inside the phase', () => {
    expect(stats.loggedDays).toBe(2)
    expect(stats.avgKcal).toBe(2250)
    expect(stats.onTargetDays).toBe(1)
    expect(stats.workouts).toBe(3)
    expect(stats.workoutsPerWeek).toBeCloseTo(0.75)
    expect(stats.cardioKm).toBe(5)
  })
})
