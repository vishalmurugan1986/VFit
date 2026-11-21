import Dexie, { type EntityTable, type Table } from 'dexie'
import { todayStr, dateStrFromTs } from '../lib/dates'
import { uid } from '../lib/id'
import { phaseFromLegacy } from '../lib/phases'
import { legacyCardioTypes, REMOVED_EXERCISE_IDS, SEED_LEVELS, seedCardioTypes, seedExercises } from './seed'
import type {
  BodyEntry,
  CardioSession,
  CardioType,
  Exercise,
  FoodEntry,
  LegacyGoalSettings,
  DayCheck,
  MetaRow,
  Phase,
  Routine,
  SavedFood,
  Supplement,
  SupplementLog,
  Workout,
} from './types'

/** All app data lives in this IndexedDB database, on this device only. */
export class FitnessDB extends Dexie {
  declare exercises: EntityTable<Exercise, 'id'>
  declare workouts: EntityTable<Workout, 'id'>
  declare routines: EntityTable<Routine, 'id'>
  declare cardio: EntityTable<CardioSession, 'id'>
  declare cardioTypes: EntityTable<CardioType, 'id'>
  declare body: EntityTable<BodyEntry, 'id'>
  declare foods: EntityTable<FoodEntry, 'id'>
  declare savedFoods: EntityTable<SavedFood, 'id'>
  declare supplements: EntityTable<Supplement, 'id'>
  declare supplementLogs: EntityTable<SupplementLog, 'id'>
  declare phases: EntityTable<Phase, 'id'>
  declare dayChecks: EntityTable<DayCheck, 'id'>
  declare meta: EntityTable<MetaRow, 'key'>

  constructor() {
    super('fitness')
    this.version(1).stores({
      exercises: 'id, name, muscle',
      workouts: 'id, startedAt, *exerciseIds',
      routines: 'id, updatedAt',
      cardio: 'id, date',
      body: 'id, date',
      foods: 'id, date',
      savedFoods: 'id, name, lastUsed',
      meta: 'key',
    })
    // v2: custom cardio activities, supplements, beginner–intermediate exercise library.
    this.version(2)
      .stores({
        cardioTypes: 'id, order',
        supplements: 'id, order',
        supplementLogs: 'id, date, supplementId',
      })
      .upgrade(async (tx) => {
        await trimExerciseLibrary(tx.table('exercises'), tx.table('workouts'), tx.table('routines'))
        await ensureCardioTypes(tx.table('cardioTypes'), tx.table('cardio'))
      })
    // v3: training phases (Maingain → Cut → …). Your goal and targets move out of settings
    // into a first phase that starts on the day of your earliest log.
    this.version(3)
      .stores({ phases: 'id, startDate' })
      .upgrade(async (tx) => {
        await ensurePhases((name) => tx.table(name))
      })
    // v4: meals you skip on a day, so the app knows they're done without any food logged.
    this.version(4).stores({ mealSkips: 'id, date' })
    // v5: one check row per day (meals eaten or skipped, workout done / rest / missed, before-bed check).
    // Skipped meals move into it.
    this.version(5)
      .stores({ dayChecks: 'id, date' })
      .upgrade(async (tx) => {
        const checks = new Map<string, DayCheck>()
        for (const s of (await tx.table('mealSkips').toArray()) as { date: string; meal: string }[]) {
          const c = checks.get(s.date) ?? { id: s.date, date: s.date, meals: {}, updatedAt: Date.now() }
          c.meals[s.meal] = 'skipped'
          checks.set(s.date, c)
        }
        if (checks.size) await tx.table('dayChecks').bulkPut([...checks.values()])
      })
    this.version(6).stores({ mealSkips: null })
    // Fresh install: the inserts are queued on the creation transaction.
    this.on('populate', (tx) => {
      void tx.table('exercises').bulkAdd(seedExercises())
      void tx.table('cardioTypes').bulkAdd(seedCardioTypes())
      void tx.table('phases').add(phaseFromLegacy({}, todayStr(), uid()))
    })
  }
}

/**
 * Drop the advanced built-in exercises: delete them if never used, otherwise archive them
 * so past workouts still show their names. Tag the remaining built-ins with their level.
 */
async function trimExerciseLibrary(
  exercises: Table<Exercise, string>,
  workouts: Table<Workout, string>,
  routines: Table<Routine, string>,
) {
  const used = new Set<string>()
  for (const w of await workouts.toArray()) for (const e of w.exercises ?? []) used.add(e.exerciseId)
  for (const r of await routines.toArray()) for (const e of r.exercises ?? []) used.add(e.exerciseId)
  for (const id of REMOVED_EXERCISE_IDS) {
    const ex = await exercises.get(id)
    if (!ex || ex.custom) continue
    if (used.has(id)) await exercises.update(id, { archived: true })
    else await exercises.delete(id)
  }
  for (const [id, level] of SEED_LEVELS) {
    const ex = await exercises.get(id)
    if (ex && !ex.custom) await exercises.update(id, { level })
  }
}

/** Make sure the activity list exists, including hidden entries for retired activities you logged. */
export async function ensureCardioTypes(
  types: EntityTable<CardioType, 'id'>,
  sessions: EntityTable<CardioSession, 'id'>,
) {
  if ((await types.count()) > 0) return
  await types.bulkAdd(seedCardioTypes())
  const used = new Set((await sessions.toArray()).map((s) => s.activity))
  const legacy = legacyCardioTypes(used)
  if (legacy.length) await types.bulkAdd(legacy)
}

/**
 * Make sure there is at least one phase. Older data (and older backups) kept a single goal and
 * targets in settings: that becomes your first phase, starting on the day of your earliest log.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- works on both a transaction and the db
export async function ensurePhases(table: (name: string) => Table<any, any>) {
  const phases = table('phases')
  if ((await phases.count()) > 0) return
  const settings = (await table('meta').get('settings'))?.value as LegacyGoalSettings | undefined
  const [food, body, cardio, workout] = await Promise.all([
    table('foods').orderBy('date').first(),
    table('body').orderBy('date').first(),
    table('cardio').orderBy('date').first(),
    table('workouts').orderBy('startedAt').first(),
  ])
  const dates = [food?.date, body?.date, cardio?.date, workout ? dateStrFromTs(workout.startedAt) : undefined].filter(
    (d): d is string => typeof d === 'string',
  )
  const start = dates.length ? dates.sort()[0] : todayStr()
  await phases.add(phaseFromLegacy(settings ?? {}, start, uid()))
}

export const db = new FitnessDB()

// A newer version of the app wants to upgrade the database (e.g. after an update, with the app also
// open in another tab or as the Home Screen app): step aside by closing and reloading into the new version.
db.on('versionchange', () => {
  db.close()
  window.location.reload()
  return false
})
