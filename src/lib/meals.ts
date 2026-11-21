import type { MealDef } from '../db/types'
import { combineDateTime, type DateStr } from './dates'

/** Times the first four meals start with; you change them in Your meals. */
export const DEFAULT_MEAL_TIMES = ['08:00', '13:00', '17:00', '20:00']

export const isClock = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** Clock time minus `minutes`, as "HH:MM" (wraps past midnight). */
export function clockMinus(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = (((h * 60 + m - minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** The meal you're most likely adding food to right now: the latest one that has started, else the first. */
export function mealForNow(meals: MealDef[], date: DateStr, now: number): string | undefined {
  let pick: MealDef | undefined
  for (const m of meals) {
    if (!isClock(m.time)) continue
    // Count a meal from 30 minutes before its time, so logging just before you eat lands in the right place.
    if (combineDateTime(date, m.time) - 30 * 60_000 <= now) {
      if (!pick || m.time! > pick.time!) pick = m
    }
  }
  return (pick ?? meals[0])?.id
}
