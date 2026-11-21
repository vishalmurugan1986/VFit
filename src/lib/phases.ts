import type { Goal, LegacyGoalSettings, Nutrients, Phase } from '../db/types'
import { addDays, diffDays, type DateStr } from './dates'

export const GOALS: { key: Goal; label: string; hint: string }[] = [
  { key: 'bulk', label: 'Bulk', hint: 'Gaining weight to build muscle.' },
  { key: 'maingain', label: 'Maingain', hint: 'Maintaining weight while gaining muscle.' },
  { key: 'cut', label: 'Cut', hint: 'Losing fat while keeping muscle.' },
]

export const GOAL_COLOR: Record<Goal, string> = { bulk: 'var(--bulk)', maingain: 'var(--maingain)', cut: 'var(--cut)' }

export const goalLabel = (g: Goal) => GOALS.find((x) => x.key === g)?.label ?? 'Maingain'

/** What usually comes after each goal; only a suggestion for the "next phase" form. */
export const NEXT_GOAL: Record<Goal, Goal> = { bulk: 'cut', maingain: 'cut', cut: 'maingain' }

export const DEFAULT_TARGETS: Nutrients = { calories: 2000, protein: 150, carbs: 200, fat: 65 }

const OLD_GOALS: Record<string, Goal> = { lose: 'cut', maintain: 'maingain', gain: 'bulk' }

export function toGoal(v: unknown): Goal {
  if (v === 'bulk' || v === 'maingain' || v === 'cut') return v
  return (typeof v === 'string' && OLD_GOALS[v]) || 'maingain'
}

/** The first phase for an install that kept its goal and targets in settings (or a fresh one). */
export function phaseFromLegacy(old: LegacyGoalSettings, startDate: DateStr, id: string, now = Date.now()): Phase {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback)
  return {
    id,
    goal: toGoal(old.goal),
    startDate,
    targetWeightKg: typeof old.goalWeightKg === 'number' && old.goalWeightKg > 0 ? old.goalWeightKg : null,
    targets: {
      calories: num(old.calorieTarget, DEFAULT_TARGETS.calories) || DEFAULT_TARGETS.calories,
      protein: num(old.proteinTarget, DEFAULT_TARGETS.protein),
      carbs: num(old.carbsTarget, DEFAULT_TARGETS.carbs),
      fat: num(old.fatTarget, DEFAULT_TARGETS.fat),
    },
    createdAt: now,
  }
}

export const sortPhases = (list: Phase[]) => [...list].sort((a, b) => a.startDate.localeCompare(b.startDate))

/**
 * The phase in force on `date`: the latest one that has started by then. Days before your
 * first phase use the first phase, so older logs still have targets to compare against.
 */
export function phaseOn(sorted: Phase[], date: DateStr): Phase | null {
  let found: Phase | null = null
  for (const p of sorted) {
    if (p.startDate <= date) found = p
    else break
  }
  return found ?? sorted[0] ?? null
}

export interface PhaseSpan {
  phase: Phase
  start: DateStr
  /** last day (inclusive): the day before the next phase starts; null while open-ended */
  end: DateStr | null
}

export function phaseSpans(sorted: Phase[]): PhaseSpan[] {
  return sorted.map((phase, i) => {
    const next = sorted[i + 1]
    return { phase, start: phase.startDate, end: next ? addDays(next.startDate, -1) : null }
  })
}

export type PhaseStatus = 'past' | 'current' | 'upcoming'

export function phaseStatus(span: PhaseSpan, today: DateStr): PhaseStatus {
  if (span.start > today) return 'upcoming'
  if (span.end != null && span.end < today) return 'past'
  return 'current'
}

/** 1-based week of the phase that `date` falls in. */
export const phaseWeek = (start: DateStr, date: DateStr) => Math.floor(diffDays(date, start) / 7) + 1

/** "Week 6", "Starts in 3 weeks", "Starts tomorrow"… A phase runs until the next one starts. */
export function phaseProgressLabel(p: Phase, today: DateStr): string {
  if (p.startDate > today) {
    const days = diffDays(p.startDate, today)
    if (days === 1) return 'Starts tomorrow'
    if (days < 14) return `Starts in ${days} days`
    return `Starts in ${Math.round(days / 7)} weeks`
  }
  return `Week ${phaseWeek(p.startDate, today)}`
}

/* ───────── Phase results ───────── */

export interface PhaseInputs {
  /** weigh-ins, oldest first */
  weights: { date: DateStr; kg: number }[]
  /** calories logged per day */
  kcalByDay: Map<DateStr, number>
  /** one entry per finished workout */
  workoutDates: DateStr[]
  cardio: { date: DateStr; km: number; sec: number }[]
}

export interface PhaseStats {
  days: number
  weeks: number
  startWeight: number | null
  endWeight: number | null
  /** kg, end − start */
  change: number | null
  /** kg per week */
  perWeek: number | null
  avgKcal: number | null
  loggedDays: number
  /** days within ±10% of that phase's calorie target */
  onTargetDays: number
  workouts: number
  workoutsPerWeek: number
  cardioKm: number
  cardioSec: number
}

/** Results for one phase, counting up to its last day (or today, for the current phase). */
export function phaseStats(span: PhaseSpan, data: PhaseInputs, today: DateStr): PhaseStats {
  const from = span.start
  const to = span.end != null && span.end < today ? span.end : today
  const inside = (d: DateStr) => d >= from && d <= to
  const days = to < from ? 0 : diffDays(to, from) + 1
  const weeks = days / 7

  // Start: the last weigh-in on or before day one (within a fortnight), else the first one inside.
  const before = [...data.weights].reverse().find((w) => w.date <= from && diffDays(from, w.date) <= 14)
  const within = data.weights.filter((w) => inside(w.date))
  const startW = before ?? within[0] ?? null
  const endW = within[within.length - 1] ?? null
  const change = startW && endW && endW.date > startW.date ? endW.kg - startW.kg : null
  const spanDays = startW && endW ? diffDays(endW.date, startW.date) : 0
  const perWeek = change != null && spanDays >= 7 ? (change / spanDays) * 7 : null

  let kcal = 0
  let loggedDays = 0
  let onTargetDays = 0
  const target = span.phase.targets.calories
  for (const [d, v] of data.kcalByDay) {
    if (!inside(d) || v <= 0) continue
    kcal += v
    loggedDays++
    if (target > 0 && Math.abs(v - target) <= target * 0.1) onTargetDays++
  }

  const workouts = data.workoutDates.filter(inside).length
  const cardio = data.cardio.filter((c) => inside(c.date))
  return {
    days,
    weeks,
    startWeight: startW?.kg ?? null,
    endWeight: endW?.kg ?? null,
    change,
    perWeek,
    avgKcal: loggedDays ? kcal / loggedDays : null,
    loggedDays,
    onTargetDays,
    workouts,
    workoutsPerWeek: weeks >= 1 ? workouts / weeks : workouts,
    cardioKm: cardio.reduce((s, c) => s + c.km, 0),
    cardioSec: cardio.reduce((s, c) => s + c.sec, 0),
  }
}
