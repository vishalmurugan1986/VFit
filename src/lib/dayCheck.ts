import type { DayCheck, MealDef, Routine, Session, Settings } from '../db/types'
import { combineDateTime, type DateStr } from './dates'
import { isClock } from './meals'

/**
 * How VFit knows what you've done each day:
 * - a meal is done when food is logged under it, or you tick it as eaten (or skipped);
 * - a workout is done when you log one that day, or tick it as done (or rest / missed);
 *   a day with no routine planned is a rest day by itself;
 * - supplements are done when every one due that day is ticked.
 * The before-bed check walks through whatever is still open.
 */

export type MealState = 'logged' | 'eaten' | 'skipped' | 'open' | 'later'
export type WorkoutState = 'logged' | 'done' | 'rest' | 'missed' | 'open' | 'later'

export interface MealItem {
  meal: MealDef
  state: MealState
  /** when it starts that day (ms), if it has a time */
  at: number | null
}

export interface WorkoutItem {
  state: WorkoutState
  /** routines planned that day */
  planned: Routine[]
  session: Session | null
  /** when the planned session starts (ms) */
  at: number | null
  /** nothing was planned (a rest day by itself) */
  restDay: boolean
}

export const isDone = (s: MealState | WorkoutState) =>
  s === 'logged' || s === 'eaten' || s === 'skipped' || s === 'done' || s === 'rest' || s === 'missed'

export function mealItems(meals: MealDef[], date: DateStr, now: number, logged: Set<string>, check?: DayCheck): MealItem[] {
  return meals.map((meal) => {
    const at = isClock(meal.time) ? combineDateTime(date, meal.time) : null
    const mark = check?.meals?.[meal.id]
    let state: MealState
    if (logged.has(meal.id)) state = 'logged'
    else if (mark) state = mark
    else if (at != null && now < at) state = 'later'
    else state = 'open'
    return { meal, state, at }
  })
}

export function workoutItem(
  planned: Routine[],
  date: DateStr,
  now: number,
  trained: boolean,
  sessions: Settings['sessions'],
  check?: DayCheck,
): WorkoutItem {
  const session = planned[0]?.session ?? null
  const time = session ? sessions[session] : null
  const at = time && isClock(time) ? combineDateTime(date, time) : null
  const restDay = planned.length === 0
  let state: WorkoutState
  if (trained) state = 'logged'
  else if (check?.workout) state = check.workout
  else if (restDay) state = 'rest'
  else if (at != null && now < at) state = 'later'
  else state = 'open'
  return { state, planned, session, at, restDay }
}

export interface DayProgress {
  done: number
  total: number
  /** items still to do, including ones later today */
  open: number
}

export function dayProgress(meals: MealItem[], workout: WorkoutItem, supplements: { due: number; taken: number }): DayProgress {
  const states = [...meals.map((m) => m.state), workout.state]
  let done = states.filter(isDone).length
  let total = states.length
  if (supplements.due > 0) {
    total++
    if (supplements.taken >= supplements.due) done++
  }
  return { done, total, open: total - done }
}

/** The before-bed check opens an hour before bedtime and stays open until midnight. */
export function isBedCheckTime(now: number, date: DateStr, bedTime: string): boolean {
  if (!isClock(bedTime)) return false
  return now >= combineDateTime(date, bedTime) - 60 * 60_000
}

/**
 * The morning nudge to finish yesterday's check: until noon, while yesterday was left open with
 * something still to do, and only once you were using VFit before today. `firstActiveDay` is the first
 * day anything was logged or checked off; a brand-new install has none, so it has no yesterday to finish.
 */
export function showYesterdayNudge(o: {
  today: DateStr
  now: number
  firstActiveDay: DateStr | null
  closed: boolean
  open: number
}): boolean {
  const usedBefore = o.firstActiveDay != null && o.firstActiveDay < o.today
  return usedBefore && !o.closed && o.open > 0 && new Date(o.now).getHours() < 12
}
