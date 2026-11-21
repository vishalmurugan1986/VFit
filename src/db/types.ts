import type { DateStr } from '../lib/dates'
import type { DistanceUnit, LengthUnit, WeightUnit } from '../lib/units'

/* ───────── Strength ───────── */

export type Muscle = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full' | 'other'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other'
/** weight: load × reps · bodyweight: reps, optional added load · time: holds and carries */
export type ExerciseKind = 'weight' | 'bodyweight' | 'time'
export type Level = 'beginner' | 'intermediate'

export interface Exercise {
  id: string
  name: string
  muscle: Muscle
  equipment: Equipment
  kind: ExerciseKind
  /** Built-in exercises are tagged; your own exercises have no level. */
  level?: Level
  custom: boolean
  /** Hidden from pickers but kept so history still resolves. */
  archived?: boolean
  createdAt: number
}

export interface WorkoutSet {
  id: string
  /** kg (bodyweight exercises: added load) */
  weight: number | null
  reps: number | null
  durationSec: number | null
  done: boolean
  warmup?: boolean
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  sets: WorkoutSet[]
  note?: string
  targetReps?: number | null
}

export interface Workout {
  id: string
  name: string
  startedAt: number
  /** null while the workout is in progress */
  finishedAt: number | null
  exercises: WorkoutExercise[]
  /** Derived from `exercises`; multi-entry index for "workouts containing exercise X". */
  exerciseIds: string[]
  note?: string
  routineId?: string | null
}

export interface RoutineExercise {
  id: string
  exerciseId: string
  sets: number
  reps: number | null
}

/** Your two gym times. */
export type Session = 'morning' | 'evening'

export interface Routine {
  id: string
  name: string
  exercises: RoutineExercise[]
  /** weekdays it's planned for (0 = Sunday … 6 = Saturday) */
  days?: number[]
  /** the gym session it's planned for */
  session?: Session | null
  createdAt: number
  updatedAt: number
}

/* ───────── Cardio ───────── */

/** Id of a CardioType ('walk', 'run', … or a custom one). */
export type CardioActivity = string

/** pace: min/km · speed: km/h · swim: min/100 m · time: duration only, no distance */
export type CardioMeasure = 'pace' | 'speed' | 'swim' | 'time'

export type CardioIcon =
  | 'walk'
  | 'run'
  | 'bike'
  | 'swim'
  | 'elliptical'
  | 'hike'
  | 'row'
  | 'activity'
  | 'heart'
  | 'zap'
  | 'dumbbell'
  | 'timer'

export interface CardioType {
  id: string
  name: string
  measure: CardioMeasure
  icon: CardioIcon
  builtIn: boolean
  /** Hidden from the activity picker; past sessions still show. */
  hidden?: boolean
  order: number
  createdAt: number
}

export interface CardioSession {
  id: string
  date: DateStr
  activity: CardioActivity
  durationSec: number
  /** km */
  distanceKm: number | null
  calories: number | null
  avgHr: number | null
  note?: string
  createdAt: number
}

/* ───────── Body ───────── */

export interface BodyEntry {
  id: string
  date: DateStr
  /** kg */
  weightKg: number | null
  /** cm */
  heightCm?: number | null
  bodyFatPct: number | null
  /** Older entries may carry tape measurements (cm); no longer shown. */
  measurements?: Record<string, number>
  note?: string
  createdAt: number
}

/* ───────── Nutrition ───────── */

/** Id of one of your meals (Settings.meals). The first four keep the ids older versions used. */
export type Meal = string

export interface MealDef {
  id: Meal
  name: string
  /** when the meal usually starts, "HH:MM"; null for no time (no alarm) */
  time?: string | null
}

/**
 * What you ticked off for a day (one row per date). Meals with food logged and finished workouts
 * count by themselves; this holds the rest: meals eaten without logging, skipped meals, rest days.
 */
export interface DayCheck {
  /** the date */
  id: DateStr
  date: DateStr
  meals: Record<Meal, 'eaten' | 'skipped'>
  /** done: trained but didn't log it here · rest: planned rest · missed: skipped the session */
  workout?: 'done' | 'rest' | 'missed'
  /** when you finished the before-bed check */
  closedAt?: number
  updatedAt: number
}

export type AlarmKind = 'wake' | 'gymMorning' | 'gymEvening' | 'meals' | 'bed'

/** Daily or per-item totals. */
export interface Nutrients {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Values per serving. (Foods logged while VFit tracked fibre may still carry an unused `fibre` value.) */
export interface FoodValues {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Totals = per-serving values × servings. */
export interface FoodEntry extends FoodValues {
  id: string
  date: DateStr
  meal: Meal
  name: string
  serving?: string
  servings: number
  createdAt: number
}

export interface SavedFood extends FoodValues {
  id: string
  name: string
  serving?: string
  lastUsed: number
  useCount: number
}

/* ───────── Supplements ───────── */

export type SupplementTime =
  | 'morning'
  | 'with-meal'
  | 'afternoon'
  | 'pre-workout'
  | 'post-workout'
  | 'evening'
  | 'bedtime'
  | 'anytime'

export interface Supplement {
  id: string
  name: string
  /** Free text: "5 g", "1 capsule", "1 scoop" */
  dose: string
  time: SupplementTime
  /** Days of the week it's taken (0 = Sunday). Empty = every day. */
  days: number[]
  notes?: string
  paused?: boolean
  order: number
  createdAt: number
}

export interface SupplementLog {
  id: string
  date: DateStr
  supplementId: string
  takenAt: number
}

/* ───────── Settings ───────── */

export type Theme = 'system' | 'light' | 'dark'
/** bulk: gain weight · maingain: build muscle at about the same weight · cut: lose fat */
export type Goal = 'bulk' | 'maingain' | 'cut'

/**
 * A training phase (Bulk, Maingain or Cut) with its own target weight and daily targets.
 * A phase runs from its start date until the day before the next phase starts, so a phase
 * planned ahead (say, a Cut from 1 February) takes over by itself on that day.
 */
export interface Phase {
  id: string
  goal: Goal
  /** first day of the phase */
  startDate: DateStr
  /** kg */
  targetWeightKg: number | null
  /** your own daily targets for this phase */
  targets: Nutrients
  note?: string
  createdAt: number
}

export type BackupReminder = 7 | 14 | 30

export interface Settings {
  /** The app is metric throughout; these stay kg / km / cm. */
  weightUnit: WeightUnit
  distanceUnit: DistanceUnit
  lengthUnit: LengthUnit
  age: number | null
  restSeconds: number
  autoRest: boolean
  weekStartsOn: 0 | 1
  theme: Theme
  /** true once you've picked a theme yourself; until then VFit uses its dark Apple Fitness look */
  themeChosen?: boolean
  /** 'HH:MM', 24-hour */
  wakeTime: string | null
  /** 'HH:MM', when you go to bed; the before-bed check opens an hour earlier */
  bedTime: string
  /** your two gym times, 'HH:MM' */
  sessions: { morning: string; evening: string }
  /** which alarms "Send all alarms" puts in the iPhone Clock app */
  alarms: Record<AlarmKind, boolean>
  /** your meals, in order */
  meals: MealDef[]
  /** days between backup reminders on Today */
  backupReminderDays: BackupReminder
}

/** Goal and targets as versions before phases stored them, inside settings. */
export interface LegacyGoalSettings {
  goal?: string
  goalWeightKg?: number | null
  calorieTarget?: number
  proteinTarget?: number
  carbsTarget?: number
  fatTarget?: number
}

export interface MetaRow {
  key: string
  value: unknown
}

/* ───────── Labels ───────── */

export const MUSCLES: { key: Muscle; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
  { key: 'core', label: 'Core' },
  { key: 'full', label: 'Full body' },
  { key: 'other', label: 'Other' },
]

export const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'band', label: 'Band' },
  { key: 'other', label: 'Other' },
]

export const LEVEL_LABELS: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate' }

export const muscleLabel = (m: Muscle) => MUSCLES.find((x) => x.key === m)?.label ?? 'Other'
export const equipmentLabel = (e: Equipment) => EQUIPMENT.find((x) => x.key === e)?.label ?? 'Other'

/** "Chest · Barbell · Beginner" (your own exercises: "Chest · Barbell · Yours"). */
export const exerciseMeta = (e: Pick<Exercise, 'muscle' | 'equipment' | 'level' | 'custom'>) =>
  [muscleLabel(e.muscle), equipmentLabel(e.equipment), e.level ? LEVEL_LABELS[e.level] : e.custom ? 'Yours' : null]
    .filter(Boolean)
    .join(' · ')
