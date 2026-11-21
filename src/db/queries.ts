import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { addDays, dateStrFromTs, dayStartTs } from '../lib/dates'
import { dayProgress, mealItems, workoutItem, type DayProgress, type MealItem, type WorkoutItem } from '../lib/dayCheck'
import { routinesOn } from '../lib/schedule'
import { isScheduled } from '../lib/supplements'
import { entryTotals } from '../lib/nutrition'
import type { PhaseInputs } from '../lib/phases'
import { previousSets } from '../lib/strength'
import { db } from './db'
import { usePhases, useSettings } from './settings'
import type { CardioType, DayCheck, Exercise, ExerciseKind, Nutrients, Workout, WorkoutSet } from './types'

export interface ProfileFacts {
  weightKg: number | null
  heightCm: number | null
}

/** The workout currently in progress, or null. */
export async function getActiveWorkout(): Promise<Workout | null> {
  return (
    (await db.workouts
      .orderBy('startedAt')
      .reverse()
      .filter((w) => w.finishedAt == null)
      .first()) ?? null
  )
}

export async function workoutsWithExercise(exerciseId: string): Promise<Workout[]> {
  return db.workouts.where('exerciseIds').equals(exerciseId).toArray()
}

/** For each exercise: the sets from its most recent earlier session. */
export async function previousSetsMap(
  exerciseIds: string[],
  before: number,
  excludeId: string,
): Promise<Record<string, WorkoutSet[]>> {
  const out: Record<string, WorkoutSet[]> = {}
  await Promise.all(
    exerciseIds.map(async (id) => {
      const sets = previousSets(id, await workoutsWithExercise(id), before, excludeId)
      if (sets) out[id] = sets
    }),
  )
  return out
}

export async function getLastBackup(): Promise<number | null> {
  const row = await db.meta.get('lastBackupAt')
  return typeof row?.value === 'number' ? row.value : null
}

/** Latest logged weight and height (from any entry that has them). */
export async function getBodyFacts(): Promise<ProfileFacts> {
  const newestFirst = db.body.orderBy('date').reverse()
  const [w, h] = await Promise.all([
    newestFirst.clone().filter((e) => e.weightKg != null).first(),
    newestFirst.clone().filter((e) => e.heightCm != null).first(),
  ])
  return { weightKg: w?.weightKg ?? null, heightCm: h?.heightCm ?? null }
}

export function useActiveWorkout() {
  return useLiveQuery(getActiveWorkout, [])
}

/** Exercise library as a list (A–Z) plus an id → exercise map. */
export function useExercises() {
  const list = useLiveQuery(() => db.exercises.orderBy('name').toArray(), [])
  return useMemo(() => {
    const map = new Map<string, Exercise>((list ?? []).map((e) => [e.id, e]))
    const kindOf = (id: string): ExerciseKind => map.get(id)?.kind ?? 'weight'
    return { list: list ?? [], map, kindOf, loaded: list !== undefined }
  }, [list])
}

/** Cardio activities in display order, plus a lookup that never fails for old or unknown ids. */
export function useCardioTypes() {
  const list = useLiveQuery(() => db.cardioTypes.orderBy('order').toArray(), [])
  return useMemo(() => {
    const all = list ?? []
    const map = new Map<string, CardioType>(all.map((t) => [t.id, t]))
    const typeOf = (id: string): CardioType =>
      map.get(id) ?? {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        measure: 'pace',
        icon: 'activity',
        builtIn: false,
        order: 999,
        createdAt: 0,
      }
    return { all, visible: all.filter((t) => !t.hidden), typeOf, loaded: list !== undefined }
  }, [list])
}

/** Daily nutrition targets of the phase in force on `date` (today by default). */
export function useTargets(date?: string): { targets: Nutrients } {
  const { targetsOn } = usePhases()
  const targets = targetsOn(date)
  return useMemo(() => ({ targets }), [targets])
}

/** Everything phase results are measured from, loaded in one go (used on the Goal page). */
export async function getPhaseInputs(): Promise<PhaseInputs> {
  const [body, foods, workouts, cardio] = await Promise.all([
    db.body.orderBy('date').toArray(),
    db.foods.toArray(),
    db.workouts.orderBy('startedAt').toArray(),
    db.cardio.orderBy('date').toArray(),
  ])
  const kcalByDay = new Map<string, number>()
  for (const f of foods) kcalByDay.set(f.date, (kcalByDay.get(f.date) ?? 0) + entryTotals(f).calories)
  return {
    weights: body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, kg: b.weightKg! })),
    kcalByDay,
    workoutDates: workouts.filter((w) => w.finishedAt != null).map((w) => dateStrFromTs(w.startedAt)),
    cardio: cardio.map((c) => ({ date: c.date, km: c.distanceKm ?? 0, sec: c.durationSec })),
  }
}

export interface DayCheckData {
  meals: MealItem[]
  workout: WorkoutItem
  supplements: { due: number; taken: number }
  progress: DayProgress
  check: DayCheck | undefined
  /** the workout logged that day, if any */
  logged: Workout | undefined
  ready: boolean
}

/** Everything the day check needs for one date: meals, the planned workout, supplements. */
export function useDayCheck(date: string, now: number): DayCheckData {
  const settings = useSettings()
  const data = useLiveQuery(async () => {
    const [foods, check, workouts, routines, supplements, logs] = await Promise.all([
      db.foods.where('date').equals(date).toArray(),
      db.dayChecks.get(date),
      db.workouts.where('startedAt').between(dayStartTs(date), dayStartTs(addDays(date, 1)), true, false).toArray(),
      db.routines.toArray(),
      db.supplements.toArray(),
      db.supplementLogs.where('date').equals(date).toArray(),
    ])
    const due = supplements.filter((x) => isScheduled(x, date))
    return {
      logged: new Set(foods.map((x) => x.meal)),
      check,
      workout: workouts.sort((x, y) => y.startedAt - x.startedAt)[0],
      planned: routinesOn(routines, date),
      supplements: { due: due.length, taken: due.filter((x) => logs.some((l) => l.supplementId === x.id)).length },
    }
  }, [date])
  const meals = mealItems(settings.meals, date, now, data?.logged ?? new Set(), data?.check)
  const workout = workoutItem(data?.planned ?? [], date, now, data?.workout != null, settings.sessions, data?.check)
  const supplements = data?.supplements ?? { due: 0, taken: 0 }
  return {
    meals,
    workout,
    supplements,
    progress: dayProgress(meals, workout, supplements),
    check: data?.check,
    logged: data?.workout,
    ready: data !== undefined,
  }
}

async function patchDayCheck(date: string, change: (c: DayCheck) => void) {
  await db.transaction('rw', db.dayChecks, async () => {
    const c: DayCheck = (await db.dayChecks.get(date)) ?? { id: date, date, meals: {}, updatedAt: 0 }
    change(c)
    c.updatedAt = Date.now()
    await db.dayChecks.put(c)
  })
}

/** Tick a meal as eaten or skipped without logging food (null clears it). */
export const setMealCheck = (date: string, meal: string, value: 'eaten' | 'skipped' | null) =>
  patchDayCheck(date, (c) => {
    if (value) c.meals[meal] = value
    else delete c.meals[meal]
  })

/** Mark the day's workout as done (not logged here), a rest day or missed (null clears it). */
export const setWorkoutCheck = (date: string, value: DayCheck['workout'] | null) =>
  patchDayCheck(date, (c) => {
    if (value) c.workout = value
    else delete c.workout
  })

/** Finish the before-bed check for a day. */
export const closeDay = (date: string) => patchDayCheck(date, (c) => (c.closedAt = Date.now()))

/** The first day anything was logged or checked off on this device, or null on a brand-new install. */
export async function getFirstActiveDay(): Promise<string | null> {
  const [food, body, cardio, workout, check, supplement] = await Promise.all([
    db.foods.orderBy('date').first(),
    db.body.orderBy('date').first(),
    db.cardio.orderBy('date').first(),
    db.workouts.orderBy('startedAt').first(),
    db.dayChecks.orderBy('date').first(),
    db.supplementLogs.orderBy('date').first(),
  ])
  const workoutDay = workout && dateStrFromTs(workout.startedAt)
  const days = [food?.date, body?.date, cardio?.date, workoutDay, check?.date, supplement?.date]
  return days.filter((d): d is string => typeof d === 'string').sort()[0] ?? null
}

export function useFirstActiveDay() {
  return useLiveQuery(getFirstActiveDay, [])
}
