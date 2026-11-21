/**
 * Development only: fills this browser's database with about six weeks of realistic data, so
 * screens can be designed and screenshotted with real-looking content. Loaded from main.tsx when
 * the dev server is opened with ?demo (http://localhost:5173/?demo#/). Never part of a production build.
 */
import { db } from '../db/db'
import type {
  BodyEntry,
  CardioSession,
  DayCheck,
  FoodEntry,
  Phase,
  Routine,
  SavedFood,
  Supplement,
  SupplementLog,
  Workout,
} from '../db/types'
import { toDateStr } from '../lib/dates'
import { updateSettings } from '../db/settings'

const uid = () => crypto.randomUUID()

const FOODS: [meal: string, name: string, kcal: number, protein: number, carbs: number, fat: number][] = [
  ['breakfast', 'Oats with milk and banana', 420, 18, 68, 9],
  ['breakfast', 'Boiled eggs (3)', 210, 18, 2, 15],
  ['lunch', 'Chicken rice bowl', 640, 48, 72, 14],
  ['lunch', 'Dal and roti', 480, 22, 70, 10],
  ['dinner', 'Paneer curry with rice', 690, 32, 64, 30],
  ['dinner', 'Grilled fish and vegetables', 520, 46, 28, 22],
  ['snack', 'Whey shake', 160, 30, 6, 2],
  ['snack', 'Greek yogurt and nuts', 290, 20, 14, 16],
]

/**
 * With `workout`, also starts today's routine 20 minutes ago with a few sets done (to see the logger);
 * with `light`, switches to the light theme (otherwise the default dark).
 */
export async function seedDemo(options: { workout?: boolean; light?: boolean } = {}): Promise<void> {
  const DAYS = 42
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exercises = await db.exercises.toArray()
  const pick = (names: string[]) => names.map((n) => exercises.find((e) => e.name === n)).filter((e) => e != null)
  const plans = [
    { name: 'Push', ex: pick(['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Lateral Raise', 'Triceps Pushdown']), days: [1, 4], session: 'morning' as const },
    { name: 'Pull', ex: pick(['Deadlift', 'Pull-Up', 'Barbell Row', 'Lat Pulldown', 'Dumbbell Curl']), days: [2, 5], session: 'evening' as const },
    { name: 'Legs', ex: pick(['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise']), days: [3, 6], session: 'morning' as const },
  ]
  const routines: Routine[] = plans.map((p, i) => ({
    id: `demo-r${i}`,
    name: p.name,
    exercises: p.ex.map((e) => ({ id: uid(), exerciseId: e.id, sets: 3, reps: 8 })),
    days: p.days,
    session: p.session,
    createdAt: Date.now() - 50 * 864e5,
    updatedAt: Date.now() - i * 1000,
  }))
  const supplements: Supplement[] = [
    { id: 'demo-s1', name: 'Whey protein', dose: '30 g', time: 'morning', days: [], order: 0, createdAt: 1 },
    { id: 'demo-s2', name: 'Creatine', dose: '5 g', time: 'morning', days: [], order: 1, createdAt: 1 },
    { id: 'demo-s3', name: 'Vitamin D3', dose: '1 capsule', time: 'evening', days: [], order: 2, createdAt: 1 },
  ]

  const foods: FoodEntry[] = []
  const body: BodyEntry[] = []
  const workouts: Workout[] = []
  const cardio: CardioSession[] = []
  const logs: SupplementLog[] = []
  const checks: DayCheck[] = []
  let weight = 80.8

  for (let i = DAYS; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = toDateStr(d)
    const t0 = d.getTime()
    const dow = d.getDay()
    const isToday = i === 0

    FOODS.forEach(([meal, name, kcal, protein, carbs, fat], k) => {
      if (isToday ? meal !== 'breakfast' : (i + k) % 3 === 0) return
      foods.push({ id: uid(), date, meal, name, serving: '1 serving', servings: 1, calories: kcal + ((i * 7) % 40) - 20, protein, carbs, fat, createdAt: t0 + (8 + k * 1.5) * 3600e3 })
    })

    weight += -0.02 + Math.sin(i / 3) * 0.12
    body.push({ id: uid(), date, weightKg: Math.round(weight * 10) / 10, heightCm: 178, bodyFatPct: null, createdAt: t0 + 7 * 3600e3 })

    const plan = plans.find((p) => p.days.includes(dow))
    if (plan && !isToday && i % 9 !== 4) {
      const start = t0 + (plan.session === 'morning' ? 6.1 : 19.05) * 3600e3
      const progress = Math.floor((DAYS - i) / 7) * 2.5
      const exs = plan.ex.map((e, j) => ({
        id: uid(),
        exerciseId: e.id,
        targetReps: 8,
        sets: Array.from({ length: 3 }, (_, s) => ({
          id: uid(),
          weight: e.kind === 'weight' ? [60, 40, 24, 10, 25][j] + progress : null,
          reps: e.kind === 'time' ? null : 8 - (s === 2 ? 1 : 0),
          durationSec: e.kind === 'time' ? 45 : null,
          done: true,
        })),
      }))
      workouts.push({
        id: uid(),
        name: plan.name,
        startedAt: start,
        finishedAt: start + (52 + (i % 9)) * 60e3,
        exercises: exs,
        exerciseIds: [...new Set(exs.map((x) => x.exerciseId))],
        routineId: routines.find((r) => r.name === plan.name)!.id,
        note: '',
      })
    }

    if ((dow === 0 || dow === 3) && !isToday) {
      const run = dow === 0
      cardio.push({ id: uid(), date, activity: run ? 'run' : 'walk', durationSec: run ? 1680 + (i % 5) * 60 : 2400, distanceKm: run ? 5 + (i % 3) * 0.5 : 3.2, calories: null, avgHr: null, createdAt: t0 + 18 * 3600e3 })
    }

    for (const s of supplements) {
      if (isToday && s.id !== 'demo-s1') continue
      if ((i + s.order) % 6 === 0) continue
      logs.push({ id: uid(), date, supplementId: s.id, takenAt: t0 + (s.time === 'morning' ? 8 : 21) * 3600e3 })
    }
    if (!isToday && i % 4 !== 1) checks.push({ id: date, date, meals: {}, closedAt: t0 + 22.4 * 3600e3, updatedAt: t0 + 22.4 * 3600e3 })
  }

  const phase = (id: string, goal: Phase['goal'], daysFromToday: number, calories: number, targetWeightKg: number | null): Phase => {
    const d = new Date(today)
    d.setDate(d.getDate() + daysFromToday)
    return { id, goal, startDate: toDateStr(d), targetWeightKg, targets: { calories, protein: 170, carbs: 260, fat: 70 }, createdAt: 1 }
  }
  const saved: SavedFood[] = FOODS.slice(0, 6).map(([, name, calories, protein, carbs, fat], k) => ({
    id: uid(),
    name,
    serving: '1 serving',
    calories,
    protein,
    carbs,
    fat,
    lastUsed: Date.now() - k * 1000,
    useCount: 10 - k,
  }))

  await db.transaction('rw', db.tables, async () => {
    for (const t of ['foods', 'body', 'workouts', 'cardio', 'supplements', 'supplementLogs', 'dayChecks', 'routines', 'phases', 'savedFoods']) {
      await db.table(t).clear()
    }
    await db.phases.bulkAdd([phase('demo-p1', 'bulk', -140, 3000, null), phase('demo-p2', 'maingain', -38, 2600, 79), phase('demo-p3', 'cut', 60, 2200, 76)])
    await db.foods.bulkAdd(foods)
    await db.body.bulkAdd(body)
    await db.workouts.bulkAdd(workouts)
    await db.cardio.bulkAdd(cardio)
    await db.supplements.bulkAdd(supplements)
    await db.supplementLogs.bulkAdd(logs)
    await db.dayChecks.bulkAdd(checks)
    await db.routines.bulkAdd(routines)
    await db.savedFoods.bulkAdd(saved)
    await db.meta.put({ key: 'lastBackupAt', value: Date.now() - 3 * 864e5 })
  })
  await updateSettings(options.light ? { theme: 'light', themeChosen: true } : { theme: 'dark', themeChosen: false })
  await db.transaction('rw', db.workouts, async () => {
    if (options.workout) {
      const r = routines[0]
      const startedAt = Date.now() - 20 * 60e3
      const exs = r.exercises.map((e, j) => ({
        id: uid(),
        exerciseId: e.exerciseId,
        targetReps: 8,
        sets: Array.from({ length: 3 }, (_, s) => ({
          id: uid(),
          weight: j === 0 && s < 2 ? 70 : null,
          reps: j === 0 && s < 2 ? 8 : null,
          durationSec: null,
          done: j === 0 && s < 2,
        })),
      }))
      await db.workouts.put({
        id: 'demo-workout',
        name: r.name,
        startedAt,
        finishedAt: null,
        exercises: exs,
        exerciseIds: [...new Set(exs.map((x) => x.exerciseId))],
        routineId: r.id,
        note: '',
      })
    }
  })
}
