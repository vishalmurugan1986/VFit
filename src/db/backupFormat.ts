import { toDateStr } from '../lib/dates'

export const BACKUP_APP = 'fitness-pwa'
/**
 * 2: adds cardio activities and supplements. 3: adds phases (goal and targets used to live in settings).
 * 4: adds skipped meals. 5: replaces them with day checks (a v4 file's skipped meals are converted).
 * Older files still restore: missing tables come in empty and are rebuilt from what the file has.
 */
export const BACKUP_VERSION = 5
export const BACKUP_TABLES = [
  'exercises',
  'workouts',
  'routines',
  'cardio',
  'cardioTypes',
  'body',
  'foods',
  'savedFoods',
  'supplements',
  'supplementLogs',
  'phases',
  'dayChecks',
  'meta',
] as const

export type BackupTable = (typeof BACKUP_TABLES)[number]
export type BackupRow = Record<string, unknown>

export interface BackupFile {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: Record<BackupTable, BackupRow[]>
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Validate a backup file's text. Throws an Error with a user-facing message. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error("This file isn't a valid backup (it isn't JSON).")
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new Error("This doesn't look like a VFit backup file.")
  if (typeof raw.version !== 'number' || raw.version < 1) throw new Error('This backup file is damaged.')
  if (raw.version > BACKUP_VERSION) {
    throw new Error('This backup comes from a newer version of the app. Update the app, then try again.')
  }
  if (!isObj(raw.data)) throw new Error('This backup file has no data in it.')

  const data = {} as BackupFile['data']
  for (const table of BACKUP_TABLES) {
    const rows = raw.data[table] ?? []
    const key = table === 'meta' ? 'key' : 'id'
    if (!Array.isArray(rows) || !rows.every((r) => isObj(r) && typeof r[key] === 'string')) {
      throw new Error(`The "${table}" part of this backup is damaged.`)
    }
    data[table] = rows as BackupRow[]
  }
  // Version 4 kept skipped meals in their own list: fold them into day checks.
  const skips = Array.isArray(raw.data.mealSkips) ? (raw.data.mealSkips as unknown[]) : []
  for (const s of skips) {
    if (!isObj(s) || typeof s.date !== 'string' || typeof s.meal !== 'string') continue
    let c = data.dayChecks.find((d) => d.id === s.date)
    if (!c) {
      c = { id: s.date, date: s.date, meals: {}, updatedAt: Date.now() }
      data.dayChecks.push(c)
    }
    ;(c.meals as Record<string, string>)[s.meal] = 'skipped'
  }
  // Re-derive the indexed exercise list so a hand-edited file can't break lookups.
  data.workouts = data.workouts.map((w) => {
    const exercises = Array.isArray(w.exercises) ? (w.exercises as BackupRow[]) : []
    return { ...w, exercises, exerciseIds: [...new Set(exercises.map((e) => String(e.exerciseId)))] }
  })
  return {
    app: BACKUP_APP,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    data,
  }
}

export function backupSummary(b: BackupFile): string {
  const d = b.data
  const parts: { n: number; one: string; many: string }[] = [
    { n: d.workouts.length, one: 'workout', many: 'workouts' },
    { n: d.cardio.length, one: 'cardio session', many: 'cardio sessions' },
    { n: d.body.length, one: 'body entry', many: 'body entries' },
    { n: d.foods.length, one: 'food entry', many: 'food entries' },
    { n: d.supplements.length, one: 'supplement', many: 'supplements' },
    { n: d.phases.length, one: 'phase', many: 'phases' },
  ]
  return parts
    .filter((p, i) => i < 4 || p.n > 0)
    .map(({ n, one, many }) => `${n} ${n === 1 ? one : many}`)
    .join(', ')
}

export function backupFileName(d = new Date()): string {
  return `vfit-backup-${toDateStr(d)}.json`
}
