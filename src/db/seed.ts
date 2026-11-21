import type {
  CardioIcon,
  CardioMeasure,
  CardioType,
  Equipment,
  Exercise,
  ExerciseKind,
  Level,
  Muscle,
  SupplementTime,
} from './types'

/* ───────── Exercises: beginner to intermediate ───────── */

type Seed = [id: string, name: string, muscle: Muscle, equipment: Equipment, level: Level, kind?: ExerciseKind]

/** Starter library. Stable ids keep backups portable between devices. Add anything else as your own. */
const SEEDS: Seed[] = [
  ['push-up', 'Push-Up', 'chest', 'bodyweight', 'beginner', 'bodyweight'],
  ['bench-press', 'Bench Press', 'chest', 'barbell', 'beginner'],
  ['dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell', 'beginner'],
  ['incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', 'beginner'],
  ['machine-chest-press', 'Machine Chest Press', 'chest', 'machine', 'beginner'],
  ['incline-bench-press', 'Incline Bench Press', 'chest', 'barbell', 'intermediate'],
  ['dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbell', 'intermediate'],
  ['cable-crossover', 'Cable Crossover', 'chest', 'cable', 'intermediate'],
  ['dip', 'Dip', 'chest', 'bodyweight', 'intermediate', 'bodyweight'],

  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable', 'beginner'],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable', 'beginner'],
  ['dumbbell-row', 'Dumbbell Row', 'back', 'dumbbell', 'beginner'],
  ['back-extension', 'Back Extension', 'back', 'bodyweight', 'beginner', 'bodyweight'],
  ['shrug', 'Shrug', 'back', 'dumbbell', 'beginner'],
  ['barbell-row', 'Barbell Row', 'back', 'barbell', 'intermediate'],
  ['deadlift', 'Deadlift', 'back', 'barbell', 'intermediate'],
  ['pull-up', 'Pull-Up', 'back', 'bodyweight', 'intermediate', 'bodyweight'],
  ['chin-up', 'Chin-Up', 'back', 'bodyweight', 'intermediate', 'bodyweight'],

  ['goblet-squat', 'Goblet Squat', 'legs', 'dumbbell', 'beginner'],
  ['leg-press', 'Leg Press', 'legs', 'machine', 'beginner'],
  ['lunge', 'Lunge', 'legs', 'dumbbell', 'beginner'],
  ['leg-extension', 'Leg Extension', 'legs', 'machine', 'beginner'],
  ['leg-curl', 'Leg Curl', 'legs', 'machine', 'beginner'],
  ['calf-raise', 'Calf Raise', 'legs', 'machine', 'beginner'],
  ['squat', 'Squat', 'legs', 'barbell', 'intermediate'],
  ['romanian-deadlift', 'Romanian Deadlift', 'legs', 'barbell', 'intermediate'],
  ['hip-thrust', 'Hip Thrust', 'legs', 'barbell', 'intermediate'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'legs', 'dumbbell', 'intermediate'],

  ['dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'beginner'],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell', 'beginner'],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', 'beginner'],
  ['face-pull', 'Face Pull', 'shoulders', 'cable', 'beginner'],
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell', 'intermediate'],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell', 'intermediate'],

  ['dumbbell-curl', 'Dumbbell Curl', 'arms', 'dumbbell', 'beginner'],
  ['hammer-curl', 'Hammer Curl', 'arms', 'dumbbell', 'beginner'],
  ['barbell-curl', 'Barbell Curl', 'arms', 'barbell', 'beginner'],
  ['preacher-curl', 'Preacher Curl', 'arms', 'machine', 'beginner'],
  ['triceps-pushdown', 'Triceps Pushdown', 'arms', 'cable', 'beginner'],
  ['overhead-triceps-extension', 'Overhead Triceps Extension', 'arms', 'dumbbell', 'beginner'],
  ['skull-crusher', 'Skull Crusher', 'arms', 'barbell', 'intermediate'],

  ['plank', 'Plank', 'core', 'bodyweight', 'beginner', 'time'],
  ['side-plank', 'Side Plank', 'core', 'bodyweight', 'beginner', 'time'],
  ['crunch', 'Crunch', 'core', 'bodyweight', 'beginner', 'bodyweight'],
  ['cable-crunch', 'Cable Crunch', 'core', 'cable', 'beginner'],
  ['russian-twist', 'Russian Twist', 'core', 'bodyweight', 'beginner', 'bodyweight'],

  ['burpee', 'Burpee', 'full', 'bodyweight', 'beginner', 'bodyweight'],
  ['farmers-carry', "Farmer's Carry", 'full', 'dumbbell', 'beginner', 'time'],
  ['kettlebell-swing', 'Kettlebell Swing', 'full', 'kettlebell', 'intermediate'],
]

/** Advanced lifts dropped from the starter library (kept, archived, if you've logged them). */
export const REMOVED_EXERCISE_IDS = [
  'power-clean',
  'thruster',
  'front-squat',
  'ab-wheel-rollout',
  'hanging-leg-raise',
  't-bar-row',
  'close-grip-bench-press',
]

export function seedExercises(now = Date.now()): Exercise[] {
  return SEEDS.map(([id, name, muscle, equipment, level, kind = 'weight']) => ({
    id,
    name,
    muscle,
    equipment,
    kind,
    level,
    custom: false,
    createdAt: now,
  }))
}

export const SEED_LEVELS: ReadonlyMap<string, Level> = new Map(SEEDS.map(([id, , , , level]) => [id, level]))

/* ───────── Cardio activities ───────── */

type CardioSeed = [id: string, name: string, measure: CardioMeasure, icon: CardioIcon]

/** The common activities everyone starts with. Ids match sessions logged by earlier versions. */
const CARDIO_SEEDS: CardioSeed[] = [
  ['walk', 'Walk', 'pace', 'walk'],
  ['run', 'Run', 'pace', 'run'],
  ['ride', 'Cycling', 'speed', 'bike'],
  ['swim', 'Swim', 'swim', 'swim'],
  ['elliptical', 'Elliptical', 'time', 'elliptical'],
]

/** Activities earlier versions offered; recreated (hidden) only if you logged them. */
const LEGACY_CARDIO: CardioSeed[] = [
  ['hike', 'Hike', 'pace', 'hike'],
  ['row', 'Row', 'pace', 'row'],
  ['other', 'Other', 'time', 'activity'],
]

export function seedCardioTypes(now = Date.now()): CardioType[] {
  return CARDIO_SEEDS.map(([id, name, measure, icon], order) => ({
    id,
    name,
    measure,
    icon,
    builtIn: true,
    order,
    createdAt: now,
  }))
}

export function legacyCardioTypes(usedIds: Set<string>, now = Date.now()): CardioType[] {
  return LEGACY_CARDIO.filter(([id]) => usedIds.has(id)).map(([id, name, measure, icon], i) => ({
    id,
    name,
    measure,
    icon,
    builtIn: true,
    hidden: true,
    order: 100 + i,
    createdAt: now,
  }))
}

/* ───────── Supplement quick picks ───────── */

export const SUPPLEMENT_PRESETS: { name: string; dose: string; time: SupplementTime }[] = [
  { name: 'Whey protein', dose: '1 scoop', time: 'post-workout' },
  { name: 'Creatine', dose: '5 g', time: 'anytime' },
  { name: 'Multivitamin', dose: '1 tablet', time: 'with-meal' },
  { name: 'Omega-3 fish oil', dose: '1 capsule', time: 'with-meal' },
  { name: 'Vitamin D3', dose: '1 capsule', time: 'morning' },
]
