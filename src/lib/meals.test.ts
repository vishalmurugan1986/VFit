import { describe, expect, it } from 'vitest'
import type { DayCheck, MealDef, Routine } from '../db/types'
import { combineDateTime } from './dates'
import { dayProgress, isBedCheckTime, mealItems, workoutItem } from './dayCheck'
import { clockMinus, isClock, mealForNow } from './meals'
import { daysLabel, routinesOn, sessionOf } from './schedule'

const meals: MealDef[] = [
  { id: 'a', name: 'Meal 1', time: '08:00' },
  { id: 'b', name: 'Meal 2', time: '13:00' },
  { id: 'c', name: 'Meal 3', time: '17:00' },
  { id: 'd', name: 'Meal 4', time: null },
]
const day = '2026-11-19' // a Thursday
const at = (t: string) => combineDateTime(day, t)
const sessions = { morning: '06:00', evening: '19:00' }
const routine = (id: string, days: number[], session: 'morning' | 'evening' | null = 'morning'): Routine => ({
  id,
  name: id,
  exercises: [],
  days,
  session,
  createdAt: 0,
  updatedAt: 0,
})
const check = (p: Partial<DayCheck>): DayCheck => ({ id: day, date: day, meals: {}, updatedAt: 0, ...p })

describe('meal times', () => {
  it('checks clock strings and subtracts minutes', () => {
    expect(isClock('08:00')).toBe(true)
    expect(isClock('24:00')).toBe(false)
    expect(clockMinus('00:10', 15)).toBe('23:55')
  })

  it('picks the meal whose time it is', () => {
    expect(mealForNow(meals, day, at('07:00'))).toBe('a')
    expect(mealForNow(meals, day, at('12:40'))).toBe('b')
    expect(mealForNow(meals, day, at('22:00'))).toBe('c')
  })
})

describe('day check', () => {
  it('counts logged food or a tick as eating a meal', () => {
    const items = mealItems(meals, day, at('14:00'), new Set(['a']), check({ meals: { b: 'skipped' } }))
    expect(items.map((i) => i.state)).toEqual(['logged', 'skipped', 'later', 'open'])
    expect(mealItems(meals, day, at('14:00'), new Set(), check({ meals: { a: 'eaten' } }))[0].state).toBe('eaten')
  })

  it('knows the planned workout, rest days and logged sessions', () => {
    const push = routine('Push', [4], 'evening')
    expect(workoutItem([push], day, at('12:00'), false, sessions).state).toBe('later')
    expect(workoutItem([push], day, at('20:00'), false, sessions).state).toBe('open')
    expect(workoutItem([push], day, at('20:00'), true, sessions).state).toBe('logged')
    expect(workoutItem([push], day, at('20:00'), false, sessions, check({ workout: 'missed' })).state).toBe('missed')
    expect(workoutItem([], day, at('20:00'), false, sessions).state).toBe('rest')
  })

  it('adds up the day, supplements included', () => {
    const m = mealItems(meals.slice(0, 2), day, at('21:00'), new Set(['a']), undefined)
    const w = workoutItem([], day, at('21:00'), false, sessions)
    expect(dayProgress(m, w, { due: 2, taken: 2 })).toEqual({ done: 3, total: 4, open: 1 })
  })

  it('opens the before-bed check an hour before bedtime', () => {
    expect(isBedCheckTime(at('21:20'), day, '22:30')).toBe(false)
    expect(isBedCheckTime(at('21:30'), day, '22:30')).toBe(true)
  })
})

describe('schedule', () => {
  it('finds routines for a day and labels their days', () => {
    const list = [routine('Legs', [1, 4], 'evening'), routine('Push', [4], 'morning'), routine('Pull', [2])]
    expect(routinesOn(list, day).map((r) => r.name)).toEqual(['Push', 'Legs'])
    expect(daysLabel([4, 1], 1)).toBe('Mon, Thu')
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6], 1)).toBe('Every day')
  })

  it('puts a workout in the session it is closer to', () => {
    expect(sessionOf(at('06:20'), sessions)).toBe('morning')
    expect(sessionOf(at('18:40'), sessions)).toBe('evening')
  })
})
