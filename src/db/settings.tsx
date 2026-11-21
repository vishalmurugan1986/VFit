import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { todayStr } from '../lib/dates'
import { DEFAULT_MEAL_TIMES, isClock } from '../lib/meals'
import { DEFAULT_SESSIONS } from '../lib/schedule'
import { DEFAULT_TARGETS, phaseOn, phaseSpans, phaseStatus, sortPhases, type PhaseSpan } from '../lib/phases'
import { db } from './db'
import type { AlarmKind, BackupReminder, MealDef, Nutrients, Phase, Settings, Theme } from './types'

/** Alarms "Send all alarms" includes at first. The wake-up alarm already covers the morning gym. */
export const DEFAULT_ALARMS: Record<AlarmKind, boolean> = {
  wake: true,
  gymMorning: false,
  gymEvening: true,
  meals: true,
  bed: true,
}

/** Ids match the old Breakfast / Lunch / Dinner / Snacks, so food logged before keeps its place. */
export const DEFAULT_MEALS: MealDef[] = [
  { id: 'breakfast', name: 'Meal 1', time: DEFAULT_MEAL_TIMES[0] },
  { id: 'lunch', name: 'Meal 2', time: DEFAULT_MEAL_TIMES[1] },
  { id: 'dinner', name: 'Meal 3', time: DEFAULT_MEAL_TIMES[2] },
  { id: 'snack', name: 'Meal 4', time: DEFAULT_MEAL_TIMES[3] },
]

export function defaultSettings(): Settings {
  const lang = typeof navigator === 'undefined' ? 'en' : navigator.language
  return {
    weightUnit: 'kg',
    distanceUnit: 'km',
    lengthUnit: 'cm',
    age: null,
    restSeconds: 90,
    autoRest: true,
    weekStartsOn: /^en-US\b/i.test(lang) ? 0 : 1,
    theme: 'dark',
    wakeTime: null,
    bedTime: '22:30',
    sessions: DEFAULT_SESSIONS,
    alarms: DEFAULT_ALARMS,
    meals: DEFAULT_MEALS,
    backupReminderDays: 7,
  }
}

const REMINDERS: BackupReminder[] = [7, 14, 30]

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get('settings')
  const stored = (row?.value as (Partial<Settings> & { birthYear?: number | null }) | undefined) ?? {}
  const merged = { ...defaultSettings(), ...stored }
  const age = merged.age ?? (stored.birthYear ? new Date().getFullYear() - stored.birthYear : null)
  const storedMeals = Array.isArray(merged.meals) && merged.meals.length ? merged.meals : DEFAULT_MEALS
  // Meals saved before meal times existed get the usual times; a time you cleared stays cleared.
  const meals = storedMeals.map((m, i) => ({
    ...m,
    time: isClock(m.time) ? m.time : m.time === undefined ? (DEFAULT_MEAL_TIMES[i] ?? null) : null,
  }))
  const sessions = {
    morning: isClock(merged.sessions?.morning) ? merged.sessions.morning : DEFAULT_SESSIONS.morning,
    evening: isClock(merged.sessions?.evening) ? merged.sessions.evening : DEFAULT_SESSIONS.evening,
  }
  const bedTime = isClock(merged.bedTime) ? merged.bedTime : '22:30'
  const alarms = { ...DEFAULT_ALARMS, ...(merged.alarms ?? {}) }
  // Settings from the meal-reminder version: drop the fields it no longer uses.
  const { mealLead: _lead, mealNotify: _notify, ...rest } = merged as Settings & { mealLead?: unknown; mealNotify?: unknown }
  // Metric everywhere: older installs may have saved lb / mi / in.
  const backupReminderDays = REMINDERS.includes(merged.backupReminderDays) ? merged.backupReminderDays : 7
  // VFit's look is dark (Apple Fitness). A theme saved before that counts only if you chose it yourself.
  const theme = merged.themeChosen ? merged.theme : 'dark'
  return {
    ...rest,
    theme,
    age,
    meals,
    sessions,
    bedTime,
    alarms,
    backupReminderDays,
    weightUnit: 'kg',
    distanceUnit: 'km',
    lengthUnit: 'cm',
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.meta, async () => {
    const current = await getSettings()
    await db.meta.put({ key: 'settings', value: { ...current, ...patch } })
  })
}

const SettingsContext = createContext<Settings | null>(null)
const PhasesContext = createContext<Phase[] | null>(null)

/** Loads settings and phases once (a few ms) before rendering, so nothing flashes the wrong way. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(getSettings, [])
  const phases = useLiveQuery(() => db.phases.orderBy('startDate').toArray(), [])
  const [slow, setSlow] = useState(false)
  useTheme(settings?.theme)
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 4000)
    return () => window.clearTimeout(t)
  }, [])
  if (!settings || !phases) return slow ? <StorageWait /> : null
  return (
    <SettingsContext.Provider value={settings}>
      <PhasesContext.Provider value={phases}>{children}</PhasesContext.Provider>
    </SettingsContext.Provider>
  )
}

/** Shown when the database can't open, usually because an older copy of the app is still open elsewhere. */
function StorageWait() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-title2 font-semibold">Finishing an update…</h1>
      <p className="text-footnote text-ink-2">
        If this doesn't clear, close VFit everywhere else it's open (other browser tabs or the Home Screen app),
        then tap Reload.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="h-11 rounded-xl bg-accent px-5 font-semibold text-on-accent"
      >
        Reload
      </button>
    </div>
  )
}

export function useSettings(): Settings {
  const s = useContext(SettingsContext)
  if (!s) throw new Error('useSettings must be used inside <SettingsProvider>')
  return s
}

export interface PhasePlan {
  /** oldest first */
  list: Phase[]
  spans: PhaseSpan[]
  /** the phase in force today (null only if the table is empty) */
  current: Phase | null
  currentSpan: PhaseSpan | null
  /** phases you've planned that haven't started yet, soonest first */
  upcoming: Phase[]
  /** the phase in force on a given day */
  on: (date: string) => Phase | null
  /** daily targets in force on a given day (today by default) */
  targetsOn: (date?: string) => Nutrients
}

/** Your phases (Maingain → Cut → …): which one is current, what's next, and targets for any day. */
export function usePhases(): PhasePlan {
  const raw = useContext(PhasesContext)
  if (!raw) throw new Error('usePhases must be used inside <SettingsProvider>')
  const today = todayStr()
  return useMemo(() => {
    const list = sortPhases(raw)
    const spans = phaseSpans(list)
    const on = (date: string) => phaseOn(list, date)
    const currentSpan = spans.find((s) => phaseStatus(s, today) === 'current') ?? spans[0] ?? null
    return {
      list,
      spans,
      current: currentSpan?.phase ?? null,
      currentSpan,
      upcoming: list.filter((p) => p.startDate > today),
      on,
      targetsOn: (date = today) => on(date)?.targets ?? DEFAULT_TARGETS,
    }
  }, [raw, today])
}

function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    if (!theme) return
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage blocked: theme still applies for this session */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#f2f2f7')
    }
    apply()
    if (theme !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
