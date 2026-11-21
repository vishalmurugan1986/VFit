import { describe, expect, it } from 'vitest'
import type { ExerciseKind, Workout, WorkoutSet } from '../db/types'
import {
  cleanupForFinish,
  e1rm,
  findPRs,
  formatSet,
  formatSetShort,
  previousSets,
  routineFromWorkout,
  withExerciseIds,
  workoutStats,
} from './strength'
import { toKg } from './units'

let n = 0
const set = (weight: number | null, reps: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${++n}`,
  weight,
  reps,
  durationSec: null,
  done: true,
  ...extra,
})

const workout = (id: string, startedAt: number, exercises: Record<string, WorkoutSet[]>, finished = true): Workout =>
  withExerciseIds({
    id,
    name: id,
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({ id: `${id}-${exerciseId}`, exerciseId, sets })),
    exerciseIds: [],
  })

const kind = (k: ExerciseKind) => () => k

describe('e1rm', () => {
  it('uses the Epley formula and takes singles as-is', () => {
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 2)
    expect(e1rm(0, 5)).toBe(0)
    expect(e1rm(100, 0)).toBe(0)
  })
})

describe('workoutStats', () => {
  it('counts completed working sets and volume, ignoring warm-ups', () => {
    const w = workout('a', 0, {
      bench: [set(40, 10, { warmup: true }), set(60, 8), set(60, 8), set(60, 6, { done: false })],
    })
    const s = workoutStats(w)
    expect(s.sets).toBe(2)
    expect(s.volumeKg).toBe(960)
    expect(s.durationSec).toBe(3600)
  })
})

describe('cleanupForFinish', () => {
  it('keeps sets with reps (ticked or not) and drops empty sets and exercises', () => {
    const w = workout(
      'a',
      0,
      {
        bench: [set(60, 8), set(60, 8, { done: false }), set(null, null, { done: false })],
        squat: [set(null, null, { done: false })],
      },
      false,
    )
    const c = cleanupForFinish(w, kind('weight'))
    expect(c.exerciseIds).toEqual(['bench'])
    expect(c.exercises[0].sets).toHaveLength(2)
    expect(c.exercises[0].sets.every((s) => s.done)).toBe(true)
  })

  it('uses time for timed exercises', () => {
    const w = workout('a', 0, { plank: [set(null, null, { durationSec: 60, done: false }), set(null, null, { done: false })] }, false)
    expect(cleanupForFinish(w, kind('time')).exercises[0].sets).toHaveLength(1)
  })
})

describe('previousSets', () => {
  it('returns the latest earlier finished session for that exercise', () => {
    const old = workout('old', 1000, { bench: [set(50, 8)] })
    const recent = workout('recent', 2000, { bench: [set(55, 8), set(55, 7)] })
    const unfinished = workout('open', 2500, { bench: [set(99, 1)] }, false)
    const current = workout('now', 3000, { bench: [] }, false)
    const all = [old, recent, unfinished, current]
    expect(previousSets('bench', all, 3000, 'now')?.map((s) => s.weight)).toEqual([55, 55])
    expect(previousSets('bench', all, 1500)?.map((s) => s.weight)).toEqual([50])
    expect(previousSets('squat', all, 3000)).toBeNull()
  })
})

describe('findPRs', () => {
  it('flags the sets that beat every earlier session', () => {
    const before = workout('b', 1000, { bench: [set(80, 5), set(70, 10)] }) // best e1RM 93.3, heaviest 80
    const now = workout('n', 2000, { bench: [set(82.5, 3), set(75, 10), set(60, 12)] })
    const [heavy, strong, light] = now.exercises[0].sets
    const prs = findPRs(now, [before, now], kind('weight'))
    expect(prs.get(heavy.id)).toEqual(['weight'])
    expect(prs.get(strong.id)).toEqual(['e1rm'])
    expect(prs.has(light.id)).toBe(false)
  })

  it("sets no records on an exercise's first session", () => {
    const first = workout('f', 1000, { bench: [set(100, 5)] })
    expect(findPRs(first, [first], kind('weight')).size).toBe(0)
  })

  it('ignores warm-ups and workouts that came later', () => {
    const before = workout('b', 1000, { pullup: [set(null, 10)] })
    const now = workout('n', 2000, { pullup: [set(null, 15, { warmup: true }), set(null, 11)] })
    const later = workout('l', 3000, { pullup: [set(null, 20)] })
    const prs = findPRs(now, [before, now, later], kind('bodyweight'))
    expect(prs.size).toBe(1)
    expect(prs.get(now.exercises[0].sets[1].id)).toEqual(['reps'])
  })
})

describe('routineFromWorkout', () => {
  it('uses working-set count and the most common reps', () => {
    const w = workout('a', 0, { bench: [set(40, 10, { warmup: true }), set(60, 8), set(60, 8), set(60, 6)] })
    expect(routineFromWorkout(w)).toEqual([{ exerciseId: 'bench', sets: 3, reps: 8 }])
  })
})

describe('formatting sets', () => {
  it('formats by exercise kind and unit', () => {
    expect(formatSet({ weight: 60, reps: 8, durationSec: null }, 'weight', 'kg')).toBe('60 kg × 8')
    expect(formatSet({ weight: null, reps: 12, durationSec: null }, 'bodyweight', 'kg')).toBe('12 reps')
    expect(formatSet({ weight: 10, reps: 8, durationSec: null }, 'bodyweight', 'kg')).toBe('+10 kg × 8')
    expect(formatSet({ weight: null, reps: null, durationSec: 90 }, 'time', 'kg')).toBe('1:30')
    expect(formatSetShort({ weight: toKg(135, 'lb'), reps: 5, durationSec: null }, 'weight', 'lb')).toBe('135 × 5')
  })
})
