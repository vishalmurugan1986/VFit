import type { ExerciseKind, RoutineExercise, Workout, WorkoutSet } from '../db/types'
import { formatClock } from './dates'
import { fmtNum, kgTo, type WeightUnit } from './units'

/** Estimated one-rep max (Epley formula). */
export function e1rm(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export const isWorking = (s: WorkoutSet) => s.done && !s.warmup

/** A set counts once it has reps (or a time, for timed exercises). */
export function hasData(s: WorkoutSet, kind: ExerciseKind): boolean {
  return kind === 'time' ? (s.durationSec ?? 0) > 0 : (s.reps ?? 0) > 0
}

export const setVolume = (s: WorkoutSet) => (s.weight ?? 0) * (s.reps ?? 0)

export function withExerciseIds(w: Workout): Workout {
  return { ...w, exerciseIds: [...new Set(w.exercises.map((e) => e.exerciseId))] }
}

export interface WorkoutStats {
  durationSec: number
  sets: number
  volumeKg: number
  exercises: number
}

/** Duration, completed working sets and volume (load × reps). Warm-ups are excluded. */
export function workoutStats(w: Workout, now = Date.now()): WorkoutStats {
  let sets = 0
  let volumeKg = 0
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (!isWorking(s)) continue
      sets++
      volumeKg += setVolume(s)
    }
  }
  return {
    durationSec: Math.max(0, ((w.finishedAt ?? now) - w.startedAt) / 1000),
    sets,
    volumeKg,
    exercises: w.exercises.length,
  }
}

export const countSets = (w: Workout) => w.exercises.reduce((n, e) => n + e.sets.length, 0)

/**
 * Prepare a workout for saving: keep every set with reps/time entered (ticked or not),
 * drop empty placeholder sets, and drop exercises left with no sets.
 */
export function cleanupForFinish(w: Workout, kindOf: (exerciseId: string) => ExerciseKind): Workout {
  const exercises = w.exercises
    .map((ex) => ({
      ...ex,
      sets: ex.sets.filter((s) => hasData(s, kindOf(ex.exerciseId))).map((s) => ({ ...s, done: true })),
    }))
    .filter((ex) => ex.sets.length > 0)
  return withExerciseIds({ ...w, exercises })
}

/** Sets logged for an exercise in the most recent finished workout that started before `before`. */
export function previousSets(
  exerciseId: string,
  workouts: Workout[],
  before: number,
  excludeId?: string,
): WorkoutSet[] | null {
  let best: Workout | undefined
  for (const w of workouts) {
    if (w.id === excludeId || w.finishedAt == null || w.startedAt >= before) continue
    if (!w.exercises.some((e) => e.exerciseId === exerciseId)) continue
    if (!best || w.startedAt > best.startedAt) best = w
  }
  if (!best) return null
  return best.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets)
    .filter((s) => s.done)
}

/** Headline metric for one session: best e1RM, most reps, or longest time. */
export function sessionBest(sets: WorkoutSet[], kind: ExerciseKind): number {
  let best = 0
  for (const s of sets) {
    if (!isWorking(s)) continue
    const v =
      kind === 'weight' ? e1rm(s.weight ?? 0, s.reps ?? 0) : kind === 'bodyweight' ? (s.reps ?? 0) : (s.durationSec ?? 0)
    if (v > best) best = v
  }
  return best
}

export type PRKind = 'e1rm' | 'weight' | 'reps' | 'time'

export const PR_LABELS: Record<PRKind, string> = {
  e1rm: 'Best e1RM',
  weight: 'Heaviest',
  reps: 'Most reps',
  time: 'Longest',
}

/**
 * Records set in `workout` versus every earlier finished workout, keyed by set id.
 * An exercise's first-ever session sets no records (otherwise everything would be a PR).
 */
export function findPRs(
  workout: Workout,
  history: Workout[],
  kindOf: (exerciseId: string) => ExerciseKind,
): Map<string, PRKind[]> {
  const result = new Map<string, PRKind[]>()
  const earlier = history.filter(
    (h) => h.id !== workout.id && h.finishedAt != null && h.startedAt < workout.startedAt,
  )
  for (const exId of new Set(workout.exercises.map((e) => e.exerciseId))) {
    const kind = kindOf(exId)
    const past = earlier
      .flatMap((h) => h.exercises.filter((e) => e.exerciseId === exId).flatMap((e) => e.sets))
      .filter(isWorking)
    if (past.length === 0) continue
    const sets = workout.exercises
      .filter((e) => e.exerciseId === exId)
      .flatMap((e) => e.sets)
      .filter(isWorking)
    const metrics: Array<[PRKind, (s: WorkoutSet) => number]> =
      kind === 'weight'
        ? [
            ['e1rm', (s) => e1rm(s.weight ?? 0, s.reps ?? 0)],
            ['weight', (s) => ((s.reps ?? 0) > 0 ? (s.weight ?? 0) : 0)],
          ]
        : kind === 'bodyweight'
          ? [['reps', (s) => s.reps ?? 0]]
          : [['time', (s) => s.durationSec ?? 0]]
    for (const [prKind, metric] of metrics) {
      let top: WorkoutSet | undefined
      let topVal = past.reduce((m, s) => Math.max(m, metric(s)), 0)
      for (const s of sets) {
        const v = metric(s)
        if (v > topVal + 1e-9) {
          top = s
          topVal = v
        }
      }
      if (top) result.set(top.id, [...(result.get(top.id) ?? []), prKind])
    }
  }
  return result
}

/** "60 kg × 8", "12 reps", "+10 kg × 8", "1:30". */
export function formatSet(s: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec'>, kind: ExerciseKind, u: WeightUnit): string {
  const w = s.weight != null && s.weight > 0 ? fmtNum(kgTo(s.weight, u), 1) : null
  if (kind === 'time') {
    const t = formatClock(s.durationSec ?? 0)
    return w ? `${w} ${u} · ${t}` : t
  }
  const reps = s.reps ?? 0
  if (kind === 'bodyweight') return w ? `+${w} ${u} × ${reps}` : `${reps} reps`
  return w ? `${w} ${u} × ${reps}` : `${reps} reps`
}

/** Compact form for the "previous" column: "60 × 8", "12", "1:30". */
export function formatSetShort(s: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec'>, kind: ExerciseKind, u: WeightUnit): string {
  const w = s.weight != null && s.weight > 0 ? fmtNum(kgTo(s.weight, u), 1) : null
  if (kind === 'time') return formatClock(s.durationSec ?? 0)
  if (kind === 'bodyweight') return w ? `+${w} × ${s.reps ?? 0}` : `${s.reps ?? 0}`
  return w ? `${w} × ${s.reps ?? 0}` : `${s.reps ?? 0}`
}

/** The single most impressive set (highest e1RM / reps / time). */
export function bestSet(sets: WorkoutSet[], kind: ExerciseKind): WorkoutSet | null {
  let best: WorkoutSet | null = null
  let bestVal = 0
  for (const s of sets) {
    if (!isWorking(s)) continue
    const v = sessionBest([s], kind)
    if (v > bestVal) {
      best = s
      bestVal = v
    }
  }
  return best
}

/** Turn a finished workout into routine rows: working-set count and most common rep target. */
export function routineFromWorkout(w: Workout): Omit<RoutineExercise, 'id'>[] {
  return w.exercises.map((ex) => {
    const working = ex.sets.filter((s) => !s.warmup)
    const freq = new Map<number, number>()
    for (const s of working) if (s.reps) freq.set(s.reps, (freq.get(s.reps) ?? 0) + 1)
    let reps: number | null = null
    let top = 0
    for (const [r, n] of freq) if (n > top) [reps, top] = [r, n]
    return { exerciseId: ex.exerciseId, sets: Math.max(1, working.length), reps }
  })
}
