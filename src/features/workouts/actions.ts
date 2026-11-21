import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../components/toast'
import { db } from '../../db/db'
import { getActiveWorkout } from '../../db/queries'
import type { Routine, Workout, WorkoutSet } from '../../db/types'
import { uid } from '../../lib/id'
import { routineFromWorkout, withExerciseIds } from '../../lib/strength'

export function newSet(): WorkoutSet {
  return { id: uid(), weight: null, reps: null, durationSec: null, done: false }
}

export function defaultWorkoutName(ts = Date.now()): string {
  const h = new Date(ts).getHours()
  if (h >= 5 && h < 12) return 'Morning workout'
  if (h >= 12 && h < 17) return 'Afternoon workout'
  if (h >= 17 && h < 22) return 'Evening workout'
  return 'Night workout'
}

export interface WorkoutTemplate {
  name: string
  routineId?: string
  exercises: { exerciseId: string; sets: number; reps: number | null }[]
}

export const templateFromRoutine = (r: Routine): WorkoutTemplate => ({
  name: r.name,
  routineId: r.id,
  exercises: r.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets, reps: e.reps })),
})

export const templateFromWorkout = (w: Workout): WorkoutTemplate => ({
  name: w.name,
  exercises: routineFromWorkout(w),
})

/** Start a workout, or resume the one already in progress (only one at a time). */
export async function startWorkout(template?: WorkoutTemplate): Promise<{ id: string; resumed: boolean }> {
  const active = await getActiveWorkout()
  if (active) return { id: active.id, resumed: true }
  const now = Date.now()
  const workout = withExerciseIds({
    id: uid(),
    name: template?.name ?? defaultWorkoutName(now),
    startedAt: now,
    finishedAt: null,
    exercises: (template?.exercises ?? []).map((e) => ({
      id: uid(),
      exerciseId: e.exerciseId,
      targetReps: e.reps,
      sets: Array.from({ length: Math.max(1, e.sets) }, newSet),
    })),
    exerciseIds: [],
    routineId: template?.routineId ?? null,
    note: '',
  })
  await db.workouts.add(workout)
  return { id: workout.id, resumed: false }
}

/** A finished one-hour workout ending now, opened for editing (for logging after the fact). */
export async function createPastWorkout(): Promise<string> {
  const end = Math.floor(Date.now() / 300_000) * 300_000
  const workout: Workout = {
    id: uid(),
    name: 'Workout',
    startedAt: end - 3_600_000,
    finishedAt: end,
    exercises: [],
    exerciseIds: [],
    note: '',
  }
  await db.workouts.add(workout)
  return workout.id
}

export async function saveWorkoutAsRoutine(w: Workout): Promise<string> {
  const now = Date.now()
  const routine: Routine = {
    id: uid(),
    name: w.name,
    exercises: routineFromWorkout(w).map((e) => ({ ...e, id: uid() })),
    createdAt: now,
    updatedAt: now,
  }
  await db.routines.add(routine)
  return routine.id
}

/** Start (or resume) a workout and open it. */
export function useStartWorkout() {
  const navigate = useNavigate()
  const toast = useToast()
  return useCallback(
    async (template?: WorkoutTemplate) => {
      const { id, resumed } = await startWorkout(template)
      if (resumed) toast('You already have a workout in progress. Resuming it.')
      navigate(`/workouts/${id}`)
    },
    [navigate, toast],
  )
}
